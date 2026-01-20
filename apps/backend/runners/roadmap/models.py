"""
Data models for roadmap generation.
"""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class RoadmapPhaseResult:
    """Result of a roadmap phase execution."""

    phase: str
    success: bool
    output_files: list[str]
    errors: list[str]
    retries: int


@dataclass
class PhaseCheckpoint:
    """Checkpoint for a completed roadmap phase."""

    phase: str
    success: bool
    completed_at: str  # ISO format timestamp
    output_files: list[str] = field(default_factory=list)


@dataclass
class RoadmapCheckpoint:
    """Checkpoint state for roadmap generation, enabling resume after interruption.

    This checkpoint tracks which phases have completed successfully, allowing
    the roadmap generator to resume from where it left off if the process is
    interrupted (e.g., due to rate limits or token exhaustion).
    """

    version: int = 1  # Checkpoint format version for future compatibility
    started_at: str = ""  # ISO format timestamp
    last_updated: str = ""  # ISO format timestamp
    completed_phases: list[PhaseCheckpoint] = field(default_factory=list)
    model: str = ""  # Model used for generation
    thinking_level: str = ""  # Thinking level used

    def __post_init__(self):
        if not self.started_at:
            self.started_at = datetime.now().isoformat()
        if not self.last_updated:
            self.last_updated = self.started_at

    def is_phase_complete(self, phase_name: str) -> bool:
        """Check if a phase has been completed successfully."""
        return any(
            p.phase == phase_name and p.success for p in self.completed_phases
        )

    def mark_phase_complete(self, result: "RoadmapPhaseResult") -> None:
        """Mark a phase as complete and update checkpoint."""
        checkpoint = PhaseCheckpoint(
            phase=result.phase,
            success=result.success,
            completed_at=datetime.now().isoformat(),
            output_files=result.output_files,
        )
        # Remove any existing checkpoint for this phase (in case of retry)
        self.completed_phases = [
            p for p in self.completed_phases if p.phase != result.phase
        ]
        self.completed_phases.append(checkpoint)
        self.last_updated = datetime.now().isoformat()

    def get_completed_phase_names(self) -> list[str]:
        """Get list of successfully completed phase names."""
        return [p.phase for p in self.completed_phases if p.success]


@dataclass
class RoadmapConfig:
    """Configuration for roadmap generation."""

    project_dir: Path
    output_dir: Path
    model: str = "sonnet"  # Changed from "opus" (fix #433)
    refresh: bool = False  # Force regeneration even if roadmap exists
    enable_competitor_analysis: bool = False  # Enable competitor analysis phase
