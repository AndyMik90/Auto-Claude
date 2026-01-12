"""
Export Modules for Program Mapping Engine
Exports enriched job data to Notion CSV and n8n JSON formats.

Based on: program-mapping-skill.md
"""

import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any


# ============================================
# NOTION CSV EXPORTER
# ============================================

class NotionCSVExporter:
    """
    Exports enriched jobs to Notion-compatible CSV format.
    Maps the 24+ field schema to Notion database columns.
    """

    # Column mapping from internal fields to Notion columns
    NOTION_COLUMNS = [
        # Core fields
        'Job Title',
        'Date Posted',
        'Location',
        'Position Overview',
        'Key Responsibilities',
        'Required Qualifications',
        'Project Duration',
        'Rate/Pay',
        'Security Clearance',
        'Position Details',
        'Additional Info',
        # Intelligence fields
        'Program Hints',
        'Client Hints',
        'Contract Vehicle',
        'Prime Contractor',
        'Recruiter Contact',
        'Technologies',
        'Certifications',
        'Clearance Parsed',
        # Mapping/Scoring fields
        'Matched Program',
        'Match Confidence',
        'Match Type',
        'BD Priority Score',
        'Priority Tier',
        'Secondary Programs',
        # Metadata
        'Source URL',
        'Processing Date',
    ]

    # Internal field name to Notion column name mapping
    FIELD_MAPPING = {
        'Job Title/Position': 'Job Title',
        'Date Posted': 'Date Posted',
        'Location': 'Location',
        'Position Overview': 'Position Overview',
        'Key Responsibilities': 'Key Responsibilities',
        'Required Qualifications': 'Required Qualifications',
        'Project Duration': 'Project Duration',
        'Rate/Pay Rate': 'Rate/Pay',
        'Security Clearance': 'Security Clearance',
        'Position Details': 'Position Details',
        'Additional Information': 'Additional Info',
        'Program Hints': 'Program Hints',
        'Client Hints': 'Client Hints',
        'Contract Vehicle Hints': 'Contract Vehicle',
        'Prime Contractor': 'Prime Contractor',
        'Recruiter Contact': 'Recruiter Contact',
        'Technologies': 'Technologies',
        'Certifications Required': 'Certifications',
        'Clearance Level Parsed': 'Clearance Parsed',
        'Matched Program': 'Matched Program',
        'Match Confidence': 'Match Confidence',
        'Match Type': 'Match Type',
        'BD Priority Score': 'BD Priority Score',
        'Priority Tier': 'Priority Tier',
        'Secondary Programs': 'Secondary Programs',
        'Source URL': 'Source URL',
        'Processing Date': 'Processing Date',
    }

    def __init__(self, output_dir: str = "outputs/notion"):
        """
        Initialize the Notion CSV exporter.

        Args:
            output_dir: Directory to write CSV files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _format_value(self, value: Any) -> str:
        """Convert a value to CSV-safe string format."""
        if value is None:
            return ""
        if isinstance(value, list):
            # Join list items with semicolons for Notion multi-select
            return "; ".join(str(v) for v in value if v)
        if isinstance(value, dict):
            # Format dict as key: value pairs
            parts = [f"{k}: {v}" for k, v in value.items() if v]
            return "; ".join(parts)
        if isinstance(value, (int, float)):
            if isinstance(value, float):
                return f"{value:.2f}"
            return str(value)
        return str(value)

    def _map_job_to_row(self, job: Dict) -> Dict[str, str]:
        """Map internal job fields to Notion column names."""
        row = {}

        # Map standard fields
        for internal_name, notion_name in self.FIELD_MAPPING.items():
            value = job.get(internal_name)
            row[notion_name] = self._format_value(value)

        # Handle _mapping nested object (from program_mapper)
        mapping = job.get('_mapping', {})
        if mapping:
            row['Matched Program'] = self._format_value(mapping.get('program_name'))
            row['Match Confidence'] = self._format_value(mapping.get('match_confidence'))
            row['Match Type'] = self._format_value(mapping.get('match_type'))
            row['BD Priority Score'] = self._format_value(mapping.get('bd_priority_score'))
            row['Priority Tier'] = self._format_value(mapping.get('priority_tier'))
            row['Secondary Programs'] = self._format_value(mapping.get('secondary_candidates'))

        # Handle _scoring nested object (from bd_scoring)
        scoring = job.get('_scoring', {})
        if scoring:
            # Override with more detailed scoring if available
            if 'bd_score' in scoring:
                row['BD Priority Score'] = self._format_value(scoring.get('bd_score'))
            if 'tier' in scoring:
                row['Priority Tier'] = self._format_value(scoring.get('tier'))

        # Add processing date if not present
        if not row.get('Processing Date'):
            row['Processing Date'] = datetime.now().strftime('%Y-%m-%d')

        return row

    def export(self, jobs: List[Dict], filename: Optional[str] = None) -> str:
        """
        Export jobs to Notion-compatible CSV.

        Args:
            jobs: List of enriched job dictionaries
            filename: Output filename (auto-generated if not provided)

        Returns:
            Path to the exported CSV file
        """
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"jobs_notion_{timestamp}.csv"

        filepath = self.output_dir / filename

        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=self.NOTION_COLUMNS, extrasaction='ignore')
            writer.writeheader()

            for job in jobs:
                row = self._map_job_to_row(job)
                writer.writerow(row)

        return str(filepath)


# ============================================
# N8N WEBHOOK EXPORTER
# ============================================

class N8nWebhookExporter:
    """
    Exports enriched jobs to n8n-compatible JSON format.
    Creates JSON payloads suitable for n8n webhook nodes.
    """

    def __init__(self, output_dir: str = "outputs/n8n"):
        """
        Initialize the n8n JSON exporter.

        Args:
            output_dir: Directory to write JSON files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _prepare_job_for_export(self, job: Dict) -> Dict:
        """
        Prepare a job object for n8n export.
        Flattens nested objects and ensures JSON serialization.
        """
        export_job = {}

        # Copy all top-level fields
        for key, value in job.items():
            if key.startswith('_'):
                # Keep _mapping and _scoring as nested objects
                export_job[key] = value
            elif isinstance(value, (str, int, float, bool, type(None))):
                export_job[key] = value
            elif isinstance(value, list):
                export_job[key] = value
            elif isinstance(value, dict):
                export_job[key] = value
            else:
                # Convert other types to string
                export_job[key] = str(value)

        # Ensure _mapping exists
        if '_mapping' not in export_job:
            export_job['_mapping'] = {
                'program_name': None,
                'match_confidence': 0.0,
                'match_type': 'unmatched',
                'bd_priority_score': 0,
                'priority_tier': 'Cold',
                'signals': [],
                'secondary_candidates': []
            }

        # Ensure _scoring exists
        if '_scoring' not in export_job:
            export_job['_scoring'] = {
                'bd_score': export_job.get('_mapping', {}).get('bd_priority_score', 0),
                'tier': export_job.get('_mapping', {}).get('priority_tier', 'Cold'),
                'factors': []
            }

        # Add metadata
        export_job['_metadata'] = {
            'exported_at': datetime.now().isoformat(),
            'export_format': 'n8n',
            'schema_version': '2.0'
        }

        return export_job

    def export(self, jobs: List[Dict], filename: Optional[str] = None) -> str:
        """
        Export jobs to n8n-compatible JSON.

        Args:
            jobs: List of enriched job dictionaries
            filename: Output filename (auto-generated if not provided)

        Returns:
            Path to the exported JSON file
        """
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"jobs_n8n_{timestamp}.json"

        filepath = self.output_dir / filename

        # Prepare all jobs for export
        export_data = [self._prepare_job_for_export(job) for job in jobs]

        # Create the n8n-friendly payload
        payload = {
            'jobs': export_data,
            'metadata': {
                'total_jobs': len(export_data),
                'exported_at': datetime.now().isoformat(),
                'tiers': {
                    'hot': sum(1 for j in export_data if j.get('_mapping', {}).get('priority_tier') == 'Hot'),
                    'warm': sum(1 for j in export_data if j.get('_mapping', {}).get('priority_tier') == 'Warm'),
                    'cold': sum(1 for j in export_data if j.get('_mapping', {}).get('priority_tier') == 'Cold'),
                }
            }
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        return str(filepath)

    def export_webhook_payload(self, jobs: List[Dict]) -> Dict:
        """
        Create a webhook payload without writing to file.
        Useful for direct API calls to n8n.

        Args:
            jobs: List of enriched job dictionaries

        Returns:
            Webhook-ready payload dictionary
        """
        export_data = [self._prepare_job_for_export(job) for job in jobs]

        return {
            'jobs': export_data,
            'metadata': {
                'total_jobs': len(export_data),
                'timestamp': datetime.now().isoformat(),
            }
        }


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

def export_batch(
    jobs: List[Dict],
    notion_output: Optional[str] = "outputs/notion",
    n8n_output: Optional[str] = "outputs/n8n",
    filename_prefix: Optional[str] = None
) -> Dict[str, str]:
    """
    Export jobs to both Notion CSV and n8n JSON formats.

    Args:
        jobs: List of enriched job dictionaries
        notion_output: Directory for Notion CSV (None to skip)
        n8n_output: Directory for n8n JSON (None to skip)
        filename_prefix: Optional prefix for output filenames

    Returns:
        Dictionary with paths to exported files
    """
    results = {}
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    if notion_output:
        exporter = NotionCSVExporter(notion_output)
        filename = f"{filename_prefix}_notion_{timestamp}.csv" if filename_prefix else None
        results['notion_csv'] = exporter.export(jobs, filename)

    if n8n_output:
        exporter = N8nWebhookExporter(n8n_output)
        filename = f"{filename_prefix}_n8n_{timestamp}.json" if filename_prefix else None
        results['n8n_json'] = exporter.export(jobs, filename)

    return results


def create_output_directories(base_path: str = "outputs") -> None:
    """
    Create output directories for exporters.

    Args:
        base_path: Base output directory
    """
    Path(base_path).mkdir(parents=True, exist_ok=True)
    (Path(base_path) / "notion").mkdir(exist_ok=True)
    (Path(base_path) / "n8n").mkdir(exist_ok=True)


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Export enriched jobs to various formats')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file with enriched jobs')
    parser.add_argument('--output', '-o', default='outputs', help='Output base directory')
    parser.add_argument('--format', '-f', choices=['notion', 'n8n', 'both'], default='both',
                        help='Export format (default: both)')

    args = parser.parse_args()

    # Load jobs
    with open(args.input, 'r') as f:
        jobs = json.load(f)

    # Handle both array and wrapped formats
    if isinstance(jobs, dict):
        jobs = jobs.get('jobs', [jobs])

    print(f"Loaded {len(jobs)} jobs from {args.input}")

    # Create output directories
    create_output_directories(args.output)

    # Export based on format
    results = export_batch(
        jobs,
        notion_output=f"{args.output}/notion" if args.format in ['notion', 'both'] else None,
        n8n_output=f"{args.output}/n8n" if args.format in ['n8n', 'both'] else None,
    )

    print(f"\nExported files:")
    for format_name, path in results.items():
        print(f"  {format_name}: {path}")
