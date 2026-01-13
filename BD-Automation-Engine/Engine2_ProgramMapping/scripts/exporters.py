"""
Export Modules for Program Mapping Engine
Exports enriched job data to Notion CSV and n8n webhook JSON formats.

Based on: spec.md requirements for export modules
"""

import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


# ============================================
# EXPORT CONFIGURATION
# ============================================

# Default output directories (relative to repository root)
DEFAULT_NOTION_OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "outputs" / "notion"
DEFAULT_N8N_OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "outputs" / "n8n"

# Column order for Notion CSV export (24 fields from schema)
# Required Fields (6)
NOTION_REQUIRED_COLUMNS = [
    'Job Title/Position',
    'Date Posted',
    'Location',
    'Position Overview',
    'Key Responsibilities',
    'Required Qualifications',
]

# Intelligence Fields (8)
NOTION_INTELLIGENCE_COLUMNS = [
    'Security Clearance',
    'Program Hints',
    'Client Hints',
    'Contract Vehicle Hints',
    'Prime Contractor',
    'Recruiter Contact',
    'Technologies',
    'Certifications Required',
]

# Enrichment Fields (6)
NOTION_ENRICHMENT_COLUMNS = [
    'Matched Program',
    'Match Confidence',
    'Match Type',
    'BD Priority Score',
    'Priority Tier',
    'Match Signals',
]

# Metadata Fields (4)
NOTION_METADATA_COLUMNS = [
    'Source',
    'Source URL',
    'Scraped At',
    'Processed At',
]

# Combined column order for Notion export
NOTION_COLUMN_ORDER = (
    NOTION_REQUIRED_COLUMNS +
    NOTION_INTELLIGENCE_COLUMNS +
    NOTION_ENRICHMENT_COLUMNS +
    NOTION_METADATA_COLUMNS
)


# ============================================
# DATA CLASSES
# ============================================

@dataclass
class ExportResult:
    """Result of an export operation."""
    success: bool
    file_path: str
    record_count: int
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


# ============================================
# NOTION CSV EXPORTER
# ============================================

