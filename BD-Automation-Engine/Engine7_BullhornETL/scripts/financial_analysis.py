"""
Financial Analysis Module
Calculates revenue, margins, and financial metrics from Bullhorn placement data.
"""

import sqlite3
import json
import csv
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"

# Standard assumptions for revenue calculation
HOURS_PER_WEEK = 40
WEEKS_PER_YEAR = 52
HOURS_PER_YEAR = HOURS_PER_WEEK * WEEKS_PER_YEAR  # 2080 hours

# Default placement duration if end_date not specified (in months)
DEFAULT_PLACEMENT_MONTHS = 12


def calculate_placement_revenue(placement: dict) -> dict:
    """Calculate revenue metrics for a single placement."""
    bill_rate = placement.get('bill_rate') or 0
    pay_rate = placement.get('pay_rate') or 0
    salary = placement.get('salary') or 0
    start_date = placement.get('start_date')
    end_date = placement.get('end_date')

    # Handle potential data issues (some rates might be annual, not hourly)
    if pay_rate > 500:  # Likely annual rate stored incorrectly
        pay_rate = pay_rate / HOURS_PER_YEAR
    if bill_rate > 500:
        bill_rate = bill_rate / HOURS_PER_YEAR

    # Calculate duration
    if start_date and end_date:
        try:
            start = datetime.strptime(str(start_date)[:10], '%Y-%m-%d')
            end = datetime.strptime(str(end_date)[:10], '%Y-%m-%d')
            duration_days = (end - start).days
        except:
            duration_days = DEFAULT_PLACEMENT_MONTHS * 30
    else:
        duration_days = DEFAULT_PLACEMENT_MONTHS * 30

    # Calculate hours (assuming 40 hr/week)
    duration_weeks = duration_days / 7
    total_hours = duration_weeks * HOURS_PER_WEEK

    # Calculate revenue
    gross_revenue = bill_rate * total_hours if bill_rate > 0 else 0
    cost = pay_rate * total_hours if pay_rate > 0 else 0
    gross_profit = gross_revenue - cost

    # Margin calculation
    margin_percent = (gross_profit / gross_revenue * 100) if gross_revenue > 0 else 0
    spread = bill_rate - pay_rate if bill_rate > 0 and pay_rate > 0 else 0

    return {
        'bill_rate': round(bill_rate, 2),
        'pay_rate': round(pay_rate, 2),
        'spread': round(spread, 2),
        'margin_percent': round(margin_percent, 1),
        'duration_days': duration_days,
        'total_hours': round(total_hours, 0),
        'gross_revenue': round(gross_revenue, 2),
        'cost': round(cost, 2),
        'gross_profit': round(gross_profit, 2)
    }


