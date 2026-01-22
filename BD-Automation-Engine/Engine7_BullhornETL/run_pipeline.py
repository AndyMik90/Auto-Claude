#!/usr/bin/env python3
"""
Engine 7: Bullhorn ETL Pipeline Orchestrator
Runs all ETL steps in sequence to process Bullhorn exports and generate BD intelligence.

Usage:
    python run_pipeline.py [--full] [--skip-etl] [--reports-only]

Steps:
1. ETL - Extract, transform, load Bullhorn data
2. Cleanup - Normalize company names
3. Financials - Calculate revenue metrics
4. Programs - Link to Federal Programs database
5. Contacts - Score contact engagement
6. Reports - Generate comprehensive reports
7. Export - Create Notion-compatible CSVs
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime

# Add scripts directory to path
SCRIPTS_DIR = Path(__file__).parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))


def run_step(step_name: str, module_name: str, function_name: str = None):
    """Run a pipeline step."""
    print()
    print("="*80)
    print(f"STEP: {step_name}")
    print("="*80)

    try:
        module = __import__(module_name)
        if function_name:
            func = getattr(module, function_name)
            result = func()
        else:
            # Module has __main__ execution
            if hasattr(module, 'run'):
                result = module.run()
            elif hasattr(module, 'main'):
                result = module.main()
            else:
                result = None
        print(f"[OK] {step_name} completed successfully")
        return True, result
    except Exception as e:
        print(f"[ERROR] {step_name} failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, None


def run_full_pipeline():
    """Run the complete ETL pipeline."""
    print()
    print("="*80)
    print("ENGINE 7: BULLHORN ETL PIPELINE")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    results = {}
    success_count = 0
    fail_count = 0

    # Step 1: ETL
    success, result = run_step(
        "1. ETL - Extract & Load Bullhorn Data",
        "bullhorn_etl_v2",
        "BullhornETLv2"
    )
    if success:
        # Need to run the ETL
        from bullhorn_etl_v2 import BullhornETLv2
        etl = BullhornETLv2()
        results['etl'] = etl.run()
        success_count += 1
    else:
        fail_count += 1

    # Step 2: Data Cleanup
    success, result = run_step(
        "2. Data Cleanup - Normalize Company Names",
        "data_cleanup",
        "run_cleanup"
    )
    results['cleanup'] = result
    success_count += 1 if success else 0
    fail_count += 0 if success else 1

    # Step 3: Financial Analysis
    success, result = run_step(
        "3. Financial Analysis - Calculate Revenue Metrics",
        "financial_analysis",
        "run_financial_analysis"
    )
    results['financials'] = result
    success_count += 1 if success else 0
    fail_count += 0 if success else 1

    # Step 4: Link to Federal Programs
    success, result = run_step(
        "4. Federal Programs - Link Placements to Programs",
        "link_to_federal_programs",
        "run_linking"
    )
    results['programs'] = result
    success_count += 1 if success else 0
    fail_count += 0 if success else 1

    # Step 5: Contact Scoring
    success, result = run_step(
        "5. Contact Scoring - Calculate Engagement Scores",
        "contact_scoring",
        "run_contact_scoring"
    )
    results['contacts'] = result
    success_count += 1 if success else 0
    fail_count += 0 if success else 1

    # Step 6: Past Performance Report
    success, result = run_step(
        "6. Past Performance Report - Generate Analytics",
        "past_performance_report",
        "generate_past_performance_report"
    )
    results['past_performance'] = result
    success_count += 1 if success else 0
    fail_count += 0 if success else 1

    # Step 7: Notion Export
    success, result = run_step(
        "7. Export - Generate Notion-Compatible CSVs",
        "export_to_notion",
        "run_export"
    )
    results['export'] = result
    success_count += 1 if success else 0
    fail_count += 0 if success else 1

    # Final summary
    print()
    print("="*80)
    print("PIPELINE COMPLETE")
    print("="*80)
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Steps completed: {success_count}")
    print(f"Steps failed: {fail_count}")
    print()
    print("Output files in: Engine7_BullhornETL/outputs/")
    print("Database at: Engine7_BullhornETL/data/bullhorn_master.db")

    return results


def run_reports_only():
    """Run only the reporting steps (skip ETL)."""
    print()
    print("="*80)
    print("ENGINE 7: REPORTS ONLY MODE")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    results = {}

    # Financial Analysis
    success, result = run_step(
        "Financial Analysis",
        "financial_analysis",
        "run_financial_analysis"
    )
    results['financials'] = result

    # Federal Programs Linking
    success, result = run_step(
        "Federal Programs Linking",
        "link_to_federal_programs",
        "run_linking"
    )
    results['programs'] = result

    # Contact Scoring
    success, result = run_step(
        "Contact Scoring",
        "contact_scoring",
        "run_contact_scoring"
    )
    results['contacts'] = result

    # Past Performance Report
    success, result = run_step(
        "Past Performance Report",
        "past_performance_report",
        "generate_past_performance_report"
    )
    results['past_performance'] = result

    # Notion Export
    success, result = run_step(
        "Notion Export",
        "export_to_notion",
        "run_export"
    )
    results['export'] = result

    print()
    print("="*80)
    print("REPORTS COMPLETE")
    print("="*80)

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Engine 7: Bullhorn ETL Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_pipeline.py              # Run full pipeline
  python run_pipeline.py --reports    # Run reports only (skip ETL)
  python run_pipeline.py --help       # Show this help

Steps in full pipeline:
  1. ETL - Extract, transform, load Bullhorn data
  2. Cleanup - Normalize company names
  3. Financials - Calculate revenue metrics
  4. Programs - Link to Federal Programs database
  5. Contacts - Score contact engagement
  6. Reports - Generate comprehensive reports
  7. Export - Create Notion-compatible CSVs
        """
    )

    parser.add_argument(
        '--reports', '--reports-only',
        action='store_true',
        help='Run only reporting steps (skip ETL)'
    )

    parser.add_argument(
        '--full',
        action='store_true',
        help='Run full pipeline including ETL'
    )

    args = parser.parse_args()

    if args.reports:
        run_reports_only()
    else:
        run_full_pipeline()


if __name__ == "__main__":
    main()
