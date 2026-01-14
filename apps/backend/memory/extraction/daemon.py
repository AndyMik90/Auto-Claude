"""
Memory Extraction Daemon
========================

Background service that monitors sessions and extracts insights automatically.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .extractor import ExtractedInsight, InsightExtractor
from .processor import ProcessedTranscript, TranscriptProcessor

logger = logging.getLogger(__name__)


@dataclass
class DaemonConfig:
    """Configuration for the memory extraction daemon."""

    # Directories to monitor
    transcript_dirs: list[Path] = field(default_factory=list)

    # How often to check for new transcripts (seconds)
    poll_interval: float = 60.0

    # Session idle time before extraction (seconds)
    idle_threshold: float = 300.0  # 5 minutes

    # Minimum transcript age before processing (seconds)
    min_age: float = 60.0

    # Maximum insights to store per session
    max_insights_per_session: int = 100

    # Output directory for extracted insights
    output_dir: Path | None = None

    # Whether to store to Graphiti
    use_graphiti: bool = True

    # Whether to store to file-based system
    use_file_storage: bool = True

    @classmethod
    def from_env(cls) -> DaemonConfig:
        """Create config from environment variables."""
        transcript_dirs = []

        # Default Claude Code transcript locations
        claude_dir = Path.home() / ".claude" / "projects"
        if claude_dir.exists():
            transcript_dirs.append(claude_dir)

        # Auto-Claude specific paths
        auto_claude_dir = Path.home() / ".auto-claude" / "sessions"
        if auto_claude_dir.exists():
            transcript_dirs.append(auto_claude_dir)

        # Custom path from environment
        custom_path = os.environ.get("MEMORY_TRANSCRIPT_DIR")
        if custom_path:
            transcript_dirs.append(Path(custom_path))

        return cls(
            transcript_dirs=transcript_dirs,
            poll_interval=float(os.environ.get("MEMORY_POLL_INTERVAL", "60")),
            idle_threshold=float(os.environ.get("MEMORY_IDLE_THRESHOLD", "300")),
            use_graphiti=os.environ.get("GRAPHITI_ENABLED", "").lower() == "true",
            output_dir=Path(
                os.environ.get("MEMORY_OUTPUT_DIR", str(Path.home() / ".auto-claude" / "extracted-insights"))
            ),
        )


@dataclass
class ProcessingState:
    """Tracks which transcripts have been processed."""

    processed_files: dict[str, str] = field(default_factory=dict)  # path -> last_modified
    last_check: float = 0.0

    def is_processed(self, path: Path) -> bool:
        """Check if a file has been processed at its current state."""
        key = str(path)
        if key not in self.processed_files:
            return False

        try:
            current_mtime = str(path.stat().st_mtime)
            return self.processed_files[key] == current_mtime
        except OSError:
            return True  # File doesn't exist, consider processed

    def mark_processed(self, path: Path) -> None:
        """Mark a file as processed."""
        try:
            self.processed_files[str(path)] = str(path.stat().st_mtime)
        except OSError:
            pass

    def save(self, state_file: Path) -> None:
        """Save state to disk."""
        state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(state_file, "w") as f:
            json.dump(
                {
                    "processed_files": self.processed_files,
                    "last_check": self.last_check,
                },
                f,
            )

    @classmethod
    def load(cls, state_file: Path) -> ProcessingState:
        """Load state from disk."""
        if not state_file.exists():
            return cls()

        try:
            with open(state_file) as f:
                data = json.load(f)
            return cls(
                processed_files=data.get("processed_files", {}),
                last_check=data.get("last_check", 0.0),
            )
        except (json.JSONDecodeError, OSError):
            return cls()


class MemoryExtractionDaemon:
    """
    Background daemon for extracting insights from session transcripts.

    Features:
    - Monitors transcript directories for new/updated files
    - Extracts insights using pattern matching
    - Stores to Graphiti and/or file-based storage
    - Tracks processing state to avoid reprocessing
    """

    def __init__(
        self,
        config: DaemonConfig | None = None,
        processor: TranscriptProcessor | None = None,
    ):
        self.config = config or DaemonConfig.from_env()
        self.processor = processor or TranscriptProcessor()

        # Processing state - store in parent of output_dir to avoid confusion with insight files
        base_dir = self.config.output_dir.parent if self.config.output_dir else Path.home() / ".auto-claude"
        self.state_file = base_dir / "extraction_state.json"
        self.state = ProcessingState.load(self.state_file)

        # Callbacks
        self._on_insight_extracted: list[Callable[[ExtractedInsight], None]] = []
        self._on_transcript_processed: list[Callable[[ProcessedTranscript], None]] = []

        # Running state
        self._running = False
        self._task: asyncio.Task | None = None

    def on_insight_extracted(
        self, callback: Callable[[ExtractedInsight], None]
    ) -> None:
        """Register callback for when an insight is extracted."""
        self._on_insight_extracted.append(callback)

    def on_transcript_processed(
        self, callback: Callable[[ProcessedTranscript], None]
    ) -> None:
        """Register callback for when a transcript is processed."""
        self._on_transcript_processed.append(callback)

    def find_transcripts(self) -> list[Path]:
        """Find all transcript files to process."""
        transcripts = []
        current_time = time.time()

        for directory in self.config.transcript_dirs:
            if not directory.exists():
                continue

            # Find JSONL files
            for transcript in directory.rglob("*.jsonl"):
                try:
                    stat = transcript.stat()
                    age = current_time - stat.st_mtime

                    # Skip if too new (still being written)
                    if age < self.config.min_age:
                        continue

                    # Skip if already processed at this state
                    if self.state.is_processed(transcript):
                        continue

                    transcripts.append(transcript)
                except OSError:
                    continue

        return transcripts

    def process_transcript(self, transcript_path: Path) -> ProcessedTranscript | None:
        """Process a single transcript file."""
        try:
            result = self.processor.process_transcript(transcript_path)

            # Trigger callbacks
            for callback in self._on_transcript_processed:
                try:
                    callback(result)
                except Exception as e:
                    logger.warning(f"Callback error: {e}")

            for insight in result.insights:
                for callback in self._on_insight_extracted:
                    try:
                        callback(insight)
                    except Exception as e:
                        logger.warning(f"Insight callback error: {e}")

            # Mark as processed
            self.state.mark_processed(transcript_path)

            return result

        except Exception as e:
            logger.error(f"Error processing {transcript_path}: {e}")
            return None

    def store_insights(self, insights: list[ExtractedInsight], session_id: str) -> None:
        """Store extracted insights to configured backends."""
        if not insights:
            return

        # File-based storage
        if self.config.use_file_storage and self.config.output_dir:
            self._store_to_files(insights, session_id)

        # Graphiti storage
        if self.config.use_graphiti:
            self._store_to_graphiti(insights, session_id)

    def _store_to_files(
        self, insights: list[ExtractedInsight], session_id: str
    ) -> None:
        """Store insights to JSON files."""
        if not self.config.output_dir:
            return

        output_dir = self.config.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        # Store by session
        session_file = output_dir / f"{session_id}.json"

        # Load existing insights if any
        existing = []
        if session_file.exists():
            try:
                with open(session_file) as f:
                    existing = json.load(f)
            except (json.JSONDecodeError, OSError):
                pass

        # Merge new insights (deduplicate by ID)
        existing_ids = {i.get("insight_id") for i in existing}
        for insight in insights:
            if insight.insight_id not in existing_ids:
                existing.append(insight.to_dict())

        # Limit to max insights
        existing = existing[-self.config.max_insights_per_session:]

        # Save
        with open(session_file, "w") as f:
            json.dump(existing, f, indent=2)

        logger.info(f"Stored {len(insights)} insights to {session_file}")

    def _store_to_graphiti(
        self, insights: list[ExtractedInsight], session_id: str
    ) -> None:
        """Store insights to Graphiti memory system."""
        try:
            from integrations.graphiti.memory import get_graphiti_memory, is_graphiti_enabled

            if not is_graphiti_enabled():
                return

            # Would need spec_dir and project_dir - skip for now
            # This would be enhanced in Phase 7.2
            logger.debug(f"Graphiti storage skipped - needs spec context")

        except ImportError:
            logger.debug("Graphiti not available")

    def run_once(self) -> dict[str, Any]:
        """
        Run a single extraction pass.

        Returns:
            Stats about the extraction run
        """
        transcripts = self.find_transcripts()
        total_insights = 0
        processed_count = 0

        for transcript in transcripts:
            result = self.process_transcript(transcript)
            if result:
                processed_count += 1
                total_insights += len(result.insights)
                self.store_insights(result.insights, result.session_id)

        # Save state
        self.state.last_check = time.time()
        self.state.save(self.state_file)

        return {
            "transcripts_found": len(transcripts),
            "transcripts_processed": processed_count,
            "insights_extracted": total_insights,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def run_async(self) -> None:
        """Run the daemon in async mode."""
        self._running = True
        logger.info(
            f"Memory extraction daemon started (poll interval: {self.config.poll_interval}s)"
        )

        while self._running:
            try:
                stats = self.run_once()
                if stats["transcripts_processed"] > 0:
                    logger.info(
                        f"Extraction pass complete: {stats['insights_extracted']} insights "
                        f"from {stats['transcripts_processed']} transcripts"
                    )
            except Exception as e:
                logger.error(f"Extraction error: {e}")

            await asyncio.sleep(self.config.poll_interval)

    def start(self) -> None:
        """Start the daemon in the background."""
        if self._task is not None:
            return

        loop = asyncio.get_event_loop()
        self._task = loop.create_task(self.run_async())
        logger.info("Memory extraction daemon started")

    def stop(self) -> None:
        """Stop the daemon."""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Memory extraction daemon stopped")

    def get_stats(self) -> dict[str, Any]:
        """Get daemon statistics."""
        return {
            "running": self._running,
            "config": {
                "transcript_dirs": [str(d) for d in self.config.transcript_dirs],
                "poll_interval": self.config.poll_interval,
                "idle_threshold": self.config.idle_threshold,
                "use_graphiti": self.config.use_graphiti,
                "use_file_storage": self.config.use_file_storage,
            },
            "state": {
                "processed_files": len(self.state.processed_files),
                "last_check": datetime.fromtimestamp(self.state.last_check).isoformat()
                if self.state.last_check
                else None,
            },
        }
