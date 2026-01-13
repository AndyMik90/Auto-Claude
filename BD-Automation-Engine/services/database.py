"""
Database Persistence Layer - PostgreSQL integration for BD Automation Engine.
Provides persistent storage for jobs, programs, contacts, and pipeline runs.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('BD-Database')

# Try to import psycopg2
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_values
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False
    logger.warning("psycopg2 not installed. Database features disabled.")


@dataclass
class DatabaseConfig:
    """PostgreSQL database configuration."""
    host: str = os.getenv('POSTGRES_HOST', 'localhost')
    port: int = int(os.getenv('POSTGRES_PORT', '5432'))
    database: str = os.getenv('POSTGRES_DB', 'bd_automation')
    user: str = os.getenv('POSTGRES_USER', 'postgres')
    password: str = os.getenv('POSTGRES_PASSWORD', '')

    @property
    def connection_string(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


class DatabaseManager:
    """Manages PostgreSQL database operations for BD Automation Engine."""

    def __init__(self, config: DatabaseConfig = None):
        self.config = config or DatabaseConfig()
        self._connection = None
        self._initialized = False

    @contextmanager
    def get_connection(self):
        """Get a database connection with automatic cleanup."""
        if not HAS_POSTGRES:
            raise RuntimeError("psycopg2 not installed. Run: pip install psycopg2-binary")

        conn = None
        try:
            conn = psycopg2.connect(
                host=self.config.host,
                port=self.config.port,
                database=self.config.database,
                user=self.config.user,
                password=self.config.password
            )
            yield conn
        finally:
            if conn:
                conn.close()

    @contextmanager
    def get_cursor(self, dict_cursor: bool = True):
        """Get a database cursor with automatic commit/rollback."""
        with self.get_connection() as conn:
            cursor_factory = RealDictCursor if dict_cursor else None
            cursor = conn.cursor(cursor_factory=cursor_factory)
            try:
                yield cursor
                conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Database error: {e}")
                raise

    def initialize_schema(self):
        """Create database tables if they don't exist."""
        if not HAS_POSTGRES:
            logger.warning("PostgreSQL not available. Using file-based storage.")
            return

        schema_sql = """
        -- Jobs table: stores all processed job postings
        CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            job_id VARCHAR(255) UNIQUE,
            title VARCHAR(500),
            company VARCHAR(255),
            location VARCHAR(255),
            clearance VARCHAR(100),
            description TEXT,
            source VARCHAR(100),
            source_url TEXT,
            scraped_at TIMESTAMP,
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            raw_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Program mappings table: stores job-to-program mappings
        CREATE TABLE IF NOT EXISTS program_mappings (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
            program_name VARCHAR(255),
            match_confidence FLOAT,
            match_type VARCHAR(50),
            signals JSONB,
            secondary_candidates JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- BD scores table: stores scoring results
        CREATE TABLE IF NOT EXISTS bd_scores (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
            bd_score INTEGER,
            priority_tier VARCHAR(50),
            score_breakdown JSONB,
            recommendations JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- QA reviews table: stores QA evaluation results
        CREATE TABLE IF NOT EXISTS qa_reviews (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
            status VARCHAR(50),
            confidence FLOAT,
            review_reasons JSONB,
            reviewed BOOLEAN DEFAULT FALSE,
            reviewed_by VARCHAR(255),
            reviewed_at TIMESTAMP,
            feedback TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Pipeline runs table: stores pipeline execution history
        CREATE TABLE IF NOT EXISTS pipeline_runs (
            id SERIAL PRIMARY KEY,
            batch_id VARCHAR(100) UNIQUE,
            input_file VARCHAR(500),
            jobs_processed INTEGER,
            hot_leads INTEGER,
            warm_leads INTEGER,
            cold_leads INTEGER,
            briefings_generated INTEGER,
            qa_approved INTEGER,
            qa_needs_review INTEGER,
            duration_seconds FLOAT,
            success BOOLEAN,
            errors JSONB,
            export_files JSONB,
            started_at TIMESTAMP,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Contacts table: stores contact information
        CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            first_name VARCHAR(100),
            title VARCHAR(255),
            company VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(50),
            linkedin TEXT,
            location VARCHAR(255),
            program VARCHAR(255),
            tier INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
        CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
        CREATE INDEX IF NOT EXISTS idx_jobs_clearance ON jobs(clearance);
        CREATE INDEX IF NOT EXISTS idx_jobs_processed_at ON jobs(processed_at);
        CREATE INDEX IF NOT EXISTS idx_mappings_program ON program_mappings(program_name);
        CREATE INDEX IF NOT EXISTS idx_scores_tier ON bd_scores(priority_tier);
        CREATE INDEX IF NOT EXISTS idx_scores_score ON bd_scores(bd_score);
        CREATE INDEX IF NOT EXISTS idx_qa_status ON qa_reviews(status);
        CREATE INDEX IF NOT EXISTS idx_contacts_program ON contacts(program);
        CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
        """

        try:
            with self.get_cursor(dict_cursor=False) as cursor:
                cursor.execute(schema_sql)
            self._initialized = True
            logger.info("Database schema initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize schema: {e}")
            raise

    # ============================================
    # JOB OPERATIONS
    # ============================================

    def insert_job(self, job: Dict) -> int:
        """Insert a job and return its ID."""
        with self.get_cursor() as cursor:
            # Generate unique job_id from source URL or hash
            job_id = job.get('Source URL') or job.get('url') or f"job_{hash(json.dumps(job, sort_keys=True))}"

            cursor.execute("""
                INSERT INTO jobs (job_id, title, company, location, clearance, description,
                                 source, source_url, raw_data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (job_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            """, (
                job_id,
                job.get('Job Title/Position') or job.get('title', ''),
                job.get('Prime Contractor') or job.get('company', ''),
                job.get('Location') or job.get('location', ''),
                job.get('Security Clearance') or job.get('clearance', ''),
                job.get('Position Overview') or job.get('description', ''),
                job.get('Source', 'unknown'),
                job.get('Source URL') or job.get('url', ''),
                json.dumps(job)
            ))
            return cursor.fetchone()['id']

    def insert_jobs_batch(self, jobs: List[Dict]) -> List[int]:
        """Insert multiple jobs and return their IDs."""
        ids = []
        for job in jobs:
            try:
                job_id = self.insert_job(job)
                ids.append(job_id)
            except Exception as e:
                logger.error(f"Failed to insert job: {e}")
        return ids

    def get_job_by_id(self, job_id: int) -> Optional[Dict]:
        """Get a job by its database ID."""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
            return cursor.fetchone()

    def get_jobs_by_filter(
        self,
        source: str = None,
        location: str = None,
        clearance: str = None,
        since: datetime = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get jobs matching specified filters."""
        conditions = ["1=1"]
        params = []

        if source:
            conditions.append("source = %s")
            params.append(source)
        if location:
            conditions.append("location ILIKE %s")
            params.append(f"%{location}%")
        if clearance:
            conditions.append("clearance ILIKE %s")
            params.append(f"%{clearance}%")
        if since:
            conditions.append("processed_at >= %s")
            params.append(since)

        params.append(limit)

        with self.get_cursor() as cursor:
            cursor.execute(f"""
                SELECT * FROM jobs
                WHERE {' AND '.join(conditions)}
                ORDER BY processed_at DESC
                LIMIT %s
            """, params)
            return cursor.fetchall()

    # ============================================
    # MAPPING OPERATIONS
    # ============================================

    def insert_mapping(self, job_db_id: int, mapping: Dict) -> int:
        """Insert a program mapping for a job."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO program_mappings
                    (job_id, program_name, match_confidence, match_type, signals, secondary_candidates)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                job_db_id,
                mapping.get('program_name', ''),
                mapping.get('match_confidence', 0.0),
                mapping.get('match_type', 'inferred'),
                json.dumps(mapping.get('signals', [])),
                json.dumps(mapping.get('secondary_candidates', []))
            ))
            return cursor.fetchone()['id']

    def get_mappings_by_program(self, program_name: str, limit: int = 100) -> List[Dict]:
        """Get all mappings for a specific program."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT m.*, j.title, j.company, j.location
                FROM program_mappings m
                JOIN jobs j ON m.job_id = j.id
                WHERE m.program_name ILIKE %s
                ORDER BY m.match_confidence DESC
                LIMIT %s
            """, (f"%{program_name}%", limit))
            return cursor.fetchall()

    # ============================================
    # SCORING OPERATIONS
    # ============================================

    def insert_score(self, job_db_id: int, scoring: Dict) -> int:
        """Insert a BD score for a job."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO bd_scores
                    (job_id, bd_score, priority_tier, score_breakdown, recommendations)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                job_db_id,
                scoring.get('BD Priority Score', 0),
                scoring.get('Priority Tier', 'Cold'),
                json.dumps(scoring.get('Score Breakdown', {})),
                json.dumps(scoring.get('Recommendations', []))
            ))
            return cursor.fetchone()['id']

    def get_hot_leads(self, min_score: int = 80, limit: int = 50) -> List[Dict]:
        """Get all hot leads above score threshold."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT j.*, s.bd_score, s.priority_tier, s.recommendations,
                       m.program_name, m.match_confidence
                FROM jobs j
                JOIN bd_scores s ON j.id = s.job_id
                LEFT JOIN program_mappings m ON j.id = m.job_id
                WHERE s.bd_score >= %s
                ORDER BY s.bd_score DESC
                LIMIT %s
            """, (min_score, limit))
            return cursor.fetchall()

    def get_score_distribution(self) -> Dict:
        """Get distribution of BD scores."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE bd_score >= 80) as hot,
                    COUNT(*) FILTER (WHERE bd_score >= 50 AND bd_score < 80) as warm,
                    COUNT(*) FILTER (WHERE bd_score < 50) as cold,
                    AVG(bd_score) as average,
                    COUNT(*) as total
                FROM bd_scores
            """)
            return dict(cursor.fetchone())

    # ============================================
    # QA OPERATIONS
    # ============================================

    def insert_qa_review(self, job_db_id: int, qa_result: Dict) -> int:
        """Insert a QA review for a job."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO qa_reviews
                    (job_id, status, confidence, review_reasons)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (
                job_db_id,
                qa_result.get('status', 'pending'),
                qa_result.get('confidence', 0.5),
                json.dumps(qa_result.get('review_reasons', []))
            ))
            return cursor.fetchone()['id']

    def get_pending_reviews(self, limit: int = 50) -> List[Dict]:
        """Get all pending QA reviews."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT q.*, j.title, j.company, j.location,
                       m.program_name, s.bd_score
                FROM qa_reviews q
                JOIN jobs j ON q.job_id = j.id
                LEFT JOIN program_mappings m ON j.id = m.job_id
                LEFT JOIN bd_scores s ON j.id = s.job_id
                WHERE q.status = 'needs_review' AND q.reviewed = FALSE
                ORDER BY s.bd_score DESC NULLS LAST
                LIMIT %s
            """, (limit,))
            return cursor.fetchall()

    def update_review(self, review_id: int, feedback: str, approved: bool, reviewer: str) -> bool:
        """Update a QA review with human feedback."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                UPDATE qa_reviews
                SET reviewed = TRUE,
                    reviewed_by = %s,
                    reviewed_at = CURRENT_TIMESTAMP,
                    feedback = %s,
                    status = %s
                WHERE id = %s
            """, (reviewer, feedback, 'approved' if approved else 'rejected', review_id))
            return cursor.rowcount > 0

    # ============================================
    # PIPELINE RUN OPERATIONS
    # ============================================

    def insert_pipeline_run(self, result: Dict) -> int:
        """Record a pipeline run."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO pipeline_runs
                    (batch_id, input_file, jobs_processed, hot_leads, warm_leads, cold_leads,
                     briefings_generated, qa_approved, qa_needs_review, duration_seconds,
                     success, errors, export_files, started_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                result.get('batch_id', datetime.now().strftime('BATCH_%Y%m%d_%H%M%S')),
                result.get('input_file', ''),
                result.get('jobs_processed', 0),
                result.get('hot_leads', 0),
                result.get('warm_leads', 0),
                result.get('cold_leads', 0),
                result.get('briefings_generated', 0),
                result.get('qa_approved', 0),
                result.get('qa_needs_review', 0),
                result.get('duration_seconds', 0),
                result.get('success', False),
                json.dumps(result.get('errors', [])),
                json.dumps(result.get('export_files', {})),
                result.get('started_at', datetime.now())
            ))
            return cursor.fetchone()['id']

    def get_pipeline_history(self, limit: int = 20) -> List[Dict]:
        """Get recent pipeline run history."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT * FROM pipeline_runs
                ORDER BY completed_at DESC
                LIMIT %s
            """, (limit,))
            return cursor.fetchall()

    def get_pipeline_stats(self, days: int = 7) -> Dict:
        """Get pipeline statistics for the last N days."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT
                    COUNT(*) as total_runs,
                    SUM(jobs_processed) as total_jobs,
                    SUM(hot_leads) as total_hot_leads,
                    AVG(duration_seconds) as avg_duration,
                    COUNT(*) FILTER (WHERE success = TRUE) as successful_runs
                FROM pipeline_runs
                WHERE completed_at >= CURRENT_DATE - INTERVAL '%s days'
            """, (days,))
            return dict(cursor.fetchone())

    # ============================================
    # REPORTING
    # ============================================

    def generate_dashboard_data(self) -> Dict:
        """Generate data for a BD dashboard."""
        with self.get_cursor() as cursor:
            # Score distribution
            cursor.execute("""
                SELECT priority_tier, COUNT(*) as count
                FROM bd_scores
                GROUP BY priority_tier
            """)
            tier_dist = {row['priority_tier']: row['count'] for row in cursor.fetchall()}

            # Top programs
            cursor.execute("""
                SELECT program_name, COUNT(*) as count, AVG(match_confidence) as avg_confidence
                FROM program_mappings
                WHERE program_name IS NOT NULL AND program_name != 'Unmatched'
                GROUP BY program_name
                ORDER BY count DESC
                LIMIT 10
            """)
            top_programs = cursor.fetchall()

            # Recent activity
            cursor.execute("""
                SELECT DATE(completed_at) as date, SUM(jobs_processed) as jobs,
                       SUM(hot_leads) as hot_leads
                FROM pipeline_runs
                WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY DATE(completed_at)
                ORDER BY date
            """)
            daily_activity = cursor.fetchall()

            return {
                'tier_distribution': tier_dist,
                'top_programs': [dict(p) for p in top_programs],
                'daily_activity': [dict(d) for d in daily_activity],
                'generated_at': datetime.now().isoformat()
            }


# ============================================
# FILE-BASED FALLBACK
# ============================================

class FileBasedStorage:
    """Fallback file-based storage when PostgreSQL is not available."""

    def __init__(self, data_dir: str = None):
        from pathlib import Path
        self.data_dir = Path(data_dir) if data_dir else Path(__file__).parent.parent / 'data' / 'db'
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def save_jobs(self, jobs: List[Dict], batch_id: str = None) -> str:
        """Save jobs to JSON file."""
        batch_id = batch_id or datetime.now().strftime('batch_%Y%m%d_%H%M%S')
        filepath = self.data_dir / f'jobs_{batch_id}.json'
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(jobs, f, indent=2, default=str)
        return str(filepath)

    def load_jobs(self, batch_id: str = None) -> List[Dict]:
        """Load jobs from JSON file."""
        if batch_id:
            filepath = self.data_dir / f'jobs_{batch_id}.json'
        else:
            # Get most recent
            files = list(self.data_dir.glob('jobs_*.json'))
            if not files:
                return []
            filepath = max(files, key=lambda f: f.stat().st_mtime)

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_pipeline_run(self, result: Dict) -> str:
        """Save pipeline run result."""
        runs_file = self.data_dir / 'pipeline_runs.json'
        runs = []
        if runs_file.exists():
            with open(runs_file, 'r') as f:
                runs = json.load(f)
        runs.append(result)
        with open(runs_file, 'w') as f:
            json.dump(runs[-100:], f, indent=2, default=str)  # Keep last 100 runs
        return str(runs_file)


# ============================================
# FACTORY FUNCTION
# ============================================

def get_storage(prefer_postgres: bool = True):
    """Get storage backend (PostgreSQL or file-based)."""
    if prefer_postgres and HAS_POSTGRES:
        config = DatabaseConfig()
        if config.password:  # Only use PostgreSQL if configured
            db = DatabaseManager(config)
            try:
                db.initialize_schema()
                return db
            except Exception as e:
                logger.warning(f"PostgreSQL not available: {e}")

    logger.info("Using file-based storage")
    return FileBasedStorage()


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='BD Automation Database Manager')
    parser.add_argument('--init', action='store_true', help='Initialize database schema')
    parser.add_argument('--stats', action='store_true', help='Show database statistics')
    parser.add_argument('--hot-leads', action='store_true', help='Show hot leads')
    parser.add_argument('--pending-reviews', action='store_true', help='Show pending QA reviews')
    parser.add_argument('--dashboard', action='store_true', help='Generate dashboard data')

    args = parser.parse_args()

    db = get_storage()

    if isinstance(db, DatabaseManager):
        if args.init:
            db.initialize_schema()
            print("Database schema initialized")

        if args.stats:
            stats = db.get_pipeline_stats()
            print(f"\nPipeline Statistics (Last 7 Days):")
            print(f"  Total Runs: {stats.get('total_runs', 0)}")
            print(f"  Total Jobs: {stats.get('total_jobs', 0)}")
            print(f"  Hot Leads: {stats.get('total_hot_leads', 0)}")
            print(f"  Avg Duration: {stats.get('avg_duration', 0):.1f}s")

        if args.hot_leads:
            leads = db.get_hot_leads()
            print(f"\nHot Leads ({len(leads)}):")
            for lead in leads[:10]:
                print(f"  - {lead['title']} | Score: {lead['bd_score']} | {lead['program_name']}")

        if args.pending_reviews:
            reviews = db.get_pending_reviews()
            print(f"\nPending Reviews ({len(reviews)}):")
            for review in reviews[:10]:
                print(f"  - {review['title']} | {review['program_name']} | Reasons: {review['review_reasons']}")

        if args.dashboard:
            data = db.generate_dashboard_data()
            print(json.dumps(data, indent=2, default=str))
    else:
        print("Using file-based storage. PostgreSQL not configured.")
