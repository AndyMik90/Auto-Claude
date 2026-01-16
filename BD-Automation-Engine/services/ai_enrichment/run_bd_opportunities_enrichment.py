#!/usr/bin/env python3
"""
BD Opportunities Enrichment - Enrich opportunities with win probability and analysis
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
BD_OPPORTUNITIES_DB_ID = os.getenv('NOTION_DB_BD_OPPORTUNITIES', '2bcdef65-baa5-8015-bf09-c01813f24b0a')


def query_database_page(cursor=None):
    """Query a single page of results"""
    url = f'https://api.notion.com/v1/databases/{BD_OPPORTUNITIES_DB_ID}/query'
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


def update_page(page_id, properties):
    """Update a single page"""
    url = f'https://api.notion.com/v1/pages/{page_id}'
    headers = {
        'Authorization': f'Bearer {NOTION_TOKEN}',
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    }

    body = {'properties': properties}

    try:
        resp = requests.patch(url, headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f'    Update error: {e}', flush=True)
        return False


def get_title_from_page(page):
    """Extract title from page properties"""
    props = page.get('properties', {})
    for key, val in props.items():
        if val.get('type') == 'title':
            return ''.join([t.get('plain_text', '') for t in val.get('title', [])])
    return ''


def extract_number(prop):
    """Extract number from property"""
    return prop.get('number')


def extract_select(prop):
    """Extract select value from property"""
    select = prop.get('select')
    return select.get('name') if select else None


def extract_rich_text(prop):
    """Extract rich text from property"""
    text_array = prop.get('rich_text', [])
    return ''.join([t.get('plain_text', '') for t in text_array])


def calculate_win_probability(agency, value, description):
    """Calculate win probability percentage"""
    prob = 50  # Base probability

    # Agency familiarity bonus
    familiar_agencies = ['DoD', 'Army', 'Air Force', 'Navy', 'DIA', 'NGA', 'NSA', 'NRO']
    if agency and any(a.lower() in agency.lower() for a in familiar_agencies):
        prob += 10

    # Size adjustment (smaller contracts = higher probability)
    if value:
        if value < 1_000_000:
            prob += 15
        elif value < 10_000_000:
            prob += 5
        elif value > 100_000_000:
            prob -= 10

    # Keyword indicators
    if description:
        desc_lower = description.lower()
        positive_indicators = ['small business', 'set-aside', 'sole source', 'dcgs', 'incumbent']
        negative_indicators = ['full and open', 'large business']

        for pos in positive_indicators:
            if pos in desc_lower:
                prob += 8

        for neg in negative_indicators:
            if neg in desc_lower:
                prob -= 10

    return max(min(prob, 95), 5)  # Clamp between 5-95%


def determine_priority_level(score):
    """Determine priority level based on score"""
    if score >= 80:
        return 'Critical'
    elif score >= 60:
        return 'High'
    elif score >= 40:
        return 'Medium'
    else:
        return 'Low'


def enrich_opportunity(page):
    """Enrich a single opportunity with priority score and level"""
    props = page.get('properties', {})

    # Extract existing values using actual property names from the database
    title = get_title_from_page(page)
    company = extract_rich_text(props.get('Company', {})) or extract_rich_text(props.get('Source Company', {}))
    matched_program = extract_rich_text(props.get('Matched Program', {}))
    value = extract_number(props.get('Value', {}))
    notes = extract_rich_text(props.get('Notes', {}))
    source_title = extract_rich_text(props.get('Source Job Title', {}))

    # Calculate priority score (0-100)
    score = 50  # Base score

    # DCGS/Intelligence keywords boost
    dcgs_keywords = ['dcgs', 'distributed common ground', 'isr', 'sigint', 'geoint',
                     'intelligence', 'surveillance', 'reconnaissance']
    text_to_check = (title + ' ' + company + ' ' + matched_program + ' ' + notes + ' ' + source_title).lower()
    keyword_hits = sum(1 for kw in dcgs_keywords if kw in text_to_check)
    score += min(keyword_hits * 10, 30)

    # Value-based boost
    if value:
        if value >= 10_000_000:
            score += 15
        elif value >= 1_000_000:
            score += 10
        elif value >= 100_000:
            score += 5

    # Program alignment boost
    if matched_program:
        score += 10

    score = min(score, 100)  # Cap at 100

    # Determine priority level
    priority_level = determine_priority_level(score)

    # Build update properties using existing DB schema
    update_props = {
        'Priority Score': {'number': score},
        'Priority Level': {'select': {'name': priority_level}}
    }

    return update_props, score, priority_level


def run_bd_opportunities_enrichment():
    """Run enrichment with pagination"""
    print('BD Opportunities Enrichment', flush=True)
    print('='*60, flush=True)
    print(f'Database ID: {BD_OPPORTUNITIES_DB_ID}', flush=True)
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

            try:
                update_props, win_prob, revenue_potential = enrich_opportunity(page)

                if update_page(page_id, update_props):
                    batch_success += 1
                    if (i + 1) % 10 == 0:
                        print(f'    {i+1}/{len(pages)} updated', flush=True)
                else:
                    batch_failed += 1
            except Exception as e:
                batch_failed += 1
                print(f'    Error enriching {title[:30]}: {e}', flush=True)

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

    return total_success, total_failed


if __name__ == '__main__':
    run_bd_opportunities_enrichment()
