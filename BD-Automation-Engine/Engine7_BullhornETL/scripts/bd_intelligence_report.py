"""
BD Intelligence Report Generator
Creates a comprehensive Business Development intelligence report combining all data sources.
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"


def generate_bd_intelligence_report():
    """Generate comprehensive BD intelligence report."""
    print("="*80)
    print("BD INTELLIGENCE REPORT GENERATOR")
    print("="*80)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    report = {
        'report_title': 'BD Intelligence Report - Bullhorn CRM Analysis',
        'generated_at': datetime.now().isoformat(),
        'executive_summary': {},
        'defense_primes': {},
        'federal_programs': {},
        'financial_metrics': {},
        'contact_intelligence': {},
        'opportunities': [],
        'recommendations': []
    }

    # =========================================
    # EXECUTIVE SUMMARY
    # =========================================
    print("\nGenerating Executive Summary...")

    cursor.execute("SELECT COUNT(*) FROM jobs")
    total_jobs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM placements")
    total_placements = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM candidates")
    total_contacts = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM activities")
    total_activities = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT client_name) FROM placements WHERE client_name IS NOT NULL")
    total_companies = cursor.fetchone()[0]

    cursor.execute("""
        SELECT SUM(bill_rate * 2080) as annual_revenue
        FROM placements
        WHERE bill_rate > 0 AND bill_rate < 500
    """)
    est_annual_revenue = cursor.fetchone()[0] or 0

    report['executive_summary'] = {
        'total_jobs': total_jobs,
        'total_placements': total_placements,
        'total_contacts': total_contacts,
        'total_activities': total_activities,
        'total_companies': total_companies,
        'estimated_annual_revenue': round(est_annual_revenue, 2),
        'date_range': '2008-2026',
        'primary_focus': 'Federal Defense & IT Staffing'
    }

    # =========================================
    # DEFENSE PRIMES ANALYSIS
    # =========================================
    print("Analyzing Defense Prime Contractors...")

    defense_primes = ['Leidos', 'General Dynamics IT', 'Peraton', 'Boeing',
                      'CACI International', 'Northrop Grumman', 'Lockheed Martin',
                      'Amentum', 'Dell Federal Services', 'SRA International']

    for prime in defense_primes:
        cursor.execute("""
            SELECT
                COUNT(*) as placements,
                AVG(CASE WHEN bill_rate > 0 AND bill_rate < 500 THEN bill_rate END) as avg_bill,
                AVG(CASE WHEN pay_rate > 0 AND pay_rate < 500 THEN pay_rate END) as avg_pay,
                MIN(start_date) as first_date,
                MAX(start_date) as last_date
            FROM placements
            WHERE client_name = ?
        """, (prime,))
        row = cursor.fetchone()

        if row and row['placements'] > 0:
            avg_bill = row['avg_bill'] or 0
            avg_pay = row['avg_pay'] or 0
            margin = ((avg_bill - avg_pay) / avg_bill * 100) if avg_bill > 0 else 0

            report['defense_primes'][prime] = {
                'placements': row['placements'],
                'avg_bill_rate': round(avg_bill, 2),
                'avg_pay_rate': round(avg_pay, 2),
                'avg_margin_percent': round(margin, 1),
                'first_engagement': str(row['first_date'])[:10] if row['first_date'] else None,
                'last_engagement': str(row['last_date'])[:10] if row['last_date'] else None,
                'estimated_annual_revenue': round(row['placements'] * avg_bill * 2080, 2) if avg_bill > 0 else 0
            }

    # =========================================
    # FEDERAL PROGRAMS
    # =========================================
    print("Analyzing Federal Programs...")

    cursor.execute("""
        SELECT program_name, agency, COUNT(*) as link_count
        FROM placement_program_links
        GROUP BY program_name, agency
        ORDER BY link_count DESC
        LIMIT 20
    """)

    top_programs = []
    for row in cursor.fetchall():
        top_programs.append({
            'program': row['program_name'],
            'agency': row['agency'],
            'placements_linked': row['link_count']
        })

    report['federal_programs'] = {
        'total_programs_linked': len(top_programs),
        'top_programs': top_programs
    }

    # =========================================
    # FINANCIAL METRICS
    # =========================================
    print("Calculating Financial Metrics...")

    cursor.execute("""
        SELECT
            client_name,
            COUNT(*) as placements,
            AVG(CASE WHEN bill_rate > 0 AND bill_rate < 500 THEN bill_rate END) as avg_bill,
            AVG(CASE WHEN pay_rate > 0 AND pay_rate < 500 THEN pay_rate END) as avg_pay,
            SUM(CASE WHEN bill_rate > 0 AND bill_rate < 500 THEN bill_rate * 2080 ELSE 0 END) as total_revenue
        FROM placements
        WHERE client_name IS NOT NULL
        GROUP BY client_name
        ORDER BY total_revenue DESC
        LIMIT 15
    """)

    top_revenue = []
    for row in cursor.fetchall():
        top_revenue.append({
            'company': row['client_name'],
            'placements': row['placements'],
            'avg_bill_rate': round(row['avg_bill'] or 0, 2),
            'avg_pay_rate': round(row['avg_pay'] or 0, 2),
            'estimated_revenue': round(row['total_revenue'] or 0, 2)
        })

    report['financial_metrics'] = {
        'top_revenue_accounts': top_revenue,
        'defense_share_percent': round(
            sum(p.get('estimated_annual_revenue', 0) for p in report['defense_primes'].values()) /
            est_annual_revenue * 100 if est_annual_revenue > 0 else 0, 1
        )
    }

    # =========================================
    # CONTACT INTELLIGENCE
    # =========================================
    print("Analyzing Contact Intelligence...")

    cursor.execute("""
        SELECT tier, COUNT(*) as count
        FROM contact_scores
        GROUP BY tier
        ORDER BY tier
    """)

    tier_distribution = {}
    for row in cursor.fetchall():
        tier_distribution[row['tier']] = row['count']

    cursor.execute("""
        SELECT contact_name, score, tier, primes, placement_count
        FROM contact_scores
        ORDER BY score DESC
        LIMIT 20
    """)

    top_contacts = []
    for row in cursor.fetchall():
        top_contacts.append({
            'name': row['contact_name'],
            'score': row['score'],
            'tier': row['tier'],
            'primes': row['primes'],
            'placements': row['placement_count']
        })

    report['contact_intelligence'] = {
        'tier_distribution': tier_distribution,
        'top_contacts': top_contacts
    }

    # =========================================
    # OPPORTUNITIES & RECOMMENDATIONS
    # =========================================
    print("Generating Recommendations...")

    # Identify growth opportunities
    opportunities = []

    # High-value primes with growth potential
    for prime, data in report['defense_primes'].items():
        if data['placements'] >= 10 and data['avg_margin_percent'] >= 35:
            opportunities.append({
                'type': 'Expand Existing Relationship',
                'target': prime,
                'rationale': f"Strong margin ({data['avg_margin_percent']}%) with {data['placements']} active placements",
                'priority': 'High'
            })

    # Programs with limited staffing
    for prog in top_programs[:10]:
        if prog['placements_linked'] >= 50:
            opportunities.append({
                'type': 'Program Focus',
                'target': prog['program'],
                'rationale': f"High-volume program ({prog['placements_linked']} placements) at {prog['agency']}",
                'priority': 'Medium'
            })

    report['opportunities'] = opportunities

    # Generate recommendations
    recommendations = [
        {
            'category': 'Revenue Growth',
            'recommendation': 'Focus on expanding relationships with top 5 defense primes (Leidos, GDIT, Peraton, Boeing, CACI)',
            'impact': 'High',
            'effort': 'Medium'
        },
        {
            'category': 'Margin Improvement',
            'recommendation': 'Target higher bill rates on new placements - current avg is competitive but can improve',
            'impact': 'Medium',
            'effort': 'Low'
        },
        {
            'category': 'Contact Engagement',
            'recommendation': 'Re-engage Tier D and E contacts (77% of database) with targeted outreach',
            'impact': 'High',
            'effort': 'High'
        },
        {
            'category': 'Program Diversification',
            'recommendation': 'Explore adjacent federal programs in DHA, DISA, and NGA portfolios',
            'impact': 'Medium',
            'effort': 'Medium'
        }
    ]

    report['recommendations'] = recommendations

    # =========================================
    # SAVE REPORT
    # =========================================
    print("\nSaving report...")

    report_path = OUTPUT_DIR / f"bd_intelligence_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"Report saved to: {report_path}")

    # Print summary
    print("\n" + "="*80)
    print("BD INTELLIGENCE REPORT SUMMARY")
    print("="*80)

    print("\n** EXECUTIVE SUMMARY **")
    print(f"  Total Jobs: {report['executive_summary']['total_jobs']}")
    print(f"  Total Placements: {report['executive_summary']['total_placements']}")
    print(f"  Total Contacts: {report['executive_summary']['total_contacts']}")
    print(f"  Total Companies: {report['executive_summary']['total_companies']}")
    print(f"  Est. Annual Revenue: ${report['executive_summary']['estimated_annual_revenue']:,.0f}")

    print("\n** TOP DEFENSE PRIMES **")
    for prime, data in sorted(report['defense_primes'].items(),
                               key=lambda x: x[1].get('estimated_annual_revenue', 0), reverse=True)[:5]:
        print(f"  {prime}: {data['placements']} placements, ${data['estimated_annual_revenue']:,.0f} est. revenue")

    print("\n** TOP FEDERAL PROGRAMS **")
    for prog in report['federal_programs']['top_programs'][:5]:
        print(f"  {prog['program']} ({prog['agency']}): {prog['placements_linked']} placements")

    print("\n** KEY RECOMMENDATIONS **")
    for rec in recommendations[:3]:
        print(f"  [{rec['category']}] {rec['recommendation']}")

    conn.close()

    print("\n" + "="*80)
    print("REPORT GENERATION COMPLETE")
    print("="*80)

    return report


if __name__ == "__main__":
    generate_bd_intelligence_report()
