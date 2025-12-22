"""
Smart Rollback and Recovery System
===================================

Automatic recovery from build failures, stuck loops, and broken builds.
Enables true "walk away" automation by detecting and recovering from common failure modes.

Key Features:
- Automatic rollback to last working state
- Circular fix detection (prevents infinite loops)
- Attempt history tracking across sessions
- Smart retry with different approaches
- Escalation to human when stuck
"""

import json
import subprocess
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path


class FailureType(Enum):
    """Types of failures that can occur during autonomous builds."""

    BROKEN_BUILD = "broken_build"  # Code doesn't compile/run
    VERIFICATION_FAILED = "verification_failed"  # Subtask verification failed
    CIRCULAR_FIX = "circular_fix"  # Same fix attempted multiple times
    CONTEXT_EXHAUSTED = "context_exhausted"  # Ran out of context mid-subtask
    UNKNOWN = "unknown"


@dataclass
class RecoveryAction:
    """Action to take in response to a failure."""

    action: str  # "rollback", "retry", "skip", "escalate"
    target: str  # commit hash, subtask id, or message
    reason: str


@dataclass
class RetryConfig:
    """Configuration for retry limits and backoff."""

    max_attempts: int = 3
    backoff_factor: float = 1.5
    initial_delay: float = 1.0
    max_delay: float = 60.0
    jitter: bool = True


