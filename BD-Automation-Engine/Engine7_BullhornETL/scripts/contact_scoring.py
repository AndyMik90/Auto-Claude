"""
Contact Engagement Scoring System
Scores contacts based on activity, placements, relationship strength, and recency.
"""

import sqlite3
import json
import csv
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"


def calculate_contact_score(contact_data: dict) -> dict:
    """
    Calculate engagement score for a contact.

    Scoring factors:
    - Activity count (notes, visits, submissions): up to 30 points
    - Placement count: up to 30 points
    - Recency of activity: up to 20 points
    - Relationship diversity (multiple primes): up to 10 points
    - Status (active, new lead, etc.): up to 10 points
    """
    score = 0
    factors = []

    # Activity score (max 30 points)
    activity_count = contact_data.get('activity_count', 0)
    if activity_count >= 20:
        activity_score = 30
    elif activity_count >= 10:
        activity_score = 25
    elif activity_count >= 5:
        activity_score = 20
    elif activity_count >= 2:
        activity_score = 10
    elif activity_count >= 1:
        activity_score = 5
    else:
        activity_score = 0

    score += activity_score
    if activity_score > 0:
        factors.append(f"Activity ({activity_count} interactions): +{activity_score}")

    # Placement score (max 30 points)
    placement_count = contact_data.get('placement_count', 0)
    if placement_count >= 5:
        placement_score = 30
    elif placement_count >= 3:
        placement_score = 25
    elif placement_count >= 2:
        placement_score = 20
    elif placement_count >= 1:
        placement_score = 15
    else:
        placement_score = 0

    score += placement_score
    if placement_score > 0:
        factors.append(f"Placements ({placement_count}): +{placement_score}")

    # Recency score (max 20 points)
    last_activity = contact_data.get('last_activity_date')
    if last_activity:
        try:
            last_date = datetime.strptime(str(last_activity)[:10], '%Y-%m-%d')
            days_ago = (datetime.now() - last_date).days

            if days_ago <= 30:
                recency_score = 20
            elif days_ago <= 90:
                recency_score = 15
            elif days_ago <= 180:
                recency_score = 10
            elif days_ago <= 365:
                recency_score = 5
            else:
                recency_score = 0

            score += recency_score
            if recency_score > 0:
                factors.append(f"Recent activity ({days_ago} days ago): +{recency_score}")
        except:
            pass

    # Relationship diversity score (max 10 points)
    prime_count = contact_data.get('prime_count', 0)
    if prime_count >= 3:
        diversity_score = 10
    elif prime_count >= 2:
        diversity_score = 7
    elif prime_count >= 1:
        diversity_score = 3
    else:
        diversity_score = 0

    score += diversity_score
    if diversity_score > 0:
        factors.append(f"Prime diversity ({prime_count} primes): +{diversity_score}")

    # Status score (max 10 points)
    status = contact_data.get('status', '').lower()
    if 'active' in status:
        status_score = 10
    elif 'new lead' in status:
        status_score = 8
    elif 'submitted' in status:
        status_score = 5
    else:
        status_score = 0

    score += status_score
    if status_score > 0:
        factors.append(f"Status ({status}): +{status_score}")

    # Determine tier
    if score >= 70:
        tier = 'A - Strategic'
    elif score >= 50:
        tier = 'B - High Value'
    elif score >= 30:
        tier = 'C - Engaged'
    elif score >= 15:
        tier = 'D - Developing'
    else:
        tier = 'E - New/Inactive'

    return {
        'score': score,
        'tier': tier,
        'factors': factors
    }


