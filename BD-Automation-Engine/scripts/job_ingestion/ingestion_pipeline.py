"""
Job Ingestion Pipeline - Complete pipeline for parsing, enriching, and uploading jobs.

Usage:
    python ingestion_pipeline.py --files job1.json job2.json --upload
    python ingestion_pipeline.py --files job1.json --enrich --output enriched.json
    python ingestion_pipeline.py --files job1.json --stats-only
"""

import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
load_dotenv()

from scripts.job_ingestion.job_parser import (
    parse_job_file,
    deduplicate_jobs,
    NormalizedJob
)
from scripts.job_ingestion.ai_enrichment import (
    AIEnrichmentEngine,
    FallbackEnrichmentEngine
)
from scripts.job_ingestion.relational_enrichment import (
    RelationalEnrichmentEngine
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('BD-Ingestion')


# ===========================================
# NOTION UPLOAD
# ===========================================

class NotionJobUploader:
    """Handles uploading jobs to Notion."""

    def __init__(self):
        self.token = os.getenv('NOTION_TOKEN')
        self.db_id = os.getenv('NOTION_DB_GDIT_JOBS')
        self._client = None
        self._data_source_id = None

    @property
    def client(self):
        """Get Notion client."""
        if self._client is None:
            try:
                from notion_client import Client
                self._client = Client(auth=self.token)
            except ImportError:
                raise RuntimeError("notion-client not installed. Run: pip install notion-client")
        return self._client

    def get_data_source_id(self) -> str:
        """Get data source ID for the jobs database."""
        if self._data_source_id:
            return self._data_source_id

        import requests
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }

        url = f"https://api.notion.com/v1/databases/{self.db_id}"
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        db_info = response.json()

        data_sources = db_info.get('data_sources', [])
        if data_sources:
            self._data_source_id = data_sources[0]['id']
        else:
            # Fall back to database_id for older API versions
            self._data_source_id = self.db_id

        return self._data_source_id

    def check_job_exists(self, job_number: str, company: str) -> bool:
        """Check if a job already exists in Notion."""
        import requests

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }

        try:
            data_source_id = self.get_data_source_id()
            url = f"https://api.notion.com/v1/data_sources/{data_source_id}/query"
        except Exception:
            # Fall back to database query
            url = f"https://api.notion.com/v1/databases/{self.db_id}/query"

        body = {
            "filter": {
                "and": [
                    {"property": "Job Number", "number": {"equals": int(job_number) if job_number.isdigit() else 0}},
                ]
            },
            "page_size": 1
        }

        try:
            response = requests.post(url, headers=headers, json=body)
            response.raise_for_status()
            results = response.json().get('results', [])
            return len(results) > 0
        except Exception as e:
            logger.warning(f"Could not check for existing job: {e}")
            return False

    def upload_job(self, job: NormalizedJob) -> Optional[str]:
        """Upload a single job to Notion."""
        import requests

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }

        properties = job.to_notion_properties()

        try:
            data_source_id = self.get_data_source_id()
            body = {
                "parent": {"data_source_id": data_source_id},
                "properties": properties
            }
        except Exception:
            # Fall back to database_id
            body = {
                "parent": {"database_id": self.db_id},
                "properties": properties
            }

        url = "https://api.notion.com/v1/pages"

        try:
            response = requests.post(url, headers=headers, json=body)
            response.raise_for_status()
            result = response.json()
            return result.get('id')
        except Exception as e:
            logger.error(f"Failed to upload job: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None

    def upload_jobs_batch(self, jobs: List[NormalizedJob], skip_existing: bool = True) -> Dict:
        """Upload a batch of jobs to Notion."""
        results = {
            'uploaded': 0,
            'skipped': 0,
            'failed': 0,
            'page_ids': []
        }

        for i, job in enumerate(jobs):
            logger.info(f"Uploading {i+1}/{len(jobs)}: {job.title[:50]}")

            # Check if already exists
            if skip_existing and job.job_number:
                if self.check_job_exists(job.job_number, job.company):
                    logger.info(f"  Skipping (already exists): {job.job_number}")
                    results['skipped'] += 1
                    continue

            page_id = self.upload_job(job)

            if page_id:
                results['uploaded'] += 1
                results['page_ids'].append(page_id)
            else:
                results['failed'] += 1

        return results


# ===========================================
# PIPELINE
# ===========================================

class JobIngestionPipeline:
    """Complete job ingestion pipeline."""

    def __init__(self, use_ai: bool = True, data_dir: str = None):
        self.use_ai = use_ai
        self.data_dir = data_dir
        self.enrichment_engine = None
        self.relational_engine = None
        self.uploader = None

    def _get_enrichment_engine(self):
        """Get enrichment engine (lazy init)."""
        if self.enrichment_engine is None:
            if self.use_ai:
                try:
                    self.enrichment_engine = AIEnrichmentEngine()
                except Exception as e:
                    logger.warning(f"AI enrichment unavailable: {e}. Using fallback.")
                    self.enrichment_engine = FallbackEnrichmentEngine()
            else:
                self.enrichment_engine = FallbackEnrichmentEngine()
        return self.enrichment_engine

    def _get_uploader(self):
        """Get Notion uploader (lazy init)."""
        if self.uploader is None:
            self.uploader = NotionJobUploader()
        return self.uploader

    def _get_relational_engine(self):
        """Get relational enrichment engine (lazy init)."""
        if self.relational_engine is None:
            self.relational_engine = RelationalEnrichmentEngine(data_dir=self.data_dir)
        return self.relational_engine

    def parse_files(self, file_paths: List[str]) -> List[NormalizedJob]:
        """Parse multiple scrape files."""
        all_jobs = []

        for path in file_paths:
            logger.info(f"Parsing: {path}")
            try:
                jobs = parse_job_file(path)
                logger.info(f"  Found {len(jobs)} jobs")
                all_jobs.extend(jobs)
            except Exception as e:
                logger.error(f"  Failed to parse: {e}")

        return all_jobs

    def enrich_jobs(self, jobs: List[NormalizedJob]) -> List[NormalizedJob]:
        """Enrich jobs with AI-extracted data."""
        engine = self._get_enrichment_engine()

        for i, job in enumerate(jobs):
            logger.info(f"Enriching {i+1}/{len(jobs)}: {job.title[:50]}")

            result = engine.enrich_job(job.description)

            # Apply enrichment
            if result.experience_years is not None:
                job.experience_years = result.experience_years
            if result.skills:
                job.skills = result.skills
            if result.technologies:
                job.technologies = result.technologies
            if result.certifications_required:
                job.certifications_required = result.certifications_required
            if result.certifications_extra:
                job.certifications_extra = result.certifications_extra

            # Update clearance if AI detected something different
            if result.clearance_detected and not job.clearance:
                job.clearance = result.clearance_detected

            # Update status
            if job.skills or job.technologies:
                job.status = 'enriched'

        return jobs

    def upload_jobs(self, jobs: List[NormalizedJob], skip_existing: bool = True) -> Dict:
        """Upload jobs to Notion."""
        uploader = self._get_uploader()
        return uploader.upload_jobs_batch(jobs, skip_existing)

    def enrich_relational(self, jobs: List[NormalizedJob]) -> List[NormalizedJob]:
        """Enrich jobs with relational data from Federal Programs."""
        engine = self._get_relational_engine()

        for i, job in enumerate(jobs):
            logger.info(f"Relational enrichment {i+1}/{len(jobs)}: {job.title[:50]}")

            # Convert NormalizedJob to dict for enrichment
            job_dict = job.to_dict()
            enriched = engine.enrich_job(job_dict)

            # Apply enrichment back to job
            if enriched.get('prime'):
                job.prime = enriched['prime']
            if enriched.get('subcontractors'):
                job.subcontractors = enriched['subcontractors']
            if enriched.get('matched_program'):
                job.task_order = enriched.get('matched_program')  # Use program as task order proxy

            # Update status if matched
            if enriched.get('match_confidence', 0) >= 0.5:
                job.status = 'enriched'

        return jobs

    def run(self, file_paths: List[str], enrich: bool = True, relational: bool = True,
            upload: bool = False, dedupe: bool = True, skip_existing: bool = True) -> Dict:
        """Run the full pipeline.

        Args:
            file_paths: List of JSON files to process
            enrich: Whether to run AI enrichment (Skills, Technologies, etc.)
            relational: Whether to run relational enrichment (Prime, Program matching)
            upload: Whether to upload to Notion
            dedupe: Whether to deduplicate jobs
            skip_existing: Whether to skip jobs that already exist in Notion

        Returns:
            Pipeline results summary
        """
        results = {
            'files_processed': len(file_paths),
            'jobs_parsed': 0,
            'jobs_after_dedupe': 0,
            'jobs_ai_enriched': 0,
            'jobs_program_matched': 0,
            'upload_results': None,
            'jobs': []
        }

        # Step 1: Parse
        logger.info("=== Step 1: Parsing Files ===")
        jobs = self.parse_files(file_paths)
        results['jobs_parsed'] = len(jobs)

        if not jobs:
            logger.warning("No jobs parsed")
            return results

        # Step 2: Deduplicate
        if dedupe:
            logger.info("=== Step 2: Deduplication ===")
            before = len(jobs)
            jobs = deduplicate_jobs(jobs)
            results['jobs_after_dedupe'] = len(jobs)
            logger.info(f"Deduplicated: {before} -> {len(jobs)}")
        else:
            results['jobs_after_dedupe'] = len(jobs)

        # Step 3: AI Enrichment (Skills, Technologies, Certifications)
        if enrich:
            logger.info("=== Step 3: AI Enrichment ===")
            jobs = self.enrich_jobs(jobs)
            results['jobs_ai_enriched'] = sum(1 for j in jobs if j.skills or j.technologies)

        # Step 4: Relational Enrichment (Program matching, Prime/Subcontractors)
        if relational:
            logger.info("=== Step 4: Relational Enrichment ===")
            jobs = self.enrich_relational(jobs)
            results['jobs_program_matched'] = sum(1 for j in jobs if j.prime or j.task_order)

        # Step 5: Upload
        if upload:
            logger.info("=== Step 5: Notion Upload ===")
            results['upload_results'] = self.upload_jobs(jobs, skip_existing)

        results['jobs'] = jobs
        return results


# ===========================================
# STATISTICS
# ===========================================

def print_statistics(jobs: List[NormalizedJob]):
    """Print detailed statistics about jobs."""
    print("\n" + "="*60)
    print("JOB STATISTICS")
    print("="*60)

    print(f"\nTotal Jobs: {len(jobs)}")

    # By company
    by_company = {}
    for job in jobs:
        by_company[job.company] = by_company.get(job.company, 0) + 1
    print("\nBy Company:")
    for company, count in sorted(by_company.items(), key=lambda x: -x[1]):
        print(f"  {company}: {count}")

    # By clearance
    by_clearance = {}
    for job in jobs:
        key = job.clearance or 'Unknown/None'
        by_clearance[key] = by_clearance.get(key, 0) + 1
    print("\nBy Clearance:")
    for clearance, count in sorted(by_clearance.items(), key=lambda x: -x[1]):
        print(f"  {clearance}: {count}")

    # By employment type
    by_type = {}
    for job in jobs:
        by_type[job.employment_type] = by_type.get(job.employment_type, 0) + 1
    print("\nBy Employment Type:")
    for emp_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {emp_type}: {count}")

    # By location (top 10)
    by_location = {}
    for job in jobs:
        loc = job.location or 'Unknown'
        by_location[loc] = by_location.get(loc, 0) + 1
    print("\nTop 10 Locations:")
    for loc, count in sorted(by_location.items(), key=lambda x: -x[1])[:10]:
        print(f"  {loc}: {count}")

    # Enrichment stats
    with_experience = sum(1 for j in jobs if j.experience_years)
    with_skills = sum(1 for j in jobs if j.skills)
    with_tech = sum(1 for j in jobs if j.technologies)
    with_certs = sum(1 for j in jobs if j.certifications_required)

    print("\nAI Enrichment Coverage:")
    print(f"  Experience Years: {with_experience}/{len(jobs)} ({100*with_experience/len(jobs):.1f}%)")
    print(f"  Skills: {with_skills}/{len(jobs)} ({100*with_skills/len(jobs):.1f}%)")
    print(f"  Technologies: {with_tech}/{len(jobs)} ({100*with_tech/len(jobs):.1f}%)")
    print(f"  Certifications: {with_certs}/{len(jobs)} ({100*with_certs/len(jobs):.1f}%)")

    # Relational enrichment stats
    with_prime = sum(1 for j in jobs if j.prime)
    with_program = sum(1 for j in jobs if j.task_order)
    with_subs = sum(1 for j in jobs if j.subcontractors)

    print("\nRelational Enrichment Coverage:")
    print(f"  Prime Contractor: {with_prime}/{len(jobs)} ({100*with_prime/len(jobs):.1f}%)")
    print(f"  Matched Program: {with_program}/{len(jobs)} ({100*with_program/len(jobs):.1f}%)")
    print(f"  Subcontractors: {with_subs}/{len(jobs)} ({100*with_subs/len(jobs):.1f}%)")

    # Top primes
    if with_prime > 0:
        by_prime = {}
        for job in jobs:
            if job.prime:
                by_prime[job.prime] = by_prime.get(job.prime, 0) + 1
        print("\nTop Prime Contractors:")
        for prime, count in sorted(by_prime.items(), key=lambda x: -x[1])[:10]:
            print(f"  {prime}: {count}")


# ===========================================
# CLI
# ===========================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Job Ingestion Pipeline')
    parser.add_argument('--files', '-f', nargs='+', required=True, help='JSON files to process')
    parser.add_argument('--output', '-o', help='Output JSON file for processed jobs')
    parser.add_argument('--enrich', '-e', action='store_true', help='Run AI enrichment (Skills, Tech, Certs)')
    parser.add_argument('--relational', '-r', action='store_true', help='Run relational enrichment (Program matching)')
    parser.add_argument('--upload', '-u', action='store_true', help='Upload to Notion')
    parser.add_argument('--no-dedupe', action='store_true', help='Skip deduplication')
    parser.add_argument('--no-ai', action='store_true', help='Use fallback extraction (no API)')
    parser.add_argument('--data-dir', '-d', help='Data directory with CSV files for relational enrichment')
    parser.add_argument('--stats-only', action='store_true', help='Only show statistics')
    parser.add_argument('--limit', '-l', type=int, help='Limit number of jobs to process')

    args = parser.parse_args()

    # Initialize pipeline
    pipeline = JobIngestionPipeline(use_ai=not args.no_ai, data_dir=args.data_dir)

    if args.stats_only:
        # Just parse and show stats
        jobs = pipeline.parse_files(args.files)
        if not args.no_dedupe:
            jobs = deduplicate_jobs(jobs)
        if args.limit:
            jobs = jobs[:args.limit]
        print_statistics(jobs)
        return

    # Run full pipeline
    results = pipeline.run(
        file_paths=args.files,
        enrich=args.enrich,
        relational=args.relational,
        upload=args.upload,
        dedupe=not args.no_dedupe
    )

    jobs = results['jobs']

    if args.limit:
        jobs = jobs[:args.limit]

    # Show statistics
    print_statistics(jobs)

    # Save output
    if args.output:
        output_data = [job.to_dict() for job in jobs]
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2)
        print(f"\nSaved to: {args.output}")

    # Show upload results
    if results['upload_results']:
        ur = results['upload_results']
        print(f"\nUpload Results:")
        print(f"  Uploaded: {ur['uploaded']}")
        print(f"  Skipped: {ur['skipped']}")
        print(f"  Failed: {ur['failed']}")


if __name__ == '__main__':
    main()
