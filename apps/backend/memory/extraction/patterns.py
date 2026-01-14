"""
Pattern Matching for Insight Extraction
========================================

Regex and keyword-based pattern matching to identify insights in transcripts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class PatternType(Enum):
    """Types of patterns we can detect in transcripts."""

    GOTCHA = "gotcha"  # Pitfall or unexpected behavior
    PATTERN = "pattern"  # Code pattern or best practice
    DISCOVERY = "discovery"  # New understanding about codebase
    FAILURE = "failure"  # What didn't work
    SUCCESS = "success"  # What worked well
    RECOMMENDATION = "recommendation"  # Suggestion for future
    DECISION = "decision"  # Design or implementation decision
    WORKAROUND = "workaround"  # Temporary fix or hack


@dataclass
class MatchedPattern:
    """A pattern match result."""

    pattern_type: PatternType
    text: str
    context: str
    confidence: float  # 0.0 to 1.0
    keywords: list[str] = field(default_factory=list)
    line_number: int | None = None


class PatternMatcher:
    """
    Matches patterns in text using keywords and regex.

    Uses a combination of:
    - Keyword matching for high-confidence patterns
    - Regex patterns for structured content
    - Heuristics for edge cases
    """

    # Keyword patterns for each type
    KEYWORD_PATTERNS: dict[PatternType, list[str]] = {
        PatternType.GOTCHA: [
            "gotcha",
            "pitfall",
            "careful",
            "watch out",
            "beware",
            "trap",
            "subtle bug",
            "edge case",
            "caught me",
            "unexpected",
            "surprisingly",
            "don't forget",
            "easy to miss",
            "tricky",
            "counterintuitive",
            "footgun",
        ],
        PatternType.PATTERN: [
            "pattern",
            "always use",
            "best practice",
            "convention",
            "should always",
            "rule of thumb",
            "standard approach",
            "idiomatic",
            "prefer",
            "recommended way",
            "consistent with",
        ],
        PatternType.DISCOVERY: [
            "discovered",
            "found out",
            "learned",
            "realized",
            "turns out",
            "interesting",
            "didn't know",
            "now understand",
            "makes sense",
            "aha",
            "insight",
        ],
        PatternType.FAILURE: [
            "didn't work",
            "failed",
            "broke",
            "error",
            "mistake",
            "wrong approach",
            "bad idea",
            "shouldn't have",
            "regret",
            "waste of time",
            "dead end",
        ],
        PatternType.SUCCESS: [
            "worked",
            "success",
            "fixed",
            "solved",
            "working now",
            "that did it",
            "finally",
            "breakthrough",
            "nailed it",
        ],
        PatternType.RECOMMENDATION: [
            "recommend",
            "should",
            "next time",
            "in the future",
            "going forward",
            "better to",
            "suggestion",
            "tip",
            "advice",
        ],
        PatternType.DECISION: [
            "decided",
            "chose",
            "going with",
            "opting for",
            "trade-off",
            "because",
            "rationale",
            "reasoning",
        ],
        PatternType.WORKAROUND: [
            "workaround",
            "hack",
            "temporary",
            "for now",
            "quick fix",
            "band-aid",
            "TODO",
            "FIXME",
            "technical debt",
        ],
    }

    # Regex patterns for structured content
    REGEX_PATTERNS: dict[PatternType, list[re.Pattern]] = {
        PatternType.GOTCHA: [
            re.compile(r"(?:note|important|warning|caution):\s*(.+)", re.IGNORECASE),
            re.compile(r"(?:don't|do not|never)\s+(.+)", re.IGNORECASE),
            re.compile(r"(?:must|always)\s+remember\s+(.+)", re.IGNORECASE),
        ],
        PatternType.PATTERN: [
            re.compile(r"(?:pattern|convention):\s*(.+)", re.IGNORECASE),
            re.compile(r"(?:we|they)\s+(?:always|consistently)\s+(.+)", re.IGNORECASE),
        ],
        PatternType.DISCOVERY: [
            re.compile(r"(?:TIL|learned|discovered):\s*(.+)", re.IGNORECASE),
            re.compile(r"(?:it|this)\s+(?:turns out|seems)\s+(.+)", re.IGNORECASE),
        ],
        PatternType.DECISION: [
            re.compile(r"(?:decision|chose|choosing):\s*(.+)", re.IGNORECASE),
            re.compile(
                r"(?:went|going)\s+with\s+(.+?)\s+because\s+(.+)", re.IGNORECASE
            ),
        ],
    }

    # Confidence thresholds
    KEYWORD_CONFIDENCE = 0.7
    REGEX_CONFIDENCE = 0.85
    MULTI_KEYWORD_BONUS = 0.1

    def __init__(self):
        # Compile keyword patterns for efficiency
        self._keyword_patterns: dict[PatternType, re.Pattern] = {}
        for ptype, keywords in self.KEYWORD_PATTERNS.items():
            pattern = "|".join(re.escape(kw) for kw in keywords)
            self._keyword_patterns[ptype] = re.compile(pattern, re.IGNORECASE)

    def match(self, text: str, context: str = "") -> list[MatchedPattern]:
        """
        Find all pattern matches in text.

        Args:
            text: Text to search
            context: Additional context (e.g., surrounding lines)

        Returns:
            List of matched patterns
        """
        matches = []
        full_text = f"{context}\n{text}" if context else text

        # Check keyword patterns
        for ptype, pattern in self._keyword_patterns.items():
            keyword_matches = pattern.findall(full_text)
            if keyword_matches:
                confidence = self.KEYWORD_CONFIDENCE
                # Bonus for multiple matches
                if len(keyword_matches) > 1:
                    confidence = min(1.0, confidence + self.MULTI_KEYWORD_BONUS)

                matches.append(
                    MatchedPattern(
                        pattern_type=ptype,
                        text=text,
                        context=context,
                        confidence=confidence,
                        keywords=keyword_matches,
                    )
                )

        # Check regex patterns
        for ptype, patterns in self.REGEX_PATTERNS.items():
            for pattern in patterns:
                regex_match = pattern.search(full_text)
                if regex_match:
                    # Extract matched content
                    matched_text = regex_match.group(0)
                    captured = regex_match.groups()

                    matches.append(
                        MatchedPattern(
                            pattern_type=ptype,
                            text=matched_text,
                            context=context,
                            confidence=self.REGEX_CONFIDENCE,
                            keywords=list(captured) if captured else [],
                        )
                    )

        return matches

    def extract_sentences_with_patterns(
        self, text: str
    ) -> list[tuple[str, list[MatchedPattern]]]:
        """
        Split text into sentences and find patterns in each.

        Returns:
            List of (sentence, patterns) tuples
        """
        # Simple sentence splitting
        sentences = re.split(r"(?<=[.!?])\s+", text)

        results = []
        for i, sentence in enumerate(sentences):
            # Use surrounding sentences as context
            context_start = max(0, i - 1)
            context_end = min(len(sentences), i + 2)
            context = " ".join(sentences[context_start:context_end])

            patterns = self.match(sentence, context)
            if patterns:
                results.append((sentence, patterns))

        return results

    def get_dominant_type(self, patterns: list[MatchedPattern]) -> PatternType | None:
        """Get the highest-confidence pattern type from a list."""
        if not patterns:
            return None

        return max(patterns, key=lambda p: p.confidence).pattern_type

    def summarize_patterns(
        self, patterns: list[MatchedPattern]
    ) -> dict[PatternType, int]:
        """Count patterns by type."""
        counts: dict[PatternType, int] = {}
        for p in patterns:
            counts[p.pattern_type] = counts.get(p.pattern_type, 0) + 1
        return counts
