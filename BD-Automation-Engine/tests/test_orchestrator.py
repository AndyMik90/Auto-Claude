"""
Comprehensive Test Suite for BD Automation Engine Orchestrator
Tests the master orchestrator, all engines, and service integrations.
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

import pytest

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ============================================
# FIXTURES
# ============================================

@pytest.fixture
def sample_jobs():
    """Sample job data for testing."""
    return [
        {
            "title": "Senior Systems Engineer - DCGS",
            "Job Title/Position": "Senior Systems Engineer - DCGS",
            "company": "GDIT",
            "Prime Contractor": "GDIT",
            "location": "San Diego, CA",
            "Location": "San Diego, CA",
            "clearance": "TS/SCI",
            "Security Clearance": "TS/SCI",
            "description": "Support AF DCGS PACAF mission...",
            "Position Overview": "Support AF DCGS PACAF mission...",
            "Source": "ClearanceJobs",
            "Source URL": "https://example.com/job1",
        },
        {
            "title": "Intelligence Analyst",
            "Job Title/Position": "Intelligence Analyst",
            "company": "BAE Systems",
            "Prime Contractor": "BAE Systems",
            "location": "Hampton, VA",
            "Location": "Hampton, VA",
            "clearance": "Top Secret",
            "Security Clearance": "Top Secret",
            "description": "Provide intelligence analysis for DGS-1...",
            "Position Overview": "Provide intelligence analysis for DGS-1...",
            "Source": "LinkedIn",
            "Source URL": "https://example.com/job2",
        },
        {
            "title": "Software Developer",
            "Job Title/Position": "Software Developer",
            "company": "Northrop Grumman",
            "Prime Contractor": "Northrop Grumman",
            "location": "Falls Church, VA",
            "Location": "Falls Church, VA",
            "clearance": "Secret",
            "Security Clearance": "Secret",
            "description": "Develop software applications...",
            "Position Overview": "Develop software applications...",
            "Source": "Indeed",
            "Source URL": "https://example.com/job3",
        },
    ]


@pytest.fixture
def sample_jobs_file(sample_jobs, tmp_path):
    """Create a temporary JSON file with sample jobs."""
    file_path = tmp_path / "sample_jobs.json"
    with open(file_path, 'w') as f:
        json.dump(sample_jobs, f)
    return str(file_path)


@pytest.fixture
def enriched_jobs(sample_jobs):
    """Sample enriched jobs with mapping and scoring data."""
    enriched = []
    for job in sample_jobs:
        enriched_job = job.copy()
        enriched_job['_mapping'] = {
            'program_name': 'AF DCGS - PACAF' if 'DCGS' in str(job) else 'Corporate HQ',
            'match_confidence': 0.85,
            'match_type': 'direct',
            'signals': ['Location match: San Diego'],
            'secondary_candidates': [],
        }
        enriched_job['_scoring'] = {
            'BD Priority Score': 85 if 'TS/SCI' in str(job.get('clearance', '')) else 60,
            'Priority Tier': 'Hot' if 'TS/SCI' in str(job.get('clearance', '')) else 'Warm',
            'Score Breakdown': {'base': 50, 'clearance': 25, 'confidence': 10},
            'Recommendations': ['Immediate outreach recommended'],
        }
        enriched.append(enriched_job)
    return enriched


# ============================================
# ORCHESTRATOR TESTS
# ============================================

class TestOrchestratorConfig:
    """Test OrchestratorConfig dataclass."""

    def test_default_config(self):
        """Test default configuration values."""
        from orchestrator import OrchestratorConfig

        config = OrchestratorConfig()

        assert config.test_mode == False
        assert config.run_mapping == True
        assert config.run_briefings == True
        assert config.send_webhook == True
        assert config.send_email == False

    def test_custom_config(self):
        """Test custom configuration."""
        from orchestrator import OrchestratorConfig

        config = OrchestratorConfig(
            test_mode=True,
            hot_leads_only=True,
            min_bd_score=70,
        )

        assert config.test_mode == True
        assert config.hot_leads_only == True
        assert config.min_bd_score == 70


class TestBDOrchestrator:
    """Test BDOrchestrator class."""

    def test_orchestrator_initialization(self):
        """Test orchestrator initialization."""
        from orchestrator import BDOrchestrator, OrchestratorConfig

        config = OrchestratorConfig(test_mode=True)
        orchestrator = BDOrchestrator(config)

        assert orchestrator.config.test_mode == True
        assert orchestrator.engines is not None

    def test_engine_imports(self):
        """Test that engines are imported correctly."""
        from orchestrator import import_engines

        engines = import_engines()

        # Check that mapping engine is available (core engine)
        if 'mapping' in engines:
            assert 'process_jobs_batch' in engines['mapping']
            assert 'export_batch' in engines['mapping']


class TestPipelineResult:
    """Test PipelineResult dataclass."""

    def test_pipeline_result_creation(self):
        """Test creating a PipelineResult."""
        from orchestrator import PipelineResult

        result = PipelineResult(
            success=True,
            jobs_processed=10,
            hot_leads=3,
            warm_leads=5,
            cold_leads=2,
            briefings_generated=3,
            qa_approved=8,
            qa_needs_review=2,
            export_files={'notion': '/path/to/csv'},
            errors=[],
            duration_seconds=45.5,
        )

        assert result.success == True
        assert result.jobs_processed == 10
        assert result.hot_leads == 3


# ============================================
# EMAIL NOTIFIER TESTS
# ============================================

class TestEmailNotifier:
    """Test EmailNotifier class."""

    def test_email_notifier_disabled_without_credentials(self):
        """Test that email notifier is disabled without credentials."""
        from orchestrator import EmailNotifier, OrchestratorConfig

        config = OrchestratorConfig(
            smtp_user='',
            smtp_password='',
        )
        notifier = EmailNotifier(config)

        assert notifier.enabled == False

    def test_build_hot_lead_text(self, enriched_jobs):
        """Test building plain text email content."""
        from orchestrator import EmailNotifier, OrchestratorConfig

        config = OrchestratorConfig()
        notifier = EmailNotifier(config)

        hot_leads = [j for j in enriched_jobs if 'Hot' in str(j.get('_scoring', {}).get('Priority Tier', ''))]

        text = notifier._build_hot_lead_text(hot_leads)

        assert 'HOT LEAD ALERT' in text
        assert 'Senior Systems Engineer' in text or len(hot_leads) == 0


# ============================================
# WEBHOOK DELIVERY TESTS
# ============================================

class TestWebhookDelivery:
    """Test WebhookDelivery class."""

    def test_webhook_delivery_disabled_without_url(self):
        """Test that webhook delivery handles missing URL gracefully."""
        from orchestrator import WebhookDelivery, OrchestratorConfig

        config = OrchestratorConfig(n8n_webhook_url='')
        delivery = WebhookDelivery(config)

        result = delivery.deliver_jobs([{'test': 'job'}])

        assert result == False  # Should fail gracefully

    @patch('requests.post')
    def test_webhook_delivery_success(self, mock_post, enriched_jobs):
        """Test successful webhook delivery."""
        from orchestrator import WebhookDelivery, OrchestratorConfig

        mock_post.return_value.status_code = 200

        config = OrchestratorConfig(n8n_webhook_url='https://test.webhook.com')
        delivery = WebhookDelivery(config)

        result = delivery.deliver_jobs(enriched_jobs)

        assert mock_post.called


# ============================================
# ENGINE INTEGRATION TESTS
# ============================================

class TestProgramMapperIntegration:
    """Test program_mapper.py integration."""

    def test_map_job_to_program(self, sample_jobs):
        """Test mapping a job to a federal program."""
        try:
            from Engine2_ProgramMapping.scripts.program_mapper import map_job_to_program

            job = sample_jobs[0]  # DCGS job in San Diego
            result = map_job_to_program(job)

            assert result is not None
            assert hasattr(result, 'program_name')
            assert hasattr(result, 'match_confidence')
            assert hasattr(result, 'match_type')
            assert 0.0 <= result.match_confidence <= 1.0
        except ImportError:
            pytest.skip("program_mapper not available")

    def test_process_jobs_batch(self, sample_jobs):
        """Test batch processing of jobs."""
        try:
            from Engine2_ProgramMapping.scripts.program_mapper import process_jobs_batch

            results = process_jobs_batch(sample_jobs)

            assert len(results) == len(sample_jobs)
            for result in results:
                assert '_mapping' in result
        except ImportError:
            pytest.skip("program_mapper not available")


class TestBDScoringIntegration:
    """Test bd_scoring.py integration."""

    def test_calculate_bd_score(self, sample_jobs):
        """Test BD score calculation."""
        try:
            from Engine5_Scoring.scripts.bd_scoring import calculate_bd_score

            job = sample_jobs[0]
            result = calculate_bd_score(job)

            assert result is not None
            assert hasattr(result, 'bd_score')
            assert hasattr(result, 'tier')
            assert 0 <= result.bd_score <= 100
            assert result.tier in ['Hot', 'Warm', 'Cold']
        except ImportError:
            pytest.skip("bd_scoring not available")

    def test_score_batch(self, sample_jobs):
        """Test batch scoring."""
        try:
            from Engine5_Scoring.scripts.bd_scoring import score_batch

            results = score_batch(sample_jobs)

            assert len(results) == len(sample_jobs)
            for result in results:
                assert '_scoring' in result
        except ImportError:
            pytest.skip("bd_scoring not available")


class TestContactLookupIntegration:
    """Test contact_lookup.py integration."""

    def test_lookup_contacts(self):
        """Test contact lookup by program."""
        try:
            from Engine3_OrgChart.scripts.contact_lookup import lookup_contacts

            result = lookup_contacts(program_name='DCGS')

            assert result is not None
            assert hasattr(result, 'contacts')
            assert hasattr(result, 'contact_count')
        except ImportError:
            pytest.skip("contact_lookup not available")


class TestBriefingGeneratorIntegration:
    """Test briefing_generator.py integration."""

    def test_generate_briefing(self, enriched_jobs):
        """Test briefing generation."""
        try:
            from Engine4_Briefing.scripts.briefing_generator import generate_briefing

            job = enriched_jobs[0]
            result = generate_briefing(job, include_contacts=False)

            assert result is not None
            assert 'markdown' in result
            assert 'BD Briefing' in result['markdown']
        except ImportError:
            pytest.skip("briefing_generator not available")


class TestQAFeedbackIntegration:
    """Test qa_feedback.py integration."""

    def test_evaluate_batch(self, enriched_jobs):
        """Test QA batch evaluation."""
        try:
            from Engine6_QA.scripts.qa_feedback import evaluate_batch

            report = evaluate_batch(enriched_jobs)

            assert report is not None
            assert hasattr(report, 'total_items')
            assert hasattr(report, 'auto_approved')
            assert hasattr(report, 'needs_review')
        except ImportError:
            pytest.skip("qa_feedback not available")


# ============================================
# SERVICES TESTS
# ============================================

class TestDatabaseService:
    """Test database.py service."""

    def test_file_based_storage(self, enriched_jobs, tmp_path):
        """Test file-based storage fallback."""
        from services.database import FileBasedStorage

        storage = FileBasedStorage(data_dir=str(tmp_path))

        # Save jobs
        filepath = storage.save_jobs(enriched_jobs, 'test_batch')
        assert Path(filepath).exists()

        # Load jobs
        loaded = storage.load_jobs('test_batch')
        assert len(loaded) == len(enriched_jobs)


class TestSchedulerService:
    """Test scheduler.py service."""

    def test_scheduler_config(self):
        """Test scheduler configuration."""
        from services.scheduler import SchedulerConfig

        config = SchedulerConfig(
            interval_hours=12,
            test_mode=True,
        )

        assert config.interval_hours == 12
        assert config.test_mode == True

    def test_scheduled_run_creation(self):
        """Test creating a scheduled run."""
        from services.scheduler import ScheduledRun

        run = ScheduledRun(
            run_id='TEST_001',
            scheduled_time=datetime.now(),
        )

        assert run.status == 'pending'
        assert run.retry_count == 0


class TestNotionSyncService:
    """Test notion_sync.py service."""

    def test_notion_config(self):
        """Test Notion configuration."""
        from services.notion_sync import NotionConfig

        config = NotionConfig()

        # Config should load from env vars
        assert isinstance(config.token, str)
        assert isinstance(config.db_jobs, str)

    def test_format_rich_text(self):
        """Test rich text formatting."""
        from services.notion_sync import NotionSyncService

        sync = NotionSyncService()

        result = sync._format_rich_text('Test text')

        assert len(result) == 1
        assert result[0]['type'] == 'text'
        assert result[0]['text']['content'] == 'Test text'


class TestBullhornIntegration:
    """Test bullhorn_integration.py service."""

    def test_bullhorn_config(self):
        """Test Bullhorn configuration."""
        from services.bullhorn_integration import BullhornConfig

        config = BullhornConfig()

        assert isinstance(config.api_url, str)
        assert 'bullhorn' in config.api_url.lower()

    def test_mock_client(self):
        """Test mock Bullhorn client."""
        from services.bullhorn_integration import get_bullhorn_client

        client = get_bullhorn_client(use_mock=True)

        # Test mock operations
        assert client.authenticate() == True

        contact = {'name': 'Test User', 'email': 'test@example.com'}
        enriched = client.enrich_contact_from_bullhorn(contact)

        assert enriched['name'] == 'Test User'


# ============================================
# EXPORTER TESTS
# ============================================

class TestExporters:
    """Test exporters.py module."""

    def test_notion_csv_exporter(self, enriched_jobs, tmp_path):
        """Test Notion CSV export."""
        try:
            from Engine2_ProgramMapping.scripts.exporters import NotionCSVExporter

            exporter = NotionCSVExporter(output_dir=str(tmp_path))
            result = exporter.export_jobs(enriched_jobs)

            assert result.success == True
            assert result.record_count == len(enriched_jobs)
            assert Path(result.file_path).exists()
        except ImportError:
            pytest.skip("exporters not available")

    def test_n8n_json_exporter(self, enriched_jobs, tmp_path):
        """Test n8n JSON export."""
        try:
            from Engine2_ProgramMapping.scripts.exporters import N8nWebhookExporter

            exporter = N8nWebhookExporter(output_dir=str(tmp_path))
            result = exporter.export_jobs(enriched_jobs)

            assert result.success == True
            assert result.record_count == len(enriched_jobs)
            assert Path(result.file_path).exists()

            # Verify JSON structure
            with open(result.file_path, 'r') as f:
                data = json.load(f)
            assert 'jobs' in data
            assert 'metadata' in data
        except ImportError:
            pytest.skip("exporters not available")


# ============================================
# END-TO-END TESTS
# ============================================

class TestEndToEnd:
    """End-to-end integration tests."""

    def test_full_pipeline_test_mode(self, sample_jobs_file):
        """Test full pipeline in test mode."""
        from orchestrator import BDOrchestrator, OrchestratorConfig

        config = OrchestratorConfig(
            input_path=sample_jobs_file,
            test_mode=True,
            send_email=False,
            send_webhook=False,
        )

        orchestrator = BDOrchestrator(config)
        result = orchestrator.run_full_pipeline(sample_jobs_file)

        assert result is not None
        assert result.jobs_processed <= 3  # Test mode limits to 3

    def test_pipeline_with_invalid_input(self, tmp_path):
        """Test pipeline handles invalid input gracefully."""
        from orchestrator import BDOrchestrator, OrchestratorConfig

        config = OrchestratorConfig(
            test_mode=True,
            send_email=False,
            send_webhook=False,
        )

        orchestrator = BDOrchestrator(config)
        result = orchestrator.run_full_pipeline(str(tmp_path / 'nonexistent.json'))

        assert result.success == False
        assert len(result.errors) > 0


# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