def run_financial_analysis():
    """Run comprehensive financial analysis."""
    print("="*80)
    print("FINANCIAL ANALYSIS")
    print("="*80)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all placements with financial data
    cursor.execute("""
        SELECT
            id, bullhorn_placement_id, client_name, job_title, candidate_name,
            status, start_date, end_date, salary, pay_rate, bill_rate
        FROM placements
        WHERE bill_rate > 0 OR pay_rate > 0 OR salary > 0
    """)

    placements = cursor.fetchall()
    print(f"\nAnalyzing {len(placements)} placements with financial data...")

    # Aggregate by prime contractor
    prime_financials = defaultdict(lambda: {
        'placements': [],
        'total_revenue': 0,
        'total_cost': 0,
        'total_profit': 0,
        'avg_bill_rate': [],
        'avg_pay_rate': [],
        'avg_margin': [],
        'total_hours': 0
    })

    # Process each placement
    for plc in placements:
        plc_dict = dict(plc)
        metrics = calculate_placement_revenue(plc_dict)

        prime = plc['client_name'] or 'Unknown'
        pf = prime_financials[prime]

        pf['placements'].append({
            'id': plc['bullhorn_placement_id'],
            'job_title': plc['job_title'],
            'candidate': plc['candidate_name'],
            'status': plc['status'],
            **metrics
        })

        pf['total_revenue'] += metrics['gross_revenue']
        pf['total_cost'] += metrics['cost']
        pf['total_profit'] += metrics['gross_profit']
        pf['total_hours'] += metrics['total_hours']

        if metrics['bill_rate'] > 0:
            pf['avg_bill_rate'].append(metrics['bill_rate'])
        if metrics['pay_rate'] > 0:
            pf['avg_pay_rate'].append(metrics['pay_rate'])
        if metrics['margin_percent'] > 0:
            pf['avg_margin'].append(metrics['margin_percent'])

    # Calculate averages
    for prime, data in prime_financials.items():
        data['avg_bill_rate'] = round(sum(data['avg_bill_rate']) / len(data['avg_bill_rate']), 2) if data['avg_bill_rate'] else 0
        data['avg_pay_rate'] = round(sum(data['avg_pay_rate']) / len(data['avg_pay_rate']), 2) if data['avg_pay_rate'] else 0
        data['avg_margin'] = round(sum(data['avg_margin']) / len(data['avg_margin']), 1) if data['avg_margin'] else 0
        data['placement_count'] = len(data['placements'])
        data['overall_margin'] = round((data['total_profit'] / data['total_revenue'] * 100), 1) if data['total_revenue'] > 0 else 0

    # Sort by total revenue
    sorted_primes = sorted(prime_financials.items(), key=lambda x: x[1]['total_revenue'], reverse=True)

    # Print report
    print("\n" + "="*80)
    print("REVENUE BY PRIME CONTRACTOR")
    print("="*80)
    print()
    print(f"{'Prime Contractor':<30} {'Placements':<12} {'Total Revenue':<15} {'Total Profit':<15} {'Margin %':<10}")
    print("-"*85)

    total_revenue = 0
    total_profit = 0
    total_placements = 0

    for prime, data in sorted_primes[:20]:  # Top 20
        print(f"{prime[:30]:<30} {data['placement_count']:<12} ${data['total_revenue']:>12,.0f} ${data['total_profit']:>12,.0f} {data['overall_margin']:>8.1f}%")
        total_revenue += data['total_revenue']
        total_profit += data['total_profit']
        total_placements += data['placement_count']

    print("-"*85)
    print(f"{'TOTAL':<30} {total_placements:<12} ${total_revenue:>12,.0f} ${total_profit:>12,.0f} {(total_profit/total_revenue*100) if total_revenue > 0 else 0:>8.1f}%")

    # Defense Primes breakdown
    print("\n" + "="*80)
    print("DEFENSE PRIME CONTRACTORS - DETAILED FINANCIALS")
    print("="*80)

    defense_primes = ['Leidos', 'General Dynamics IT', 'Peraton', 'Boeing', 'CACI International',
                      'Northrop Grumman', 'Lockheed Martin', 'Amentum', 'Dell Federal Services', 'SRA International']

    defense_total_revenue = 0
    defense_total_profit = 0

    for prime in defense_primes:
        if prime in prime_financials:
            data = prime_financials[prime]
            print(f"\n{prime}:")
            print(f"  Placements: {data['placement_count']}")
            print(f"  Total Revenue: ${data['total_revenue']:,.0f}")
            print(f"  Total Profit: ${data['total_profit']:,.0f}")
            print(f"  Overall Margin: {data['overall_margin']:.1f}%")
            print(f"  Avg Bill Rate: ${data['avg_bill_rate']:.2f}/hr")
            print(f"  Avg Pay Rate: ${data['avg_pay_rate']:.2f}/hr")
            print(f"  Total Hours: {data['total_hours']:,.0f}")

            defense_total_revenue += data['total_revenue']
            defense_total_profit += data['total_profit']

    print("\n" + "-"*60)
    print(f"DEFENSE PRIMES TOTAL:")
    print(f"  Total Revenue: ${defense_total_revenue:,.0f}")
    print(f"  Total Profit: ${defense_total_profit:,.0f}")
    print(f"  Overall Margin: {(defense_total_profit/defense_total_revenue*100) if defense_total_revenue > 0 else 0:.1f}%")

    # Rate analysis
    print("\n" + "="*80)
    print("RATE ANALYSIS BY PRIME")
    print("="*80)
    print()
    print(f"{'Prime Contractor':<30} {'Avg Bill':<12} {'Avg Pay':<12} {'Spread':<12} {'Margin':<10}")
    print("-"*80)

    for prime, data in sorted_primes[:15]:
        spread = data['avg_bill_rate'] - data['avg_pay_rate']
        print(f"{prime[:30]:<30} ${data['avg_bill_rate']:<10.2f} ${data['avg_pay_rate']:<10.2f} ${spread:<10.2f} {data['avg_margin']:<8.1f}%")

    # Save detailed report
    report = {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_placements_analyzed': len(placements),
            'total_revenue': round(total_revenue, 2),
            'total_profit': round(total_profit, 2),
            'overall_margin_percent': round((total_profit/total_revenue*100) if total_revenue > 0 else 0, 1),
            'defense_primes_revenue': round(defense_total_revenue, 2),
            'defense_primes_profit': round(defense_total_profit, 2)
        },
        'by_prime': {}
    }

    for prime, data in sorted_primes:
        report['by_prime'][prime] = {
            'placement_count': data['placement_count'],
            'total_revenue': round(data['total_revenue'], 2),
            'total_profit': round(data['total_profit'], 2),
            'total_cost': round(data['total_cost'], 2),
            'overall_margin_percent': data['overall_margin'],
            'avg_bill_rate': data['avg_bill_rate'],
            'avg_pay_rate': data['avg_pay_rate'],
            'avg_margin_percent': data['avg_margin'],
            'total_hours': data['total_hours']
        }

    report_path = OUTPUT_DIR / f"financial_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\nDetailed report saved to: {report_path}")

    # Export to CSV
    csv_path = OUTPUT_DIR / f"prime_financials_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Prime Contractor', 'Placements', 'Total Revenue', 'Total Profit',
            'Total Cost', 'Margin %', 'Avg Bill Rate', 'Avg Pay Rate', 'Total Hours'
        ])

        for prime, data in sorted_primes:
            writer.writerow([
                prime,
                data['placement_count'],
                round(data['total_revenue'], 2),
                round(data['total_profit'], 2),
                round(data['total_cost'], 2),
                data['overall_margin'],
                data['avg_bill_rate'],
                data['avg_pay_rate'],
                data['total_hours']
            ])

    print(f"CSV export saved to: {csv_path}")

    conn.close()
    return report


if __name__ == "__main__":
    run_financial_analysis()
