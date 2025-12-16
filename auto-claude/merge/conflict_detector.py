"""
Conflict Detector
=================

Detects conflicts between multiple task changes using rule-based analysis.

This module determines:
1. Which changes from different tasks overlap
2. Whether overlapping changes are compatible
3. What merge strategy can be used for compatible changes
4. Which conflicts need AI or human intervention

The goal is to resolve as many conflicts as possible without AI,
using deterministic rules based on semantic change types.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

from .types import (
    ChangeType,
    ConflictRegion,
    ConflictSeverity,
    FileAnalysis,
    MergeStrategy,
    SemanticChange,
)

# Import debug utilities
try:
    from debug import debug, debug_detailed, debug_verbose, debug_success, debug_error, debug_warning, is_debug_enabled
except ImportError:
    def debug(*args, **kwargs): pass
    def debug_detailed(*args, **kwargs): pass
    def debug_verbose(*args, **kwargs): pass
    def debug_success(*args, **kwargs): pass
    def debug_error(*args, **kwargs): pass
    def debug_warning(*args, **kwargs): pass
    def is_debug_enabled(): return False

logger = logging.getLogger(__name__)
MODULE = "merge.conflict_detector"


@dataclass
class CompatibilityRule:
    """
    A rule defining compatibility between two change types.

    Attributes:
        change_type_a: First change type
        change_type_b: Second change type (can be same as a)
        compatible: Whether these changes can be auto-merged
        strategy: If compatible, which strategy to use
        reason: Human-readable explanation
        bidirectional: If True, rule applies both ways (a,b) and (b,a)
    """

    change_type_a: ChangeType
    change_type_b: ChangeType
    compatible: bool
    strategy: Optional[MergeStrategy] = None
    reason: str = ""
    bidirectional: bool = True


class ConflictDetector:
    """
    Detects and classifies conflicts between task changes.

    Uses a comprehensive rule base to determine compatibility
    between different semantic change types, enabling maximum
    auto-merge capability.

    Example:
        detector = ConflictDetector()
        conflicts = detector.detect_conflicts({
            "task-001": analysis1,
            "task-002": analysis2,
        })
        for conflict in conflicts:
            if conflict.can_auto_merge:
                print(f"Can auto-merge with {conflict.merge_strategy}")
            else:
                print(f"Needs {conflict.severity} review")
    """

    def __init__(self):
        """Initialize with default compatibility rules."""
        debug(MODULE, "Initializing ConflictDetector")
        self._rules = self._build_default_rules()
        self._rule_index = self._index_rules()
        debug_success(MODULE, "ConflictDetector initialized", rule_count=len(self._rules))

    def _build_default_rules(self) -> list[CompatibilityRule]:
        """Build the default set of compatibility rules."""
        rules = []

        # ========================================
        # IMPORT RULES - Generally compatible
        # ========================================

        # Multiple imports from different modules = always compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_IMPORT,
                change_type_b=ChangeType.ADD_IMPORT,
                compatible=True,
                strategy=MergeStrategy.COMBINE_IMPORTS,
                reason="Adding different imports is always compatible",
            )
        )

        # Import addition + removal = check if same module
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_IMPORT,
                change_type_b=ChangeType.REMOVE_IMPORT,
                compatible=False,  # Need to check if same import
                strategy=MergeStrategy.AI_REQUIRED,
                reason="Import add/remove may conflict if same module",
            )
        )

        # ========================================
        # FUNCTION RULES
        # ========================================

        # Adding different functions = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_FUNCTION,
                change_type_b=ChangeType.ADD_FUNCTION,
                compatible=True,
                strategy=MergeStrategy.APPEND_FUNCTIONS,
                reason="Adding different functions is compatible",
            )
        )

        # Adding function + modifying different function = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_FUNCTION,
                change_type_b=ChangeType.MODIFY_FUNCTION,
                compatible=True,
                strategy=MergeStrategy.APPEND_FUNCTIONS,
                reason="Adding a function doesn't affect modifications to other functions",
            )
        )

        # Modifying same function = conflict (but may be resolvable)
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.MODIFY_FUNCTION,
                change_type_b=ChangeType.MODIFY_FUNCTION,
                compatible=False,
                strategy=MergeStrategy.AI_REQUIRED,
                reason="Multiple modifications to same function need analysis",
            )
        )

        # ========================================
        # REACT HOOK RULES
        # ========================================

        # Multiple hook additions = compatible (order matters, but predictable)
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_HOOK_CALL,
                change_type_b=ChangeType.ADD_HOOK_CALL,
                compatible=True,
                strategy=MergeStrategy.ORDER_BY_DEPENDENCY,
                reason="Multiple hooks can be added with correct ordering",
            )
        )

        # Hook addition + JSX wrap = compatible (hooks first, then wrap)
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_HOOK_CALL,
                change_type_b=ChangeType.WRAP_JSX,
                compatible=True,
                strategy=MergeStrategy.HOOKS_THEN_WRAP,
                reason="Hooks are added at function start, wrap is on return",
            )
        )

        # Hook addition + function modification = usually compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_HOOK_CALL,
                change_type_b=ChangeType.MODIFY_FUNCTION,
                compatible=True,
                strategy=MergeStrategy.HOOKS_FIRST,
                reason="Hooks go at start, other modifications likely elsewhere",
            )
        )

        # ========================================
        # JSX RULES
        # ========================================

        # Multiple JSX wraps = need to determine order
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.WRAP_JSX,
                change_type_b=ChangeType.WRAP_JSX,
                compatible=True,
                strategy=MergeStrategy.ORDER_BY_DEPENDENCY,
                reason="Multiple wraps can be nested in correct order",
            )
        )

        # JSX wrap + element addition = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.WRAP_JSX,
                change_type_b=ChangeType.ADD_JSX_ELEMENT,
                compatible=True,
                strategy=MergeStrategy.APPEND_STATEMENTS,
                reason="Wrapping and adding elements are independent",
            )
        )

        # Prop modifications = may conflict
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.MODIFY_JSX_PROPS,
                change_type_b=ChangeType.MODIFY_JSX_PROPS,
                compatible=True,
                strategy=MergeStrategy.COMBINE_PROPS,
                reason="Props can usually be combined if different",
            )
        )

        # ========================================
        # CLASS/METHOD RULES
        # ========================================

        # Adding methods to same class = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_METHOD,
                change_type_b=ChangeType.ADD_METHOD,
                compatible=True,
                strategy=MergeStrategy.APPEND_METHODS,
                reason="Adding different methods is compatible",
            )
        )

        # Modifying same method = conflict
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.MODIFY_METHOD,
                change_type_b=ChangeType.MODIFY_METHOD,
                compatible=False,
                strategy=MergeStrategy.AI_REQUIRED,
                reason="Multiple modifications to same method need analysis",
            )
        )

        # Adding class + modifying existing class = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_CLASS,
                change_type_b=ChangeType.MODIFY_CLASS,
                compatible=True,
                strategy=MergeStrategy.APPEND_FUNCTIONS,
                reason="New classes don't conflict with modifications",
            )
        )

        # ========================================
        # VARIABLE RULES
        # ========================================

        # Adding different variables = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_VARIABLE,
                change_type_b=ChangeType.ADD_VARIABLE,
                compatible=True,
                strategy=MergeStrategy.APPEND_STATEMENTS,
                reason="Adding different variables is compatible",
            )
        )

        # Adding constant + variable = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_CONSTANT,
                change_type_b=ChangeType.ADD_VARIABLE,
                compatible=True,
                strategy=MergeStrategy.APPEND_STATEMENTS,
                reason="Constants and variables are independent",
            )
        )

        # ========================================
        # TYPE RULES (TypeScript)
        # ========================================

        # Adding different types = compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_TYPE,
                change_type_b=ChangeType.ADD_TYPE,
                compatible=True,
                strategy=MergeStrategy.APPEND_FUNCTIONS,
                reason="Adding different types is compatible",
            )
        )

        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_INTERFACE,
                change_type_b=ChangeType.ADD_INTERFACE,
                compatible=True,
                strategy=MergeStrategy.APPEND_FUNCTIONS,
                reason="Adding different interfaces is compatible",
            )
        )

        # Modifying same interface = conflict
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.MODIFY_INTERFACE,
                change_type_b=ChangeType.MODIFY_INTERFACE,
                compatible=False,
                strategy=MergeStrategy.AI_REQUIRED,
                reason="Multiple interface modifications need analysis",
            )
        )

        # ========================================
        # DECORATOR RULES (Python)
        # ========================================

        # Adding decorators = usually compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_DECORATOR,
                change_type_b=ChangeType.ADD_DECORATOR,
                compatible=True,
                strategy=MergeStrategy.ORDER_BY_DEPENDENCY,
                reason="Decorators can be stacked with correct order",
            )
        )

        # ========================================
        # COMMENT RULES - Low priority
        # ========================================

        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.ADD_COMMENT,
                change_type_b=ChangeType.ADD_COMMENT,
                compatible=True,
                strategy=MergeStrategy.APPEND_STATEMENTS,
                reason="Comments are independent",
            )
        )

        # Formatting changes are always compatible
        rules.append(
            CompatibilityRule(
                change_type_a=ChangeType.FORMATTING_ONLY,
                change_type_b=ChangeType.FORMATTING_ONLY,
                compatible=True,
                strategy=MergeStrategy.ORDER_BY_TIME,
                reason="Formatting doesn't affect semantics",
            )
        )

        return rules

    def _index_rules(self) -> dict[tuple[ChangeType, ChangeType], CompatibilityRule]:
        """Create an index for fast rule lookup."""
        index = {}
        for rule in self._rules:
            index[(rule.change_type_a, rule.change_type_b)] = rule
            if rule.bidirectional and rule.change_type_a != rule.change_type_b:
                index[(rule.change_type_b, rule.change_type_a)] = rule
        return index

    def add_rule(self, rule: CompatibilityRule) -> None:
        """Add a custom compatibility rule."""
        self._rules.append(rule)
        self._rule_index[(rule.change_type_a, rule.change_type_b)] = rule
        if rule.bidirectional and rule.change_type_a != rule.change_type_b:
            self._rule_index[(rule.change_type_b, rule.change_type_a)] = rule

    def detect_conflicts(
        self,
        task_analyses: dict[str, FileAnalysis],
    ) -> list[ConflictRegion]:
        """
        Detect conflicts between multiple task changes to the same file.

        Args:
            task_analyses: Map of task_id -> FileAnalysis

        Returns:
            List of detected conflict regions
        """
        task_ids = list(task_analyses.keys())
        debug(MODULE, f"Detecting conflicts between {len(task_analyses)} tasks",
              tasks=task_ids)

        if len(task_analyses) <= 1:
            debug(MODULE, "No conflicts possible with 0-1 tasks")
            return []  # No conflicts possible with 0-1 tasks

        conflicts: list[ConflictRegion] = []

        # Group changes by location
        location_changes: dict[str, list[tuple[str, SemanticChange]]] = defaultdict(list)

        for task_id, analysis in task_analyses.items():
            debug_detailed(MODULE, f"Processing task {task_id}",
                          changes_count=len(analysis.changes),
                          file=analysis.file_path)
            for change in analysis.changes:
                location_changes[change.location].append((task_id, change))

        debug_detailed(MODULE, f"Grouped changes into {len(location_changes)} locations")

        # Analyze each location for conflicts
        for location, task_changes in location_changes.items():
            if len(task_changes) <= 1:
                continue  # No conflict at this location

            debug_verbose(MODULE, f"Checking location {location}",
                         task_changes_count=len(task_changes))

            file_path = next(iter(task_analyses.values())).file_path
            conflict = self._analyze_location_conflict(
                file_path, location, task_changes
            )
            if conflict:
                debug_detailed(MODULE, f"Conflict detected at {location}",
                              severity=conflict.severity.value,
                              can_auto_merge=conflict.can_auto_merge,
                              tasks=conflict.tasks_involved)
                conflicts.append(conflict)

        # Also check for implicit conflicts (e.g., changes to related code)
        implicit_conflicts = self._detect_implicit_conflicts(task_analyses)
        if implicit_conflicts:
            debug_detailed(MODULE, f"Found {len(implicit_conflicts)} implicit conflicts")
        conflicts.extend(implicit_conflicts)

        # Summary
        auto_mergeable = sum(1 for c in conflicts if c.can_auto_merge)
        critical = sum(1 for c in conflicts if c.severity == ConflictSeverity.CRITICAL)
        debug_success(MODULE, f"Conflict detection complete",
                     total_conflicts=len(conflicts),
                     auto_mergeable=auto_mergeable,
                     critical=critical)

        return conflicts

    def _analyze_location_conflict(
        self,
        file_path: str,
        location: str,
        task_changes: list[tuple[str, SemanticChange]],
    ) -> Optional[ConflictRegion]:
        """Analyze changes at a specific location for conflicts."""
        tasks = [tc[0] for tc in task_changes]
        changes = [tc[1] for tc in task_changes]
        change_types = [c.change_type for c in changes]

        # Check if all changes target the same thing
        targets = {c.target for c in changes}
        if len(targets) > 1:
            # Different targets at same location - likely compatible
            # (e.g., adding two different functions)
            return None

        # Check pairwise compatibility
        all_compatible = True
        final_strategy: Optional[MergeStrategy] = None
        reasons = []

        for i, (type_a, change_a) in enumerate(zip(change_types, changes)):
            for type_b, change_b in zip(change_types[i + 1 :], changes[i + 1 :]):
                rule = self._rule_index.get((type_a, type_b))

                if rule:
                    if not rule.compatible:
                        all_compatible = False
                        reasons.append(rule.reason)
                    elif rule.strategy:
                        final_strategy = rule.strategy
                else:
                    # No rule - conservative default
                    all_compatible = False
                    reasons.append(f"No rule for {type_a.value} + {type_b.value}")

        # Determine severity
        if all_compatible:
            severity = ConflictSeverity.NONE
        else:
            severity = self._assess_severity(change_types, changes)

        return ConflictRegion(
            file_path=file_path,
            location=location,
            tasks_involved=tasks,
            change_types=change_types,
            severity=severity,
            can_auto_merge=all_compatible,
            merge_strategy=final_strategy if all_compatible else MergeStrategy.AI_REQUIRED,
            reason=" | ".join(reasons) if reasons else "Changes are compatible",
        )

    def _assess_severity(
        self,
        change_types: list[ChangeType],
        changes: list[SemanticChange],
    ) -> ConflictSeverity:
        """Assess the severity of a conflict."""
        # Critical: Both tasks modify core logic
        modify_types = {
            ChangeType.MODIFY_FUNCTION,
            ChangeType.MODIFY_METHOD,
            ChangeType.MODIFY_CLASS,
        }
        modify_count = sum(1 for ct in change_types if ct in modify_types)

        if modify_count >= 2:
            # Check if they modify the exact same lines
            line_ranges = [(c.line_start, c.line_end) for c in changes]
            if self._ranges_overlap(line_ranges):
                return ConflictSeverity.CRITICAL

        # High: Structural changes that could break compilation
        structural_types = {
            ChangeType.WRAP_JSX,
            ChangeType.UNWRAP_JSX,
            ChangeType.REMOVE_FUNCTION,
            ChangeType.REMOVE_CLASS,
        }
        if any(ct in structural_types for ct in change_types):
            return ConflictSeverity.HIGH

        # Medium: Modifications to same function/method
        if modify_count >= 1:
            return ConflictSeverity.MEDIUM

        # Low: Likely resolvable with AI
        return ConflictSeverity.LOW

    def _ranges_overlap(self, ranges: list[tuple[int, int]]) -> bool:
        """Check if any line ranges overlap."""
        sorted_ranges = sorted(ranges)
        for i in range(len(sorted_ranges) - 1):
            if sorted_ranges[i][1] >= sorted_ranges[i + 1][0]:
                return True
        return False

    def _detect_implicit_conflicts(
        self,
        task_analyses: dict[str, FileAnalysis],
    ) -> list[ConflictRegion]:
        """Detect implicit conflicts not caught by location analysis."""
        conflicts = []

        # Check for function rename + function call changes
        # (If task A renames a function and task B calls the old name)

        # Check for import removal + usage
        # (If task A removes an import and task B uses it)

        # For now, these advanced checks are TODO
        # The main location-based detection handles most cases

        return conflicts

    def get_compatible_pairs(self) -> list[tuple[ChangeType, ChangeType, MergeStrategy]]:
        """Get all compatible change type pairs and their strategies."""
        pairs = []
        for rule in self._rules:
            if rule.compatible:
                pairs.append((rule.change_type_a, rule.change_type_b, rule.strategy))
        return pairs

    def explain_conflict(self, conflict: ConflictRegion) -> str:
        """Generate a human-readable explanation of a conflict."""
        lines = [
            f"Conflict in {conflict.file_path} at {conflict.location}",
            f"Tasks involved: {', '.join(conflict.tasks_involved)}",
            f"Severity: {conflict.severity.value}",
            "",
        ]

        if conflict.can_auto_merge:
            lines.append(f"Can be auto-merged using strategy: {conflict.merge_strategy.value}")
        else:
            lines.append("Cannot be auto-merged:")
            lines.append(f"  Reason: {conflict.reason}")

        lines.append("")
        lines.append("Changes:")
        for ct in conflict.change_types:
            lines.append(f"  - {ct.value}")

        return "\n".join(lines)


def analyze_compatibility(
    change_a: SemanticChange,
    change_b: SemanticChange,
    detector: Optional[ConflictDetector] = None,
) -> tuple[bool, Optional[MergeStrategy], str]:
    """
    Analyze compatibility between two specific changes.

    Convenience function for quick compatibility checks.

    Args:
        change_a: First semantic change
        change_b: Second semantic change
        detector: Optional detector instance (creates one if not provided)

    Returns:
        Tuple of (compatible, strategy, reason)
    """
    if detector is None:
        detector = ConflictDetector()

    rule = detector._rule_index.get((change_a.change_type, change_b.change_type))

    if rule:
        return (rule.compatible, rule.strategy, rule.reason)
    else:
        return (False, MergeStrategy.AI_REQUIRED, "No compatibility rule defined")
