"""
Scheduler Service - Automated 24-hour pipeline execution for BD Automation Engine.
Supports cron-based scheduling, interval-based runs, and event-driven triggers.
"""

import os
import sys
import time
import json
import signal
import logging
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()

# Add project paths
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('BD-Scheduler')


@dataclass
class SchedulerConfig:
    """Configuration for the scheduler service."""
    # Schedule settings
    enabled: bool = True
    interval_hours: int = 6
    cron_expression: str = os.getenv('SCRAPER_SCHEDULE_CRON', '0 6 * * *')

    # Input sources
    input_dir: str = str(PROJECT_ROOT / 'Engine1_Scraper' / 'data')
    watch_for_new_files: bool = True

    # Pipeline settings
    test_mode: bool = False
    send_email: bool = True
    send_webhook: bool = True

    # Runtime settings
    max_retries: int = 3
    retry_delay_minutes: int = 5
    health_check_interval_minutes: int = 30


@dataclass
class ScheduledRun:
    """Represents a scheduled pipeline run."""
    run_id: str
    scheduled_time: datetime
    input_file: Optional[str] = None
    status: str = 'pending'  # pending, running, completed, failed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict] = None
    error: Optional[str] = None
    retry_count: int = 0


class SchedulerService:
    """Manages scheduled pipeline executions."""

    def __init__(self, config: SchedulerConfig = None):
        self.config = config or SchedulerConfig()
        self._running = False
        self._lock = threading.Lock()
        self._scheduled_runs: List[ScheduledRun] = []
        self._last_run: Optional[ScheduledRun] = None
        self._orchestrator = None

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}. Shutting down...")
        self.stop()

    def _get_orchestrator(self):
        """Lazy load the orchestrator."""
        if self._orchestrator is None:
            from orchestrator import BDOrchestrator, OrchestratorConfig
            orchestrator_config = OrchestratorConfig(
                test_mode=self.config.test_mode,
                send_email=self.config.send_email,
                send_webhook=self.config.send_webhook,
            )
            self._orchestrator = BDOrchestrator(orchestrator_config)
        return self._orchestrator

    def _find_latest_input_file(self) -> Optional[str]:
        """Find the most recent JSON file in the input directory."""
        input_dir = Path(self.config.input_dir)
        if not input_dir.exists():
            logger.warning(f"Input directory does not exist: {input_dir}")
            return None

        json_files = list(input_dir.glob('*.json'))
        if not json_files:
            logger.warning(f"No JSON files found in: {input_dir}")
            return None

        # Sort by modification time and return the most recent
        latest = max(json_files, key=lambda f: f.stat().st_mtime)
        return str(latest)

    def _execute_pipeline(self, scheduled_run: ScheduledRun) -> bool:
        """Execute a single pipeline run."""
        try:
            scheduled_run.status = 'running'
            scheduled_run.started_at = datetime.now()

            # Find input file
            input_file = scheduled_run.input_file or self._find_latest_input_file()
            if not input_file:
                scheduled_run.error = "No input file available"
                scheduled_run.status = 'failed'
                return False

            logger.info(f"Executing pipeline run {scheduled_run.run_id} with input: {input_file}")

            # Run the pipeline
            orchestrator = self._get_orchestrator()
            result = orchestrator.run_full_pipeline(input_file)

            # Update scheduled run
            scheduled_run.completed_at = datetime.now()
            scheduled_run.result = {
                'success': result.success,
                'jobs_processed': result.jobs_processed,
                'hot_leads': result.hot_leads,
                'warm_leads': result.warm_leads,
                'cold_leads': result.cold_leads,
                'briefings_generated': result.briefings_generated,
                'qa_approved': result.qa_approved,
                'qa_needs_review': result.qa_needs_review,
                'duration_seconds': result.duration_seconds,
                'errors': result.errors,
            }

            if result.success:
                scheduled_run.status = 'completed'
                logger.info(f"Pipeline run {scheduled_run.run_id} completed successfully")
                return True
            else:
                scheduled_run.status = 'failed'
                scheduled_run.error = '; '.join(result.errors)
                logger.error(f"Pipeline run {scheduled_run.run_id} failed: {scheduled_run.error}")
                return False

        except Exception as e:
            scheduled_run.status = 'failed'
            scheduled_run.error = str(e)
            scheduled_run.completed_at = datetime.now()
            logger.error(f"Pipeline run {scheduled_run.run_id} error: {e}")
            return False

    def _run_with_retry(self, scheduled_run: ScheduledRun) -> bool:
        """Execute pipeline with retry logic."""
        while scheduled_run.retry_count < self.config.max_retries:
            if self._execute_pipeline(scheduled_run):
                return True

            scheduled_run.retry_count += 1
            if scheduled_run.retry_count < self.config.max_retries:
                logger.info(f"Retrying in {self.config.retry_delay_minutes} minutes "
                           f"(attempt {scheduled_run.retry_count + 1}/{self.config.max_retries})")
                time.sleep(self.config.retry_delay_minutes * 60)
                scheduled_run.status = 'pending'

        return False

    def _calculate_next_run_time(self) -> datetime:
        """Calculate the next scheduled run time."""
        now = datetime.now()

        if self.config.cron_expression:
            # Parse simple cron (minute hour day month weekday)
            parts = self.config.cron_expression.split()
            if len(parts) >= 2:
                minute = int(parts[0]) if parts[0] != '*' else 0
                hour = int(parts[1]) if parts[1] != '*' else 6

                next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if next_run <= now:
                    next_run += timedelta(days=1)
                return next_run

        # Fallback to interval-based scheduling
        return now + timedelta(hours=self.config.interval_hours)

    def schedule_run(self, input_file: str = None, run_at: datetime = None) -> ScheduledRun:
        """Schedule a new pipeline run."""
        with self._lock:
            run_id = datetime.now().strftime('RUN_%Y%m%d_%H%M%S')
            scheduled_run = ScheduledRun(
                run_id=run_id,
                scheduled_time=run_at or datetime.now(),
                input_file=input_file
            )
            self._scheduled_runs.append(scheduled_run)
            logger.info(f"Scheduled run {run_id} for {scheduled_run.scheduled_time}")
            return scheduled_run

    def run_now(self, input_file: str = None) -> ScheduledRun:
        """Trigger an immediate pipeline run."""
        scheduled_run = self.schedule_run(input_file=input_file, run_at=datetime.now())
        self._run_with_retry(scheduled_run)
        self._last_run = scheduled_run
        return scheduled_run

    def start(self, blocking: bool = True):
        """Start the scheduler service."""
        if self._running:
            logger.warning("Scheduler is already running")
            return

        self._running = True
        logger.info(f"Starting BD Automation Scheduler")
        logger.info(f"Schedule: Every {self.config.interval_hours} hours")
        logger.info(f"Input directory: {self.config.input_dir}")

        print(f"\n{'='*60}")
        print("BD AUTOMATION SCHEDULER")
        print(f"{'='*60}")
        print(f"Interval: {self.config.interval_hours} hours")
        print(f"Input Dir: {self.config.input_dir}")
        print(f"Test Mode: {self.config.test_mode}")
        print(f"Press Ctrl+C to stop")
        print(f"{'='*60}\n")

        if blocking:
            self._run_loop()
        else:
            thread = threading.Thread(target=self._run_loop, daemon=True)
            thread.start()

    def _run_loop(self):
        """Main scheduler loop."""
        next_run_time = self._calculate_next_run_time()
        logger.info(f"Next scheduled run: {next_run_time}")

        while self._running:
            now = datetime.now()

            # Check if it's time for the next run
            if now >= next_run_time:
                logger.info(f"Starting scheduled run at {now}")
                scheduled_run = self.run_now()
                self._last_run = scheduled_run

                # Calculate next run time
                next_run_time = self._calculate_next_run_time()
                logger.info(f"Next scheduled run: {next_run_time}")

            # Check for pending runs
            with self._lock:
                for run in self._scheduled_runs:
                    if run.status == 'pending' and now >= run.scheduled_time:
                        self._run_with_retry(run)
                        self._last_run = run

            # Health check logging
            time.sleep(60)  # Check every minute

    def stop(self):
        """Stop the scheduler service."""
        logger.info("Stopping scheduler...")
        self._running = False

    def get_status(self) -> Dict:
        """Get current scheduler status."""
        return {
            'running': self._running,
            'last_run': {
                'run_id': self._last_run.run_id if self._last_run else None,
                'status': self._last_run.status if self._last_run else None,
                'completed_at': self._last_run.completed_at.isoformat() if self._last_run and self._last_run.completed_at else None,
            } if self._last_run else None,
            'pending_runs': len([r for r in self._scheduled_runs if r.status == 'pending']),
            'config': {
                'interval_hours': self.config.interval_hours,
                'input_dir': self.config.input_dir,
                'test_mode': self.config.test_mode,
            }
        }

    def get_run_history(self, limit: int = 20) -> List[Dict]:
        """Get recent run history."""
        with self._lock:
            runs = sorted(
                self._scheduled_runs,
                key=lambda r: r.scheduled_time,
                reverse=True
            )[:limit]

            return [{
                'run_id': r.run_id,
                'scheduled_time': r.scheduled_time.isoformat(),
                'status': r.status,
                'started_at': r.started_at.isoformat() if r.started_at else None,
                'completed_at': r.completed_at.isoformat() if r.completed_at else None,
                'result': r.result,
                'error': r.error,
                'retry_count': r.retry_count,
            } for r in runs]


