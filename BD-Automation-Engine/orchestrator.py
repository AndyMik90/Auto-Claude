#!/usr/bin/env python3
"""
BD Automation Engine - Master Orchestrator
Unified pipeline integrating all 6 engines for end-to-end BD automation.

Engines:
1. Engine1_Scraper - Job data collection (Apify integration)
2. Engine2_ProgramMapping - Core pipeline (standardize, match, score, export)
3. Engine3_OrgChart - Contact lookup and classification
4. Engine4_Briefing - BD briefing document generation
5. Engine5_Scoring - BD priority scoring
6. Engine6_QA - Quality assurance and feedback loop

Usage:
    python orchestrator.py --input data/jobs.json --full-pipeline
    python orchestrator.py --input data/jobs.json --hot-leads-only --email
    python orchestrator.py --schedule --interval 6h
"""

import json
import os
import sys
import argparse
import logging
import smtplib
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project paths
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# Ensure log directory exists
LOG_DIR = PROJECT_ROOT / 'outputs' / 'Logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / 'orchestrator.log', mode='a')
    ]
)
logger = logging.getLogger('BD-Orchestrator')


# ============================================
# CONFIGURATION
# ============================================

@dataclass
class OrchestratorConfig:
    """Configuration for the BD Automation Orchestrator."""
    # Input/Output
    input_path: Optional[str] = None
    output_dir: str = str(PROJECT_ROOT / 'outputs')

    # Pipeline Stages
    run_scraper: bool = False
    run_mapping: bool = True
    run_contacts: bool = True
    run_briefings: bool = True
    run_scoring: bool = True
    run_qa: bool = True

    # Filters
    hot_leads_only: bool = False
    min_bd_score: int = 0
    min_confidence: float = 0.0

    # Notifications
    send_email: bool = False
    send_webhook: bool = True

    # API Keys (from env)
    anthropic_api_key: str = field(default_factory=lambda: os.getenv('ANTHROPIC_API_KEY', ''))
    n8n_webhook_url: str = field(default_factory=lambda: os.getenv('N8N_WEBHOOK_URL', ''))
    smtp_host: str = field(default_factory=lambda: os.getenv('SMTP_HOST', 'smtp.gmail.com'))
    smtp_port: int = field(default_factory=lambda: int(os.getenv('SMTP_PORT', '587')))
    smtp_user: str = field(default_factory=lambda: os.getenv('SMTP_USER', ''))
    smtp_password: str = field(default_factory=lambda: os.getenv('SMTP_PASSWORD', ''))
    notification_email: str = field(default_factory=lambda: os.getenv('NOTIFICATION_EMAIL', ''))

    # Processing
    test_mode: bool = False
    batch_size: int = 10

    # Scheduling
    schedule_enabled: bool = False
    schedule_interval_hours: int = 6


@dataclass
class PipelineResult:
    """Result of a complete pipeline run."""
    success: bool
    jobs_processed: int
    hot_leads: int
    warm_leads: int
    cold_leads: int
    briefings_generated: int
    qa_approved: int
    qa_needs_review: int
    export_files: Dict[str, str]
    errors: List[str]
    duration_seconds: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


# ============================================
# ENGINE IMPORTS
# ============================================

