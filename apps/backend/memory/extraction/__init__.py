"""
Memory Extraction Daemon
========================

Background processing of session transcripts to extract insights automatically.

Features:
- Pattern detection from thinking blocks
- Gotcha and pitfall identification
- Code pattern recognition
- Automatic categorization and tagging
- Graphiti integration for semantic storage
"""

from .daemon import DaemonConfig, MemoryExtractionDaemon
from .extractor import InsightExtractor, ExtractedInsight
from .patterns import PatternMatcher, PatternType
from .processor import TranscriptProcessor, ProcessedTranscript

__all__ = [
    "DaemonConfig",
    "MemoryExtractionDaemon",
    "InsightExtractor",
    "ExtractedInsight",
    "PatternMatcher",
    "PatternType",
    "ProcessedTranscript",
    "TranscriptProcessor",
]
