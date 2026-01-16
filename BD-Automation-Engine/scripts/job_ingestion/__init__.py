"""
Job Ingestion Pipeline - Parse, enrich, and upload staffing jobs to Notion.

Components:
- job_parser: Normalize Apex/Insight Global scrape data
- ai_enrichment: Extract Skills/Technologies/Certifications using Claude
- relational_enrichment: Match jobs to Federal Programs, extract Prime/Subcontractors
- ingestion_pipeline: Complete pipeline orchestration
"""

from .job_parser import (
    NormalizedJob,
    parse_job_file,
    deduplicate_jobs,
    normalize_clearance,
    normalize_employment_type,
    normalize_date,
    extract_company_from_url,
)

from .ai_enrichment import (
    AIEnrichmentEngine,
    FallbackEnrichmentEngine,
    EnrichmentResult,
)

from .relational_enrichment import (
    RelationalEnrichmentEngine,
    ProgramDatabase,
    ProgramMatcher,
    FederalProgram,
    ProgramMatch,
)

from .ingestion_pipeline import (
    JobIngestionPipeline,
    NotionJobUploader,
)

__all__ = [
    # Parser
    'NormalizedJob',
    'parse_job_file',
    'deduplicate_jobs',
    'normalize_clearance',
    'normalize_employment_type',
    'normalize_date',
    'extract_company_from_url',
    # AI Enrichment
    'AIEnrichmentEngine',
    'FallbackEnrichmentEngine',
    'EnrichmentResult',
    # Relational Enrichment
    'RelationalEnrichmentEngine',
    'ProgramDatabase',
    'ProgramMatcher',
    'FederalProgram',
    'ProgramMatch',
    # Pipeline
    'JobIngestionPipeline',
    'NotionJobUploader',
]
