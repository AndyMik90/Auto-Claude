"""
Data models for task logging.
"""

from dataclasses import asdict, dataclass
from enum import Enum


class LogPhase(str, Enum):
    """Log phases matching the execution flow."""

    PLANNING = "planning"
    CODING = "coding"
    VALIDATION = "validation"


class LogEntryType(str, Enum):
    """Types of log entries."""

    TEXT = "text"
    TOOL_START = "tool_start"
    TOOL_END = "tool_end"
    PHASE_START = "phase_start"
    PHASE_END = "phase_end"
    ERROR = "error"
    SUCCESS = "success"
    INFO = "info"


@dataclass
class LogEntry:
    """A single log entry."""

    timestamp: str
    type: str
    content: str
    phase: str
    tool_name: str | None = None
    tool_input: str | None = None
    subtask_id: str | None = None
    session: int | None = None
    # New fields for expandable detail view
    detail: str | None = (
        None  # Full content that can be expanded (e.g., file contents, command output)
    )
    subphase: str | None = (
        None  # Subphase grouping (e.g., "PROJECT DISCOVERY", "CONTEXT GATHERING")
    )
    collapsed: bool | None = None  # Whether to show collapsed by default in UI
    # Provider/model tracking for iFlow integration
    provider: str | None = None  # 'claude' or 'iflow'
    model: str | None = None  # Model ID (e.g., 'claude-sonnet-4-5', 'deepseek-v3')

    def to_dict(self) -> dict:
        """Convert to dictionary, excluding None values."""
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class PhaseLog:
    """Logs for a single phase."""

    phase: str
    status: str  # "pending", "active", "completed", "failed"
    started_at: str | None = None
    completed_at: str | None = None
    entries: list = None
    # Provider/model tracking for iFlow integration
    provider: str | None = None  # 'claude' or 'iflow'
    model: str | None = None  # Model ID (e.g., 'claude-sonnet-4-5', 'deepseek-v3')
    thinking_level: str | None = None  # For Claude: 'none', 'medium', 'high', 'ultrathink'

    def __post_init__(self):
        if self.entries is None:
            self.entries = []

    def to_dict(self) -> dict:
        result = {
            "phase": self.phase,
            "status": self.status,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "entries": self.entries,
        }
        # Include provider/model/thinking_level if set
        if self.provider:
            result["provider"] = self.provider
        if self.model:
            result["model"] = self.model
        if self.thinking_level:
            result["thinking_level"] = self.thinking_level
        return result