class NotionCSVExporter:
    """
    Exports enriched job data to Notion-compatible CSV format.

    The CSV format is designed for direct import into Notion databases,
    with proper handling of arrays, nested objects, and special characters.
    """

    def __init__(
        self,
        output_dir: Optional[str] = None,
        column_order: Optional[List[str]] = None
    ):
        """
        Initialize the NotionCSVExporter.

        Args:
            output_dir: Directory for CSV output. Uses default if None.
            column_order: List of column names in export order. Uses default if None.
        """
        self.output_dir = Path(output_dir) if output_dir else DEFAULT_NOTION_OUTPUT_DIR
        self.column_order = column_order or NOTION_COLUMN_ORDER

    def _ensure_output_dir(self) -> None:
        """Create output directory if it doesn't exist."""
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _format_array_field(self, value: Any) -> str:
        """
        Format array fields for Notion CSV import.

        Notion expects arrays as comma-separated values.

        Args:
            value: Array or list to format

        Returns:
            Comma-separated string representation
        """
        if value is None:
            return ""
        if isinstance(value, list):
            # Filter out None/empty items and join with comma
            items = [str(item).strip() for item in value if item]
            return ", ".join(items)
        return str(value)

    def _format_object_field(self, value: Any) -> str:
        """
        Format nested object fields for Notion CSV import.

        Args:
            value: Dict or object to format

        Returns:
            String representation of the object
        """
        if value is None:
            return ""
        if isinstance(value, dict):
            # Format as key: value pairs
            parts = []
            for k, v in value.items():
                if v:
                    parts.append(f"{k}: {v}")
            return "; ".join(parts)
        return str(value)

    def _format_confidence(self, value: Any) -> str:
        """
        Format confidence score as percentage.

        Args:
            value: Float confidence value (0.0-1.0)

        Returns:
            Percentage string (e.g., "75%")
        """
        if value is None:
            return ""
        try:
            return f"{float(value) * 100:.0f}%"
        except (ValueError, TypeError):
            return str(value)

    def _extract_field_value(self, job: Dict, field_name: str) -> str:
        """
        Extract and format a field value from a job dictionary.

        Handles both direct fields and enrichment data from _mapping/_scoring.

        Args:
            job: Job dictionary (may contain _mapping and _scoring)
            field_name: Name of the field to extract

        Returns:
            Formatted string value for CSV
        """
        # Direct field access
        value = job.get(field_name)

        # Try _mapping for enrichment fields
        if value is None and '_mapping' in job:
            mapping = job['_mapping']
            # Map display names to internal keys
            mapping_keys = {
                'Matched Program': 'program_name',
                'Match Confidence': 'match_confidence',
                'Match Type': 'match_type',
                'BD Priority Score': 'bd_priority_score',
                'Priority Tier': 'priority_tier',
                'Match Signals': 'signals',
            }
            internal_key = mapping_keys.get(field_name)
            if internal_key:
                value = mapping.get(internal_key)

        # Try _scoring for scoring fields
        if value is None and '_scoring' in job:
            scoring = job['_scoring']
            scoring_keys = {
                'BD Priority Score': 'BD Priority Score',
                'Priority Tier': 'Priority Tier',
            }
            internal_key = scoring_keys.get(field_name)
            if internal_key:
                value = scoring.get(internal_key)

        # Format based on field type
        if field_name == 'Match Confidence':
            return self._format_confidence(value)
        elif field_name in ['Key Responsibilities', 'Required Qualifications',
                           'Program Hints', 'Client Hints', 'Contract Vehicle Hints',
                           'Technologies', 'Certifications Required', 'Match Signals']:
            return self._format_array_field(value)
        elif field_name == 'Recruiter Contact':
            return self._format_object_field(value)
        elif value is None:
            return ""
        else:
            return str(value)

    def export_jobs(
        self,
        jobs: List[Dict],
        filename: Optional[str] = None,
        include_header: bool = True
    ) -> ExportResult:
        """
        Export a list of enriched jobs to Notion-compatible CSV.

        Args:
            jobs: List of job dictionaries (with _mapping and/or _scoring)
            filename: Output filename. Auto-generated if None.
            include_header: Whether to include header row

        Returns:
            ExportResult with success status and file path
        """
        errors = []

        # Ensure output directory exists
        self._ensure_output_dir()

        # Generate filename if not provided
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"jobs_export_{timestamp}.csv"

        file_path = self.output_dir / filename

        try:
            with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile, quoting=csv.QUOTE_MINIMAL)

                # Write header row
                if include_header:
                    writer.writerow(self.column_order)

                # Write data rows
                for i, job in enumerate(jobs):
                    try:
                        row = [
                            self._extract_field_value(job, col)
                            for col in self.column_order
                        ]
                        writer.writerow(row)
                    except Exception as e:
                        errors.append(f"Row {i}: {str(e)}")

            return ExportResult(
                success=len(errors) == 0,
                file_path=str(file_path),
                record_count=len(jobs),
                errors=errors,
                metadata={
                    'columns': len(self.column_order),
                    'timestamp': datetime.now().isoformat(),
                    'format': 'csv'
                }
            )

        except Exception as e:
            return ExportResult(
                success=False,
                file_path=str(file_path),
                record_count=0,
                errors=[f"Export failed: {str(e)}"],
                metadata={}
            )

    def export_batch(
        self,
        jobs: List[Dict],
        batch_size: int = 1000,
        filename_prefix: str = "jobs_batch"
    ) -> List[ExportResult]:
        """
        Export jobs in batches for large datasets.

        Args:
            jobs: List of all job dictionaries
            batch_size: Maximum jobs per file
            filename_prefix: Prefix for batch filenames

        Returns:
            List of ExportResults for each batch file
        """
        results = []
        total_batches = (len(jobs) + batch_size - 1) // batch_size

        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, len(jobs))
            batch_jobs = jobs[start_idx:end_idx]

            filename = f"{filename_prefix}_{batch_num + 1:03d}.csv"
            result = self.export_jobs(batch_jobs, filename=filename)
            results.append(result)

        return results


# ============================================
# N8N WEBHOOK JSON EXPORTER
# ============================================

