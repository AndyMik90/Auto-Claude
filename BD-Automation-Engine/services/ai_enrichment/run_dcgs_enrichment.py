#!/usr/bin/env python3
"""
DCGS Contacts Enrichment - Paginated version for large database
Processes in batches of 50 for better progress visibility
"""
import sys
import os
import time

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import requests
from dotenv import load_dotenv

load_dotenv()

NOTION_TOKEN = os.getenv('NOTION_TOKEN')
DCGS_DB_ID = '2ccdef65-baa5-80d0-9b66-c67d66e7a54d'

# Tier patterns from engine.py
TIER_PATTERNS = {
    'Tier 1': ['ceo', 'chief executive', 'president', 'chairman', 'founder', 'owner',
               'managing director', 'general manager', 'executive director'],
    'Tier 2': ['cto', 'cfo', 'coo', 'cio', 'chief', 'svp', 'senior vice president',
               'executive vice president', 'evp', 'partner'],
    'Tier 3': ['vp', 'vice president', 'director', 'head of', 'general counsel'],
    'Tier 4': ['senior manager', 'sr manager', 'senior director', 'program manager',
               'project manager', 'business development', 'bd manager', 'capture'],
    'Tier 5': ['manager', 'lead', 'supervisor', 'coordinator', 'specialist', 'analyst',
               'engineer', 'developer', 'consultant', 'advisor'],
    'Tier 6': ['associate', 'assistant', 'intern', 'trainee', 'entry', 'junior', 'jr']
}

# Contact value scores
TIER_VALUES = {
    'Tier 1': 100, 'Tier 2': 85, 'Tier 3': 70,
    'Tier 4': 55, 'Tier 5': 40, 'Tier 6': 25
}


def get_tier(title):
    """Determine tier from job title"""
    if not title:
        return 'Tier 6'

    title_lower = title.lower()

    for tier, patterns in TIER_PATTERNS.items():
        for pattern in patterns:
            if pattern in title_lower:
                return tier

    return 'Tier 5'  # Default


def query_database_page(cursor=None, batch_num=0):
    """Query a single page of results"""
    url = f'https://api.notion.com/v1/databases/{DCGS_DB_ID}/query'
    headers = {
        'Authorization': f'Bearer {NOTION_TOKEN}',
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    }

    body = {'page_size': 50}
    if cursor:
        body['start_cursor'] = cursor

    try:
        start = time.time()
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        elapsed = time.time() - start
        print(f'  Query took {elapsed:.1f}s', flush=True)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        print(f'  Query timeout after 120s, retrying...', flush=True)
        return None
    except Exception as e:
        print(f'  Query error: {e}', flush=True)
        return None


def update_page(page_id, tier, value):
    """Update a single page"""
    url = f'https://api.notion.com/v1/pages/{page_id}'
    headers = {
        'Authorization': f'Bearer {NOTION_TOKEN}',
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    }

    body = {
        'properties': {
            'Tier': {'select': {'name': tier}},
            'Contact Value': {'number': value}
        }
    }

    try:
        resp = requests.patch(url, headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        return True
    except Exception as e:
        return False


def get_name_from_page(page):
    """Extract name from page properties"""
    props = page.get('properties', {})
    for key, val in props.items():
        if val.get('type') == 'title':
            return ''.join([t.get('plain_text', '') for t in val.get('title', [])])
    return ''


def get_title_from_page(page):
    """Extract job title from page properties"""
    props = page.get('properties', {})

    # Try common title field names
    for field in ['Title', 'Job Title', 'Position', 'Role']:
        if field in props:
            prop = props[field]
            if prop.get('type') == 'rich_text':
                return ''.join([t.get('plain_text', '') for t in prop.get('rich_text', [])])
            elif prop.get('type') == 'title':
                return ''.join([t.get('plain_text', '') for t in prop.get('title', [])])
            elif prop.get('type') == 'select':
                return prop.get('select', {}).get('name', '')

    return ''


def run_dcgs_enrichment():
    """Run enrichment with pagination"""
    print('psycopg2 not installed. Database features disabled.', flush=True)
    print('Enriching DCGS Contacts (largest - ~6000 records)...', flush=True)
    print('This will take approximately 30-45 minutes.', flush=True)
    print('', flush=True)

    total_success = 0
    total_failed = 0
    batch_num = 0
    cursor = None
    start_time = time.time()

    while True:
        batch_num += 1
        elapsed = (time.time() - start_time) / 60

        print(f'Batch {batch_num}: Processing... ({total_success} done, {elapsed:.1f} min elapsed)', flush=True)

        # Query this batch
        result = query_database_page(cursor)

        if not result:
            print(f'  Query failed, retrying in 5s...', flush=True)
            time.sleep(5)
            continue

        pages = result.get('results', [])
        has_more = result.get('has_more', False)
        cursor = result.get('next_cursor')

        if not pages:
            print('  No more pages', flush=True)
            break

        # Process this batch
        batch_success = 0
        batch_failed = 0
        print(f'  Updating {len(pages)} records...', flush=True)

        for i, page in enumerate(pages):
            page_id = page.get('id')
            title = get_title_from_page(page)
            tier = get_tier(title)
            value = TIER_VALUES.get(tier, 40)

            if update_page(page_id, tier, value):
                batch_success += 1
            else:
                batch_failed += 1

            # Progress every 10 records
            if (i + 1) % 10 == 0:
                print(f'    {i+1}/{len(pages)} updated', flush=True)

            time.sleep(0.35)  # Rate limiting

        total_success += batch_success
        total_failed += batch_failed
        print(f'  Done: {total_success} success, {total_failed} failed', flush=True)

        if not has_more:
            break

    elapsed = (time.time() - start_time) / 60
    print('', flush=True)
    print(f'Complete: {total_success} enriched, {total_failed} failed', flush=True)
    print(f'Time: {elapsed:.1f} minutes', flush=True)


if __name__ == '__main__':
    run_dcgs_enrichment()