def import_engines():
    """Import all engine modules with graceful fallbacks."""
    engines = {}

    # Engine 2: Program Mapping Pipeline
    try:
        from Engine2_ProgramMapping.scripts.pipeline import (
            PipelineConfig, load_config, run_pipeline as run_mapping_pipeline
        )
        from Engine2_ProgramMapping.scripts.job_standardizer import (
            preprocess_job_data, standardize_job_with_llm
        )
        from Engine2_ProgramMapping.scripts.program_mapper import (
            map_job_to_program, process_jobs_batch
        )
        from Engine2_ProgramMapping.scripts.exporters import (
            NotionCSVExporter, N8nWebhookExporter, export_batch
        )
        engines['mapping'] = {
            'PipelineConfig': PipelineConfig,
            'load_config': load_config,
            'run_pipeline': run_mapping_pipeline,
            'preprocess_job_data': preprocess_job_data,
            'standardize_job_with_llm': standardize_job_with_llm,
            'map_job_to_program': map_job_to_program,
            'process_jobs_batch': process_jobs_batch,
            'NotionCSVExporter': NotionCSVExporter,
            'N8nWebhookExporter': N8nWebhookExporter,
            'export_batch': export_batch,
        }
        logger.info("Engine2_ProgramMapping loaded successfully")
    except ImportError as e:
        logger.warning(f"Engine2_ProgramMapping not available: {e}")

    # Engine 3: Contact Lookup
    try:
        from Engine3_OrgChart.scripts.contact_lookup import (
            lookup_contacts, format_contacts_for_briefing, ContactDatabase
        )
        engines['contacts'] = {
            'lookup_contacts': lookup_contacts,
            'format_contacts_for_briefing': format_contacts_for_briefing,
            'ContactDatabase': ContactDatabase,
        }
        logger.info("Engine3_OrgChart loaded successfully")
    except ImportError as e:
        logger.warning(f"Engine3_OrgChart not available: {e}")

    # Engine 4: Playbook Generator (Full BD Playbooks with Email/Call/TalkingPoints)
    try:
        from Engine4_Playbook.scripts.bd_playbook_generator import (
            generate_playbook, generate_playbooks_batch, PlaybookData, PlaybookOutput
        )
        engines['briefings'] = {
            'generate_briefing': generate_playbook,
            'generate_briefings_batch': generate_playbooks_batch,
            'BriefingData': PlaybookData,
            'PlaybookOutput': PlaybookOutput,
        }
        logger.info("Engine4_Playbook loaded successfully")
    except ImportError as e:
        logger.warning(f"Engine4_Playbook not available: {e}")

    # Engine 5: BD Scoring
    try:
        from Engine5_Scoring.scripts.bd_scoring import (
            calculate_bd_score, score_batch, generate_scoring_report
        )
        engines['scoring'] = {
            'calculate_bd_score': calculate_bd_score,
            'score_batch': score_batch,
            'generate_scoring_report': generate_scoring_report,
        }
        logger.info("Engine5_Scoring loaded successfully")
    except ImportError as e:
        logger.warning(f"Engine5_Scoring not available: {e}")

    # Engine 6: QA Feedback
    try:
        from Engine6_QA.scripts.qa_feedback import (
            run_qa_workflow, evaluate_batch, ReviewQueue, QAConfig
        )
        engines['qa'] = {
            'run_qa_workflow': run_qa_workflow,
            'evaluate_batch': evaluate_batch,
            'ReviewQueue': ReviewQueue,
            'QAConfig': QAConfig,
        }
        logger.info("Engine6_QA loaded successfully")
    except ImportError as e:
        logger.warning(f"Engine6_QA not available: {e}")

    return engines


# ============================================
# EMAIL NOTIFICATION
# ============================================