class N8nWebhookExporter:
    """
    Exports enriched job data to n8n-compatible JSON format.

    The JSON format is designed for consumption by n8n webhook nodes,
    with proper structure for workflow processing.
    """

    def __init__(
        self,
        output_dir: Optional[str] = None,
        webhook_url: Optional[str] = None
    ):
        """
        Initialize the N8nWebhookExporter.

        Args:
            output_dir: Directory for JSON output. Uses default if None.
            webhook_url: n8n webhook URL for live delivery (optional).
        """
        self.output_dir = Path(output_dir) if output_dir else DEFAULT_N8N_OUTPUT_DIR
        self.webhook_url = webhook_url or os.environ.get('N8N_WEBHOOK_URL')

    def _ensure_output_dir(self) -> None:
        """Create output directory if it doesn't exist."""
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _prepare_job_payload(self, job: Dict) -> Dict:
        """
        Prepare a job dictionary for n8n webhook consumption.

        Ensures all required keys are present and properly formatted.

        Args:
            job: Raw or enriched job dictionary

        Returns:
            Cleaned job dictionary ready for n8n
        """
        payload = job.copy()

        # Ensure _mapping key exists
        if '_mapping' not in payload:
            payload['_mapping'] = {
                'program_name': None,
                'match_confidence': 0.0,
                'match_type': 'unprocessed',
                'bd_priority_score': 0,
                'priority_tier': 'Cold',
                'signals': [],
                'secondary_candidates': []
            }

        # Ensure _scoring key exists
        if '_scoring' not in payload:
            payload['_scoring'] = {
                'BD Priority Score': 0,
                'Priority Tier': 'Cold',
                'Score Breakdown': {},
                'Recommendations': []
            }

        # Add webhook metadata
        payload['_webhook_metadata'] = {
            'exported_at': datetime.now().isoformat(),
            'export_version': '2.0'
        }

        return payload

    def export_jobs(
        self,
        jobs: List[Dict],
        filename: Optional[str] = None
    ) -> ExportResult:
        """
        Export a list of enriched jobs to n8n-compatible JSON.

        Args:
            jobs: List of job dictionaries
            filename: Output filename. Auto-generated if None.

        Returns:
            ExportResult with success status and file path
        """
        errors = []

        # Ensure output directory exists
        self._ensure_output_dir()

        # Generate filename if not provided
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"jobs_webhook_{timestamp}.json"

        file_path = self.output_dir / filename

        try:
            # Prepare all job payloads
            payloads = []
            for i, job in enumerate(jobs):
                try:
                    payload = self._prepare_job_payload(job)
                    payloads.append(payload)
                except Exception as e:
                    errors.append(f"Job {i}: {str(e)}")

            # Create webhook-compatible structure
            output_data = {
                'jobs': payloads,
                'metadata': {
                    'total_count': len(payloads),
                    'exported_at': datetime.now().isoformat(),
                    'export_version': '2.0',
                    'source': 'ProgramMappingEngine'
                }
            }

            # Write JSON file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)

            return ExportResult(
                success=len(errors) == 0,
                file_path=str(file_path),
                record_count=len(payloads),
                errors=errors,
                metadata={
                    'timestamp': datetime.now().isoformat(),
                    'format': 'json',
                    'webhook_ready': True
                }
            )

        except Exception as e:
            return ExportResult(
                success=False,
                file_path=str(file_path),
                record_count=0,
                errors=[f"Export failed: {str(e)}"],
                metadata={}
            )

    def export_single(self, job: Dict) -> Dict:
        """
        Prepare a single job for immediate webhook delivery.

        Args:
            job: Job dictionary

        Returns:
            Webhook-ready payload dictionary
        """
        return self._prepare_job_payload(job)


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

def export_batch(
    jobs: List[Dict],
    output_dir: Optional[str] = None,
    formats: Optional[List[str]] = None
) -> Dict[str, ExportResult]:
    """
    Export jobs to multiple formats in one call.

    Args:
        jobs: List of enriched job dictionaries
        output_dir: Base output directory (subdirs created for each format)
        formats: List of formats to export ('notion', 'n8n'). Defaults to both.

    Returns:
        Dict mapping format name to ExportResult
    """
    if formats is None:
        formats = ['notion', 'n8n']

    results = {}

    if 'notion' in formats:
        notion_dir = Path(output_dir) / "notion" if output_dir else None
        exporter = NotionCSVExporter(output_dir=str(notion_dir) if notion_dir else None)
        results['notion'] = exporter.export_jobs(jobs)

    if 'n8n' in formats:
        n8n_dir = Path(output_dir) / "n8n" if output_dir else None
        exporter = N8nWebhookExporter(output_dir=str(n8n_dir) if n8n_dir else None)
        results['n8n'] = exporter.export_jobs(jobs)

    return results


def generate_export_report(results: Dict[str, ExportResult]) -> Dict:
    """
    Generate a summary report of export operations.

    Args:
        results: Dict of format name to ExportResult

    Returns:
        Report dictionary with statistics
    """
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_formats': len(results),
        'successful_exports': 0,
        'failed_exports': 0,
        'total_records': 0,
        'exports': {}
    }

    for format_name, result in results.items():
        if result.success:
            report['successful_exports'] += 1
        else:
            report['failed_exports'] += 1

        report['total_records'] += result.record_count

        report['exports'][format_name] = {
            'success': result.success,
            'file_path': result.file_path,
            'record_count': result.record_count,
            'errors': result.errors,
            'metadata': result.metadata
        }

    return report


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Export enriched jobs to various formats')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file with enriched jobs')
    parser.add_argument('--output', '-o', required=True, help='Output directory')
    parser.add_argument('--format', '-f', choices=['notion', 'n8n', 'both'], default='both',
                       help='Export format (default: both)')

    args = parser.parse_args()

    # Load jobs
    with open(args.input, 'r', encoding='utf-8') as f:
        jobs = json.load(f)

    # Determine formats
    if args.format == 'both':
        formats = ['notion', 'n8n']
    else:
        formats = [args.format]

    # Export
    results = export_batch(jobs, output_dir=args.output, formats=formats)

    # Generate and print report
    report = generate_export_report(results)

    print(f"\nExport Complete:")
    print(f"  Total Records: {report['total_records']}")
    print(f"  Successful Exports: {report['successful_exports']}")
    print(f"  Failed Exports: {report['failed_exports']}")

    for format_name, export_info in report['exports'].items():
        status = "OK" if export_info['success'] else "FAILED"
        print(f"\n  {format_name.upper()} [{status}]:")
        print(f"    File: {export_info['file_path']}")
        print(f"    Records: {export_info['record_count']}")
        if export_info['errors']:
            print(f"    Errors: {len(export_info['errors'])}")
