#!/usr/bin/env python3
"""
BD Automation Engine - Quick Start Script
Validates environment, tests components, and runs a sample pipeline.

Usage:
    python quickstart.py --check     # Verify environment setup
    python quickstart.py --test      # Run test pipeline with sample data
    python quickstart.py --full      # Run full pipeline
    python quickstart.py --schedule  # Start scheduled runs
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Project root
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))


def print_header(title: str):
    """Print a formatted header."""
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}\n")


def print_status(name: str, status: bool, details: str = ""):
    """Print a status line."""
    icon = "[OK]" if status else "[X]"
    print(f"  {icon} {name}: {details}")


def check_environment():
    """Check environment configuration."""
    print_header("Environment Check")

    checks_passed = 0
    checks_total = 0

    # Check Python version
    checks_total += 1
    py_version = sys.version_info
    if py_version >= (3, 10):
        print_status("Python Version", True, f"{py_version.major}.{py_version.minor}.{py_version.micro}")
        checks_passed += 1
    else:
        print_status("Python Version", False, f"{py_version.major}.{py_version.minor} (3.10+ required)")

    # Check .env file
    checks_total += 1
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        print_status(".env File", True, "Found")
        checks_passed += 1
    else:
        print_status(".env File", False, "Not found - copy from .env.example")

    # Check API keys
    from dotenv import load_dotenv
    load_dotenv()

    checks_total += 1
    anthropic_key = os.getenv('ANTHROPIC_API_KEY', '')
    if anthropic_key and anthropic_key.startswith('sk-'):
        print_status("Anthropic API Key", True, "Configured")
        checks_passed += 1
    else:
        print_status("Anthropic API Key", False, "Not configured or invalid")

    checks_total += 1
    notion_token = os.getenv('NOTION_TOKEN', '')
    if notion_token:
        print_status("Notion Token", True, "Configured")
        checks_passed += 1
    else:
        print_status("Notion Token", False, "Not configured (optional)")

    checks_total += 1
    n8n_url = os.getenv('N8N_WEBHOOK_URL', '')
    if n8n_url:
        print_status("n8n Webhook URL", True, "Configured")
        checks_passed += 1
    else:
        print_status("n8n Webhook URL", False, "Not configured (optional)")

    # Check required directories
    print("\n  Data Directories:")
    for dir_name in ['Engine1_Scraper/data', 'Engine2_ProgramMapping/data', 'outputs']:
        checks_total += 1
        dir_path = PROJECT_ROOT / dir_name
        if dir_path.exists():
            print_status(f"  {dir_name}", True, "Exists")
            checks_passed += 1
        else:
            dir_path.mkdir(parents=True, exist_ok=True)
            print_status(f"  {dir_name}", True, "Created")
            checks_passed += 1

    # Check sample data
    print("\n  Sample Data:")
    checks_total += 1
    sample_jobs = PROJECT_ROOT / "Engine1_Scraper" / "data" / "Sample_Jobs.json"
    if sample_jobs.exists():
        with open(sample_jobs) as f:
            jobs = json.load(f)
        print_status("Sample_Jobs.json", True, f"{len(jobs)} jobs")
        checks_passed += 1
    else:
        print_status("Sample_Jobs.json", False, "Not found")

    checks_total += 1
    federal_programs = PROJECT_ROOT / "Engine2_ProgramMapping" / "data" / "Federal Programs.csv"
    if federal_programs.exists():
        print_status("Federal Programs.csv", True, "Found")
        checks_passed += 1
    else:
        print_status("Federal Programs.csv", False, "Not found")

    # Summary
    print(f"\n  Result: {checks_passed}/{checks_total} checks passed")
    return checks_passed == checks_total


def check_modules():
    """Check that all modules can be imported."""
    print_header("Module Import Check")

    modules = [
        ("orchestrator", "Master Orchestrator"),
        ("Engine2_ProgramMapping.scripts.pipeline", "Pipeline Engine"),
        ("Engine2_ProgramMapping.scripts.program_mapper", "Program Mapper"),
        ("Engine2_ProgramMapping.scripts.exporters", "Exporters"),
        ("Engine3_OrgChart.scripts.contact_lookup", "Contact Lookup"),
        ("Engine4_Briefing.scripts.briefing_generator", "Briefing Generator"),
        ("Engine5_Scoring.scripts.bd_scoring", "BD Scoring"),
        ("Engine6_QA.scripts.qa_feedback", "QA Feedback"),
        ("services.database", "Database Service"),
        ("services.scheduler", "Scheduler Service"),
        ("services.notion_sync", "Notion Sync"),
        ("services.bullhorn_integration", "Bullhorn Integration"),
    ]

    all_ok = True
    for module_name, display_name in modules:
        try:
            __import__(module_name)
            print_status(display_name, True, "OK")
        except ImportError as e:
            print_status(display_name, False, str(e)[:50])
            all_ok = False

    return all_ok


def run_test_pipeline():
    """Run a test pipeline with sample data."""
    print_header("Running Test Pipeline")

    # Find sample input
    sample_jobs = PROJECT_ROOT / "Engine1_Scraper" / "data" / "Sample_Jobs.json"
    if not sample_jobs.exists():
        print("  Error: Sample_Jobs.json not found")
        print("  Creating sample data...")

        # Create minimal sample data
        sample_data = [
            {
                "title": "Senior Systems Engineer - DCGS",
                "Job Title/Position": "Senior Systems Engineer - DCGS",
                "company": "GDIT",
                "Prime Contractor": "GDIT",
                "location": "San Diego, CA",
                "Location": "San Diego, CA",
                "clearance": "TS/SCI",
                "Security Clearance": "TS/SCI",
                "description": "Support AF DCGS PACAF mission",
                "Position Overview": "Support AF DCGS PACAF mission",
                "Source": "Test",
                "Source URL": "https://example.com/job1",
            }
        ]
        sample_jobs.parent.mkdir(parents=True, exist_ok=True)
        with open(sample_jobs, 'w') as f:
            json.dump(sample_data, f, indent=2)
        print("  Created sample data with 1 job")

    try:
        from orchestrator import BDOrchestrator, OrchestratorConfig

        config = OrchestratorConfig(
            input_path=str(sample_jobs),
            test_mode=True,
            send_email=False,
            send_webhook=False,
        )

        print("  Initializing orchestrator...")
        orchestrator = BDOrchestrator(config)

        print("  Running pipeline...")
        result = orchestrator.run_full_pipeline(str(sample_jobs))

        print("\n  Pipeline Results:")
        print(f"    Jobs Processed: {result.jobs_processed}")
        print(f"    Hot Leads: {result.hot_leads}")
        print(f"    Warm Leads: {result.warm_leads}")
        print(f"    Cold Leads: {result.cold_leads}")
        print(f"    Briefings: {result.briefings_generated}")
        print(f"    QA Approved: {result.qa_approved}")
        print(f"    Duration: {result.duration_seconds:.1f}s")
        print(f"    Status: {'SUCCESS' if result.success else 'FAILED'}")

        if result.errors:
            print(f"\n  Errors ({len(result.errors)}):")
            for err in result.errors[:5]:
                print(f"    - {err}")

        return result.success

    except Exception as e:
        print(f"  Error: {e}")
        return False


def run_full_pipeline(input_file: str = None):
    """Run the full production pipeline."""
    print_header("Running Full Pipeline")

    # Find input file
    if input_file:
        input_path = Path(input_file)
    else:
        # Find latest JSON in scraper data
        data_dir = PROJECT_ROOT / "Engine1_Scraper" / "data"
        json_files = list(data_dir.glob("*.json"))
        if not json_files:
            print("  Error: No input files found")
            return False
        input_path = max(json_files, key=lambda f: f.stat().st_mtime)

    print(f"  Input: {input_path}")

    try:
        from orchestrator import BDOrchestrator, OrchestratorConfig

        config = OrchestratorConfig(
            input_path=str(input_path),
            test_mode=False,
            send_email=bool(os.getenv('SMTP_USER')),
            send_webhook=bool(os.getenv('N8N_WEBHOOK_URL')),
        )

        orchestrator = BDOrchestrator(config)
        result = orchestrator.run_full_pipeline(str(input_path))

        return result.success

    except Exception as e:
        print(f"  Error: {e}")
        return False


def start_scheduler():
    """Start the scheduled pipeline runner."""
    print_header("Starting Scheduler")

    try:
        from services.scheduler import SchedulerService, SchedulerConfig

        config = SchedulerConfig(
            interval_hours=6,
            test_mode=False,
            send_email=bool(os.getenv('SMTP_USER')),
            send_webhook=bool(os.getenv('N8N_WEBHOOK_URL')),
        )

        scheduler = SchedulerService(config)
        scheduler.start(blocking=True)

    except KeyboardInterrupt:
        print("\n  Scheduler stopped")
    except Exception as e:
        print(f"  Error: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='BD Automation Engine - Quick Start',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python quickstart.py --check     # Verify environment
  python quickstart.py --test      # Run test pipeline
  python quickstart.py --full      # Run full pipeline
  python quickstart.py --full --input data/jobs.json  # Custom input
  python quickstart.py --schedule  # Start scheduler
        """
    )

    parser.add_argument('--check', action='store_true', help='Check environment setup')
    parser.add_argument('--test', action='store_true', help='Run test pipeline')
    parser.add_argument('--full', action='store_true', help='Run full pipeline')
    parser.add_argument('--schedule', action='store_true', help='Start scheduler')
    parser.add_argument('--input', '-i', help='Input file for pipeline')

    args = parser.parse_args()

    print("""
    ============================================================
    |         BD Automation Engine - Quick Start               |
    |                                                          |
    |  End-to-End Business Development Intelligence Pipeline   |
    ============================================================
    """)

    if args.check or not any([args.test, args.full, args.schedule]):
        env_ok = check_environment()
        modules_ok = check_modules()

        if env_ok and modules_ok:
            print("\n  All checks passed! Ready to run pipeline.")
            print("\n  Next steps:")
            print("    python quickstart.py --test     # Test with sample data")
            print("    python quickstart.py --full     # Run full pipeline")
            print("    python quickstart.py --schedule # Start scheduled runs")

    if args.test:
        success = run_test_pipeline()
        sys.exit(0 if success else 1)

    if args.full:
        success = run_full_pipeline(args.input)
        sys.exit(0 if success else 1)

    if args.schedule:
        start_scheduler()


if __name__ == '__main__':
    main()
