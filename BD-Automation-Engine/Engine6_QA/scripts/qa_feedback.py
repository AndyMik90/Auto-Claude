"""
Quality Assurance & Feedback Loop Engine - QA gating, human review queues, and feedback collection.
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

class QAStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    NEEDS_REVIEW = "needs_review"
    REJECTED = "rejected"

@dataclass
class QAConfig:
    auto_approve_threshold: float = 0.70
    review_threshold: float = 0.50
    batch_size: int = 10

@dataclass
class QAResult:
    job_id: str
    status: QAStatus
    confidence: float
    review_reasons: List[str] = field(default_factory=list)
    original_program: str = ""

@dataclass
class BatchQAReport:
    batch_id: str
    total_items: int
    auto_approved: int
    needs_review: int
    rejected: int
    avg_confidence: float
    timestamp: str
    items: List[QAResult] = field(default_factory=list)

def evaluate_item(job, config=None):
    if config is None:
        config = QAConfig()
    mapping = job.get("_mapping", {})
    confidence = mapping.get("match_confidence", 0.5)
    program = mapping.get("program_name", "Unmatched")
    clearance = job.get("Security Clearance", "")
    job_id = job.get("Source URL", "") or job.get("Job Title/Position", str(id(job)))
    review_reasons = []
    if confidence >= config.auto_approve_threshold:
        status = QAStatus.APPROVED
    elif confidence >= config.review_threshold:
        status = QAStatus.NEEDS_REVIEW
        review_reasons.append(f"Confidence {confidence:.0%} below threshold")
    else:
        status = QAStatus.NEEDS_REVIEW
        review_reasons.append(f"Low confidence {confidence:.0%}")
    if "TS/SCI" in clearance.upper():
        if status == QAStatus.APPROVED:
            status = QAStatus.NEEDS_REVIEW
        review_reasons.append("High clearance requires verification")
    if program == "Unmatched":
        status = QAStatus.NEEDS_REVIEW
        review_reasons.append("No program match found")
    return QAResult(job_id=job_id[:100], status=status, confidence=confidence,
                   review_reasons=review_reasons, original_program=program)

def evaluate_batch(jobs, config=None, batch_id=None):
    if config is None:
        config = QAConfig()
    if batch_id is None:
        batch_id = datetime.now().strftime("BATCH_%Y%m%d_%H%M%S")
    results = []
    total_conf = 0.0
    for job in jobs:
        result = evaluate_item(job, config)
        results.append(result)
        total_conf += result.confidence
    auto_approved = sum(1 for r in results if r.status == QAStatus.APPROVED)
    needs_review = sum(1 for r in results if r.status == QAStatus.NEEDS_REVIEW)
    rejected = sum(1 for r in results if r.status == QAStatus.REJECTED)
    avg_conf = total_conf / len(results) if results else 0.0
    return BatchQAReport(batch_id=batch_id, total_items=len(results), auto_approved=auto_approved,
                        needs_review=needs_review, rejected=rejected, avg_confidence=avg_conf,
                        timestamp=datetime.now().isoformat(), items=results)

class ReviewQueue:
    def __init__(self, queue_file=None):
        if queue_file is None:
            queue_file = Path(__file__).parent.parent / "data" / "review_queue.json"
        self.queue_file = Path(queue_file)
        self.items = []
        self._load()

    def _load(self):
        if self.queue_file.exists():
            with open(self.queue_file, "r") as f:
                self.items = json.load(f)

    def _save(self):
        self.queue_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.queue_file, "w") as f:
            json.dump(self.items, f, indent=2, default=str)

    def add(self, job, qa_result):
        item = {"job_id": qa_result.job_id, "added_at": datetime.now().isoformat(),
                "status": qa_result.status.value, "confidence": qa_result.confidence,
                "review_reasons": qa_result.review_reasons, "original_program": qa_result.original_program,
                "reviewed": False}
        self.items.append(item)
        self._save()

    def get_pending(self):
        return [i for i in self.items if not i.get("reviewed", False)]

    def get_stats(self):
        total = len(self.items)
        pending = len(self.get_pending())
        return {"total": total, "pending": pending, "reviewed": total - pending}

def run_qa_workflow(jobs, config=None, auto_queue=True):
    if config is None:
        config = QAConfig()
    report = evaluate_batch(jobs, config)
    approved_jobs, review_jobs = [], []
    queue = ReviewQueue() if auto_queue else None
    for i, result in enumerate(report.items):
        job = jobs[i]
        if result.status == QAStatus.APPROVED:
            approved_jobs.append(job)
        else:
            review_jobs.append(job)
            if queue:
                queue.add(job, result)
    return report, approved_jobs, review_jobs