# ============================================
# FILE WATCHER
# ============================================

class FileWatcher:
    """Watch for new files in the input directory."""

    def __init__(self, directory: str, callback: Callable[[str], None]):
        self.directory = Path(directory)
        self.callback = callback
        self._running = False
        self._known_files: set = set()

    def start(self):
        """Start watching for new files."""
        self._running = True
        self._known_files = set(self.directory.glob('*.json'))
        logger.info(f"File watcher started. Monitoring: {self.directory}")

        while self._running:
            current_files = set(self.directory.glob('*.json'))
            new_files = current_files - self._known_files

            for new_file in new_files:
                logger.info(f"New file detected: {new_file}")
                self.callback(str(new_file))

            self._known_files = current_files
            time.sleep(30)  # Check every 30 seconds

    def stop(self):
        """Stop watching."""
        self._running = False


# ============================================
# CLI INTERFACE
# ============================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='BD Automation Scheduler Service')
    parser.add_argument('--interval', type=int, default=6, help='Run interval in hours')
    parser.add_argument('--input-dir', help='Input directory to watch')
    parser.add_argument('--test', action='store_true', help='Enable test mode')
    parser.add_argument('--run-now', action='store_true', help='Run immediately then exit')
    parser.add_argument('--status', action='store_true', help='Show scheduler status')
    parser.add_argument('--no-email', action='store_true', help='Disable email notifications')
    parser.add_argument('--no-webhook', action='store_true', help='Disable webhook delivery')

    args = parser.parse_args()

    config = SchedulerConfig(
        interval_hours=args.interval,
        input_dir=args.input_dir or str(PROJECT_ROOT / 'Engine1_Scraper' / 'data'),
        test_mode=args.test,
        send_email=not args.no_email,
        send_webhook=not args.no_webhook,
    )

    scheduler = SchedulerService(config)

    if args.status:
        status = scheduler.get_status()
        print(json.dumps(status, indent=2, default=str))
        return

    if args.run_now:
        result = scheduler.run_now()
        print(f"\nRun ID: {result.run_id}")
        print(f"Status: {result.status}")
        if result.error:
            print(f"Error: {result.error}")
        if result.result:
            print(f"Jobs Processed: {result.result.get('jobs_processed', 0)}")
            print(f"Hot Leads: {result.result.get('hot_leads', 0)}")
        return

    # Start the scheduler
    try:
        scheduler.start(blocking=True)
    except KeyboardInterrupt:
        scheduler.stop()
        print("\nScheduler stopped.")


if __name__ == '__main__':
    main()
