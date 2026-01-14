"""
Insight Extractor
=================

Extracts structured insights from session content using pattern matching
and optional LLM enhancement.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .patterns import MatchedPattern, PatternMatcher, PatternType

logger = logging.getLogger(__name__)


@dataclass
class ExtractedInsight:
    """A structured insight extracted from session content."""

    # Core content
    insight_type: str  # gotcha, pattern, discovery, etc.
    title: str  # Short summary
    content: str  # Full insight text
    confidence: float  # 0.0 to 1.0

    # Source information
    source_file: str | None = None
    source_line: int | None = None
    session_id: str | None = None

    # Metadata
    tags: list[str] = field(default_factory=list)
    related_files: list[str] = field(default_factory=list)
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Unique ID based on content
    insight_id: str = field(default="")

    def __post_init__(self):
        if not self.insight_id:
            # Generate deterministic ID from content
            content_hash = hashlib.sha256(
                f"{self.insight_type}:{self.content}".encode()
            ).hexdigest()[:12]
            self.insight_id = f"insight_{content_hash}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "insight_id": self.insight_id,
            "insight_type": self.insight_type,
            "title": self.title,
            "content": self.content,
            "confidence": self.confidence,
            "source_file": self.source_file,
            "source_line": self.source_line,
            "session_id": self.session_id,
            "tags": self.tags,
            "related_files": self.related_files,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ExtractedInsight:
        return cls(
            insight_id=data.get("insight_id", ""),
            insight_type=data["insight_type"],
            title=data["title"],
            content=data["content"],
            confidence=data.get("confidence", 0.5),
            source_file=data.get("source_file"),
            source_line=data.get("source_line"),
            session_id=data.get("session_id"),
            tags=data.get("tags", []),
            related_files=data.get("related_files", []),
            timestamp=data.get("timestamp", ""),
        )


class InsightExtractor:
    """
    Extracts insights from text content using pattern matching.

    Optionally uses LLM for enhanced extraction and summarization.
    """

    def __init__(
        self,
        use_llm: bool = False,
        min_confidence: float = 0.5,
    ):
        self.pattern_matcher = PatternMatcher()
        self.use_llm = use_llm
        self.min_confidence = min_confidence

    def extract_from_text(
        self,
        text: str,
        source_file: str | None = None,
        session_id: str | None = None,
    ) -> list[ExtractedInsight]:
        """
        Extract insights from text content.

        Args:
            text: Text to analyze
            source_file: Optional source file path
            session_id: Optional session identifier

        Returns:
            List of extracted insights
        """
        insights = []

        # Split into paragraphs for better context
        paragraphs = self._split_paragraphs(text)

        for para_num, paragraph in enumerate(paragraphs):
            # Find patterns in paragraph
            patterns = self.pattern_matcher.match(paragraph)

            # Filter by confidence
            patterns = [p for p in patterns if p.confidence >= self.min_confidence]

            if not patterns:
                continue

            # Group patterns and create insights
            for pattern in patterns:
                insight = self._pattern_to_insight(
                    pattern=pattern,
                    paragraph=paragraph,
                    source_file=source_file,
                    session_id=session_id,
                    line_number=para_num + 1,
                )
                if insight:
                    insights.append(insight)

        # Deduplicate similar insights
        insights = self._deduplicate(insights)

        return insights

    def extract_from_thinking_block(
        self,
        thinking_content: str,
        source_file: str | None = None,
        session_id: str | None = None,
    ) -> list[ExtractedInsight]:
        """
        Extract insights specifically from thinking/reasoning blocks.

        Thinking blocks often contain the "why" behind decisions.
        """
        insights = []

        # Look for decision patterns
        decision_patterns = [
            r"(?:I'll|Let me|I should|I need to)\s+(.+?)(?:\.|$)",
            r"(?:because|since|given that)\s+(.+?)(?:\.|$)",
            r"(?:The issue|The problem|The reason)\s+(?:is|was)\s+(.+?)(?:\.|$)",
            r"(?:This means|This suggests|This indicates)\s+(.+?)(?:\.|$)",
        ]

        for pattern in decision_patterns:
            matches = re.findall(pattern, thinking_content, re.IGNORECASE)
            for match in matches:
                if len(match) > 20:  # Skip very short matches
                    insights.append(
                        ExtractedInsight(
                            insight_type="reasoning",
                            title=self._generate_title(match),
                            content=match.strip(),
                            confidence=0.6,
                            source_file=source_file,
                            session_id=session_id,
                            tags=["thinking", "reasoning"],
                        )
                    )

        # Also run standard extraction
        standard_insights = self.extract_from_text(
            thinking_content,
            source_file=source_file,
            session_id=session_id,
        )

        # Boost confidence for thinking block insights
        for insight in standard_insights:
            insight.confidence = min(1.0, insight.confidence + 0.1)
            if "thinking" not in insight.tags:
                insight.tags.append("thinking")

        insights.extend(standard_insights)

        return self._deduplicate(insights)

    def extract_from_tool_result(
        self,
        tool_name: str,
        tool_input: dict[str, Any],
        tool_output: str,
        session_id: str | None = None,
    ) -> list[ExtractedInsight]:
        """
        Extract insights from tool usage patterns.
        """
        insights = []

        # Extract file-related insights
        if tool_name in ("Read", "Edit", "Write"):
            file_path = tool_input.get("file_path", "")

            # Look for error patterns in output
            if "error" in tool_output.lower() or "failed" in tool_output.lower():
                insights.append(
                    ExtractedInsight(
                        insight_type="gotcha",
                        title=f"Error with {Path(file_path).name}",
                        content=tool_output[:500],
                        confidence=0.7,
                        source_file=file_path,
                        session_id=session_id,
                        tags=["error", tool_name.lower()],
                        related_files=[file_path] if file_path else [],
                    )
                )

        # Extract command-related insights
        elif tool_name == "Bash":
            command = tool_input.get("command", "")

            # Track successful complex commands
            if (
                "&&" in command or "|" in command
            ) and "error" not in tool_output.lower():
                insights.append(
                    ExtractedInsight(
                        insight_type="pattern",
                        title="Useful command pattern",
                        content=f"Command: {command[:200]}",
                        confidence=0.5,
                        session_id=session_id,
                        tags=["command", "bash"],
                    )
                )

        return insights

    def _pattern_to_insight(
        self,
        pattern: MatchedPattern,
        paragraph: str,
        source_file: str | None,
        session_id: str | None,
        line_number: int | None,
    ) -> ExtractedInsight | None:
        """Convert a matched pattern to an insight."""
        # Map pattern types to insight types
        type_map = {
            PatternType.GOTCHA: "gotcha",
            PatternType.PATTERN: "pattern",
            PatternType.DISCOVERY: "discovery",
            PatternType.FAILURE: "failure",
            PatternType.SUCCESS: "success",
            PatternType.RECOMMENDATION: "recommendation",
            PatternType.DECISION: "decision",
            PatternType.WORKAROUND: "workaround",
        }

        insight_type = type_map.get(pattern.pattern_type, "general")

        # Generate title from content
        title = self._generate_title(pattern.text)

        # Extract related files from content
        related_files = self._extract_file_paths(paragraph)

        return ExtractedInsight(
            insight_type=insight_type,
            title=title,
            content=paragraph.strip(),
            confidence=pattern.confidence,
            source_file=source_file,
            source_line=line_number,
            session_id=session_id,
            tags=pattern.keywords[:5],  # Use matched keywords as tags
            related_files=related_files,
        )

    def _generate_title(self, text: str) -> str:
        """Generate a short title from text."""
        # Take first sentence or first N chars
        first_sentence = text.split(".")[0].strip()
        if len(first_sentence) <= 60:
            return first_sentence
        return first_sentence[:57] + "..."

    def _extract_file_paths(self, text: str) -> list[str]:
        """Extract file paths mentioned in text."""
        # Common file path patterns
        patterns = [
            r"[`'\"]([a-zA-Z0-9_/.-]+\.[a-zA-Z0-9]+)[`'\"]",  # Quoted paths
            r"(?:in|from|at|file)\s+([a-zA-Z0-9_/.-]+\.[a-zA-Z0-9]+)",  # "in file.py"
        ]

        paths = []
        for pattern in patterns:
            matches = re.findall(pattern, text)
            paths.extend(matches)

        return list(set(paths))[:5]  # Dedupe and limit

    def _split_paragraphs(self, text: str) -> list[str]:
        """Split text into paragraphs."""
        # Split on double newlines or single newlines followed by uppercase
        paragraphs = re.split(r"\n\n+|\n(?=[A-Z])", text)
        return [p.strip() for p in paragraphs if p.strip()]

    def _deduplicate(self, insights: list[ExtractedInsight]) -> list[ExtractedInsight]:
        """Remove duplicate or very similar insights."""
        seen_ids = set()
        unique = []

        for insight in insights:
            if insight.insight_id not in seen_ids:
                seen_ids.add(insight.insight_id)
                unique.append(insight)

        return unique
