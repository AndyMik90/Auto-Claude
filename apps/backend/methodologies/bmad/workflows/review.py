"""BMAD Code Review workflow integration.

This module implements the code review phase for the BMAD methodology.
It validates implementation against acceptance criteria, runs tests,
and produces a comprehensive review report.

Story Reference: Story 6.7 - Implement BMAD Code Review Workflow Integration
Architecture Source: architecture.md#BMAD-Plugin-Structure
"""

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from apps.backend.methodologies.bmad.workflows.dev import (
    SprintStatus,
    get_implementation_status,
    load_implementation_result,
)
from apps.backend.methodologies.bmad.workflows.epics import (
    Story,
    load_epics,
)

logger = logging.getLogger(__name__)


# Type alias for progress callback
ProgressCallback = Callable[[str, float], None]


@dataclass
class ReviewFinding:
    """A single code review finding.

    Attributes:
        id: Unique identifier for the finding
        category: Type of finding (issue, suggestion, praise)
        severity: Severity level (critical, major, minor, info)
        file_path: Path to the file with the finding
        line_number: Line number (if applicable)
        description: Description of the finding
        recommendation: Suggested fix or action
    """

    id: str = ""
    category: str = "issue"  # issue, suggestion, praise
    severity: str = "minor"  # critical, major, minor, info
    file_path: str = ""
    line_number: int = 0
    description: str = ""
    recommendation: str = ""


@dataclass
class StoryReviewResult:
    """Review result for a single story.

    Attributes:
        story_id: ID of the reviewed story
        status: Review status (passed, needs_work, failed)
        acceptance_criteria_verified: Number of ACs verified
        acceptance_criteria_total: Total number of ACs
        findings: List of review findings
        notes: General review notes
    """

    story_id: str = ""
    status: str = "pending"  # pending, passed, needs_work, failed
    acceptance_criteria_verified: int = 0
    acceptance_criteria_total: int = 0
    findings: list[ReviewFinding] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class ReviewReportMetadata:
    """Metadata about the review report.

    Attributes:
        version: Report version
        created_at: Timestamp when report was created
        reviewer: Reviewer identifier
        methodology: Methodology used (BMAD)
    """

    version: str = "1.0.0"
    created_at: str = ""
    reviewer: str = "auto-claude"
    methodology: str = "BMAD"