class ValidationRecoveryManager:
    """
    Specialized recovery manager for validation failures with configurable retry limits.

    This manager handles the specific case of validation failures in the QA workflow,
    providing configurable retry mechanisms, exponential backoff, and proper state
    management for validation recovery scenarios.

    Responsibilities:
    - Manage validation-specific retry attempts with configurable limits
    - Track validation failure history and patterns
    - Provide exponential backoff with jitter for retry delays
    - Generate recovery prompts with validation feedback
    - Handle escalation when retry limits are exceeded
    """

    def __init__(self, spec_dir: Path, project_dir: Path, retry_config: RetryConfig | None = None):
        """
        Initialize validation recovery manager.

        Args:
            spec_dir: Spec directory containing memory/
            project_dir: Root project directory for git operations
            retry_config: Configuration for retry behavior (defaults to sensible values)
        """
        self.spec_dir = spec_dir
        self.project_dir = project_dir
        self.memory_dir = spec_dir / "memory"
        self.validation_history_file = self.memory_dir / "validation_recovery_history.json"

        # Use provided config or create default
        self.retry_config = retry_config or RetryConfig()

        # Ensure memory directory exists
        self.memory_dir.mkdir(parents=True, exist_ok=True)

        # Initialize history file if it doesn't exist
        if not self.validation_history_file.exists():
            self._init_validation_history()

    def _init_validation_history(self) -> None:
        """Initialize the validation recovery history file."""
        initial_data = {
            "validation_sessions": {},
            "active_recoveries": {},
            "escalated_recoveries": [],
            "config": {
                "max_attempts": self.retry_config.max_attempts,
                "backoff_factor": self.retry_config.backoff_factor,
                "initial_delay": self.retry_config.initial_delay,
                "max_delay": self.retry_config.max_delay,
                "jitter": self.retry_config.jitter,
            },
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
            },
        }
        with open(self.validation_history_file, "w") as f:
            json.dump(initial_data, f, indent=2)

    def _load_validation_history(self) -> dict:
        """Load validation recovery history from JSON file."""
        try:
            with open(self.validation_history_file) as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            self._init_validation_history()
            with open(self.validation_history_file) as f:
                return json.load(f)

    def _save_validation_history(self, data: dict) -> None:
        """Save validation recovery history to JSON file."""
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        data["config"] = {
            "max_attempts": self.retry_config.max_attempts,
            "backoff_factor": self.retry_config.backoff_factor,
            "initial_delay": self.retry_config.initial_delay,
            "max_delay": self.retry_config.max_delay,
            "jitter": self.retry_config.jitter,
        }
        with open(self.validation_history_file, "w") as f:
            json.dump(data, f, indent=2)

    def get_retry_count(self, subtask_id: str) -> int:
        """
        Get the current retry count for a validation failure.

        Args:
            subtask_id: ID of the subtask that failed validation

        Returns:
            Current retry attempt count (0 for first attempt)
        """
        history = self._load_validation_history()
        recovery_data = history["active_recoveries"].get(subtask_id, {})
        return recovery_data.get("attempt_count", 0)

    def can_retry(self, subtask_id: str) -> bool:
        """
        Check if a validation failure can be retried.

        Args:
            subtask_id: ID of the subtask that failed validation

        Returns:
            True if retry is allowed, False if limit exceeded
        """
        retry_count = self.get_retry_count(subtask_id)
        return retry_count < self.retry_config.max_attempts

    def get_retry_delay(self, attempt_count: int) -> float:
        """
        Calculate retry delay using exponential backoff with jitter.

        Args:
            attempt_count: Current attempt count (0-based)

        Returns:
            Delay in seconds before next retry
        """
        # Calculate exponential backoff: delay = initial_delay * backoff_factor^attempt
        delay = self.retry_config.initial_delay * (self.retry_config.backoff_factor ** attempt_count)

        # Cap at maximum delay
        delay = min(delay, self.retry_config.max_delay)

        # Add jitter if enabled (±25% random variation)
        if self.retry_config.jitter:
            import random
            jitter_factor = random.uniform(0.75, 1.25)
            delay *= jitter_factor

        return delay

    def record_validation_attempt(
        self,
        subtask_id: str,
        qa_feedback: str,
        fix_request: str | None = None,
        human_input: str | None = None,
        success: bool = False,
        error: str | None = None,
    ) -> None:
        """
        Record a validation recovery attempt.

        Args:
            subtask_id: ID of the subtask that failed validation
            qa_feedback: QA review feedback
            fix_request: Specific fix request from QA
            human_input: Additional human guidance (if any)
            success: Whether the recovery attempt succeeded
            error: Error message if recovery failed
        """
        history = self._load_validation_history()

        # Initialize recovery data if it doesn't exist
        if subtask_id not in history["active_recoveries"]:
            history["active_recoveries"][subtask_id] = {
                "attempts": [],
                "attempt_count": 0,
                "started_at": datetime.now().isoformat(),
            }

        recovery_data = history["active_recoveries"][subtask_id]

        # Record the attempt
        attempt = {
            "timestamp": datetime.now().isoformat(),
            "qa_feedback": qa_feedback,
            "fix_request": fix_request,
            "human_input": human_input,
            "success": success,
            "error": error,
            "attempt_number": recovery_data["attempt_count"] + 1,
        }

        recovery_data["attempts"].append(attempt)
        recovery_data["attempt_count"] += 1

        # If successful, move to completed and clean up
        if success:
            if "validation_sessions" not in history:
                history["validation_sessions"] = {}

            history["validation_sessions"][subtask_id] = {
                "completed_at": datetime.now().isoformat(),
                "total_attempts": recovery_data["attempt_count"],
                "attempts": recovery_data["attempts"],
            }

            # Remove from active recoveries
            del history["active_recoveries"][subtask_id]

        # If max attempts exceeded, escalate
        elif recovery_data["attempt_count"] >= self.retry_config.max_attempts:
            self._escalate_recovery(subtask_id, recovery_data, history)

        self._save_validation_history(history)

    def _escalate_recovery(self, subtask_id: str, recovery_data: dict, history: dict) -> None:
        """
        Escalate a recovery that has exceeded retry limits.

        Args:
            subtask_id: ID of the subtask being escalated
            recovery_data: Recovery attempt data
            history: Full history dict (modified in place)
        """
        escalation = {
            "subtask_id": subtask_id,
            "escalated_at": datetime.now().isoformat(),
            "total_attempts": recovery_data["attempt_count"],
            "max_attempts": self.retry_config.max_attempts,
            "attempts": recovery_data["attempts"],
            "reason": "Exceeded maximum retry attempts",
        }

        history["escalated_recoveries"].append(escalation)

        # Remove from active recoveries
        if subtask_id in history["active_recoveries"]:
            del history["active_recoveries"][subtask_id]

        # Create escalation documentation
        escalation_file = self.spec_dir / "VALIDATION_ESCALATION.md"
        with open(escalation_file, "w") as f:
            f.write(f"# Validation Recovery Escalation\n\n")
            f.write(f"**Subtask:** {subtask_id}\n")
            f.write(f"**Escalated At:** {escalation['escalated_at']}\n")
            f.write(f"**Total Attempts:** {escalation['total_attempts']} (max: {escalation['max_attempts']})\n\n")

            f.write("## Attempt History\n\n")
            for i, attempt in enumerate(recovery_data["attempts"], 1):
                f.write(f"### Attempt {i}\n")
                f.write(f"- **Time:** {attempt['timestamp']}\n")
                f.write(f"- **QA Feedback:** {attempt['qa_feedback'][:200]}...\n")
                if attempt.get('fix_request'):
                    f.write(f"- **Fix Request:** {attempt['fix_request'][:200]}...\n")
                if attempt.get('error'):
                    f.write(f"- **Error:** {attempt['error'][:200]}...\n")
                f.write("\n")

            f.write("## Recommended Next Steps\n\n")
            f.write("This validation recovery requires human intervention. Please:\n\n")
            f.write("1. Review the attempt history above\n")
            f.write("2. Analyze the persistent validation issues\n")
            f.write("3. Provide guidance on alternative approaches\n")
            f.write("4. Consider if the subtask requirements need clarification\n")

    def get_recovery_context(self, subtask_id: str) -> dict:
        """
        Get comprehensive recovery context for a subtask.

        Args:
            subtask_id: ID of the subtask

        Returns:
            Dict with recovery context including attempt history and next action
        """
        history = self._load_validation_history()
        recovery_data = history["active_recoveries"].get(subtask_id, {})

        if not recovery_data:
            return {
                "subtask_id": subtask_id,
                "can_retry": True,
                "attempt_count": 0,
                "attempts_remaining": self.retry_config.max_attempts,
                "next_attempt": 1,
                "suggested_delay": self.retry_config.initial_delay,
                "history": [],
            }

        attempt_count = recovery_data["attempt_count"]
        can_retry = attempt_count < self.retry_config.max_attempts

        return {
            "subtask_id": subtask_id,
            "can_retry": can_retry,
            "attempt_count": attempt_count,
            "attempts_remaining": max(0, self.retry_config.max_attempts - attempt_count),
            "next_attempt": attempt_count + 1,
            "suggested_delay": self.get_retry_delay(attempt_count) if can_retry else 0,
            "history": recovery_data.get("attempts", []),
            "started_at": recovery_data.get("started_at"),
        }

    def generate_recovery_prompt(self, subtask_id: str, qa_feedback: str, fix_request: str | None = None, human_input: str | None = None) -> str:
        """
        Generate a comprehensive recovery prompt for the coder agent.

        Args:
            subtask_id: ID of the subtask that failed validation
            qa_feedback: QA review feedback
            fix_request: Specific fix request from QA
            human_input: Additional human guidance

        Returns:
            Formatted prompt string for the coder agent
        """
        context = self.get_recovery_context(subtask_id)

        prompt = f"""# VALIDATION RECOVERY - Subtask {subtask_id}

## Current Status
- **Attempt:** {context['next_attempt']} of {self.retry_config.max_attempts}
- **Attempts Remaining:** {context['attempts_remaining']}
- **Can Retry:** {'Yes' if context['can_retry'] else 'No (Limit Exceeded)'}

## Validation Feedback

### QA Review
{qa_feedback}

"""

        if fix_request:
            prompt += f"""### Specific Fix Request
{fix_request}

"""

        if human_input:
            prompt += f"""### Human Guidance
{human_input}

"""

        if context['history']:
            prompt += """## Previous Attempts

"""
            for i, attempt in enumerate(context['history'][-2:], 1):  # Show last 2 attempts
                prompt += f"""### Attempt {attempt['attempt_number']} ({attempt['timestamp']})
- **QA Feedback:** {attempt['qa_feedback'][:300]}...
"""
                if attempt.get('fix_request'):
                    prompt += f"- **Fix Request:** {attempt['fix_request'][:300]}...\n"
                if attempt.get('error'):
                    prompt += f"- **Error:** {attempt['error'][:300]}...\n"
                prompt += "\n"

        if not context['can_retry']:
            prompt += """## ⚠️ RETRY LIMIT EXCEEDED

This validation recovery has exceeded the maximum retry limit. The issue requires:
1. Different approach than previous attempts
2. Consideration of whether subtask requirements need clarification
3. Potential escalation to human intervention

"""
        else:
            prompt += f"""## Instructions for Recovery

1. **Address All QA Feedback:** Carefully review and address every point in the QA review
2. **Implement Fix Request:** Ensure the specific fix request is fully implemented
3. **Consider Previous Attempts:** Review what was tried before and try a different approach
4. **Test Thoroughly:** Verify the fix before submitting for validation

## Recovery Strategy

Since this is attempt {context['next_attempt']} of {self.retry_config.max_attempts}:
"""
            if context['next_attempt'] == 1:
                prompt += """- First attempt: Focus on directly addressing the QA feedback
- Standard implementation approach should work
"""
            elif context['next_attempt'] == 2:
                prompt += """- Second attempt: Try a different approach than the first
- Consider if there's a misunderstanding of requirements
- May need to simplify or use a different pattern
"""
            else:
                prompt += """- Final attempt: Try a completely different approach
- Consider if the subtask needs to be re-scoped
- Document why previous approaches failed
"""

        prompt += """

## Validation Checklist

After implementing your fix, verify:
- [ ] All QA feedback points addressed
- [ ] Fix request fully implemented
- [ ] No regressions introduced
- [ ] Code follows project patterns
- [ ] Verification tests pass

Submit for validation when ready.
"""

        return prompt

    def reset_recovery(self, subtask_id: str) -> None:
        """
        Reset recovery tracking for a subtask (for manual intervention).

        Args:
            subtask_id: ID of the subtask to reset
        """
        history = self._load_validation_history()

        # Remove from active recoveries
        if subtask_id in history["active_recoveries"]:
            del history["active_recoveries"][subtask_id]

        # Remove from validation sessions (completed ones)
        if subtask_id in history.get("validation_sessions", {}):
            del history["validation_sessions"][subtask_id]

        # Remove from escalated recoveries
        history["escalated_recoveries"] = [
            e for e in history.get("escalated_recoveries", [])
            if e["subtask_id"] != subtask_id
        ]

        self._save_validation_history(history)

    def update_retry_config(self, **kwargs) -> None:
        """
        Update retry configuration parameters.

        Args:
            **kwargs: Configuration parameters to update (max_attempts, backoff_factor, etc.)
        """
        for key, value in kwargs.items():
            if hasattr(self.retry_config, key):
                setattr(self.retry_config, key, value)

        # Save updated config to history file
        history = self._load_validation_history()
        history["config"] = {
            "max_attempts": self.retry_config.max_attempts,
            "backoff_factor": self.retry_config.backoff_factor,
            "initial_delay": self.retry_config.initial_delay,
            "max_delay": self.retry_config.max_delay,
            "jitter": self.retry_config.jitter,
        }
        self._save_validation_history(history)


