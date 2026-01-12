"""
Full BD Automation Pipeline - 8-Stage pipeline integrating all engines.
"""
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from Engine2_ProgramMapping.scripts.pipeline import (
    PipelineConfig as BasePipelineConfig, PipelineStats, ingest_jobs,
    parse_and_standardize, match_to_programs, calculate_bd_scores, export_results
)
from Engine3_OrgChart.scripts.contact_lookup import lookup_contacts, format_contacts_json
from Engine4_Briefing.scripts.briefing_generator import generate_briefing, generate_briefings_batch
from Engine6_QA.scripts.qa_feedback import QAConfig, run_qa_workflow, BatchQAReport

@dataclass
class FullPipelineConfig(BasePipelineConfig):
    enable_contacts: bool = True
    contact_limit: int = 5
    enable_briefings: bool = True
    briefing_min_score: int = 50
    enable_qa: bool = True
    qa_auto_approve_threshold: float = 0.70

@dataclass
class FullPipelineStats(PipelineStats):
    contacts_found: int = 0
    briefings_generated: int = 0
    qa_approved: int = 0
    qa_needs_review: int = 0

def enrich_with_contacts(jobs, contact_limit=5):
    results = []
    for job in jobs:
        mapping = job.get("_mapping", {})
        program = mapping.get("program_name", "")
        company = job.get("Prime Contractor", "")
        result = lookup_contacts(program_name=program, prime_contractor=company, limit=contact_limit)
        enriched = job.copy()
        enriched["_contacts"] = {"contacts": format_contacts_json(result), "count": result.contact_count}
        results.append(enriched)
    return results

def generate_job_briefings(jobs, output_dir="outputs/BD_Briefings", min_score=50, include_contacts=True):
    results = []
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    for job in jobs:
        enriched = job.copy()
        score = job.get("_scoring", {}).get("bd_score", 50)
        if score >= min_score:
            result = generate_briefing(job, include_contacts)
            title = job.get("Job Title/Position", "Unknown")[:40]
            program = job.get("_mapping", {}).get("program_name", "Unmatched")[:30]
            safe = lambda s: "".join(c for c in s if c.isalnum() or c in " -_")
            filename = f"{safe(program)}_{safe(title)}_Briefing.md"
            filepath = Path(output_dir) / filename
            with open(filepath, "w") as f:
                f.write(result["markdown"])
            enriched["_briefing"] = {"generated": True, "path": str(filepath)}
        else:
            enriched["_briefing"] = {"generated": False, "reason": f"Score {score} below {min_score}"}
        results.append(enriched)
    return results

def run_qa_stage(jobs, config):
    report, approved, review = run_qa_workflow(jobs, config)
    results = []
    for job in jobs:
        job_id = job.get("Source URL", "") or job.get("Job Title/Position", "")
        qa_item = next((i for i in report.items if i.job_id == job_id[:100]), None)
        enriched = job.copy()
        if qa_item:
            enriched["_qa"] = {"status": qa_item.status.value, "confidence": qa_item.confidence}
        results.append(enriched)
    return results, report

def run_full_pipeline(config):
    stats = FullPipelineStats()
    def log(msg):
        if config.verbose:
            print(msg)
    try:
        log("=== Stage 1: Ingest ===")
        jobs = ingest_jobs(config.input_path)
        stats.total_jobs = len(jobs)
        if config.test_mode:
            jobs = jobs[:config.test_limit]
        log(f"Loaded {len(jobs)} jobs")

        log("=== Stage 2-3: Parse & Standardize ===")
        standardized = parse_and_standardize(jobs, use_llm=config.use_llm)
        stats.jobs_standardized = len([j for j in standardized if j.get("Validation Status") != "invalid"])

        log("=== Stage 4: Match to Programs ===")
        matched = match_to_programs(standardized, config.use_federal_db)
        stats.jobs_matched = len([j for j in matched if j.get("_mapping", {}).get("program_name") != "Unmatched"])

        log("=== Stage 5: Calculate BD Scores ===")
        scored = calculate_bd_scores(matched)
        stats.jobs_scored = len(scored)

        if config.enable_contacts:
            log("=== Stage 6: Contact Lookup ===")
            with_contacts = enrich_with_contacts(scored, config.contact_limit)
            stats.contacts_found = sum(1 for j in with_contacts if j.get("_contacts", {}).get("count", 0) > 0)
        else:
            with_contacts = scored

        if config.enable_briefings:
            log("=== Stage 7: Generate Briefings ===")
            with_briefings = generate_job_briefings(with_contacts, f"{config.output_dir}/BD_Briefings",
                                                   config.briefing_min_score, config.enable_contacts)
            stats.briefings_generated = sum(1 for j in with_briefings if j.get("_briefing", {}).get("generated"))
        else:
            with_briefings = with_contacts

        if config.enable_qa:
            log("=== Stage 8: Quality Assurance ===")
            qa_config = QAConfig(auto_approve_threshold=config.qa_auto_approve_threshold)
            final_jobs, qa_report = run_qa_stage(with_briefings, qa_config)
            stats.qa_approved = qa_report.auto_approved
            stats.qa_needs_review = qa_report.needs_review
        else:
            final_jobs = with_briefings

        log("=== Export Results ===")
        export_results(final_jobs, output_dir=config.output_dir, export_notion=config.export_notion, export_n8n=config.export_n8n)
        stats.jobs_processed = len(final_jobs)
        stats.jobs_exported = len(final_jobs)

    except Exception as e:
        stats.processing_errors += 1
        log(f"ERROR: {e}")
        raise
    finally:
        stats.end_time = datetime.now()

    log(f"=== Pipeline Complete: {stats.jobs_processed} jobs in {stats.duration_seconds:.1f}s ===")
    return stats

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Full BD Pipeline")
    parser.add_argument("--input", "-i", required=True)
    parser.add_argument("--output", "-o", default="outputs")
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()
    config = FullPipelineConfig(input_path=args.input, output_dir=args.output, test_mode=args.test)
    run_full_pipeline(config)