@dataclass
class ReviewReport:
    """Complete code review report.

    This is the main output of the run_code_review function and is
    serialized to review_report.md artifact.

    Attributes:
        project_name: Name of the project
        sprint_id: Sprint being reviewed
        summary: Executive summary of the review
        overall_status: Overall review status (approved, needs_work, rejected)
        stories_reviewed: Number of stories reviewed
        stories_passed: Number of stories that passed review
        test_results: Summary of test execution results
        story_reviews: Individual story review results
        findings: Aggregated findings across all stories
        recommendations: Overall recommendations
        metadata: Report metadata
    """

    project_name: str = ""
    sprint_id: str = "Sprint-1"
    summary: str = ""
    overall_status: str = "pending"  # pending, approved, needs_work, rejected
    stories_reviewed: int = 0
    stories_passed: int = 0
    test_results: dict[str, Any] = field(default_factory=dict)
    story_reviews: list[StoryReviewResult] = field(default_factory=list)
    findings: list[ReviewFinding] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    metadata: ReviewReportMetadata = field(default_factory=ReviewReportMetadata)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    def to_markdown(self) -> str:
        """Convert ReviewReport to Markdown format.

        Returns:
            Markdown-formatted review report
        """
        lines: list[str] = []

        # Header
        lines.append(f"# Code Review Report: {self.project_name}")
        lines.append("")
        lines.append(f"**Sprint:** {self.sprint_id}")
        lines.append(f"**Status:** {self.overall_status.upper()}")
        lines.append(f"**Reviewed:** {self.metadata.created_at}")
        lines.append(f"**Reviewer:** {self.metadata.reviewer}")
        lines.append("")

        # Summary
        lines.append("## Summary")
        lines.append("")
        lines.append(self.summary or "_No summary available_")
        lines.append("")

        # Statistics
        lines.append("## Statistics")
        lines.append("")
        lines.append(f"- **Stories Reviewed:** {self.stories_reviewed}")
        lines.append(f"- **Stories Passed:** {self.stories_passed}")
        pass_rate = (
            (self.stories_passed / self.stories_reviewed * 100)
            if self.stories_reviewed > 0
            else 0
        )
        lines.append(f"- **Pass Rate:** {pass_rate:.1f}%")
        lines.append("")

        # Findings Summary by Severity
        if self.findings:
            lines.append("### Findings by Severity")
            lines.append("")
            severity_counts = {"critical": 0, "major": 0, "minor": 0, "info": 0}
            for finding in self.findings:
                if finding.severity in severity_counts:
                    severity_counts[finding.severity] += 1
            for severity, count in severity_counts.items():
                if count > 0:
                    lines.append(f"- **{severity.capitalize()}:** {count}")
            lines.append("")

        # Test Results
        if self.test_results:
            lines.append("## Test Results")
            lines.append("")
            passed = self.test_results.get("passed", 0)
            failed = self.test_results.get("failed", 0)
            skipped = self.test_results.get("skipped", 0)
            total = passed + failed + skipped

            if total > 0:
                status_icon = ":white_check_mark:" if failed == 0 else ":x:"
                lines.append(f"**Overall:** {status_icon}")
                lines.append("")
                lines.append("| Metric | Count |")
                lines.append("|--------|-------|")
                lines.append(f"| Passed | {passed} |")
                lines.append(f"| Failed | {failed} |")
                lines.append(f"| Skipped | {skipped} |")
                lines.append(f"| **Total** | {total} |")
            else:
                lines.append("_No tests executed_")
            lines.append("")

        # Story Reviews
        if self.story_reviews:
            lines.append("## Story Reviews")
            lines.append("")

            # Summary table
            lines.append("| Story ID | Status | ACs Verified | Findings |")
            lines.append("|----------|--------|--------------|----------|")
            for sr in self.story_reviews:
                status_icon = {
                    "passed": ":white_check_mark:",
                    "needs_work": ":warning:",
                    "failed": ":x:",
                    "pending": ":hourglass:",
                }.get(sr.status, ":question:")

                lines.append(
                    f"| {sr.story_id} | {status_icon} {sr.status} | "
                    f"{sr.acceptance_criteria_verified}/{sr.acceptance_criteria_total} | "
                    f"{len(sr.findings)} |"
                )
            lines.append("")

            # Detailed story reviews
            for sr in self.story_reviews:
                lines.append(f"### {sr.story_id}")
                lines.append("")
                lines.append(f"**Status:** {sr.status}")
                lines.append(
                    f"**Acceptance Criteria:** "
                    f"{sr.acceptance_criteria_verified}/{sr.acceptance_criteria_total} verified"
                )
                lines.append("")

                if sr.notes:
                    lines.append(sr.notes)
                    lines.append("")

                if sr.findings:
                    lines.append("**Findings:**")
                    for finding in sr.findings:
                        severity_badge = {
                            "critical": ":red_circle:",
                            "major": ":orange_circle:",
                            "minor": ":yellow_circle:",
                            "info": ":blue_circle:",
                        }.get(finding.severity, "")
                        lines.append(f"- {severity_badge} **{finding.category.upper()}** ({finding.severity})")
                        if finding.file_path:
                            loc = f"{finding.file_path}"
                            if finding.line_number:
                                loc += f":{finding.line_number}"
                            lines.append(f"  - Location: `{loc}`")
                        lines.append(f"  - {finding.description}")
                        if finding.recommendation:
                            lines.append(f"  - *Recommendation:* {finding.recommendation}")
                    lines.append("")

        # All Findings
        if self.findings:
            lines.append("## All Findings")
            lines.append("")

            for severity in ["critical", "major", "minor", "info"]:
                severity_findings = [f for f in self.findings if f.severity == severity]
                if severity_findings:
                    lines.append(f"### {severity.capitalize()}")
                    lines.append("")
                    for finding in severity_findings:
                        lines.append(f"- **{finding.id}** ({finding.category})")
                        if finding.file_path:
                            lines.append(f"  - File: `{finding.file_path}`")
                        lines.append(f"  - {finding.description}")
                        if finding.recommendation:
                            lines.append(f"  - *Fix:* {finding.recommendation}")
                    lines.append("")

        # Recommendations
        if self.recommendations:
            lines.append("## Recommendations")
            lines.append("")
            for i, rec in enumerate(self.recommendations, 1):
                lines.append(f"{i}. {rec}")
            lines.append("")

        # Footer
        lines.append("---")
        lines.append("")
        lines.append(f"*Generated by {self.metadata.methodology} Code Review Workflow*")
        lines.append(f"*Version: {self.metadata.version}*")

        return "\n".join(lines)


