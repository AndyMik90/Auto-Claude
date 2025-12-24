"""
Issue Batching Service
======================

Groups similar issues together for combined auto-fix:
- Uses semantic similarity from duplicates.py
- Creates issue clusters using agglomerative clustering
- Generates combined specs for issue batches
- Tracks batch state and progress
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Import validators
try:
    from .batch_validator import BatchValidator
    from .duplicates import SIMILAR_THRESHOLD
except (ImportError, ValueError, SystemError):
    from batch_validator import BatchValidator
    from duplicates import SIMILAR_THRESHOLD


class ClaudeSimilarityDetector:
    """
    Claude-based similarity detection for GitHub issues.
    Uses Claude Haiku 4.5 for fast semantic similarity comparison.
    """

    def __init__(self, project_dir: Path | None = None):
        """Initialize Claude similarity detector."""
        self.project_dir = project_dir or Path.cwd()
        print(
            f"[SIMILARITY] Initialized with project_dir: {self.project_dir}", flush=True
        )

    async def compare_issues(
        self,
        repo: str,
        issue_a: dict[str, Any],
        issue_b: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Compare two issues for similarity using Claude SDK.

        Returns:
            Dict with is_similar (bool) and overall_score (float 0-1)
        """
        try:
            # Import auth utilities
            import sys

            from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

            backend_path = Path(__file__).parent.parent.parent
            sys.path.insert(0, str(backend_path))
            from core.auth import ensure_claude_code_oauth_token
        except ImportError as e:
            logger.error(f"claude-agent-sdk not available: {e}")
            return {
                "is_similar": False,
                "overall_score": 0.0,
                "reasoning": "Claude SDK not available",
            }

        prompt = f"""Compare these two GitHub issues and determine if they are similar enough to be fixed together in a single batch.

Issue A (#{issue_a["number"]}):
Title: {issue_a.get("title", "")}
Body: {issue_a.get("body", "")}

Issue B (#{issue_b["number"]}):
Title: {issue_b.get("title", "")}
Body: {issue_b.get("body", "")}

Are these issues similar enough to fix together? Consider:
- Do they affect the same feature/component?
- Do they share a common root cause?
- Would fixing them together make sense?

Respond with JSON only:
{{
  "is_similar": true/false,
  "similarity_score": 0.0-1.0,
  "reasoning": "brief explanation"
}}"""

        try:
            # Ensure Claude Code OAuth token is available
            ensure_claude_code_oauth_token()

            print("[SIMILARITY] Creating Claude SDK client...", flush=True)
            print(f"[SIMILARITY] CWD: {self.project_dir.resolve()}", flush=True)

            # Using Haiku 4.5 - fast and cost-effective for similarity detection
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model="claude-haiku-4-5-20251001",
                    system_prompt="You are an expert at analyzing GitHub issues. Respond ONLY with valid JSON. Do NOT use any tools. Do NOT write explanatory text. ONLY return the JSON object requested.",
                    allowed_tools=[],
                    max_turns=1,
                    cwd=str(self.project_dir.resolve()),
                )
            )

            print("[SIMILARITY] Claude SDK client created successfully", flush=True)

            async with client:
                await client.query(prompt)
                response_text = await self._collect_response(client)

            print(
                f"[SIMILARITY] Received response: {response_text[:200] if response_text else 'EMPTY'}",
                flush=True,
            )
            logger.info(
                f"[SIMILARITY] Received response: {response_text[:200] if response_text else 'EMPTY'}"
            )

            # Parse JSON response
            import json

            content = response_text.strip()

            if not content:
                logger.error("[SIMILARITY] Empty response from Claude SDK")
                raise ValueError("Empty response from Claude SDK")

            # Extract JSON from markdown code blocks if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            else:
                # Look for JSON object in the response (handle preamble text)
                if "{" in content:
                    start = content.find("{")
                    # Find matching closing brace
                    brace_count = 0
                    for i, char in enumerate(content[start:], start):
                        if char == "{":
                            brace_count += 1
                        elif char == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                content = content[start : i + 1]
                                break

            logger.info(f"[SIMILARITY] Parsing JSON: {content[:200]}")
            result = json.loads(content)

            return {
                "is_similar": result.get("is_similar", False),
                "overall_score": result.get("similarity_score", 0.0),
                "reasoning": result.get("reasoning", ""),
            }

        except Exception as e:
            logger.error(f"Claude similarity comparison error: {e}")
            import traceback

            traceback.print_exc()
            # If Claude fails, assume not similar (conservative approach)
            return {
                "is_similar": False,
                "overall_score": 0.0,
                "reasoning": f"Error during comparison: {e}",
            }

    async def _collect_response(self, client: Any) -> str:
        """Collect text response from Claude client - matches insights_runner pattern."""
        response_text = ""
        message_count = 0

        print("[SIMILARITY] Starting to collect response...", flush=True)

        async for msg in client.receive_response():
            message_count += 1
            msg_type = type(msg).__name__
            print(
                f"[SIMILARITY] Received message #{message_count}, type: {msg_type}",
                flush=True,
            )

            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__
                    print(f"[SIMILARITY] Block type: {block_type}", flush=True)
                    if block_type == "TextBlock" and hasattr(block, "text"):
                        text = block.text
                        print(
                            f"[SIMILARITY] Found text: {text[:100] if text else 'EMPTY'}",
                            flush=True,
                        )
                        response_text += text

        print(
            f"[SIMILARITY] Finished collecting. Total messages: {message_count}, Response length: {len(response_text)}",
            flush=True,
        )
        return response_text

    async def precompute_embeddings(self, repo: str, issues: list[dict]) -> int:
        """No-op for compatibility with DuplicateDetector interface."""
        return 0


