"""
Bullhorn ETL Database Schema
Creates SQLite database with comprehensive schema for:
- Jobs, Candidates, Placements, Activities
- Prime Contractors, Programs, Past Performance
"""

import sqlite3
from pathlib import Path
from datetime import datetime

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"


def create_database():
    """Create the master Bullhorn database with all tables."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    # =========================================
    # CORE ENTITY TABLES
    # =========================================

    # Jobs table - all job orders from Bullhorn
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bullhorn_job_id VARCHAR(20) UNIQUE,
            job_number VARCHAR(10),
            title VARCHAR(500) NOT NULL,
            description TEXT,
            client_corporation VARCHAR(200),
            prime_contractor VARCHAR(200),
            employment_type VARCHAR(50),
            status VARCHAR(50),
            pay_rate DECIMAL(10,2),
            bill_rate DECIMAL(10,2),
            salary DECIMAL(12,2),
            perm_fee_percent INTEGER,
            location VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(50),
            clearance_required VARCHAR(100),
            skills TEXT,
            owner VARCHAR(200),
            contact VARCHAR(200),
            date_added DATETIME,
            date_modified DATETIME,
            date_closed DATETIME,
            custom_text1 TEXT,
            custom_text2 TEXT,
            custom_text3 TEXT,
            source_file VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Candidates/Contacts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bullhorn_candidate_id VARCHAR(50) UNIQUE,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            full_name VARCHAR(200),
            email VARCHAR(200),
            phone VARCHAR(50),
            mobile VARCHAR(50),
            occupation VARCHAR(200),
            job_title VARCHAR(200),
            company_name VARCHAR(200),
            current_employer VARCHAR(200),
            status VARCHAR(50),
            address VARCHAR(500),
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            clearance_level VARCHAR(100),
            linkedin_url VARCHAR(500),
            owner VARCHAR(200),
            date_added DATETIME,
            date_modified DATETIME,
            last_activity_date DATETIME,
            custom_text1 TEXT,
            custom_text2 TEXT,
            custom_text3 TEXT,
            source_file VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Placements table - links jobs and candidates
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS placements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bullhorn_placement_id VARCHAR(50) UNIQUE,
            job_id INTEGER,
            candidate_id INTEGER,
            bullhorn_job_id VARCHAR(20),
            bullhorn_candidate_id VARCHAR(50),
            placement_date DATE,
            start_date DATE,
            end_date DATE,
            status VARCHAR(50),
            outcome VARCHAR(100),
            pay_rate DECIMAL(10,2),
            bill_rate DECIMAL(10,2),
            salary DECIMAL(12,2),
            commission DECIMAL(10,2),
            duration_days INTEGER,
            client_name VARCHAR(200),
            job_title VARCHAR(500),
            candidate_name VARCHAR(200),
            owner VARCHAR(200),
            source_file VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id),
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        )
    """)

    # Activities/Notes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bullhorn_activity_id VARCHAR(50),
            activity_type VARCHAR(100),
            action VARCHAR(200),
            related_job_id INTEGER,
            related_candidate_id INTEGER,
            bullhorn_job_id VARCHAR(20),
            bullhorn_candidate_id VARCHAR(50),
            activity_date DATETIME,
            actor VARCHAR(200),
            note_text TEXT,
            comments TEXT,
            follow_up_required BOOLEAN,
            follow_up_date DATE,
            status VARCHAR(50),
            source_file VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (related_job_id) REFERENCES jobs(id),
            FOREIGN KEY (related_candidate_id) REFERENCES candidates(id)
        )
    """)

    # =========================================
    # BUSINESS DEVELOPMENT TABLES
    # =========================================

    # Prime Contractors - companies we work with
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prime_contractors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(200) UNIQUE NOT NULL,
            normalized_name VARCHAR(200),
            aliases TEXT,
            cage_code VARCHAR(20),
            duns_number VARCHAR(20),
            website VARCHAR(500),
            headquarters VARCHAR(200),
            employee_count INTEGER,
            annual_revenue DECIMAL(15,2),
            naics_codes TEXT,
            contract_vehicles TEXT,
            total_jobs INTEGER DEFAULT 0,
            total_placements INTEGER DEFAULT 0,
            total_revenue DECIMAL(15,2) DEFAULT 0,
            first_engagement_date DATE,
            last_engagement_date DATE,
            relationship_status VARCHAR(50),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Programs - federal programs we support
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS programs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(500) NOT NULL,
            normalized_name VARCHAR(500),
            acronym VARCHAR(50),
            prime_contractor_id INTEGER,
            prime_contractor_name VARCHAR(200),
            agency VARCHAR(200),
            sub_agency VARCHAR(200),
            contract_number VARCHAR(100),
            contract_value DECIMAL(15,2),
            period_of_performance VARCHAR(100),
            start_date DATE,
            end_date DATE,
            location VARCHAR(200),
            description TEXT,
            total_jobs INTEGER DEFAULT 0,
            total_placements INTEGER DEFAULT 0,
            total_revenue DECIMAL(15,2) DEFAULT 0,
            source_file VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (prime_contractor_id) REFERENCES prime_contractors(id)
        )
    """)

    # Past Performance - aggregated performance data
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS past_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prime_contractor_id INTEGER,
            prime_contractor_name VARCHAR(200),
            program_id INTEGER,
            program_name VARCHAR(500),
            total_jobs INTEGER DEFAULT 0,
            open_jobs INTEGER DEFAULT 0,
            closed_jobs INTEGER DEFAULT 0,
            filled_jobs INTEGER DEFAULT 0,
            lost_jobs INTEGER DEFAULT 0,
            total_placements INTEGER DEFAULT 0,
            active_placements INTEGER DEFAULT 0,
            completed_placements INTEGER DEFAULT 0,
            total_candidates_submitted INTEGER DEFAULT 0,
            total_revenue DECIMAL(15,2) DEFAULT 0,
            avg_bill_rate DECIMAL(10,2),
            avg_pay_rate DECIMAL(10,2),
            avg_margin DECIMAL(5,2),
            avg_placement_duration_days INTEGER,
            fill_rate DECIMAL(5,2),
            first_job_date DATE,
            last_job_date DATE,
            first_placement_date DATE,
            last_placement_date DATE,
            performance_score DECIMAL(5,2),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (prime_contractor_id) REFERENCES prime_contractors(id),
            FOREIGN KEY (program_id) REFERENCES programs(id)
        )
    """)

    # =========================================
    # LINKING/MAPPING TABLES
    # =========================================

    # Job to Program mapping
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS job_program_mapping (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            program_id INTEGER NOT NULL,
            confidence_score DECIMAL(5,2),
            mapping_method VARCHAR(50),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id),
            FOREIGN KEY (program_id) REFERENCES programs(id),
            UNIQUE(job_id, program_id)
        )
    """)

    # Job to Prime mapping
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS job_prime_mapping (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            prime_contractor_id INTEGER NOT NULL,
            relationship_type VARCHAR(50),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id),
            FOREIGN KEY (prime_contractor_id) REFERENCES prime_contractors(id),
            UNIQUE(job_id, prime_contractor_id)
        )
    """)

    # Candidate to Prime history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidate_prime_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            prime_contractor_id INTEGER NOT NULL,
            start_date DATE,
            end_date DATE,
            job_title VARCHAR(200),
            program_name VARCHAR(500),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id),
            FOREIGN KEY (prime_contractor_id) REFERENCES prime_contractors(id)
        )
    """)

    # =========================================
    # METADATA/AUDIT TABLES
    # =========================================

    # Source files tracking
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS source_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename VARCHAR(500) NOT NULL,
            file_path VARCHAR(1000),
            file_size_bytes INTEGER,
            file_type VARCHAR(50),
            entity_type VARCHAR(50),
            record_count INTEGER,
            processed_date DATETIME,
            processing_status VARCHAR(50),
            error_message TEXT,
            checksum VARCHAR(64),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Data quality issues log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS data_quality_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file VARCHAR(500),
            table_name VARCHAR(100),
            record_identifier VARCHAR(200),
            issue_type VARCHAR(100),
            issue_description TEXT,
            original_value TEXT,
            corrected_value TEXT,
            severity VARCHAR(20),
            resolved BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Processing statistics
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processing_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id VARCHAR(50),
            source_file VARCHAR(500),
            table_name VARCHAR(100),
            records_read INTEGER,
            records_inserted INTEGER,
            records_updated INTEGER,
            records_skipped INTEGER,
            records_error INTEGER,
            duplicates_found INTEGER,
            processing_time_seconds DECIMAL(10,2),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # =========================================
    # INDEXES FOR PERFORMANCE
    # =========================================

    # Jobs indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_bullhorn_id ON jobs(bullhorn_job_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_job_number ON jobs(job_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_corporation)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_prime ON jobs(prime_contractor)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_date_added ON jobs(date_added)")

    # Candidates indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_bullhorn_id ON candidates(bullhorn_candidate_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(full_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_candidates_company ON candidates(company_name)")

    # Placements indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_placements_job_id ON placements(job_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_placements_candidate_id ON placements(candidate_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_placements_date ON placements(placement_date)")

    # Activities indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_job_id ON activities(related_job_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_candidate_id ON activities(related_candidate_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date)")

    # Prime contractors indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_primes_name ON prime_contractors(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_primes_normalized ON prime_contractors(normalized_name)")

    # Programs indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_programs_name ON programs(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_programs_prime ON programs(prime_contractor_id)")

    conn.commit()
    conn.close()

    print(f"Database created successfully at: {DATABASE_PATH}")
    return DATABASE_PATH


def get_connection():
    """Get database connection."""
    return sqlite3.connect(DATABASE_PATH)


def get_table_counts():
    """Get record counts for all tables."""
    conn = get_connection()
    cursor = conn.cursor()

    tables = [
        'jobs', 'candidates', 'placements', 'activities',
        'prime_contractors', 'programs', 'past_performance',
        'source_files', 'data_quality_log', 'processing_stats'
    ]

    counts = {}
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        counts[table] = cursor.fetchone()[0]

    conn.close()
    return counts


if __name__ == "__main__":
    create_database()
    print("\nTable counts:")
    for table, count in get_table_counts().items():
        print(f"  {table}: {count}")