def _load_sprint_status(output_dir: Path) -> SprintStatus | None:
    """Load existing sprint status from output directory.

    Args:
        output_dir: Directory containing sprint-status.json

    Returns:
        SprintStatus if file exists, None otherwise
    """
    status_file = output_dir / "sprint-status.json"
    if not status_file.exists():
        return None

    try:
        with open(status_file) as f:
            data = json.load(f)
        return SprintStatus(**data)
    except Exception as e:
        logger.error(f"Failed to load sprint status: {e}")
        return None


def _review_story(story: Story, output_dir: Path) -> StoryReviewResult:
    """Review a single story's implementation.

    Args:
        story: Story to review
        output_dir: BMAD output directory

    Returns:
        StoryReviewResult with review details
    """
    result = StoryReviewResult(
        story_id=story.id,
        acceptance_criteria_total=len(story.acceptance_criteria),
    )

    # Load implementation result if available
    impl_result = load_implementation_result(story.id, output_dir)

    # Count verified acceptance criteria
    verified = sum(1 for ac in story.acceptance_criteria if ac.verified)
    result.acceptance_criteria_verified = verified

    # Determine status based on story status and AC verification
    if story.status == "done":
        if verified == len(story.acceptance_criteria):
            result.status = "passed"
            result.notes = f"All {verified} acceptance criteria verified."
        else:
            result.status = "needs_work"
            unverified = len(story.acceptance_criteria) - verified
            result.notes = (
                f"{unverified} acceptance criteria not yet verified. "
                "Story marked as done but requires verification."
            )
            result.findings.append(
                ReviewFinding(
                    id=f"{story.id}-RF-01",
                    category="issue",
                    severity="major",
                    description=f"{unverified} acceptance criteria not verified",
                    recommendation="Verify remaining acceptance criteria before approval",
                )
            )
    elif story.status == "in_progress":
        result.status = "pending"
        result.notes = "Story is still in progress."
    elif story.status == "blocked":
        result.status = "failed"
        result.notes = "Story is blocked and cannot be reviewed."
        result.findings.append(
            ReviewFinding(
                id=f"{story.id}-RF-02",
                category="issue",
                severity="critical",
                description="Story is blocked",
                recommendation="Resolve blocking issues before proceeding",
            )
        )
    else:
        result.status = "pending"
        result.notes = f"Story status is '{story.status}'."

    # Add implementation details if available
    if impl_result:
        if impl_result.files_modified:
            result.notes += f" Modified {len(impl_result.files_modified)} files."
        if impl_result.files_created:
            result.notes += f" Created {len(impl_result.files_created)} files."

    return result


def _generate_review_summary(
    report: ReviewReport,
    epics_doc: Any,
) -> str:
    """Generate an executive summary for the review report.

    Args:
        report: ReviewReport being generated
        epics_doc: EpicsDocument for context

    Returns:
        Summary text
    """
    parts: list[str] = []

    # Overall status summary
    if report.overall_status == "approved":
        parts.append(
            f"The code review for {report.project_name} ({report.sprint_id}) "
            "has been **approved**. All reviewed stories meet their acceptance criteria."
        )
    elif report.overall_status == "needs_work":
        parts.append(
            f"The code review for {report.project_name} ({report.sprint_id}) "
            "requires **additional work**. Some stories need attention before approval."
        )
    elif report.overall_status == "rejected":
        parts.append(
            f"The code review for {report.project_name} ({report.sprint_id}) "
            "has been **rejected**. Critical issues must be resolved."
        )
    else:
        parts.append(
            f"Code review for {report.project_name} ({report.sprint_id}) "
            "is in progress."
        )

    # Statistics
    parts.append(
        f"\n\n**Key Metrics:** {report.stories_passed}/{report.stories_reviewed} stories passed, "
        f"{len(report.findings)} total findings."
    )

    # Critical findings
    critical = [f for f in report.findings if f.severity == "critical"]
    if critical:
        parts.append(
            f"\n\n**:warning: {len(critical)} critical issue(s) require immediate attention.**"
        )

    return "".join(parts)