class RecoveryManager:
    """
    Manages recovery from build failures.

    Responsibilities:
    - Track attempt history across sessions
    - Classify failures and determine recovery actions
    - Rollback to working states
    - Detect circular fixes (same approach repeatedly)
    - Escalate stuck subtasks for human intervention
    """

    def __init__(self, spec_dir: Path, project_dir: Path):
        """
        Initialize recovery manager.

        Args:
            spec_dir: Spec directory containing memory/
            project_dir: Root project directory for git operations
        """
        self.spec_dir = spec_dir
        self.project_dir = project_dir
        self.memory_dir = spec_dir / "memory"
        self.attempt_history_file = self.memory_dir / "attempt_history.json"
        self.build_commits_file = self.memory_dir / "build_commits.json"

        # Ensure memory directory exists
        self.memory_dir.mkdir(parents=True, exist_ok=True)

        # Initialize files if they don't exist
        if not self.attempt_history_file.exists():
            self._init_attempt_history()

        if not self.build_commits_file.exists():
            self._init_build_commits()

    def _init_attempt_history(self) -> None:
        """Initialize the attempt history file."""
        initial_data = {
            "subtasks": {},
            "stuck_subtasks": [],
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
            },
        }
        with open(self.attempt_history_file, "w") as f:
            json.dump(initial_data, f, indent=2)

    def _init_build_commits(self) -> None:
        """Initialize the build commits tracking file."""
        initial_data = {
            "commits": [],
            "last_good_commit": None,
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
            },
        }
        with open(self.build_commits_file, "w") as f:
            json.dump(initial_data, f, indent=2)

    def _load_attempt_history(self) -> dict:
        """Load attempt history from JSON file."""
        try:
            with open(self.attempt_history_file) as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            self._init_attempt_history()
            with open(self.attempt_history_file) as f:
                return json.load(f)

    def _save_attempt_history(self, data: dict) -> None:
        """Save attempt history to JSON file."""
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        with open(self.attempt_history_file, "w") as f:
            json.dump(data, f, indent=2)

    def _load_build_commits(self) -> dict:
        """Load build commits from JSON file."""
        try:
            with open(self.build_commits_file) as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            self._init_build_commits()
            with open(self.build_commits_file) as f:
                return json.load(f)

    def _save_build_commits(self, data: dict) -> None:
        """Save build commits to JSON file."""
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        with open(self.build_commits_file, "w") as f:
            json.dump(data, f, indent=2)

    def classify_failure(self, error: str, subtask_id: str) -> FailureType:
        """
        Classify what type of failure occurred.

        Args:
            error: Error message or description
            subtask_id: ID of the subtask that failed

        Returns:
            FailureType enum value
        """
        error_lower = error.lower()

        # Check for broken build indicators
        build_errors = [
            "syntax error",
            "compilation error",
            "module not found",
            "import error",
            "cannot find module",
            "unexpected token",
            "indentation error",
            "parse error",
        ]
        if any(be in error_lower for be in build_errors):
            return FailureType.BROKEN_BUILD

        # Check for verification failures
        verification_errors = [
            "verification failed",
            "expected",
            "assertion",
            "test failed",
            "status code",
        ]
        if any(ve in error_lower for ve in verification_errors):
            return FailureType.VERIFICATION_FAILED

        # Check for context exhaustion
        context_errors = ["context", "token limit", "maximum length"]
        if any(ce in error_lower for ce in context_errors):
            return FailureType.CONTEXT_EXHAUSTED

        # Check for circular fixes (will be determined by attempt history)
        if self.is_circular_fix(subtask_id, error):
            return FailureType.CIRCULAR_FIX

        return FailureType.UNKNOWN

    def get_attempt_count(self, subtask_id: str) -> int:
        """
        Get how many times this subtask has been attempted.

        Args:
            subtask_id: ID of the subtask

        Returns:
            Number of attempts
        """
        history = self._load_attempt_history()
        subtask_data = history["subtasks"].get(subtask_id, {})
        return len(subtask_data.get("attempts", []))

    def record_attempt(
        self,
        subtask_id: str,
        session: int,
        success: bool,
        approach: str,
        error: str | None = None,
    ) -> None:
        """
        Record an attempt at a subtask.

        Args:
            subtask_id: ID of the subtask
            session: Session number
            success: Whether the attempt succeeded
            approach: Description of the approach taken
            error: Error message if failed
        """
        history = self._load_attempt_history()

        # Initialize subtask entry if it doesn't exist
        if subtask_id not in history["subtasks"]:
            history["subtasks"][subtask_id] = {"attempts": [], "status": "pending"}

        # Add the attempt
        attempt = {
            "session": session,
            "timestamp": datetime.now().isoformat(),
            "approach": approach,
            "success": success,
            "error": error,
        }
        history["subtasks"][subtask_id]["attempts"].append(attempt)

        # Update status
        if success:
            history["subtasks"][subtask_id]["status"] = "completed"
        else:
            history["subtasks"][subtask_id]["status"] = "failed"

        self._save_attempt_history(history)

    def is_circular_fix(self, subtask_id: str, current_approach: str) -> bool:
        """
        Detect if we're trying the same approach repeatedly.

        Args:
            subtask_id: ID of the subtask
            current_approach: Description of current approach

        Returns:
            True if this appears to be a circular fix attempt
        """
        history = self._load_attempt_history()
        subtask_data = history["subtasks"].get(subtask_id, {})
        attempts = subtask_data.get("attempts", [])

        if len(attempts) < 2:
            return False

        # Check if last 3 attempts used similar approaches
        # Simple similarity check: look for repeated keywords
        recent_attempts = attempts[-3:] if len(attempts) >= 3 else attempts

        # Extract key terms from current approach (ignore common words)
        stop_words = {
            "with",
            "using",
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "trying",
        }
        current_keywords = set(
            word for word in current_approach.lower().split() if word not in stop_words
        )

        similar_count = 0
        for attempt in recent_attempts:
            attempt_keywords = set(
                word
                for word in attempt["approach"].lower().split()
                if word not in stop_words
            )

            # Calculate Jaccard similarity (intersection over union)
            overlap = len(current_keywords & attempt_keywords)
            total = len(current_keywords | attempt_keywords)

            if total > 0:
                similarity = overlap / total
                # If >30% of meaningful words overlap, consider it similar
                # This catches key technical terms appearing repeatedly
                # (e.g., "async await" across multiple attempts)
                if similarity > 0.3:
                    similar_count += 1

        # If 2+ recent attempts were similar to current approach, it's circular
        return similar_count >= 2

    def determine_recovery_action(
        self, failure_type: FailureType, subtask_id: str
    ) -> RecoveryAction:
        """
        Decide what to do based on failure type and history.

        Args:
            failure_type: Type of failure that occurred
            subtask_id: ID of the subtask that failed

        Returns:
            RecoveryAction describing what to do
        """
        attempt_count = self.get_attempt_count(subtask_id)

        if failure_type == FailureType.BROKEN_BUILD:
            # Broken build: rollback to last good state
            last_good = self.get_last_good_commit()
            if last_good:
                return RecoveryAction(
                    action="rollback",
                    target=last_good,
                    reason=f"Build broken in subtask {subtask_id}, rolling back to working state",
                )
            else:
                return RecoveryAction(
                    action="escalate",
                    target=subtask_id,
                    reason="Build broken and no good commit found to rollback to",
                )

        elif failure_type == FailureType.VERIFICATION_FAILED:
            # Verification failed: retry with different approach if < 3 attempts
            if attempt_count < 3:
                return RecoveryAction(
                    action="retry",
                    target=subtask_id,
                    reason=f"Verification failed, retry with different approach (attempt {attempt_count + 1}/3)",
                )
            else:
                return RecoveryAction(
                    action="skip",
                    target=subtask_id,
                    reason=f"Verification failed after {attempt_count} attempts, marking as stuck",
                )

        elif failure_type == FailureType.CIRCULAR_FIX:
            # Circular fix detected: skip and escalate
            return RecoveryAction(
                action="skip",
                target=subtask_id,
                reason="Circular fix detected - same approach tried multiple times",
            )

        elif failure_type == FailureType.CONTEXT_EXHAUSTED:
            # Context exhausted: commit current progress and continue
            return RecoveryAction(
                action="continue",
                target=subtask_id,
                reason="Context exhausted, will commit progress and continue in next session",
            )

        else:  # UNKNOWN
            # Unknown error: retry once, then escalate
            if attempt_count < 2:
                return RecoveryAction(
                    action="retry",
                    target=subtask_id,
                    reason=f"Unknown error, retrying (attempt {attempt_count + 1}/2)",
                )
            else:
                return RecoveryAction(
                    action="escalate",
                    target=subtask_id,
                    reason=f"Unknown error persists after {attempt_count} attempts",
                )

    def get_last_good_commit(self) -> str | None:
        """
        Find the most recent commit where build was working.

        Returns:
            Commit hash or None
        """
        commits = self._load_build_commits()
        return commits.get("last_good_commit")

    def record_good_commit(self, commit_hash: str, subtask_id: str) -> None:
        """
        Record a commit where the build was working.

        Args:
            commit_hash: Git commit hash
            subtask_id: Subtask that was successfully completed
        """
        commits = self._load_build_commits()

        commit_record = {
            "hash": commit_hash,
            "subtask_id": subtask_id,
            "timestamp": datetime.now().isoformat(),
        }

        commits["commits"].append(commit_record)
        commits["last_good_commit"] = commit_hash

        self._save_build_commits(commits)

    def rollback_to_commit(self, commit_hash: str) -> bool:
        """
        Rollback to a specific commit.

        Args:
            commit_hash: Git commit hash to rollback to

        Returns:
            True if successful, False otherwise
        """
        try:
            # Use git reset --hard to rollback
            result = subprocess.run(
                ["git", "reset", "--hard", commit_hash],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                check=True,
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error rolling back to {commit_hash}: {e.stderr}")
            return False

    def mark_subtask_stuck(self, subtask_id: str, reason: str) -> None:
        """
        Mark a subtask as needing human intervention.

        Args:
            subtask_id: ID of the subtask
            reason: Why it's stuck
        """
        history = self._load_attempt_history()

        stuck_entry = {
            "subtask_id": subtask_id,
            "reason": reason,
            "escalated_at": datetime.now().isoformat(),
            "attempt_count": self.get_attempt_count(subtask_id),
        }

        # Check if already in stuck list
        existing = [
            s for s in history["stuck_subtasks"] if s["subtask_id"] == subtask_id
        ]
        if not existing:
            history["stuck_subtasks"].append(stuck_entry)

        # Update subtask status
        if subtask_id in history["subtasks"]:
            history["subtasks"][subtask_id]["status"] = "stuck"

        self._save_attempt_history(history)

    def get_stuck_subtasks(self) -> list[dict]:
        """
        Get all subtasks marked as stuck.

        Returns:
            List of stuck subtask entries
        """
        history = self._load_attempt_history()
        return history.get("stuck_subtasks", [])

    def get_subtask_history(self, subtask_id: str) -> dict:
        """
        Get the attempt history for a specific subtask.

        Args:
            subtask_id: ID of the subtask

        Returns:
            Subtask history dict with attempts
        """
        history = self._load_attempt_history()
        return history["subtasks"].get(
            subtask_id, {"attempts": [], "status": "pending"}
        )

    def get_recovery_hints(self, subtask_id: str) -> list[str]:
        """
        Get hints for recovery based on previous attempts.

        Args:
            subtask_id: ID of the subtask

        Returns:
            List of hint strings
        """
        subtask_history = self.get_subtask_history(subtask_id)
        attempts = subtask_history.get("attempts", [])

        if not attempts:
            return ["This is the first attempt at this subtask"]

        hints = [f"Previous attempts: {len(attempts)}"]

        # Add info about what was tried
        for i, attempt in enumerate(attempts[-3:], 1):
            hints.append(
                f"Attempt {i}: {attempt['approach']} - "
                f"{'SUCCESS' if attempt['success'] else 'FAILED'}"
            )
            if attempt.get("error"):
                hints.append(f"  Error: {attempt['error'][:100]}")

        # Add guidance
        if len(attempts) >= 2:
            hints.append(
                "\n⚠️  IMPORTANT: Try a DIFFERENT approach than previous attempts"
            )
            hints.append(
                "Consider: different library, different pattern, or simpler implementation"
            )

        return hints

    def clear_stuck_subtasks(self) -> None:
        """Clear all stuck subtasks (for manual resolution)."""
        history = self._load_attempt_history()
        history["stuck_subtasks"] = []
        self._save_attempt_history(history)

    def reset_subtask(self, subtask_id: str) -> None:
        """
        Reset a subtask's attempt history.

        Args:
            subtask_id: ID of the subtask to reset
        """
        history = self._load_attempt_history()

        # Clear attempt history
        if subtask_id in history["subtasks"]:
            history["subtasks"][subtask_id] = {"attempts": [], "status": "pending"}

        # Remove from stuck subtasks
        history["stuck_subtasks"] = [
            s for s in history["stuck_subtasks"] if s["subtask_id"] != subtask_id
        ]

        self._save_attempt_history(history)


# Utility functions for integration with agent.py


def check_and_recover(
    spec_dir: Path, project_dir: Path, subtask_id: str, error: str | None = None
) -> RecoveryAction | None:
    """
    Check if recovery is needed and return appropriate action.

    Args:
        spec_dir: Spec directory
        project_dir: Project directory
        subtask_id: Current subtask ID
        error: Error message if any

    Returns:
        RecoveryAction if recovery needed, None otherwise
    """
    if not error:
        return None

    manager = RecoveryManager(spec_dir, project_dir)
    failure_type = manager.classify_failure(error, subtask_id)

    return manager.determine_recovery_action(failure_type, subtask_id)


def get_recovery_context(spec_dir: Path, project_dir: Path, subtask_id: str) -> dict:
    """
    Get recovery context for a subtask (for prompt generation).

    Args:
        spec_dir: Spec directory
        project_dir: Project directory
        subtask_id: Subtask ID

    Returns:
        Dict with recovery hints and history
    """
    manager = RecoveryManager(spec_dir, project_dir)

    return {
        "attempt_count": manager.get_attempt_count(subtask_id),
        "hints": manager.get_recovery_hints(subtask_id),
        "subtask_history": manager.get_subtask_history(subtask_id),
        "stuck_subtasks": manager.get_stuck_subtasks(),
    }
