#!/usr/bin/env python3
"""
Basic Enrichment Runner - Fast enrichment without AI
Enriches Tier + Contact Value for all contacts
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from services.ai_enrichment.notion_client import NotionClient
from services.ai_enrichment.engine import EnrichmentEngine


def run_basic_contact_enrichment():
    """Run basic contact enrichment without AI (fast)"""
    notion = NotionClient()
    engine = EnrichmentEngine()

    # Disable AI for this run
    engine.client = None

    databases = [
        ('ff111f82-fdbd-4353-ad59-ea4de70a058b', 'GDIT PTS Contacts'),
        ('c1b1d358-9d82-4f03-b77c-db43d9795c6f', 'GDIT Other Contacts'),
        ('2ccdef65-baa5-80d0-9b66-c67d66e7a54d', 'DCGS Contacts'),
    ]

    total_success = 0
    total_failed = 0

    for db_id, db_name in databases:
        print(f"\n{'='*60}")
        print(f"Processing: {db_name}")
        print(f"{'='*60}")

        # Get all contacts
        all_pages = notion.query_all_pages(db_id)
        print(f"Found {len(all_pages)} contacts")

        success = 0
        failed = 0

        for i, page in enumerate(all_pages):
            page_id = page.get('id')
            props = page.get('properties', {})

            # Get name for display
            name = ''
            for key, val in props.items():
                if val.get('type') == 'title':
                    name = ''.join([t.get('plain_text', '') for t in val.get('title', [])])
                    break

            # Run enrichment (without AI)
            enriched = engine.enrich_contact(page)

            if enriched:
                # Only keep basic fields (Tier, Contact Value)
                basic_enriched = {
                    k: v for k, v in enriched.items()
                    if k in ['Tier', 'Contact Value']
                }

                result = notion.update_page(page_id, basic_enriched)
                if result.get('error'):
                    failed += 1
                    if failed <= 5:  # Only show first 5 errors
                        print(f"  [{i+1}] FAILED: {result.get('message')[:50]}")
                else:
                    success += 1
                    tier = enriched.get('Tier', {}).get('select', {}).get('name', '?')
                    value = enriched.get('Contact Value', {}).get('number', 0)

                    # Progress every 100 records
                    if (i + 1) % 100 == 0:
                        print(f"  Progress: {i+1}/{len(all_pages)} ({success} enriched)")

            time.sleep(0.35)  # Rate limiting

        print(f"\n{db_name}: {success} enriched, {failed} failed")
        total_success += success
        total_failed += failed

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_success} enriched, {total_failed} failed")
    print(f"{'='*60}")


if __name__ == "__main__":
    print("Starting BASIC enrichment (Tier + Contact Value only, no AI)")
    print("This is much faster than full AI enrichment\n")
    run_basic_contact_enrichment()