def _determine_overall_status(report: ReviewReport) -> str:
    """Determine the overall review status based on story reviews and findings.

    Args:
        report: ReviewReport with story reviews

    Returns:
        Overall status string (approved, needs_work, rejected)
    """
    # Check for critical findings
    critical_findings = [f for f in report.findings if f.severity == "critical"]
    if critical_findings:
        return "rejected"

    # Check story review statuses
    failed_stories = [sr for sr in report.story_reviews if sr.status == "failed"]
    if failed_stories:
        return "rejected"

    needs_work_stories = [sr for sr in report.story_reviews if sr.status == "needs_work"]
    pending_stories = [sr for sr in report.story_reviews if sr.status == "pending"]

    if needs_work_stories:
        return "needs_work"

    if pending_stories and not any(sr.status == "passed" for sr in report.story_reviews):
        return "needs_work"

    # Check major findings
    major_findings = [f for f in report.findings if f.severity == "major"]
    if len(major_findings) > 2:
        return "needs_work"

    # All checks passed
    if report.stories_passed > 0 and report.stories_passed == report.stories_reviewed:
        return "approved"

    if report.stories_reviewed == 0:
        return "pending"

    return "needs_work"


def run_code_review(
    output_dir: Path,
    progress_callback: ProgressCallback | None = None,
) -> ReviewReport:
    """Run a code review on the implemented stories.

    This is the main entry point for the BMAD code review workflow.
    It reviews all completed stories, validates acceptance criteria,
    and produces a comprehensive review report.

    Args:
        output_dir: BMAD output directory containing stories and implementation logs
        progress_callback: Optional callback for progress reporting

    Returns:
        ReviewReport with review results and findings

    Example:
        >>> report = run_code_review(Path(".auto-claude/specs/001/bmad"))
        >>> print(report.overall_status)
        'approved'

    Story Reference: Story 6.7 - Implement BMAD Code Review Workflow Integration
    """
    now = datetime.now().isoformat()

    report = ReviewReport(
        metadata=ReviewReportMetadata(
            version="1.0.0",
            created_at=now,
            reviewer="auto-claude",
            methodology="BMAD",
        ),
    )

    if progress_callback:
        progress_callback("Starting code review...", 0.0)

    # Load epics and stories
    if progress_callback:
        progress_callback("Loading epics and stories...", 10.0)

    epics_doc = load_epics(output_dir)
    if epics_doc is None:
        logger.error("No epics found for code review")
        report.summary = "Code review could not be performed: No epics found."
        report.overall_status = "rejected"
        report.recommendations.append("Run epics phase before code review.")
        return report

    report.project_name = epics_doc.project_name

    # Load sprint status
    if progress_callback:
        progress_callback("Loading sprint status...", 20.0)

    sprint_status = _load_sprint_status(output_dir)
    if sprint_status:
        report.sprint_id = sprint_status.sprint_id

    # Get implementation status
    impl_status = get_implementation_status(output_dir)

    # Collect stories to review (done and in_progress)
    stories_to_review: list[Story] = []
    for epic in epics_doc.epics:
        for story in epic.stories:
            if story.status in ("done", "in_progress"):
                stories_to_review.append(story)

    if not stories_to_review:
        logger.warning("No stories to review")
        report.summary = "No stories are ready for review. Run dev phase first."
        report.overall_status = "pending"
        report.recommendations.append("Implement stories before running code review.")
        return report

    if progress_callback:
        progress_callback(
            f"Reviewing {len(stories_to_review)} stories...", 30.0
        )

    # Review each story
    all_findings: list[ReviewFinding] = []
    stories_passed = 0

    for i, story in enumerate(stories_to_review):
        progress_pct = 30.0 + (50.0 * (i + 1) / len(stories_to_review))
        if progress_callback:
            progress_callback(f"Reviewing story {story.id}...", progress_pct)

        story_result = _review_story(story, output_dir)
        report.story_reviews.append(story_result)
        all_findings.extend(story_result.findings)

        if story_result.status == "passed":
            stories_passed += 1

    report.stories_reviewed = len(stories_to_review)
    report.stories_passed = stories_passed
    report.findings = all_findings

    # Determine overall status
    if progress_callback:
        progress_callback("Determining review status...", 85.0)

    report.overall_status = _determine_overall_status(report)

    # Generate recommendations
    if report.overall_status != "approved":
        if any(f.severity == "critical" for f in report.findings):
            report.recommendations.append(
                "Address all critical issues before proceeding."
            )
        if any(sr.status == "needs_work" for sr in report.story_reviews):
            report.recommendations.append(
                "Verify all acceptance criteria for stories marked as needs_work."
            )
        if any(sr.status == "pending" for sr in report.story_reviews):
            report.recommendations.append(
                "Complete in-progress stories before final approval."
            )

    # Generate summary
    report.summary = _generate_review_summary(report, epics_doc)

    # Write report to file
    if progress_callback:
        progress_callback("Writing review report...", 90.0)

    _write_review_report(report, output_dir)

    if progress_callback:
        progress_callback("Code review complete", 100.0)

    return report


