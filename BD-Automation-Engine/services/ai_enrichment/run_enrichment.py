#!/usr/bin/env python3
"""
BD Enrichment Pipeline Runner

Usage:
    python run_enrichment.py                    # Run full pipeline once
    python run_enrichment.py --dry-run          # Preview without writing
    python run_enrichment.py --poll             # Continuous polling mode
    python run_enrichment.py --jobs-only        # Only enrich jobs
    python run_enrichment.py --contacts-only    # Only enrich contacts
    python run_enrichment.py --call-sheet       # Generate call sheet
"""
import argparse
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from services.ai_enrichment.orchestrator import EnrichmentOrchestrator, EnrichmentType
from services.ai_enrichment.notion_client import NotionClient


def main():
    parser = argparse.ArgumentParser(
        description="BD Enrichment Pipeline - Enrich Notion databases with AI"
    )

    # Mode selection
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to Notion"
    )
    parser.add_argument(
        "--poll",
        action="store_true",
        help="Run continuously, polling for new records"
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=300,
        help="Seconds between polls (default: 300)"
    )

    # Scope selection
    parser.add_argument(
        "--jobs-only",
        action="store_true",
        help="Only enrich job records"
    )
    parser.add_argument(
        "--contacts-only",
        action="store_true",
        help="Only enrich contact records"
    )
    parser.add_argument(
        "--opportunities-only",
        action="store_true",
        help="Only enrich opportunity records"
    )

    # Special commands
    parser.add_argument(
        "--call-sheet",
        action="store_true",
        help="Generate a prioritized call sheet"
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=60,
        help="Minimum BD score for call sheet (default: 60)"
    )

    # Single record processing
    parser.add_argument(
        "--page-id",
        type=str,
        help="Enrich a single page by ID"
    )
    parser.add_argument(
        "--page-type",
        type=str,
        choices=["job", "contact", "opportunity"],
        default="job",
        help="Type of the page to enrich (default: job)"
    )

    args = parser.parse_args()

    # Initialize orchestrator
    print("Initializing BD Enrichment Pipeline...")
    orchestrator = EnrichmentOrchestrator()

    # Handle special commands
    if args.call_sheet:
        print(f"\nGenerating call sheet (min score: {args.min_score})...")
        call_sheet = orchestrator.generate_call_sheet(min_score=args.min_score)

        print(f"\n{'='*80}")
        print(f"PRIORITIZED CALL SHEET ({len(call_sheet)} opportunities)")
        print(f"{'='*80}")

        for i, item in enumerate(call_sheet, 1):
            print(f"\n{i}. {item['title']}")
            print(f"   Company:  {item['company']}")
            print(f"   Location: {item['location']}")
            print(f"   Score:    {item['bd_score']} ({item['priority']})")
            if item['mapped_programs']:
                print(f"   Programs: {item['mapped_programs']}")

        return

    # Handle single page enrichment
    if args.page_id:
        print(f"\nEnriching single page: {args.page_id}")
        type_map = {
            "job": EnrichmentType.JOB,
            "contact": EnrichmentType.CONTACT,
            "opportunity": EnrichmentType.OPPORTUNITY
        }
        result = orchestrator.enrich_single_record(
            page_id=args.page_id,
            enrichment_type=type_map[args.page_type],
            dry_run=args.dry_run
        )

        if result.success:
            print(f"SUCCESS: Updated {len(result.fields_updated)} fields")
            print(f"Fields: {', '.join(result.fields_updated)}")
        else:
            print(f"FAILED: {result.error}")

        return

    # Determine scope
    enrich_jobs = not (args.contacts_only or args.opportunities_only)
    enrich_contacts = not (args.jobs_only or args.opportunities_only)
    enrich_opportunities = not (args.jobs_only or args.contacts_only)

    # Handle polling mode
    if args.poll:
        orchestrator.poll_and_enrich(interval_seconds=args.poll_interval)
    else:
        # Single run
        orchestrator.run_full_pipeline(
            enrich_jobs=enrich_jobs,
            enrich_contacts=enrich_contacts,
            enrich_opportunities=enrich_opportunities,
            dry_run=args.dry_run
        )


if __name__ == "__main__":
    main()
