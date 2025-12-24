"""
Prompt Manager
==============

Centralized prompt template management for GitHub workflows.
"""

from __future__ import annotations

from pathlib import Path

try:
    from ..models import ReviewPass
except ImportError:
    from models import ReviewPass


class PromptManager:
    """Manages all prompt templates for GitHub automation workflows."""

    def __init__(self, prompts_dir: Path | None = None):
        """
        Initialize PromptManager.

        Args:
            prompts_dir: Optional directory containing custom prompt files
        """
        self.prompts_dir = prompts_dir or (
            Path(__file__).parent.parent.parent.parent / "prompts" / "github"
        )

    def get_review_pass_prompt(self, review_pass: ReviewPass) -> str:
        """Get the specialized prompt for each review pass."""
        prompts = {
            ReviewPass.QUICK_SCAN: """
Quickly scan this PR to understand:
1. What is the main purpose of these changes?
2. Which areas need careful review (security-sensitive, complex logic)?
3. Are there any obvious red flags?

Output a brief JSON summary:
```json
{
    "purpose": "Brief description of what this PR does",
    "risk_areas": ["Area 1", "Area 2"],
    "red_flags": ["Flag 1", "Flag 2"],
    "complexity": "low|medium|high"
}
```
""",
            ReviewPass.SECURITY: """
You are a security specialist. Focus ONLY on security issues:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication/authorization flaws
- Sensitive data exposure
- SSRF, CSRF, path traversal
- Insecure deserialization
- Cryptographic weaknesses
- Hardcoded secrets or credentials
- Unsafe file operations

Only report HIGH CONFIDENCE security findings.

Output JSON array of findings:
```json
[
  {
    "id": "finding-1",
    "severity": "critical|high|medium|low",
    "category": "security",
    "title": "Brief issue title",
    "description": "Detailed explanation of the security risk",
    "file": "path/to/file.ts",
    "line": 42,
    "suggested_fix": "How to fix this vulnerability",
    "fixable": true
  }
]
```
""",
            ReviewPass.QUALITY: """
You are a code quality expert. Focus ONLY on:
- Code complexity and maintainability
- Error handling completeness
- Test coverage for new code
- Pattern adherence and consistency
- Resource management (leaks, cleanup)
- Code duplication
- Performance anti-patterns

Only report issues that meaningfully impact quality.

Output JSON array of findings:
```json
[
  {
    "id": "finding-1",
    "severity": "high|medium|low",
    "category": "quality|test|performance|pattern",
    "title": "Brief issue title",
    "description": "Detailed explanation",
    "file": "path/to/file.ts",
    "line": 42,
    "suggested_fix": "Optional code or suggestion",
    "fixable": false
  }
]
```
""",
            ReviewPass.DEEP_ANALYSIS: """
You are an expert software architect. Perform deep analysis:
- Business logic correctness
- Edge cases and error scenarios
- Integration with existing systems
- Potential race conditions
- State management issues
- Data flow integrity
- Architectural consistency

Focus on subtle bugs that automated tools miss.

Output JSON array of findings:
```json
[
  {
    "id": "finding-1",
    "severity": "critical|high|medium|low",
    "category": "quality|pattern|performance",
    "confidence": 0.85,
    "title": "Brief issue title",
    "description": "Detailed explanation of the issue",
    "file": "path/to/file.ts",
    "line": 42,
    "suggested_fix": "How to address this",
    "fixable": false
  }
]
```
""",
            ReviewPass.STRUCTURAL: """
You are a senior software architect reviewing this PR for STRUCTURAL issues.

Focus on:
1. **Feature Creep**: Does the PR do more than its title/description claims?
2. **Scope Coherence**: Are all changes working toward the same goal?
3. **Architecture Alignment**: Does this follow established codebase patterns?
4. **PR Structure**: Is this appropriately sized? Should it be split?

Output JSON array of structural issues:
```json
[
  {
    "id": "struct-1",
    "issue_type": "feature_creep|scope_creep|architecture_violation|poor_structure",
    "severity": "critical|high|medium|low",
    "title": "Brief issue title (max 80 chars)",
    "description": "What the structural problem is",
    "impact": "Why this matters (maintenance, review quality, risk)",
    "suggestion": "How to address this"
  }
]
```
""",
            ReviewPass.AI_COMMENT_TRIAGE: """
You are triaging comments from other AI code review tools (CodeRabbit, Cursor, Greptile, etc).

For each AI comment, determine:
- CRITICAL: Genuine issue that must be addressed before merge
- IMPORTANT: Valid issue that should be addressed
- NICE_TO_HAVE: Valid but optional improvement
- TRIVIAL: Style preference, can be ignored
- FALSE_POSITIVE: The AI is wrong about this

Output JSON array:
```json
[
  {
    "comment_id": 12345678,
    "tool_name": "CodeRabbit",
    "original_summary": "Brief summary of what AI flagged (max 100 chars)",
    "verdict": "critical|important|nice_to_have|trivial|false_positive",
    "reasoning": "2-3 sentence explanation of your verdict",
    "response_comment": "Concise reply to post on GitHub"
  }
]
```
""",
        }
        return prompts.get(review_pass, "")

    def get_pr_review_prompt(self) -> str:
        """Get the main PR review prompt."""
        prompt_file = self.prompts_dir / "pr_reviewer.md"
        if prompt_file.exists():
            return prompt_file.read_text()
        return self._get_default_pr_review_prompt()

    def _get_default_pr_review_prompt(self) -> str:
        """Default PR review prompt if file doesn't exist."""
        return """# PR Review Agent

You are an AI code reviewer. Analyze the provided pull request and identify:

1. **Security Issues** - vulnerabilities, injection risks, auth problems
2. **Code Quality** - complexity, duplication, error handling
3. **Style Issues** - naming, formatting, patterns
4. **Test Coverage** - missing tests, edge cases
5. **Documentation** - missing/outdated docs

For each finding, output a JSON array:

```json
[
  {
    "id": "finding-1",
    "severity": "critical|high|medium|low",
    "category": "security|quality|style|test|docs|pattern|performance",
    "title": "Brief issue title",
    "description": "Detailed explanation",
    "file": "path/to/file.ts",
    "line": 42,
    "suggested_fix": "Optional code or suggestion",
    "fixable": true
  }
]
```

Be specific and actionable. Focus on significant issues, not nitpicks.
"""

    def get_triage_prompt(self) -> str:
        """Get the issue triage prompt."""
        prompt_file = self.prompts_dir / "issue_triager.md"
        if prompt_file.exists():
            return prompt_file.read_text()
        return self._get_default_triage_prompt()

    def _get_default_triage_prompt(self) -> str:
        """Default triage prompt if file doesn't exist."""
        return """# Issue Triage Agent

You are an issue triage assistant. Analyze the GitHub issue and classify it.

Determine:
1. **Category**: bug, feature, documentation, question, duplicate, spam, feature_creep
2. **Priority**: high, medium, low
3. **Is Duplicate?**: Check against potential duplicates list
4. **Is Spam?**: Check for promotional content, gibberish, abuse
5. **Is Feature Creep?**: Multiple unrelated features in one issue

Output JSON:

```json
{
  "category": "bug|feature|documentation|question|duplicate|spam|feature_creep",
  "confidence": 0.0-1.0,
  "priority": "high|medium|low",
  "labels_to_add": ["type:bug", "priority:high"],
  "labels_to_remove": [],
  "is_duplicate": false,
  "duplicate_of": null,
  "is_spam": false,
  "is_feature_creep": false,
  "suggested_breakdown": ["Suggested issue 1", "Suggested issue 2"],
  "comment": "Optional bot comment"
}
```
"""