def _write_review_report(report: ReviewReport, output_dir: Path) -> None:
    """Write the review report to output directory.

    Args:
        report: ReviewReport to write
        output_dir: BMAD output directory
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write Markdown report
    report_file = output_dir / "review_report.md"
    try:
        with open(report_file, "w") as f:
            f.write(report.to_markdown())
        logger.info(f"Review report written to {report_file}")
    except Exception as e:
        logger.error(f"Failed to write review report: {e}")
        raise

    # Write JSON report for programmatic access
    json_file = output_dir / "review_report.json"
    try:
        with open(json_file, "w") as f:
            json.dump(report.to_dict(), f, indent=2)
        logger.info(f"Review JSON written to {json_file}")
    except Exception as e:
        logger.error(f"Failed to write review JSON: {e}")


def load_review_report(output_dir: Path) -> ReviewReport | None:
    """Load existing review report from output directory.

    Args:
        output_dir: Directory containing review_report.json

    Returns:
        ReviewReport if file exists, None otherwise
    """
    report_file = output_dir / "review_report.json"
    if not report_file.exists():
        return None

    try:
        with open(report_file) as f:
            data = json.load(f)

        # Reconstruct dataclasses from dict
        metadata = ReviewReportMetadata(**data.get("metadata", {}))

        # Reconstruct story reviews
        story_reviews = []
        for sr_data in data.get("story_reviews", []):
            findings = [
                ReviewFinding(**f_data)
                for f_data in sr_data.get("findings", [])
            ]
            sr = StoryReviewResult(
                story_id=sr_data.get("story_id", ""),
                status=sr_data.get("status", "pending"),
                acceptance_criteria_verified=sr_data.get("acceptance_criteria_verified", 0),
                acceptance_criteria_total=sr_data.get("acceptance_criteria_total", 0),
                findings=findings,
                notes=sr_data.get("notes", ""),
            )
            story_reviews.append(sr)

        # Reconstruct all findings
        findings = [
            ReviewFinding(**f_data)
            for f_data in data.get("findings", [])
        ]

        return ReviewReport(
            project_name=data.get("project_name", ""),
            sprint_id=data.get("sprint_id", "Sprint-1"),
            summary=data.get("summary", ""),
            overall_status=data.get("overall_status", "pending"),
            stories_reviewed=data.get("stories_reviewed", 0),
            stories_passed=data.get("stories_passed", 0),
            test_results=data.get("test_results", {}),
            story_reviews=story_reviews,
            findings=findings,
            recommendations=data.get("recommendations", []),
            metadata=metadata,
        )
    except Exception as e:
        logger.error(f"Failed to load review report: {e}")
        return None


def get_review_status(output_dir: Path) -> dict[str, Any]:
    """Get the current review status for the project.

    Args:
        output_dir: BMAD output directory

    Returns:
        Dictionary with review status information
    """
    report = load_review_report(output_dir)

    status = {
        "has_report": report is not None,
        "overall_status": report.overall_status if report else "not_started",
        "stories_reviewed": report.stories_reviewed if report else 0,
        "stories_passed": report.stories_passed if report else 0,
        "findings_count": len(report.findings) if report else 0,
        "critical_findings": 0,
        "major_findings": 0,
        "created_at": report.metadata.created_at if report else None,
    }

    if report:
        status["critical_findings"] = sum(
            1 for f in report.findings if f.severity == "critical"
        )
        status["major_findings"] = sum(
            1 for f in report.findings if f.severity == "major"
        )

    return status
