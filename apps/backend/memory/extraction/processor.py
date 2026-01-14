"""
Transcript Processor
====================

Processes Claude Code session transcripts (JSONL format) to extract insights.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from .extractor import ExtractedInsight, InsightExtractor

logger = logging.getLogger(__name__)


@dataclass
class TranscriptMessage:
    """A single message from a transcript."""

    role: str  # user, assistant, system
    content: str
    timestamp: str | None = None
    thinking: str | None = None
    tool_use: list[dict[str, Any]] = field(default_factory=list)
    tool_results: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_jsonl_entry(cls, entry: dict[str, Any]) -> TranscriptMessage | None:
        """Parse a JSONL entry into a TranscriptMessage.

        Handles Claude Code transcript format where role/content are nested
        inside a 'message' field.
        """
        try:
            # Claude Code transcripts nest role/content inside 'message'
            message_obj = entry.get("message", entry)

            role = message_obj.get("role", "")
            content = ""
            thinking = None
            tool_use = []
            tool_results = []

            # Handle different content formats
            raw_content = message_obj.get("content", "")
            if isinstance(raw_content, str):
                content = raw_content
            elif isinstance(raw_content, list):
                # Content blocks
                for block in raw_content:
                    if isinstance(block, dict):
                        block_type = block.get("type", "")
                        if block_type == "text":
                            content += block.get("text", "") + "\n"
                        elif block_type == "thinking":
                            thinking = block.get("thinking", "")
                        elif block_type == "tool_use":
                            tool_use.append(block)
                        elif block_type == "tool_result":
                            tool_results.append(block)

            if not role:
                return None

            return cls(
                role=role,
                content=content.strip(),
                timestamp=entry.get("timestamp"),
                thinking=thinking,
                tool_use=tool_use,
                tool_results=tool_results,
            )
        except Exception as e:
            logger.debug(f"Failed to parse transcript entry: {e}")
            return None


@dataclass
class ProcessedTranscript:
    """A processed transcript with extracted insights."""

    transcript_path: str
    session_id: str
    message_count: int
    insights: list[ExtractedInsight]
    processed_at: str
    stats: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "transcript_path": self.transcript_path,
            "session_id": self.session_id,
            "message_count": self.message_count,
            "insights": [i.to_dict() for i in self.insights],
            "processed_at": self.processed_at,
            "stats": self.stats,
        }


class TranscriptProcessor:
    """
    Processes Claude Code session transcripts to extract insights.

    Reads JSONL transcript files and extracts:
    - Patterns from thinking blocks
    - Gotchas from error handling
    - Discoveries from tool results
    - Recommendations from assistant responses
    """

    def __init__(
        self,
        extractor: InsightExtractor | None = None,
        min_content_length: int = 50,
    ):
        self.extractor = extractor or InsightExtractor()
        self.min_content_length = min_content_length

    def process_transcript(
        self,
        transcript_path: Path | str,
        session_id: str | None = None,
    ) -> ProcessedTranscript:
        """
        Process a transcript file and extract insights.

        Args:
            transcript_path: Path to JSONL transcript file
            session_id: Optional session ID (derived from path if not provided)

        Returns:
            ProcessedTranscript with extracted insights
        """
        transcript_path = Path(transcript_path)

        if session_id is None:
            session_id = transcript_path.stem

        all_insights: list[ExtractedInsight] = []
        message_count = 0
        thinking_count = 0
        tool_count = 0

        # Process each message
        for message in self._read_messages(transcript_path):
            message_count += 1

            # Extract from thinking blocks (highest value)
            if message.thinking and len(message.thinking) >= self.min_content_length:
                thinking_count += 1
                insights = self.extractor.extract_from_thinking_block(
                    message.thinking,
                    source_file=str(transcript_path),
                    session_id=session_id,
                )
                all_insights.extend(insights)

            # Extract from regular content
            if message.content and len(message.content) >= self.min_content_length:
                if message.role == "assistant":
                    insights = self.extractor.extract_from_text(
                        message.content,
                        source_file=str(transcript_path),
                        session_id=session_id,
                    )
                    all_insights.extend(insights)

            # Extract from tool results
            for tool_result in message.tool_results:
                tool_count += 1
                tool_content = tool_result.get("content", "")
                if isinstance(tool_content, str) and len(tool_content) >= 100:
                    # Check for errors or interesting patterns
                    if any(
                        kw in tool_content.lower()
                        for kw in ["error", "warning", "failed", "success"]
                    ):
                        insights = self.extractor.extract_from_tool_result(
                            tool_name=tool_result.get("tool_use_id", "unknown"),
                            tool_input={},
                            tool_output=tool_content[:1000],
                            session_id=session_id,
                        )
                        all_insights.extend(insights)

        return ProcessedTranscript(
            transcript_path=str(transcript_path),
            session_id=session_id,
            message_count=message_count,
            insights=all_insights,
            processed_at=datetime.now().isoformat(),
            stats={
                "thinking_blocks": thinking_count,
                "tool_results": tool_count,
                "insights_extracted": len(all_insights),
            },
        )

    def process_directory(
        self,
        directory: Path | str,
        pattern: str = "*.jsonl",
    ) -> list[ProcessedTranscript]:
        """
        Process all transcript files in a directory.

        Args:
            directory: Directory containing transcripts
            pattern: Glob pattern for transcript files

        Returns:
            List of processed transcripts
        """
        directory = Path(directory)
        results = []

        for transcript_file in directory.glob(pattern):
            try:
                result = self.process_transcript(transcript_file)
                results.append(result)
                logger.info(
                    f"Processed {transcript_file.name}: "
                    f"{len(result.insights)} insights from {result.message_count} messages"
                )
            except Exception as e:
                logger.warning(f"Failed to process {transcript_file}: {e}")

        return results

    def _read_messages(self, transcript_path: Path) -> Iterator[TranscriptMessage]:
        """Read messages from a JSONL transcript file."""
        try:
            with open(transcript_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        entry = json.loads(line)
                        message = TranscriptMessage.from_jsonl_entry(entry)
                        if message:
                            yield message
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.warning(f"Error reading transcript {transcript_path}: {e}")

    def get_insight_summary(
        self,
        insights: list[ExtractedInsight],
    ) -> dict[str, Any]:
        """
        Generate a summary of extracted insights.
        """
        by_type: dict[str, list[ExtractedInsight]] = {}
        for insight in insights:
            if insight.insight_type not in by_type:
                by_type[insight.insight_type] = []
            by_type[insight.insight_type].append(insight)

        return {
            "total": len(insights),
            "by_type": {k: len(v) for k, v in by_type.items()},
            "high_confidence": len([i for i in insights if i.confidence >= 0.7]),
            "with_files": len([i for i in insights if i.related_files]),
        }