class EmailNotifier:
    """Send email notifications for hot leads and alerts."""

    def __init__(self, config: OrchestratorConfig):
        self.config = config
        self.enabled = bool(config.smtp_user and config.smtp_password)

    def send_hot_lead_alert(self, jobs: List[Dict], briefings: List[Dict]) -> bool:
        """Send email alert for hot leads."""
        if not self.enabled:
            logger.warning("Email notifications not configured")
            return False

        if not jobs:
            logger.info("No hot leads to notify")
            return True

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"[BD Alert] {len(jobs)} Hot Lead(s) Detected - {datetime.now().strftime('%Y-%m-%d')}"
            msg['From'] = self.config.smtp_user
            msg['To'] = self.config.notification_email

            # Build HTML content
            html_content = self._build_hot_lead_html(jobs, briefings)
            text_content = self._build_hot_lead_text(jobs)

            msg.attach(MIMEText(text_content, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))

            # Send email
            with smtplib.SMTP(self.config.smtp_host, self.config.smtp_port) as server:
                server.starttls()
                server.login(self.config.smtp_user, self.config.smtp_password)
                server.send_message(msg)

            logger.info(f"Hot lead alert sent to {self.config.notification_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    def _build_hot_lead_html(self, jobs: List[Dict], briefings: List[Dict]) -> str:
        """Build HTML email content for hot leads."""
        job_rows = ""
        for job in jobs:
            mapping = job.get('_mapping', {})
            scoring = job.get('_scoring', {})
            job_rows += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>{job.get('Job Title/Position', job.get('title', 'Unknown'))}</strong><br>
                    <small>{job.get('Location', job.get('location', 'N/A'))}</small>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{mapping.get('program_name', 'N/A')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                    <span style="background: #dc3545; color: white; padding: 3px 8px; border-radius: 3px;">
                        {scoring.get('BD Priority Score', 0)}
                    </span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{job.get('Security Clearance', 'N/A')}</td>
            </tr>
            """

        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Hot Lead Alert</h2>
            <p>The BD Automation Engine has identified <strong>{len(jobs)}</strong> high-priority opportunities requiring immediate attention.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; text-align: left;">Position</th>
                        <th style="padding: 10px; text-align: left;">Program</th>
                        <th style="padding: 10px; text-align: center;">BD Score</th>
                        <th style="padding: 10px; text-align: left;">Clearance</th>
                    </tr>
                </thead>
                <tbody>
                    {job_rows}
                </tbody>
            </table>

            <h3>Recommended Actions:</h3>
            <ul>
                <li>Review attached briefings for detailed opportunity analysis</li>
                <li>Escalate to BD leadership for capture decision</li>
                <li>Initiate outreach to program contacts</li>
            </ul>

            <p style="color: #666; font-size: 12px; margin-top: 30px;">
                Generated by BD Automation Engine | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            </p>
        </body>
        </html>
        """

    def _build_hot_lead_text(self, jobs: List[Dict]) -> str:
        """Build plain text email content for hot leads."""
        lines = [
            f"HOT LEAD ALERT - {len(jobs)} Opportunities Detected",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "=" * 60,
        ]

        for job in jobs:
            mapping = job.get('_mapping', {})
            scoring = job.get('_scoring', {})
            lines.extend([
                f"\nPosition: {job.get('Job Title/Position', job.get('title', 'Unknown'))}",
                f"Location: {job.get('Location', job.get('location', 'N/A'))}",
                f"Program: {mapping.get('program_name', 'N/A')}",
                f"BD Score: {scoring.get('BD Priority Score', 0)}",
                f"Clearance: {job.get('Security Clearance', 'N/A')}",
                "-" * 40,
            ])

        return "\n".join(lines)

    def send_daily_summary(self, result: PipelineResult) -> bool:
        """Send daily summary email."""
        if not self.enabled:
            return False

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"[BD Summary] Daily Pipeline Report - {datetime.now().strftime('%Y-%m-%d')}"
            msg['From'] = self.config.smtp_user
            msg['To'] = self.config.notification_email

            text_content = f"""
BD Automation Daily Summary
===========================
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Pipeline Results:
- Jobs Processed: {result.jobs_processed}
- Hot Leads: {result.hot_leads}
- Warm Leads: {result.warm_leads}
- Cold Leads: {result.cold_leads}
- Briefings Generated: {result.briefings_generated}
- QA Approved: {result.qa_approved}
- QA Needs Review: {result.qa_needs_review}

Duration: {result.duration_seconds:.1f} seconds
Status: {'SUCCESS' if result.success else 'FAILED'}

Errors: {len(result.errors)}
"""
            msg.attach(MIMEText(text_content, 'plain'))

            with smtplib.SMTP(self.config.smtp_host, self.config.smtp_port) as server:
                server.starttls()
                server.login(self.config.smtp_user, self.config.smtp_password)
                server.send_message(msg)

            logger.info(f"Daily summary sent to {self.config.notification_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send daily summary: {e}")
            return False


# ============================================
# WEBHOOK DELIVERY
# ============================================

class WebhookDelivery:
    """Deliver pipeline results to n8n webhooks."""

    def __init__(self, config: OrchestratorConfig):
        self.config = config
        self.webhook_url = config.n8n_webhook_url
        self.enrichment_url = os.getenv('N8N_ENRICHMENT_WEBHOOK', '')
        self.scoring_url = os.getenv('N8N_SCORING_WEBHOOK', '')

    def deliver_jobs(self, jobs: List[Dict], batch_id: str = None) -> bool:
        """Deliver processed jobs to n8n webhook."""
        if not self.webhook_url:
            logger.warning("n8n webhook URL not configured")
            return False

        if not jobs:
            logger.info("No jobs to deliver")
            return True

        try:
            payload = {
                'batch_id': batch_id or datetime.now().strftime('BATCH_%Y%m%d_%H%M%S'),
                'timestamp': datetime.now().isoformat(),
                'job_count': len(jobs),
                'jobs': jobs,
                'metadata': {
                    'source': 'BD-Automation-Engine',
                    'version': '2.0',
                }
            }

            response = requests.post(
                self.webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            if response.status_code == 200:
                logger.info(f"Delivered {len(jobs)} jobs to n8n webhook")
                return True
            else:
                logger.error(f"Webhook delivery failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.error(f"Webhook delivery error: {e}")
            return False

    def deliver_hot_leads(self, hot_leads: List[Dict]) -> bool:
        """Deliver hot leads specifically for urgent processing."""
        if not hot_leads:
            return True

        # Use scoring webhook for hot leads (higher priority)
        url = self.scoring_url or self.webhook_url
        if not url:
            return False

        try:
            payload = {
                'alert_type': 'HOT_LEADS',
                'timestamp': datetime.now().isoformat(),
                'lead_count': len(hot_leads),
                'leads': hot_leads,
                'priority': 'URGENT'
            }

            response = requests.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            return response.status_code == 200

        except Exception as e:
            logger.error(f"Hot lead webhook error: {e}")
            return False


# ============================================
# MAIN ORCHESTRATOR
# ============================================

class BDOrchestrator:
    """Main orchestrator coordinating all BD automation engines."""

    def __init__(self, config: OrchestratorConfig):
        self.config = config
        self.engines = import_engines()
        self.email_notifier = EmailNotifier(config)
        self.webhook_delivery = WebhookDelivery(config)

        # Ensure output directories exist
        Path(config.output_dir).mkdir(parents=True, exist_ok=True)
        (Path(config.output_dir) / 'Logs').mkdir(exist_ok=True)
        (Path(config.output_dir) / 'BD_Briefings').mkdir(exist_ok=True)
        (Path(config.output_dir) / 'notion').mkdir(exist_ok=True)
        (Path(config.output_dir) / 'n8n').mkdir(exist_ok=True)

    def run_full_pipeline(self, input_path: str = None) -> PipelineResult:
        """
        Run the complete BD automation pipeline.

        Stages:
        1. Ingest raw jobs from JSON
        2. Standardize with LLM extraction
        3. Map to federal programs
        4. Calculate BD scores
        5. Run QA evaluation
        6. Generate briefings for hot leads
        7. Export to Notion/n8n
        8. Send notifications
        """
        start_time = datetime.now()
        errors = []

        input_file = input_path or self.config.input_path
        if not input_file:
            return PipelineResult(
                success=False, jobs_processed=0, hot_leads=0, warm_leads=0, cold_leads=0,
                briefings_generated=0, qa_approved=0, qa_needs_review=0,
                export_files={}, errors=["No input file specified"],
                duration_seconds=0
            )

        logger.info(f"Starting full pipeline: {input_file}")
        print(f"\n{'='*60}")
        print("BD AUTOMATION ENGINE - Full Pipeline")
        print(f"{'='*60}")
        print(f"Input: {input_file}")
        print(f"Test Mode: {self.config.test_mode}")

        # Stage 1: Ingest
        print(f"\n[1/8] INGESTING JOBS...")
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                jobs = json.load(f)

            if self.config.test_mode:
                jobs = jobs[:3]
                print(f"  Test mode: limited to {len(jobs)} jobs")

            print(f"  Loaded {len(jobs)} jobs")
        except Exception as e:
            errors.append(f"Ingest error: {e}")
            logger.error(f"Ingest error: {e}")
            return self._error_result(errors, start_time)

        # Stage 2-4: Program Mapping Pipeline
        print(f"\n[2/8] RUNNING PROGRAM MAPPING PIPELINE...")
        if 'mapping' in self.engines and self.config.run_mapping:
            try:
                pipeline_config = self.engines['mapping']['PipelineConfig'](
                    input_path=input_file,
                    output_dir=self.config.output_dir,
                    test_mode=self.config.test_mode,
                    anthropic_api_key=self.config.anthropic_api_key,
                )

                # Process jobs through mapping
                enriched_jobs = self.engines['mapping']['process_jobs_batch'](jobs)
                print(f"  Mapped {len(enriched_jobs)} jobs to programs")
                jobs = enriched_jobs
            except Exception as e:
                errors.append(f"Mapping error: {e}")
                logger.error(f"Mapping error: {e}")
        else:
            print("  Skipped (engine not available)")

        # Stage 5: BD Scoring
        print(f"\n[3/8] CALCULATING BD SCORES...")
        if 'scoring' in self.engines and self.config.run_scoring:
            try:
                scored_jobs = self.engines['scoring']['score_batch'](jobs)
                print(f"  Scored {len(scored_jobs)} jobs")
                jobs = scored_jobs
            except Exception as e:
                errors.append(f"Scoring error: {e}")
                logger.error(f"Scoring error: {e}")
        else:
            print("  Skipped (engine not available)")

        # Categorize by tier
        hot_leads = [j for j in jobs if 'Hot' in str(j.get('_scoring', {}).get('Priority Tier', ''))]
        warm_leads = [j for j in jobs if 'Warm' in str(j.get('_scoring', {}).get('Priority Tier', ''))]
        cold_leads = [j for j in jobs if 'Cold' in str(j.get('_scoring', {}).get('Priority Tier', ''))]

        print(f"  Tiers: Hot={len(hot_leads)}, Warm={len(warm_leads)}, Cold={len(cold_leads)}")

        # Stage 6: QA Evaluation
        print(f"\n[4/8] RUNNING QA EVALUATION...")
        qa_approved = 0
        qa_needs_review = 0
        if 'qa' in self.engines and self.config.run_qa:
            try:
                qa_report, approved_jobs, review_jobs = self.engines['qa']['run_qa_workflow'](jobs)
                qa_approved = len(approved_jobs)
                qa_needs_review = len(review_jobs)
                print(f"  QA: {qa_approved} approved, {qa_needs_review} need review")
            except Exception as e:
                errors.append(f"QA error: {e}")
                logger.error(f"QA error: {e}")
        else:
            print("  Skipped (engine not available)")

        # Stage 7: Generate Briefings
        print(f"\n[5/8] GENERATING BRIEFINGS...")
        briefings = []
        briefings_to_process = hot_leads if self.config.hot_leads_only else jobs
        if 'briefings' in self.engines and self.config.run_briefings and briefings_to_process:
            try:
                briefings = self.engines['briefings']['generate_briefings_batch'](
                    briefings_to_process,
                    output_dir=str(Path(self.config.output_dir) / 'BD_Briefings'),
                    min_score=self.config.min_bd_score,
                    include_contacts=self.config.run_contacts
                )
                print(f"  Generated {len(briefings)} briefings")
            except Exception as e:
                errors.append(f"Briefing error: {e}")
                logger.error(f"Briefing error: {e}")
        else:
            print("  Skipped (no hot leads or engine not available)")

        # Stage 8: Export
        print(f"\n[6/8] EXPORTING RESULTS...")
        export_files = {}
        if 'mapping' in self.engines:
            try:
                export_results = self.engines['mapping']['export_batch'](
                    jobs,
                    output_dir=self.config.output_dir,
                    formats=['notion', 'n8n']
                )
                for fmt, result in export_results.items():
                    if result.success:
                        export_files[fmt] = result.file_path
                        print(f"  {fmt.upper()}: {result.file_path}")
            except Exception as e:
                errors.append(f"Export error: {e}")
                logger.error(f"Export error: {e}")

        # Stage 9: Webhook Delivery
        print(f"\n[7/8] DELIVERING TO WEBHOOKS...")
        if self.config.send_webhook:
            self.webhook_delivery.deliver_jobs(jobs)
            if hot_leads:
                self.webhook_delivery.deliver_hot_leads(hot_leads)
        else:
            print("  Skipped (webhooks disabled)")

        # Stage 10: Email Notifications
        print(f"\n[8/8] SENDING NOTIFICATIONS...")
        if self.config.send_email and hot_leads:
            self.email_notifier.send_hot_lead_alert(hot_leads, briefings)
        else:
            print("  Skipped (email disabled or no hot leads)")

        # Calculate duration
        duration = (datetime.now() - start_time).total_seconds()

        # Build result
        result = PipelineResult(
            success=len(errors) == 0,
            jobs_processed=len(jobs),
            hot_leads=len(hot_leads),
            warm_leads=len(warm_leads),
            cold_leads=len(cold_leads),
            briefings_generated=len(briefings),
            qa_approved=qa_approved,
            qa_needs_review=qa_needs_review,
            export_files=export_files,
            errors=errors,
            duration_seconds=duration
        )

        # Print summary
        print(f"\n{'='*60}")
        print("PIPELINE COMPLETE")
        print(f"{'='*60}")
        print(f"Duration: {duration:.1f} seconds")
        print(f"Jobs Processed: {result.jobs_processed}")
        print(f"Hot Leads: {result.hot_leads}")
        print(f"Warm Leads: {result.warm_leads}")
        print(f"Cold Leads: {result.cold_leads}")
        print(f"Briefings: {result.briefings_generated}")
        print(f"QA Approved: {result.qa_approved}")
        print(f"QA Review: {result.qa_needs_review}")
        print(f"Errors: {len(errors)}")
        print(f"Status: {'SUCCESS' if result.success else 'FAILED'}")

        # Log result
        logger.info(f"Pipeline complete: {result.jobs_processed} jobs, {result.hot_leads} hot leads")

        return result

    def _error_result(self, errors: List[str], start_time: datetime) -> PipelineResult:
        """Create an error result."""
        duration = (datetime.now() - start_time).total_seconds()
        return PipelineResult(
            success=False, jobs_processed=0, hot_leads=0, warm_leads=0, cold_leads=0,
            briefings_generated=0, qa_approved=0, qa_needs_review=0,
            export_files={}, errors=errors, duration_seconds=duration
        )

    def run_scheduled(self, interval_hours: int = 6):
        """Run the pipeline on a schedule."""
        import time

        logger.info(f"Starting scheduled runs every {interval_hours} hours")
        print(f"\nScheduled mode: running every {interval_hours} hours")
        print("Press Ctrl+C to stop\n")

        while True:
            try:
                # Find latest input file
                input_dir = PROJECT_ROOT / 'Engine1_Scraper' / 'data'
                json_files = list(input_dir.glob('*.json'))
                if json_files:
                    latest_file = max(json_files, key=lambda f: f.stat().st_mtime)
                    result = self.run_full_pipeline(str(latest_file))

                    # Send daily summary
                    if self.config.send_email:
                        self.email_notifier.send_daily_summary(result)
                else:
                    logger.warning("No input files found")

                # Sleep until next run
                next_run = datetime.now() + timedelta(hours=interval_hours)
                logger.info(f"Next run scheduled for: {next_run}")
                time.sleep(interval_hours * 3600)

            except KeyboardInterrupt:
                logger.info("Scheduled runs stopped by user")
                break
            except Exception as e:
                logger.error(f"Scheduled run error: {e}")
                time.sleep(300)  # Wait 5 minutes on error


# ============================================
# CLI INTERFACE
# ============================================

def main():
    parser = argparse.ArgumentParser(
        description='BD Automation Engine - Master Orchestrator',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full pipeline on input file
  python orchestrator.py --input Engine1_Scraper/data/Sample_Jobs.json

  # Run with email notifications for hot leads
  python orchestrator.py --input data/jobs.json --email --hot-leads-only

  # Run in test mode (first 3 jobs)
  python orchestrator.py --input data/jobs.json --test

  # Run on schedule (every 6 hours)
  python orchestrator.py --schedule --interval 6

  # Skip specific stages
  python orchestrator.py --input data/jobs.json --no-briefings --no-qa
        """
    )

    # Input/Output
    parser.add_argument('--input', '-i', help='Input JSON file with jobs')
    parser.add_argument('--output', '-o', default='outputs', help='Output directory')

    # Pipeline Control
    parser.add_argument('--test', action='store_true', help='Test mode (first 3 jobs)')
    parser.add_argument('--hot-leads-only', action='store_true', help='Only process hot leads')
    parser.add_argument('--min-score', type=int, default=0, help='Minimum BD score to process')

    # Stage Control
    parser.add_argument('--no-mapping', action='store_true', help='Skip program mapping')
    parser.add_argument('--no-contacts', action='store_true', help='Skip contact lookup')
    parser.add_argument('--no-briefings', action='store_true', help='Skip briefing generation')
    parser.add_argument('--no-scoring', action='store_true', help='Skip BD scoring')
    parser.add_argument('--no-qa', action='store_true', help='Skip QA evaluation')

    # Notifications
    parser.add_argument('--email', action='store_true', help='Send email notifications')
    parser.add_argument('--no-webhook', action='store_true', help='Disable webhook delivery')

    # Scheduling
    parser.add_argument('--schedule', action='store_true', help='Run on schedule')
    parser.add_argument('--interval', type=int, default=6, help='Schedule interval in hours')

    args = parser.parse_args()

    # Build configuration
    config = OrchestratorConfig(
        input_path=args.input,
        output_dir=args.output,
        test_mode=args.test,
        hot_leads_only=args.hot_leads_only,
        min_bd_score=args.min_score,
        run_mapping=not args.no_mapping,
        run_contacts=not args.no_contacts,
        run_briefings=not args.no_briefings,
        run_scoring=not args.no_scoring,
        run_qa=not args.no_qa,
        send_email=args.email,
        send_webhook=not args.no_webhook,
        schedule_enabled=args.schedule,
        schedule_interval_hours=args.interval,
    )

    # Create and run orchestrator
    orchestrator = BDOrchestrator(config)

    if args.schedule:
        orchestrator.run_scheduled(args.interval)
    elif args.input:
        result = orchestrator.run_full_pipeline(args.input)
        sys.exit(0 if result.success else 1)
    else:
        parser.print_help()
        print("\nError: --input required unless using --schedule")
        sys.exit(1)


if __name__ == '__main__':
    main()
