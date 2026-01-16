"""
Enrichment Orchestrator - Manages the enrichment pipeline
Handles polling, batch processing, and logging
"""
import os
import time
import json
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from .notion_client import NotionClient
from .engine import EnrichmentEngine


class EnrichmentType(Enum):
    JOB = "job"
    CONTACT = "contact"
    OPPORTUNITY = "opportunity"


@dataclass
class EnrichmentResult:
    """Result of a single enrichment operation"""
    page_id: str
    success: bool
    enrichment_type: EnrichmentType
    fields_updated: List[str] = field(default_factory=list)
    error: Optional[str] = None
    duration_ms: int = 0


@dataclass
class RunSummary:
    """Summary of an enrichment run"""
    run_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    jobs_processed: int = 0
    successful: int = 0
    failed: int = 0
    total_duration_ms: int = 0
    data_sources: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    api_costs: float = 0.0


class EnrichmentOrchestrator:
    """
    Orchestrates the full enrichment pipeline:
    1. Polls for new/updated records
    2. Runs enrichment engine on each record
    3. Writes results back to Notion
    4. Logs run statistics
    """

    def __init__(
        self,
        notion_token: Optional[str] = None,
        anthropic_key: Optional[str] = None
    ):
        self.notion = NotionClient(token=notion_token)
        self.engine = EnrichmentEngine(anthropic_key=anthropic_key)
        self.run_summary: Optional[RunSummary] = None

    def run_full_pipeline(
        self,
        enrich_jobs: bool = True,
        enrich_contacts: bool = True,
        enrich_opportunities: bool = True,
        dry_run: bool = False
    ) -> RunSummary:
        """
        Run the full enrichment pipeline on all pending records.

        Args:
            enrich_jobs: Whether to enrich job records
            enrich_contacts: Whether to enrich contact records
            enrich_opportunities: Whether to enrich opportunity records
            dry_run: If True, don't write changes to Notion
        """
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.run_summary = RunSummary(
            run_id=run_id,
            start_time=datetime.now(),
            data_sources=[]
        )

        print(f"\n{'='*60}")
        print(f"ENRICHMENT RUN: {run_id}")
        print(f"{'='*60}")

        try:
            # 1. Enrich Jobs
            if enrich_jobs:
                self._enrich_database(
                    database_id=self.notion.DATABASES['PROGRAM_MAPPING_HUB'],
                    enrichment_type=EnrichmentType.JOB,
                    enrichment_func=self.engine.enrich_job,
                    status_filter='pending_enrichment',
                    dry_run=dry_run
                )

            # 2. Enrich Contacts
            if enrich_contacts:
                for db_key in ['DCGS_CONTACTS', 'GDIT_CONTACTS', 'GDIT_PTS_CONTACTS']:
                    db_id = self.notion.DATABASES.get(db_key)
                    if db_id:
                        self._enrich_database(
                            database_id=db_id,
                            enrichment_type=EnrichmentType.CONTACT,
                            enrichment_func=self.engine.enrich_contact,
                            status_filter=None,  # No status filter for contacts
                            dry_run=dry_run
                        )

            # 3. Enrich Opportunities
            if enrich_opportunities:
                self._enrich_database(
                    database_id=self.notion.DATABASES['BD_OPPORTUNITIES'],
                    enrichment_type=EnrichmentType.OPPORTUNITY,
                    enrichment_func=self.engine.enrich_opportunity,
                    status_filter=None,
                    dry_run=dry_run
                )

        except Exception as e:
            self.run_summary.errors.append(f"Pipeline error: {str(e)}")
            print(f"ERROR: {e}")

        # Finalize run
        self.run_summary.end_time = datetime.now()
        self.run_summary.total_duration_ms = int(
            (self.run_summary.end_time - self.run_summary.start_time).total_seconds() * 1000
        )

        # Log to Notion
        if not dry_run:
            self._log_run_to_notion()

        self._print_summary()
        return self.run_summary

    def enrich_single_record(
        self,
        page_id: str,
        enrichment_type: EnrichmentType,
        dry_run: bool = False
    ) -> EnrichmentResult:
        """Enrich a single record by page ID"""
        start_time = time.time()

        # Get the page
        page = self.notion.get_page(page_id)
        if page.get('error'):
            return EnrichmentResult(
                page_id=page_id,
                success=False,
                enrichment_type=enrichment_type,
                error=page.get('message', 'Failed to fetch page')
            )

        # Run enrichment
        if enrichment_type == EnrichmentType.JOB:
            enriched = self.engine.enrich_job(page)
        elif enrichment_type == EnrichmentType.CONTACT:
            enriched = self.engine.enrich_contact(page)
        elif enrichment_type == EnrichmentType.OPPORTUNITY:
            enriched = self.engine.enrich_opportunity(page)
        else:
            return EnrichmentResult(
                page_id=page_id,
                success=False,
                enrichment_type=enrichment_type,
                error=f"Unknown enrichment type: {enrichment_type}"
            )

        # Write back to Notion
        if not dry_run and enriched:
            result = self.notion.update_page(page_id, enriched)
            if result.get('error'):
                return EnrichmentResult(
                    page_id=page_id,
                    success=False,
                    enrichment_type=enrichment_type,
                    error=result.get('message', 'Failed to update page'),
                    duration_ms=int((time.time() - start_time) * 1000)
                )

        return EnrichmentResult(
            page_id=page_id,
            success=True,
            enrichment_type=enrichment_type,
            fields_updated=list(enriched.keys()) if enriched else [],
            duration_ms=int((time.time() - start_time) * 1000)
        )

    def poll_and_enrich(
        self,
        interval_seconds: int = 300,
        max_iterations: Optional[int] = None
    ):
        """
        Continuously poll for new records and enrich them.

        Args:
            interval_seconds: Time between polls (default 5 minutes)
            max_iterations: Maximum number of poll cycles (None = infinite)
        """
        iteration = 0
        print(f"Starting continuous enrichment (polling every {interval_seconds}s)")
        print("Press Ctrl+C to stop\n")

        try:
            while max_iterations is None or iteration < max_iterations:
                iteration += 1
                print(f"\n--- Poll iteration {iteration} at {datetime.now().strftime('%H:%M:%S')} ---")

                self.run_full_pipeline()

                if max_iterations is None or iteration < max_iterations:
                    print(f"Sleeping for {interval_seconds} seconds...")
                    time.sleep(interval_seconds)

        except KeyboardInterrupt:
            print("\nEnrichment polling stopped by user.")

    def generate_call_sheet(
        self,
        database_id: Optional[str] = None,
        min_score: int = 60,
        limit: int = 20
    ) -> List[Dict]:
        """
        Generate a prioritized call sheet from enriched jobs.

        Returns list of high-priority opportunities with contact info.
        """
        db_id = database_id or self.notion.DATABASES['PROGRAM_MAPPING_HUB']

        # Query for high-scoring enriched jobs
        filter = {
            "and": [
                {"property": "Status", "select": {"equals": "enriched"}},
                {"property": "BD Score", "number": {"greater_than_or_equal_to": min_score}}
            ]
        }

        sorts = [
            {"property": "BD Score", "direction": "descending"}
        ]

        pages = self.notion.query_all_pages(db_id, filter=filter, sorts=sorts)

        call_sheet = []
        for page in pages[:limit]:
            props = page.get('properties', {})
            call_sheet.append({
                'id': page.get('id'),
                'title': self.notion.extract_title(props.get('Job Title', props.get('Name', {}))),
                'company': self.notion.extract_rich_text(props.get('Company', {})),
                'location': self.notion.extract_rich_text(props.get('Location', {})),
                'bd_score': self.notion.extract_number(props.get('BD Score', {})),
                'priority': self.notion.extract_select(props.get('BD Priority', {})),
                'mapped_programs': self.notion.extract_rich_text(props.get('Mapped Programs', {})),
            })

        return call_sheet

    # === Private Methods ===

    def _enrich_database(
        self,
        database_id: str,
        enrichment_type: EnrichmentType,
        enrichment_func: Callable,
        status_filter: Optional[str] = None,
        dry_run: bool = False
    ):
        """Enrich all pending records in a database"""
        print(f"\nProcessing {enrichment_type.value}s from database...")

        # Build filter
        filter = None
        if status_filter:
            filter = {"property": "Status", "select": {"equals": status_filter}}

        # Query pages
        pages = self.notion.query_all_pages(database_id, filter=filter)
        print(f"  Found {len(pages)} records to process")

        if not pages:
            return

        self.run_summary.data_sources.append(enrichment_type.value)

        for i, page in enumerate(pages):
            page_id = page.get('id')
            self.run_summary.jobs_processed += 1

            try:
                # Run enrichment
                start_time = time.time()
                enriched = enrichment_func(page)
                duration = int((time.time() - start_time) * 1000)

                if not enriched:
                    print(f"  [{i+1}/{len(pages)}] Skipped (no enrichment)")
                    continue

                # Write back
                if not dry_run:
                    result = self.notion.update_page(page_id, enriched)
                    if result.get('error'):
                        self.run_summary.failed += 1
                        self.run_summary.errors.append(f"Page {page_id}: {result.get('message')}")
                        print(f"  [{i+1}/{len(pages)}] FAILED: {result.get('message')}")
                    else:
                        self.run_summary.successful += 1
                        print(f"  [{i+1}/{len(pages)}] Enriched ({len(enriched)} fields, {duration}ms)")
                else:
                    self.run_summary.successful += 1
                    print(f"  [{i+1}/{len(pages)}] [DRY RUN] Would enrich {len(enriched)} fields")

            except Exception as e:
                self.run_summary.failed += 1
                self.run_summary.errors.append(f"Page {page_id}: {str(e)}")
                print(f"  [{i+1}/{len(pages)}] ERROR: {e}")

    def _log_run_to_notion(self):
        """Log run statistics to the Enrichment Runs Log database"""
        if not self.run_summary:
            return

        log_db_id = self.notion.DATABASES.get('ENRICHMENT_LOG')
        if not log_db_id:
            print("Warning: Enrichment log database not configured")
            return

        # Calculate success rate
        total = self.run_summary.successful + self.run_summary.failed
        success_rate = (self.run_summary.successful / total * 100) if total > 0 else 0

        # Build properties
        properties = {
            "Run ID": self.notion.build_title(self.run_summary.run_id),
            "Run Date": self.notion.build_date(self.run_summary.start_time.isoformat()),
            "Jobs Processed": self.notion.build_number(self.run_summary.jobs_processed),
            "Successful Enrichments": self.notion.build_number(self.run_summary.successful),
            "Failed Enrichments": self.notion.build_number(self.run_summary.failed),
            "Success Rate": self.notion.build_number(round(success_rate, 1)),
            "Duration Minutes": self.notion.build_number(
                round(self.run_summary.total_duration_ms / 60000, 2)
            ),
            "Data Sources Used": self.notion.build_multi_select(
                list(set(self.run_summary.data_sources))
            ),
        }

        if self.run_summary.errors:
            error_summary = "\n".join(self.run_summary.errors[:10])  # First 10 errors
            if len(self.run_summary.errors) > 10:
                error_summary += f"\n... and {len(self.run_summary.errors) - 10} more"
            properties["Error Summary"] = self.notion.build_rich_text(error_summary)

        # Create log entry
        result = self.notion.create_page(log_db_id, properties)
        if result.get('error'):
            print(f"Warning: Failed to log run: {result.get('message')}")
        else:
            print(f"Run logged to Notion: {self.run_summary.run_id}")

    def _print_summary(self):
        """Print run summary to console"""
        if not self.run_summary:
            return

        print(f"\n{'='*60}")
        print("RUN SUMMARY")
        print(f"{'='*60}")
        print(f"Run ID:       {self.run_summary.run_id}")
        print(f"Duration:     {self.run_summary.total_duration_ms / 1000:.1f} seconds")
        print(f"Processed:    {self.run_summary.jobs_processed}")
        print(f"Successful:   {self.run_summary.successful}")
        print(f"Failed:       {self.run_summary.failed}")

        if self.run_summary.errors:
            print(f"\nErrors ({len(self.run_summary.errors)}):")
            for err in self.run_summary.errors[:5]:
                print(f"  - {err}")
            if len(self.run_summary.errors) > 5:
                print(f"  ... and {len(self.run_summary.errors) - 5} more")

        print(f"{'='*60}\n")