class BatchStatus(str, Enum):
    """Status of an issue batch."""

    PENDING = "pending"
    ANALYZING = "analyzing"
    CREATING_SPEC = "creating_spec"
    BUILDING = "building"
    QA_REVIEW = "qa_review"
    PR_CREATED = "pr_created"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class IssueBatchItem:
    """An issue within a batch."""

    issue_number: int
    title: str
    body: str
    labels: list[str] = field(default_factory=list)
    similarity_to_primary: float = 1.0  # Primary issue has 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "issue_number": self.issue_number,
            "title": self.title,
            "body": self.body,
            "labels": self.labels,
            "similarity_to_primary": self.similarity_to_primary,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> IssueBatchItem:
        return cls(
            issue_number=data["issue_number"],
            title=data["title"],
            body=data.get("body", ""),
            labels=data.get("labels", []),
            similarity_to_primary=data.get("similarity_to_primary", 1.0),
        )


@dataclass
class IssueBatch:
    """A batch of related issues to be fixed together."""

    batch_id: str
    repo: str
    primary_issue: int  # The "anchor" issue for the batch
    issues: list[IssueBatchItem]
    common_themes: list[str] = field(default_factory=list)
    status: BatchStatus = BatchStatus.PENDING
    spec_id: str | None = None
    pr_number: int | None = None
    error: str | None = None
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    # AI validation results
    validated: bool = False
    validation_confidence: float = 0.0
    validation_reasoning: str = ""
    theme: str = ""  # Refined theme from validation

    def to_dict(self) -> dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "repo": self.repo,
            "primary_issue": self.primary_issue,
            "issues": [i.to_dict() for i in self.issues],
            "common_themes": self.common_themes,
            "status": self.status.value,
            "spec_id": self.spec_id,
            "pr_number": self.pr_number,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "validated": self.validated,
            "validation_confidence": self.validation_confidence,
            "validation_reasoning": self.validation_reasoning,
            "theme": self.theme,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> IssueBatch:
        return cls(
            batch_id=data["batch_id"],
            repo=data["repo"],
            primary_issue=data["primary_issue"],
            issues=[IssueBatchItem.from_dict(i) for i in data.get("issues", [])],
            common_themes=data.get("common_themes", []),
            status=BatchStatus(data.get("status", "pending")),
            spec_id=data.get("spec_id"),
            pr_number=data.get("pr_number"),
            error=data.get("error"),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            updated_at=data.get("updated_at", datetime.now(timezone.utc).isoformat()),
            validated=data.get("validated", False),
            validation_confidence=data.get("validation_confidence", 0.0),
            validation_reasoning=data.get("validation_reasoning", ""),
            theme=data.get("theme", ""),
        )

    def save(self, github_dir: Path) -> None:
        """Save batch to disk."""
        batches_dir = github_dir / "batches"
        batches_dir.mkdir(parents=True, exist_ok=True)

        batch_file = batches_dir / f"batch_{self.batch_id}.json"
        with open(batch_file, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

        self.updated_at = datetime.now(timezone.utc).isoformat()

    @classmethod
    def load(cls, github_dir: Path, batch_id: str) -> IssueBatch | None:
        """Load batch from disk."""
        batch_file = github_dir / "batches" / f"batch_{batch_id}.json"
        if not batch_file.exists():
            return None

        with open(batch_file) as f:
            data = json.load(f)
        return cls.from_dict(data)

    def get_issue_numbers(self) -> list[int]:
        """Get all issue numbers in the batch."""
        return [issue.issue_number for issue in self.issues]

    def update_status(self, status: BatchStatus, error: str | None = None) -> None:
        """Update batch status."""
        self.status = status
        if error:
            self.error = error
        self.updated_at = datetime.now(timezone.utc).isoformat()


class IssueBatcher:
    """
    Groups similar issues into batches for combined auto-fix.

    Usage:
        batcher = IssueBatcher(
            github_dir=Path(".auto-claude/github"),
            repo="owner/repo",
        )

        # Analyze and batch issues
        batches = await batcher.create_batches(open_issues)

        # Get batch for an issue
        batch = batcher.get_batch_for_issue(123)
    """

    def __init__(
        self,
        github_dir: Path,
        repo: str,
        project_dir: Path | None = None,
        similarity_threshold: float = SIMILAR_THRESHOLD,
        min_batch_size: int = 1,
        max_batch_size: int = 5,
        api_key: str | None = None,
        # AI validation settings
        validate_batches: bool = True,
        validation_model: str = "claude-sonnet-4-20250514",
        validation_thinking_budget: int = 10000,  # Medium thinking
    ):
        self.github_dir = github_dir
        self.repo = repo
        self.project_dir = (
            project_dir or github_dir.parent.parent
        )  # Default to project root
        self.similarity_threshold = similarity_threshold
        self.min_batch_size = min_batch_size
        self.max_batch_size = max_batch_size
        self.validate_batches_enabled = validate_batches

        # Initialize Claude-based similarity detector
        self.detector = ClaudeSimilarityDetector(project_dir=self.project_dir)

        # Initialize batch validator (uses Claude SDK with OAuth token)
        self.validator = (
            BatchValidator(
                project_dir=self.project_dir,
                model=validation_model,
                thinking_budget=validation_thinking_budget,
            )
            if validate_batches
            else None
        )

        # Cache for batches
        self._batch_index: dict[int, str] = {}  # issue_number -> batch_id
        self._load_batch_index()

    def _load_batch_index(self) -> None:
        """Load batch index from disk."""
        index_file = self.github_dir / "batches" / "index.json"
        if index_file.exists():
            with open(index_file) as f:
                data = json.load(f)
            self._batch_index = {
                int(k): v for k, v in data.get("issue_to_batch", {}).items()
            }

    def _save_batch_index(self) -> None:
        """Save batch index to disk."""
        batches_dir = self.github_dir / "batches"
        batches_dir.mkdir(parents=True, exist_ok=True)

        index_file = batches_dir / "index.json"
        with open(index_file, "w") as f:
            json.dump(
                {
                    "issue_to_batch": self._batch_index,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                f,
                indent=2,
            )

    def _generate_batch_id(self, primary_issue: int) -> str:
        """Generate unique batch ID."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return f"{primary_issue}_{timestamp}"

    async def _build_similarity_matrix(
        self,
        issues: list[dict[str, Any]],
    ) -> tuple[dict[tuple[int, int], float], dict[int, dict[int, str]]]:
        """
        Build similarity matrix for all issues.

        Returns tuple of (similarity_matrix, reasoning_dict) where:
        - similarity_matrix: dict mapping (issue_a, issue_b) -> similarity_score
        - reasoning_dict: dict mapping issue_number -> {other_issue_number: reasoning}
        """
        matrix = {}
        reasoning = {}  # Store Claude's reasoning for ALL comparisons
        n = len(issues)

        # Precompute embeddings
        logger.info(f"Precomputing embeddings for {n} issues...")
        await self.detector.precompute_embeddings(self.repo, issues)

        # Compare all pairs
        logger.info(f"Computing similarity matrix for {n * (n - 1) // 2} pairs...")
        for i in range(n):
            for j in range(i + 1, n):
                result = await self.detector.compare_issues(
                    self.repo,
                    issues[i],
                    issues[j],
                )

                issue_a = issues[i]["number"]
                issue_b = issues[j]["number"]

                # Store reasoning from Claude for ALL pairs (not just similar ones)
                if issue_a not in reasoning:
                    reasoning[issue_a] = {}
                if issue_b not in reasoning:
                    reasoning[issue_b] = {}

                claude_reasoning = result.get("reasoning", "No reasoning provided")
                reasoning[issue_a][issue_b] = claude_reasoning
                reasoning[issue_b][issue_a] = claude_reasoning

                if result.get("is_similar", False):
                    matrix[(issue_a, issue_b)] = result.get("overall_score", 0.0)
                    matrix[(issue_b, issue_a)] = result.get("overall_score", 0.0)

        return matrix, reasoning

    def _cluster_issues(
        self,
        issues: list[dict[str, Any]],
        similarity_matrix: dict[tuple[int, int], float],
    ) -> list[list[int]]:
        """
        Cluster issues using simple agglomerative approach.

        Returns list of clusters, each cluster is a list of issue numbers.
        """
        issue_numbers = [i["number"] for i in issues]

        # Start with each issue in its own cluster
        clusters: list[set[int]] = [{n} for n in issue_numbers]

        # Merge clusters that have similar issues
        def cluster_similarity(c1: set[int], c2: set[int]) -> float:
            """Average similarity between clusters."""
            scores = []
            for a in c1:
                for b in c2:
                    if (a, b) in similarity_matrix:
                        scores.append(similarity_matrix[(a, b)])
            return sum(scores) / len(scores) if scores else 0.0

        # Iteratively merge most similar clusters
        while len(clusters) > 1:
            best_score = 0.0
            best_pair = (-1, -1)

            for i in range(len(clusters)):
                for j in range(i + 1, len(clusters)):
                    score = cluster_similarity(clusters[i], clusters[j])
                    if score > best_score:
                        best_score = score
                        best_pair = (i, j)

            # Stop if best similarity is below threshold
            if best_score < self.similarity_threshold:
                break

            # Merge clusters
            i, j = best_pair
            merged = clusters[i] | clusters[j]

            # Don't exceed max batch size
            if len(merged) > self.max_batch_size:
                break

            clusters = [c for k, c in enumerate(clusters) if k not in (i, j)]
            clusters.append(merged)

        return [list(c) for c in clusters]

    def _extract_common_themes(
        self,
        issues: list[dict[str, Any]],
    ) -> list[str]:
        """Extract common themes from issue titles and bodies."""
        # Simple keyword extraction
        all_text = " ".join(
            f"{i.get('title', '')} {i.get('body', '')}" for i in issues
        ).lower()

        # Common tech keywords to look for
        keywords = [
            "authentication",
            "login",
            "oauth",
            "session",
            "api",
            "endpoint",
            "request",
            "response",
            "database",
            "query",
            "connection",
            "timeout",
            "error",
            "exception",
            "crash",
            "bug",
            "performance",
            "slow",
            "memory",
            "leak",
            "ui",
            "display",
            "render",
            "style",
            "test",
            "coverage",
            "assertion",
            "mock",
        ]

        found = [kw for kw in keywords if kw in all_text]
        return found[:5]  # Limit to 5 themes

    async def create_batches(
        self,
        issues: list[dict[str, Any]],
        exclude_issue_numbers: set[int] | None = None,
    ) -> list[IssueBatch]:
        """
        Create batches from a list of issues.

        Args:
            issues: List of issue dicts with number, title, body, labels
            exclude_issue_numbers: Issues to exclude (already in batches)

        Returns:
            List of IssueBatch objects (validated if validation enabled)
        """
        exclude = exclude_issue_numbers or set()

        # Filter to issues not already batched
        available_issues = [
            i
            for i in issues
            if i["number"] not in exclude and i["number"] not in self._batch_index
        ]

        if not available_issues:
            logger.info("No new issues to batch")
            return []

        logger.info(f"Analyzing {len(available_issues)} issues for batching...")

        # Build similarity matrix
        similarity_matrix, _ = await self._build_similarity_matrix(available_issues)

        # Cluster issues
        clusters = self._cluster_issues(available_issues, similarity_matrix)

        # Create initial batches from clusters
        initial_batches = []
        for cluster in clusters:
            if len(cluster) < self.min_batch_size:
                continue

            # Find primary issue (most connected)
            primary = max(
                cluster,
                key=lambda n: sum(
                    1
                    for other in cluster
                    if n != other and (n, other) in similarity_matrix
                ),
            )

            # Build batch items
            cluster_issues = [i for i in available_issues if i["number"] in cluster]
            items = []
            for issue in cluster_issues:
                similarity = (
                    1.0
                    if issue["number"] == primary
                    else similarity_matrix.get((primary, issue["number"]), 0.0)
                )

                items.append(
                    IssueBatchItem(
                        issue_number=issue["number"],
                        title=issue.get("title", ""),
                        body=issue.get("body", ""),
                        labels=[
                            label.get("name", "") for label in issue.get("labels", [])
                        ],
                        similarity_to_primary=similarity,
                    )
                )

            # Sort by similarity (primary first)
            items.sort(key=lambda x: x.similarity_to_primary, reverse=True)

            # Extract themes
            themes = self._extract_common_themes(cluster_issues)

            # Create batch
            batch = IssueBatch(
                batch_id=self._generate_batch_id(primary),
                repo=self.repo,
                primary_issue=primary,
                issues=items,
                common_themes=themes,
            )
            initial_batches.append((batch, cluster_issues))

        # Validate batches with AI if enabled
        validated_batches = []
        if self.validate_batches_enabled and self.validator:
            logger.info(f"Validating {len(initial_batches)} batches with AI...")
            validated_batches = await self._validate_and_split_batches(
                initial_batches, available_issues, similarity_matrix
            )
        else:
            # No validation - use batches as-is
            for batch, _ in initial_batches:
                batch.validated = True
                batch.validation_confidence = 1.0
                batch.validation_reasoning = "Validation disabled"
                batch.theme = batch.common_themes[0] if batch.common_themes else ""
                validated_batches.append(batch)

        # Save validated batches
        final_batches = []
        for batch in validated_batches:
            # Update index
            for item in batch.issues:
                self._batch_index[item.issue_number] = batch.batch_id

            # Save batch
            batch.save(self.github_dir)
            final_batches.append(batch)

            logger.info(
                f"Saved batch {batch.batch_id} with {len(batch.issues)} issues: "
                f"{[i.issue_number for i in batch.issues]} "
                f"(validated={batch.validated}, confidence={batch.validation_confidence:.0%})"
            )

        # Save index
        self._save_batch_index()

        return final_batches

    async def _validate_and_split_batches(
        self,
        initial_batches: list[tuple[IssueBatch, list[dict[str, Any]]]],
        all_issues: list[dict[str, Any]],
        similarity_matrix: dict[tuple[int, int], float],
    ) -> list[IssueBatch]:
        """
        Validate batches with AI and split invalid ones.

        Returns list of validated batches (may be more than input if splits occur).
        """
        validated = []

        for batch, cluster_issues in initial_batches:
            # Prepare issues for validation
            issues_for_validation = [
                {
                    "issue_number": item.issue_number,
                    "title": item.title,
                    "body": item.body,
                    "labels": item.labels,
                    "similarity_to_primary": item.similarity_to_primary,
                }
                for item in batch.issues
            ]

            # Validate with AI
            result = await self.validator.validate_batch(
                batch_id=batch.batch_id,
                primary_issue=batch.primary_issue,
                issues=issues_for_validation,
                themes=batch.common_themes,
            )

            if result.is_valid:
                # Batch is valid - update with validation results
                batch.validated = True
                batch.validation_confidence = result.confidence
                batch.validation_reasoning = result.reasoning
                batch.theme = result.common_theme or (
                    batch.common_themes[0] if batch.common_themes else ""
                )
                validated.append(batch)
                logger.info(f"Batch {batch.batch_id} validated: {result.reasoning}")
            else:
                # Batch is invalid - need to split
                logger.info(
                    f"Batch {batch.batch_id} invalid ({result.reasoning}), splitting..."
                )

                if result.suggested_splits:
                    # Use AI's suggested splits
                    for split_issues in result.suggested_splits:
                        if len(split_issues) < self.min_batch_size:
                            continue

                        # Create new batch from split
                        split_batch = self._create_batch_from_issues(
                            issue_numbers=split_issues,
                            all_issues=cluster_issues,
                            similarity_matrix=similarity_matrix,
                        )
                        if split_batch:
                            split_batch.validated = True
                            split_batch.validation_confidence = result.confidence
                            split_batch.validation_reasoning = (
                                f"Split from {batch.batch_id}: {result.reasoning}"
                            )
                            split_batch.theme = result.common_theme or ""
                            validated.append(split_batch)
                else:
                    # No suggested splits - treat each issue as individual batch
                    for item in batch.issues:
                        single_batch = IssueBatch(
                            batch_id=self._generate_batch_id(item.issue_number),
                            repo=self.repo,
                            primary_issue=item.issue_number,
                            issues=[item],
                            common_themes=[],
                            validated=True,
                            validation_confidence=result.confidence,
                            validation_reasoning=f"Split from invalid batch: {result.reasoning}",
                            theme="",
                        )
                        validated.append(single_batch)

        return validated

    def _create_batch_from_issues(
        self,
        issue_numbers: list[int],
        all_issues: list[dict[str, Any]],
        similarity_matrix: dict[tuple[int, int], float],
    ) -> IssueBatch | None:
        """Create a batch from a subset of issues."""
        # Find issues matching the numbers
        batch_issues = [i for i in all_issues if i["number"] in issue_numbers]
        if not batch_issues:
            return None

        # Find primary (most connected within this subset)
        primary = max(
            issue_numbers,
            key=lambda n: sum(
                1
                for other in issue_numbers
                if n != other and (n, other) in similarity_matrix
            ),
        )

        # Build items
        items = []
        for issue in batch_issues:
            similarity = (
                1.0
                if issue["number"] == primary
                else similarity_matrix.get((primary, issue["number"]), 0.0)
            )

            items.append(
                IssueBatchItem(
                    issue_number=issue["number"],
                    title=issue.get("title", ""),
                    body=issue.get("body", ""),
                    labels=[label.get("name", "") for label in issue.get("labels", [])],
                    similarity_to_primary=similarity,
                )
            )

        items.sort(key=lambda x: x.similarity_to_primary, reverse=True)
        themes = self._extract_common_themes(batch_issues)

        return IssueBatch(
            batch_id=self._generate_batch_id(primary),
            repo=self.repo,
            primary_issue=primary,
            issues=items,
            common_themes=themes,
        )

    def get_batch_for_issue(self, issue_number: int) -> IssueBatch | None:
        """Get the batch containing an issue."""
        batch_id = self._batch_index.get(issue_number)
        if not batch_id:
            return None
        return IssueBatch.load(self.github_dir, batch_id)

    def get_all_batches(self) -> list[IssueBatch]:
        """Get all batches."""
        batches_dir = self.github_dir / "batches"
        if not batches_dir.exists():
            return []

        batches = []
        for batch_file in batches_dir.glob("batch_*.json"):
            try:
                with open(batch_file) as f:
                    data = json.load(f)
                batches.append(IssueBatch.from_dict(data))
            except Exception as e:
                logger.error(f"Error loading batch {batch_file}: {e}")

        return sorted(batches, key=lambda b: b.created_at, reverse=True)

    def get_pending_batches(self) -> list[IssueBatch]:
        """Get batches that need processing."""
        return [
            b
            for b in self.get_all_batches()
            if b.status in (BatchStatus.PENDING, BatchStatus.ANALYZING)
        ]

    def get_active_batches(self) -> list[IssueBatch]:
        """Get batches currently being processed."""
        return [
            b
            for b in self.get_all_batches()
            if b.status
            in (
                BatchStatus.CREATING_SPEC,
                BatchStatus.BUILDING,
                BatchStatus.QA_REVIEW,
            )
        ]

    def is_issue_in_batch(self, issue_number: int) -> bool:
        """Check if an issue is already in a batch."""
        return issue_number in self._batch_index

    def remove_batch(self, batch_id: str) -> bool:
        """Remove a batch and update index."""
        batch = IssueBatch.load(self.github_dir, batch_id)
        if not batch:
            return False

        # Remove from index
        for issue_num in batch.get_issue_numbers():
            self._batch_index.pop(issue_num, None)
        self._save_batch_index()

        # Delete batch file
        batch_file = self.github_dir / "batches" / f"batch_{batch_id}.json"
        if batch_file.exists():
            batch_file.unlink()

        return True