def run_contact_scoring():
    """Run contact scoring for all contacts in the database."""
    print("="*80)
    print("CONTACT ENGAGEMENT SCORING")
    print("="*80)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all contacts with their activity data
    print("\nGathering contact data...")

    # Get contacts from placements
    cursor.execute("""
        SELECT
            candidate_name as name,
            client_name as prime,
            status,
            start_date
        FROM placements
        WHERE candidate_name IS NOT NULL
    """)
    placement_data = cursor.fetchall()

    # Get contacts from activities
    cursor.execute("""
        SELECT
            note_text,
            activity_date,
            actor
        FROM activities
        WHERE note_text LIKE '%Contact:%'
    """)
    activity_data = cursor.fetchall()

    # Build contact profiles
    contacts = defaultdict(lambda: {
        'name': '',
        'placements': [],
        'activities': [],
        'primes': set(),
        'statuses': set(),
        'last_activity_date': None,
        'activity_count': 0,
        'placement_count': 0
    })

    # Process placements
    for row in placement_data:
        name = row['name']
        if name:
            contacts[name]['name'] = name
            contacts[name]['placements'].append(dict(row))
            contacts[name]['placement_count'] += 1
            if row['prime']:
                contacts[name]['primes'].add(row['prime'])
            if row['status']:
                contacts[name]['statuses'].add(row['status'])
            if row['start_date']:
                date_str = str(row['start_date'])[:10]
                if contacts[name]['last_activity_date'] is None or date_str > contacts[name]['last_activity_date']:
                    contacts[name]['last_activity_date'] = date_str

    # Process activities (extract contact names from notes)
    for row in activity_data:
        note = row['note_text'] or ''
        if 'Contact:' in note:
            # Extract contact name from "Contact: Name"
            import re
            match = re.search(r'Contact:\s*([^,\n]+)', note)
            if match:
                name = match.group(1).strip()
                if name:
                    contacts[name]['activity_count'] += 1
                    if row['activity_date']:
                        date_str = str(row['activity_date'])[:10]
                        if contacts[name]['last_activity_date'] is None or date_str > contacts[name]['last_activity_date']:
                            contacts[name]['last_activity_date'] = date_str

    # Also count from the candidates table
    cursor.execute("""
        SELECT full_name, company_name
        FROM candidates
        WHERE full_name IS NOT NULL
    """)
    candidate_data = cursor.fetchall()

    for row in candidate_data:
        name = row['full_name']
        if name and name in contacts:
            if row['company_name']:
                contacts[name]['primes'].add(row['company_name'])

    print(f"Found {len(contacts)} unique contacts")

    # Score all contacts
    print("\nScoring contacts...")
    scored_contacts = []

    for name, data in contacts.items():
        contact_data = {
            'name': name,
            'activity_count': data['activity_count'],
            'placement_count': data['placement_count'],
            'last_activity_date': data['last_activity_date'],
            'prime_count': len(data['primes']),
            'status': list(data['statuses'])[0] if data['statuses'] else ''
        }

        scoring = calculate_contact_score(contact_data)

        scored_contacts.append({
            'name': name,
            'score': scoring['score'],
            'tier': scoring['tier'],
            'factors': scoring['factors'],
            'placements': data['placement_count'],
            'activities': data['activity_count'],
            'primes': list(data['primes']),
            'last_activity': data['last_activity_date']
        })

    # Sort by score
    scored_contacts.sort(key=lambda x: x['score'], reverse=True)

    # Print tier distribution
    tier_counts = defaultdict(int)
    for contact in scored_contacts:
        tier_counts[contact['tier']] += 1

    print("\n" + "="*80)
    print("TIER DISTRIBUTION")
    print("="*80)
    for tier in sorted(tier_counts.keys()):
        count = tier_counts[tier]
        pct = count / len(scored_contacts) * 100 if scored_contacts else 0
        bar = '#' * int(pct / 2)
        print(f"{tier:<20} {count:>5} contacts ({pct:>5.1f}%) {bar}")

    # Print top contacts
    print("\n" + "="*80)
    print("TOP 25 CONTACTS BY ENGAGEMENT SCORE")
    print("="*80)
    print()
    print(f"{'Name':<35} {'Score':<8} {'Tier':<15} {'Placements':<12} {'Primes':<20}")
    print("-"*95)

    for contact in scored_contacts[:25]:
        primes_str = ', '.join(contact['primes'][:2])
        if len(contact['primes']) > 2:
            primes_str += f" +{len(contact['primes'])-2} more"
        print(f"{contact['name'][:35]:<35} {contact['score']:<8} {contact['tier']:<15} {contact['placements']:<12} {primes_str[:20]:<20}")

    # Save scored contacts to database
    print("\nStoring scores in database...")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contact_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_name VARCHAR(200),
            score INTEGER,
            tier VARCHAR(50),
            placement_count INTEGER,
            activity_count INTEGER,
            prime_count INTEGER,
            primes TEXT,
            last_activity_date VARCHAR(20),
            scoring_factors TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("DELETE FROM contact_scores")

    for contact in scored_contacts:
        cursor.execute("""
            INSERT INTO contact_scores
            (contact_name, score, tier, placement_count, activity_count, prime_count, primes, last_activity_date, scoring_factors)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            contact['name'],
            contact['score'],
            contact['tier'],
            contact['placements'],
            contact['activities'],
            len(contact['primes']),
            ', '.join(contact['primes']),
            contact['last_activity'],
            ', '.join(contact['factors'])
        ))

    conn.commit()
    print(f"Stored {len(scored_contacts)} contact scores")

    # Generate reports
    report = {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_contacts': len(scored_contacts),
            'tier_distribution': dict(tier_counts),
            'avg_score': sum(c['score'] for c in scored_contacts) / len(scored_contacts) if scored_contacts else 0
        },
        'top_contacts': scored_contacts[:50]
    }

    report_path = OUTPUT_DIR / f"contact_scores_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")

    # Export to CSV
    csv_path = OUTPUT_DIR / f"contact_scores_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Name', 'Score', 'Tier', 'Placements', 'Activities', 'Primes', 'Last Activity', 'Scoring Factors'])

        for contact in scored_contacts:
            writer.writerow([
                contact['name'],
                contact['score'],
                contact['tier'],
                contact['placements'],
                contact['activities'],
                ', '.join(contact['primes']),
                contact['last_activity'],
                ' | '.join(contact['factors'])
            ])

    print(f"CSV export saved to: {csv_path}")

    conn.close()

    print("\n" + "="*80)
    print("CONTACT SCORING COMPLETE")
    print("="*80)

    return report


if __name__ == "__main__":
    run_contact_scoring()
