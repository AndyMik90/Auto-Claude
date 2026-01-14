"""
BD Data Correlation Engine
===========================
Correlates data across Notion databases to generate BD intelligence exports.

Components:
- NotionDataLoader: Fetches data from all BD-related Notion databases
- DataCorrelator: Links jobs, programs, contacts, and contractors
- BDScoreCalculator: Computes BD priority scores and rankings
- ExportGenerator: Creates JSON exports for the dashboard
"""

from .correlation_engine import (
    NotionDataLoader,
    DataCorrelator,
    BDScoreCalculator,
    ExportGenerator,
    run_full_correlation
)

__all__ = [
    "NotionDataLoader",
    "DataCorrelator",
    "BDScoreCalculator",
    "ExportGenerator",
    "run_full_correlation"
]
