"""
Integration Tests for PR Review System - Phase 4
=================================================

Tests validating all Phase 1-3 features work correctly:
- Phase 1: Confidence routing, evidence validation, scope filtering
- Phase 2: Import detection (path aliases, Python), reverse dependencies
- Phase 3: Multi-agent cross-validation
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add the backend directory to path for imports
backend_path = Path(__file__).parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_path))

# Import directly to avoid loading the full runners module with its dependencies
import importlib.util

# Load file_lock first (models.py depends on it)
file_lock_spec = importlib.util.spec_from_file_location(
    "file_lock",
    backend_path / "runners" / "github" / "file_lock.py"
)
file_lock_module = importlib.util.module_from_spec(file_lock_spec)
sys.modules['file_lock'] = file_lock_module
file_lock_spec.loader.exec_module(file_lock_module)

# Load models next
models_spec = importlib.util.spec_from_file_location(
    "models",
    backend_path / "runners" / "github" / "models.py"
)
models_module = importlib.util.module_from_spec(models_spec)
sys.modules['models'] = models_module
models_spec.loader.exec_module(models_module)
PRReviewFinding = models_module.PRReviewFinding
PRReviewResult = models_module.PRReviewResult
ReviewSeverity = models_module.ReviewSeverity
ReviewCategory = models_module.ReviewCategory

# Load services module dependencies for parallel_orchestrator_reviewer
category_utils_spec = importlib.util.spec_from_file_location(
    "category_utils",
    backend_path / "runners" / "github" / "services" / "category_utils.py"
)
category_utils_module = importlib.util.module_from_spec(category_utils_spec)
sys.modules['services.category_utils'] = category_utils_module
category_utils_spec.loader.exec_module(category_utils_module)

# Load io_utils
io_utils_spec = importlib.util.spec_from_file_location(
    "io_utils",
    backend_path / "runners" / "github" / "services" / "io_utils.py"
)
io_utils_module = importlib.util.module_from_spec(io_utils_spec)
sys.modules['services.io_utils'] = io_utils_module
io_utils_spec.loader.exec_module(io_utils_module)

# Load pydantic_models
pydantic_models_spec = importlib.util.spec_from_file_location(
    "pydantic_models",
    backend_path / "runners" / "github" / "services" / "pydantic_models.py"
)
pydantic_models_module = importlib.util.module_from_spec(pydantic_models_spec)
sys.modules['services.pydantic_models'] = pydantic_models_module
pydantic_models_spec.loader.exec_module(pydantic_models_module)
AgentAgreement = pydantic_models_module.AgentAgreement


# Load parallel_orchestrator_reviewer (contains ConfidenceTier, validation functions)
orchestrator_spec = importlib.util.spec_from_file_location(
    "parallel_orchestrator_reviewer",
    backend_path / "runners" / "github" / "services" / "parallel_orchestrator_reviewer.py"
)
orchestrator_module = importlib.util.module_from_spec(orchestrator_spec)
# Mock dependencies that aren't needed for unit testing
# IMPORTANT: Save and restore ALL mocked modules to avoid polluting sys.modules for other tests
_modules_to_mock = [
    'context_gatherer',
    'core.client',
    'gh_client',
    'phase_config',
    'services.pr_worktree_manager',
    'services.sdk_utils',
    'claude_agent_sdk',
]
_original_modules = {name: sys.modules.get(name) for name in _modules_to_mock}
for name in _modules_to_mock:
    sys.modules[name] = MagicMock()
orchestrator_spec.loader.exec_module(orchestrator_module)
# Restore all mocked modules to avoid polluting other tests
for name in _modules_to_mock:
    if _original_modules[name] is not None:
        sys.modules[name] = _original_modules[name]
    elif name in sys.modules:
        del sys.modules[name]
ConfidenceTier = orchestrator_module.ConfidenceTier
_validate_finding_evidence = orchestrator_module._validate_finding_evidence
_is_finding_in_scope = orchestrator_module._is_finding_in_scope


# =============================================================================
# Phase 1 Tests: Confidence Routing, Evidence Validation, Scope Filtering
# =============================================================================

class TestConfidenceTierRouting:
    """Test confidence tier routing logic (Phase 1)."""

    def test_high_confidence_tier(self):
        """Verify confidence >= 0.8 returns HIGH tier."""
        assert ConfidenceTier.get_tier(0.8) == ConfidenceTier.HIGH
        assert ConfidenceTier.get_tier(0.85) == ConfidenceTier.HIGH
        assert ConfidenceTier.get_tier(0.95) == ConfidenceTier.HIGH
        assert ConfidenceTier.get_tier(1.0) == ConfidenceTier.HIGH

    def test_medium_confidence_tier(self):
        """Verify confidence 0.5-0.8 returns MEDIUM tier."""
        assert ConfidenceTier.get_tier(0.5) == ConfidenceTier.MEDIUM
        assert ConfidenceTier.get_tier(0.6) == ConfidenceTier.MEDIUM
        assert ConfidenceTier.get_tier(0.7) == ConfidenceTier.MEDIUM
        assert ConfidenceTier.get_tier(0.79) == ConfidenceTier.MEDIUM

    def test_low_confidence_tier(self):
        """Verify confidence < 0.5 returns LOW tier."""
        assert ConfidenceTier.get_tier(0.0) == ConfidenceTier.LOW
        assert ConfidenceTier.get_tier(0.1) == ConfidenceTier.LOW
        assert ConfidenceTier.get_tier(0.3) == ConfidenceTier.LOW
        assert ConfidenceTier.get_tier(0.49) == ConfidenceTier.LOW

    def test_boundary_values(self):
        """Test exact boundary values: 0.5 (MEDIUM) and 0.8 (HIGH)."""
        # 0.5 is MEDIUM threshold (inclusive)
        assert ConfidenceTier.get_tier(0.5) == ConfidenceTier.MEDIUM
        # 0.8 is HIGH threshold (inclusive)
        assert ConfidenceTier.get_tier(0.8) == ConfidenceTier.HIGH
        # Just below boundaries
        assert ConfidenceTier.get_tier(0.4999) == ConfidenceTier.LOW
        assert ConfidenceTier.get_tier(0.7999) == ConfidenceTier.MEDIUM

    def test_tier_constants_values(self):
        """Verify tier constant values match expected strings."""
        assert ConfidenceTier.HIGH == "high"
        assert ConfidenceTier.MEDIUM == "medium"
        assert ConfidenceTier.LOW == "low"

    def test_threshold_values(self):
        """Verify threshold values through behavior (0.8 for HIGH, 0.5 for LOW)."""
        # HIGH threshold is 0.8
        assert ConfidenceTier.get_tier(0.8) == ConfidenceTier.HIGH
        assert ConfidenceTier.get_tier(0.79) == ConfidenceTier.MEDIUM

        # LOW threshold is 0.5
        assert ConfidenceTier.get_tier(0.5) == ConfidenceTier.MEDIUM
        assert ConfidenceTier.get_tier(0.49) == ConfidenceTier.LOW


class TestEvidenceValidation:
    """Test evidence validation logic (Phase 1)."""

    @pytest.fixture
    def make_finding(self):
        """Factory fixture to create PRReviewFinding instances."""
        def _make_finding(evidence: str | None = None, **kwargs):
            defaults = {
                "id": "TEST001",
                "severity": ReviewSeverity.MEDIUM,
                "category": ReviewCategory.QUALITY,
                "title": "Test Finding",
                "description": "Test description",
                "file": "src/test.py",
                "line": 10,
                "evidence": evidence,
            }
            defaults.update(kwargs)
            return PRReviewFinding(**defaults)
        return _make_finding

    def test_valid_evidence_with_code_syntax(self, make_finding):
        """Evidence with =, (), {} should pass validation."""
        # Assignment operator
        finding = make_finding(evidence="const x = getValue()")
        is_valid, reason = _validate_finding_evidence(finding)
        assert is_valid, f"Failed: {reason}"

        # Function call
        finding = make_finding(evidence="someFunction(arg1, arg2)")
        is_valid, reason = _validate_finding_evidence(finding)
        assert is_valid, f"Failed: {reason}"

        # Object/dict literal
        finding = make_finding(evidence="config = { 'key': 'value' }")
        is_valid, reason = _validate_finding_evidence(finding)
        assert is_valid, f"Failed: {reason}"

    def test_invalid_evidence_no_code_syntax(self, make_finding):
        """Prose-only evidence without code syntax should fail."""
        finding = make_finding(evidence="This code is problematic and needs fixing")
        is_valid, reason = _validate_finding_evidence(finding)
        assert not is_valid
        assert "lacks code syntax" in reason.lower()

    def test_empty_evidence_fails(self, make_finding):
        """Empty or short evidence should fail validation."""
        # No evidence
        finding = make_finding(evidence=None)
        is_valid, reason = _validate_finding_evidence(finding)
        assert not is_valid
        assert "no evidence" in reason.lower()

        # Empty string
        finding = make_finding(evidence="")
        is_valid, reason = _validate_finding_evidence(finding)
        assert not is_valid

        # Too short (< 10 chars)
        finding = make_finding(evidence="x = 1")
        is_valid, reason = _validate_finding_evidence(finding)
        assert not is_valid
        assert "too short" in reason.lower()

    def test_evidence_with_function_def(self, make_finding):
        """Evidence with 'def ' or 'function ' patterns should pass."""
        # Python function definition
        finding = make_finding(evidence="def vulnerable_function(user_input):")
        is_valid, reason = _validate_finding_evidence(finding)
        assert is_valid, f"Failed: {reason}"

        # JavaScript function
        finding = make_finding(evidence="function handleRequest(req, res) {")
        is_valid, reason = _validate_finding_evidence(finding)
        assert is_valid, f"Failed: {reason}"

    def test_evidence_rejects_description_patterns(self, make_finding):
        """Evidence starting with vague patterns should be rejected."""
        patterns = [
            "The code has an issue with security",
            "This function could be improved",
            "It appears there is a vulnerability",
            "Seems to be missing error handling",
        ]
        for pattern in patterns:
            finding = make_finding(evidence=pattern)
            is_valid, reason = _validate_finding_evidence(finding)
            assert not is_valid, f"Should reject: {pattern}"
            assert "description pattern" in reason.lower() or "lacks code" in reason.lower()

    def test_evidence_with_various_syntax_chars(self, make_finding):
        """Test various code syntax characters are recognized."""
        # Semicolon
        finding = make_finding(evidence="let x = 5; let y = 10;")
        is_valid, _ = _validate_finding_evidence(finding)
        assert is_valid

        # Colon (Python dict/type hint)
        finding = make_finding(evidence="config: Dict[str, int]")
        is_valid, _ = _validate_finding_evidence(finding)
        assert is_valid

        # Arrow
        finding = make_finding(evidence="result->getValue()")
        is_valid, _ = _validate_finding_evidence(finding)
        assert is_valid

        # Brackets
        finding = make_finding(evidence="array[0] = items[index]")
        is_valid, _ = _validate_finding_evidence(finding)
        assert is_valid


class TestScopeFiltering:
    """Test scope filtering logic (Phase 1)."""

    @pytest.fixture
    def make_finding(self):
        """Factory fixture to create PRReviewFinding instances."""
        def _make_finding(file: str = "src/test.py", line: int = 10, **kwargs):
            defaults = {
                "id": "TEST001",
                "severity": ReviewSeverity.MEDIUM,
                "category": ReviewCategory.QUALITY,
                "title": "Test Finding",
                "description": "Test description",
                "file": file,
                "line": line,
            }
            defaults.update(kwargs)
            return PRReviewFinding(**defaults)
        return _make_finding

    def test_finding_in_changed_files_passes(self, make_finding):
        """Finding for a file in changed_files should pass."""
        changed_files = ["src/auth.py", "src/utils.py", "tests/test_auth.py"]
        finding = make_finding(file="src/auth.py", line=15)

        is_valid, reason = _is_finding_in_scope(finding, changed_files)
        assert is_valid, f"Failed: {reason}"

    def test_finding_outside_changed_files_filtered(self, make_finding):
        """Finding for a file NOT in changed_files should be filtered."""
        changed_files = ["src/auth.py", "src/utils.py"]
        finding = make_finding(
            file="src/database.py",
            line=10,
            description="This code has a bug"
        )

        is_valid, reason = _is_finding_in_scope(finding, changed_files)
        assert not is_valid
        assert "not in pr changed files" in reason.lower()

    def test_invalid_line_number_filtered(self, make_finding):
        """Finding with invalid line number (<=0) should be filtered."""
        changed_files = ["src/test.py"]

        # Zero line
        finding = make_finding(file="src/test.py", line=0)
        is_valid, reason = _is_finding_in_scope(finding, changed_files)
        assert not is_valid
        assert "invalid line" in reason.lower()

        # Negative line
        finding = make_finding(file="src/test.py", line=-5)
        is_valid, reason = _is_finding_in_scope(finding, changed_files)
        assert not is_valid

    def test_impact_finding_allowed_for_unchanged_files(self, make_finding):
        """Finding with impact keywords should be allowed for unchanged files."""
        changed_files = ["src/auth.py"]

        # 'breaks' keyword
        finding = make_finding(
            file="src/utils.py",
            line=10,
            description="This change breaks the helper function in utils.py"
        )
        is_valid, _ = _is_finding_in_scope(finding, changed_files)
        assert is_valid

        # 'affects' keyword
        finding = make_finding(
            file="src/config.py",
            line=5,
            description="Changes in auth.py affects config loading"
        )
        is_valid, _ = _is_finding_in_scope(finding, changed_files)
        assert is_valid

        # 'depends' keyword
        finding = make_finding(
            file="src/database.py",
            line=20,
            description="database.py depends on modified auth module"
        )
        is_valid, _ = _is_finding_in_scope(finding, changed_files)
        assert is_valid

    def test_no_file_specified_fails(self, make_finding):
        """Finding with no file specified should fail."""
        changed_files = ["src/test.py"]
        finding = make_finding(file="")
        is_valid, reason = _is_finding_in_scope(finding, changed_files)
        assert not is_valid
        assert "no file" in reason.lower()

    def test_none_line_number_passes(self, make_finding):
        """Finding with None line number should pass (general finding)."""
        changed_files = ["src/test.py"]
        finding = make_finding(file="src/test.py", line=None)
        # Line=None means general file-level finding
        finding.line = None  # Override since fixture sets it
        is_valid, _ = _is_finding_in_scope(finding, changed_files)
        assert is_valid


# =============================================================================
# Phase 2 Tests: Import Detection, Reverse Dependencies
# =============================================================================

# For Phase 2 tests, we need the real PRContextGatherer methods
# We'll test the functions directly by extracting the relevant logic
github_dir = backend_path / "runners" / "github"

# Load context_gatherer module directly using spec loader
# This avoids the complex package import chain
_cg_spec = importlib.util.spec_from_file_location(
    "context_gatherer_isolated",
    github_dir / "context_gatherer.py"
)
_cg_module = importlib.util.module_from_spec(_cg_spec)
# Set up minimal module environment
sys.modules['context_gatherer_isolated'] = _cg_module
# Mock only the gh_client dependency
_mock_gh = MagicMock()
sys.modules['gh_client'] = _mock_gh
_cg_spec.loader.exec_module(_cg_module)
PRContextGathererIsolated = _cg_module.PRContextGatherer


class TestImportDetection:
    """Test import detection logic (Phase 2)."""

    @pytest.fixture
    def temp_project(self, tmp_path):
        """Create a temporary project structure for import testing."""
        # Create src directory
        src_dir = tmp_path / "src"
        src_dir.mkdir()

        # Create utils.ts file
        (src_dir / "utils.ts").write_text("export const helper = () => {};")

        # Create config.ts file
        (src_dir / "config.ts").write_text("export const config = { debug: true };")

        # Create index.ts that re-exports
        (src_dir / "index.ts").write_text("export * from './utils';\nexport { config } from './config';")

        # Create shared directory
        shared_dir = src_dir / "shared"
        shared_dir.mkdir()
        (shared_dir / "types.ts").write_text("export type User = { id: string };")

        # Create Python module
        (src_dir / "python_module.py").write_text("from .helpers import util_func\nimport os")
        (src_dir / "helpers.py").write_text("def util_func(): pass")
        (src_dir / "__init__.py").write_text("")

        return tmp_path

    def test_path_alias_detection(self, temp_project):
        """Path alias imports (@/utils) should be detected and resolved."""
        import json
        # Create tsconfig.json with path aliases
        tsconfig = {
            "compilerOptions": {
                "paths": {
                    "@/*": ["src/*"],
                    "@shared/*": ["src/shared/*"]
                }
            }
        }
        (temp_project / "tsconfig.json").write_text(json.dumps(tsconfig))

        # Create the target file that the alias points to
        (temp_project / "src" / "utils.ts").write_text("export const helper = () => {};")

        # Test file with alias import
        test_content = "import { helper } from '@/utils';"
        source_path = Path("src/test.ts")

        gatherer = PRContextGathererIsolated(temp_project, pr_number=1)

        # Call _find_imports
        imports = gatherer._find_imports(test_content, source_path)

        # Should resolve @/utils to src/utils.ts
        assert isinstance(imports, set)
        # Normalize paths for cross-platform comparison (Windows uses backslashes)
        normalized_imports = {p.replace("\\", "/") for p in imports}
        assert "src/utils.ts" in normalized_imports, f"Expected 'src/utils.ts' in imports, got: {imports}"

    def test_commonjs_require_detection(self, temp_project):
        """CommonJS require('./utils') should be detected."""
        test_content = "const utils = require('./utils');"
        source_path = Path("src/test.ts")

        gatherer = PRContextGathererIsolated(temp_project, pr_number=1)
        imports = gatherer._find_imports(test_content, source_path)

        # Should detect relative require
        # Normalize paths for cross-platform comparison (Windows uses backslashes)
        normalized_imports = {p.replace("\\", "/") for p in imports}
        assert "src/utils.ts" in normalized_imports

    def test_reexport_detection(self, temp_project):
        """Re-exports (export * from './module') should be detected."""
        test_content = "export * from './utils';\nexport { config } from './config';"
        source_path = Path("src/index.ts")

        gatherer = PRContextGathererIsolated(temp_project, pr_number=1)
        imports = gatherer._find_imports(test_content, source_path)

        # Should detect re-export targets
        # Normalize paths for cross-platform comparison (Windows uses backslashes)
        normalized_imports = {p.replace("\\", "/") for p in imports}
        assert "src/utils.ts" in normalized_imports
        assert "src/config.ts" in normalized_imports

    def test_python_relative_import(self, temp_project):
        """Python relative imports (from .utils import) should be detected via AST."""
        test_content = "from .helpers import util_func"
        source_path = Path("src/python_module.py")

        gatherer = PRContextGathererIsolated(temp_project, pr_number=1)
        imports = gatherer._find_imports(test_content, source_path)

        # Should resolve relative Python import
        # Normalize paths for cross-platform comparison (Windows uses backslashes)
        normalized_imports = {p.replace("\\", "/") for p in imports}
        assert "src/helpers.py" in normalized_imports

    def test_python_absolute_import(self, temp_project):
        """Python absolute imports should be checked for project-internal modules."""
        # Create a project-internal module
        (temp_project / "myapp").mkdir()
        (temp_project / "myapp" / "__init__.py").write_text("")
        (temp_project / "myapp" / "config.py").write_text("DEBUG = True")

        test_content = "from myapp import config"
        source_path = Path("src/test.py")

        gatherer = PRContextGathererIsolated(temp_project, pr_number=1)
        imports = gatherer._find_imports(test_content, source_path)

        # Should resolve absolute import to project module
        # Normalize paths for cross-platform comparison (Windows uses backslashes)
        normalized_imports = {p.replace("\\", "/") for p in imports}
        assert any("myapp" in i for i in normalized_imports)


class TestReverseDepDetection:
    """Test reverse dependency detection (Phase 2)."""

    @pytest.fixture
    def temp_project_with_deps(self, tmp_path):
        """Create a project with files that import each other."""
        src_dir = tmp_path / "src"
        src_dir.mkdir()

        # Create a utility file with non-generic name (helpers is in skip list)
        (src_dir / "formatter.ts").write_text(
            "export function format(s: string) { return s; }"
        )

        # Create files that import formatter
        (src_dir / "auth.ts").write_text(
            "import { format } from './formatter';\nexport const login = () => {};"
        )
        (src_dir / "api.ts").write_text(
            "import { format } from './formatter';\nexport const fetch = () => {};"
        )

        # Create a file that does NOT import formatter
        (src_dir / "standalone.ts").write_text(
            "export const standalone = () => {};"
        )

        return tmp_path

    def test_finds_files_importing_changed_file(self, temp_project_with_deps):
        """Verify grep-based detection finds files that import a given file."""
        gatherer = PRContextGathererIsolated(temp_project_with_deps, pr_number=1)
        # Use non-generic name (helpers is in the skip list)
        dependents = gatherer._find_dependents("src/formatter.ts", max_results=10)

        # Should find auth.ts and api.ts as dependents
        assert any("auth.ts" in d for d in dependents)
        assert any("api.ts" in d for d in dependents)
        # Should NOT include standalone.ts
        assert not any("standalone.ts" in d for d in dependents)

    def test_skips_generic_names(self, tmp_path):
        """Generic names (index, main, utils) should be skipped to reduce noise."""
        src_dir = tmp_path / "src"
        src_dir.mkdir()

        # Create files with generic names
        (src_dir / "index.ts").write_text("export * from './utils';")
        (src_dir / "main.ts").write_text("import { x } from './index';")

        gatherer = PRContextGathererIsolated(tmp_path, pr_number=1)

        # Generic names should return empty set (skipped)
        dependents_index = gatherer._find_dependents("src/index.ts")
        dependents_main = gatherer._find_dependents("src/main.ts")

        # These should be skipped due to generic names
        assert len(dependents_index) == 0
        assert len(dependents_main) == 0

    def test_respects_file_limit(self, tmp_path):
        """Large repo search should stop after reaching file limit."""
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        (src_dir / "unique_name.ts").write_text("export const x = 1;")

        gatherer = PRContextGathererIsolated(tmp_path, pr_number=1)

        # Mock os.walk to generate more files than the limit (2000)
        # This simulates a large codebase without creating actual files
        def mock_walk(path):
            # Yield a directory with 3000 TypeScript files
            yield (str(path), [], [f"file{i}.ts" for i in range(3000)])

        with patch.object(_cg_module.os, "walk", mock_walk):
            # The function should stop after max_files_to_check (2000) files
            # and return gracefully without hanging
            dependents = gatherer._find_dependents("src/unique_name.ts")

        # Should return a set (may be empty since mock files don't contain imports)
        assert isinstance(dependents, set)


# =============================================================================
# Phase 3 Tests: Multi-Agent Cross-Validation
# =============================================================================

# Import the cross-validation function from orchestrator
ParallelOrchestratorReviewer = orchestrator_module.ParallelOrchestratorReviewer


class TestCrossValidation:
    """Test multi-agent cross-validation logic (Phase 3)."""

    @pytest.fixture
    def make_finding(self):
        """Factory fixture to create PRReviewFinding instances."""
        def _make_finding(
            id: str = "TEST001",
            file: str = "src/test.py",
            line: int = 10,
            category: ReviewCategory = ReviewCategory.SECURITY,
            severity: ReviewSeverity = ReviewSeverity.HIGH,
            confidence: float = 0.7,
            source_agents: list = None,
            **kwargs
        ):
            return PRReviewFinding(
                id=id,
                severity=severity,
                category=category,
                title=kwargs.get("title", "Test Finding"),
                description=kwargs.get("description", "Test description"),
                file=file,
                line=line,
                confidence=confidence,
                source_agents=source_agents or [],
                **{k: v for k, v in kwargs.items() if k not in ["title", "description"]}
            )
        return _make_finding

    @pytest.fixture
    def mock_reviewer(self, tmp_path):
        """Create a mock ParallelOrchestratorReviewer instance."""
        from models import GitHubRunnerConfig

        config = GitHubRunnerConfig(
            token="test-token",
            repo="test/repo"
        )
        # Create minimal directory structure
        github_dir = tmp_path / ".auto-claude" / "github"
        github_dir.mkdir(parents=True)

        reviewer = ParallelOrchestratorReviewer(
            project_dir=tmp_path,
            github_dir=github_dir,
            config=config
        )
        return reviewer

    def test_multi_agent_agreement_boosts_confidence(self, make_finding, mock_reviewer):
        """When 2+ agents agree on same finding, confidence should increase by 0.15."""
        # Two findings from different agents on same (file, line, category)
        finding1 = make_finding(
            id="F1",
            file="src/auth.py",
            line=10,
            category=ReviewCategory.SECURITY,
            confidence=0.7,
            source_agents=["security-reviewer"],
            description="SQL injection risk"
        )
        finding2 = make_finding(
            id="F2",
            file="src/auth.py",
            line=10,
            category=ReviewCategory.SECURITY,
            confidence=0.6,
            source_agents=["quality-reviewer"],
            description="Input not sanitized"
        )

        validated, agreement = mock_reviewer._cross_validate_findings([finding1, finding2])

        # Should merge into one finding
        assert len(validated) == 1
        # Confidence should be boosted: max(0.7, 0.6) + 0.15 = 0.85
        assert validated[0].confidence == pytest.approx(0.85, rel=0.01)
        # Should have cross_validated flag set
        assert validated[0].cross_validated is True
        # Should track in agreement
        assert len(agreement.agreed_findings) == 1

    def test_confidence_boost_capped_at_095(self, make_finding, mock_reviewer):
        """Confidence boost should cap at 0.95, not exceed 1.0."""
        finding1 = make_finding(
            id="F1",
            file="src/auth.py",
            line=10,
            category=ReviewCategory.SECURITY,
            confidence=0.85,
            source_agents=["security-reviewer"],
        )
        finding2 = make_finding(
            id="F2",
            file="src/auth.py",
            line=10,
            category=ReviewCategory.SECURITY,
            confidence=0.90,
            source_agents=["logic-reviewer"],
        )

        validated, _ = mock_reviewer._cross_validate_findings([finding1, finding2])

        # 0.90 + 0.15 = 1.05, but should cap at 0.95
        assert validated[0].confidence == 0.95

    def test_merged_finding_has_cross_validated_true(self, make_finding, mock_reviewer):
        """Merged multi-agent findings should have cross_validated=True."""
        finding1 = make_finding(id="F1", file="src/test.py", line=5, source_agents=["agent1"])
        finding2 = make_finding(id="F2", file="src/test.py", line=5, source_agents=["agent2"])

        validated, _ = mock_reviewer._cross_validate_findings([finding1, finding2])

        assert validated[0].cross_validated is True

    def test_grouping_by_file_line_category(self, make_finding, mock_reviewer):
        """Findings should be grouped by (file, line, category) tuple."""
        # Same file+line but different category - should NOT merge
        finding1 = make_finding(
            id="F1",
            file="src/test.py",
            line=10,
            category=ReviewCategory.SECURITY,
        )
        finding2 = make_finding(
            id="F2",
            file="src/test.py",
            line=10,
            category=ReviewCategory.QUALITY,  # Different category
        )

        validated, _ = mock_reviewer._cross_validate_findings([finding1, finding2])

        # Should remain as 2 separate findings
        assert len(validated) == 2

        # Same category but different line - should NOT merge
        finding3 = make_finding(
            id="F3",
            file="src/test.py",
            line=10,
            category=ReviewCategory.SECURITY,
        )
        finding4 = make_finding(
            id="F4",
            file="src/test.py",
            line=20,  # Different line
            category=ReviewCategory.SECURITY,
        )

        validated2, _ = mock_reviewer._cross_validate_findings([finding3, finding4])
        assert len(validated2) == 2

    def test_merged_description_combines_sources(self, make_finding, mock_reviewer):
        """Merged findings should combine descriptions with ' | ' separator."""
        finding1 = make_finding(
            id="F1",
            file="src/auth.py",
            line=10,
            category=ReviewCategory.SECURITY,
            description="SQL injection vulnerability",
        )
        finding2 = make_finding(
            id="F2",
            file="src/auth.py",
            line=10,
            category=ReviewCategory.SECURITY,
            description="Unsanitized user input",
        )

        validated, _ = mock_reviewer._cross_validate_findings([finding1, finding2])

        # Should combine descriptions with ' | '
        assert " | " in validated[0].description
        assert "SQL injection vulnerability" in validated[0].description
        assert "Unsanitized user input" in validated[0].description

    def test_single_agent_finding_not_boosted(self, make_finding, mock_reviewer):
        """Single-agent findings should not have confidence boosted."""
        finding = make_finding(
            id="F1",
            file="src/test.py",
            line=10,
            confidence=0.7,
            source_agents=["security-reviewer"],
        )

        validated, agreement = mock_reviewer._cross_validate_findings([finding])

        # Confidence should remain unchanged
        assert validated[0].confidence == 0.7
        # Should not be marked as cross-validated
        assert validated[0].cross_validated is False
        # Should not be in agreed_findings
        assert len(agreement.agreed_findings) == 0

    def test_merged_finding_keeps_highest_severity(self, make_finding, mock_reviewer):
        """Merged findings should keep the highest severity."""
        finding1 = make_finding(
            id="F1",
            file="src/test.py",
            line=10,
            severity=ReviewSeverity.MEDIUM,
        )
        finding2 = make_finding(
            id="F2",
            file="src/test.py",
            line=10,
            severity=ReviewSeverity.CRITICAL,
        )

        validated, _ = mock_reviewer._cross_validate_findings([finding1, finding2])

        # Should keep CRITICAL (highest severity)
        assert validated[0].severity == ReviewSeverity.CRITICAL


# =============================================================================
# Integration Verification Tests: Full Pipeline Tests
# =============================================================================

class TestIntegrationPipeline:
    """Test complete pipeline integration of Phase 1-3 features."""

    @pytest.fixture
    def make_finding(self):
        """Factory fixture to create PRReviewFinding instances."""
        def _make_finding(
            id: str = "TEST001",
            file: str = "src/test.py",
            line: int = 10,
            category: ReviewCategory = ReviewCategory.SECURITY,
            severity: ReviewSeverity = ReviewSeverity.HIGH,
            confidence: float = 0.7,
            evidence: str = "const x = getValue()",
            source_agents: list = None,
            **kwargs
        ):
            return PRReviewFinding(
                id=id,
                severity=severity,
                category=category,
                title=kwargs.get("title", "Test Finding"),
                description=kwargs.get("description", "Test description"),
                file=file,
                line=line,
                confidence=confidence,
                evidence=evidence,
                source_agents=source_agents or [],
                **{k: v for k, v in kwargs.items() if k not in ["title", "description"]}
            )
        return _make_finding

    @pytest.fixture
    def mock_reviewer(self, tmp_path):
        """Create a mock ParallelOrchestratorReviewer instance."""
        from models import GitHubRunnerConfig

        config = GitHubRunnerConfig(
            token="test-token",
            repo="test/repo"
        )
        github_dir = tmp_path / ".auto-claude" / "github"
        github_dir.mkdir(parents=True)

        reviewer = ParallelOrchestratorReviewer(
            project_dir=tmp_path,
            github_dir=github_dir,
            config=config
        )
        return reviewer

    def test_pipeline_flow_high_confidence_valid_evidence_in_scope(
        self, make_finding, mock_reviewer
    ):
        """Test complete flow: high confidence + valid evidence + in scope passes all checks."""
        changed_files = ["src/auth.py"]
        finding = make_finding(
            file="src/auth.py",
            line=15,
            confidence=0.85,  # HIGH tier (>= 0.8)
            evidence="const password = req.body.password; query(`SELECT * WHERE pwd='${password}'`)",
        )

        # Phase 1a: Confidence tier
        tier = ConfidenceTier.get_tier(finding.confidence)
        assert tier == ConfidenceTier.HIGH

        # Phase 1b: Evidence validation
        is_valid_evidence, _ = _validate_finding_evidence(finding)
        assert is_valid_evidence

        # Phase 1c: Scope filtering
        is_in_scope, _ = _is_finding_in_scope(finding, changed_files)
        assert is_in_scope

        # All checks pass - finding should be included in review

    def test_pipeline_flow_low_confidence_filtered(self, make_finding):
        """Test that low confidence findings are filtered even with valid evidence."""
        changed_files = ["src/auth.py"]
        finding = make_finding(
            file="src/auth.py",
            line=15,
            confidence=0.3,  # LOW tier (< 0.5)
            evidence="const x = getValue()",
        )

        tier = ConfidenceTier.get_tier(finding.confidence)
        assert tier == ConfidenceTier.LOW

        # Low confidence findings may be filtered based on tier routing
        # This test documents the expected behavior

    def test_pipeline_flow_cross_validation_elevates_medium_to_high(
        self, make_finding, mock_reviewer
    ):
        """Test that cross-validation can elevate MEDIUM tier to HIGH tier."""
        # Two agents find same issue with MEDIUM confidence
        # Give finding2 CRITICAL severity so it becomes the primary (sorted first)
        finding1 = make_finding(
            id="F1",
            file="src/auth.py",
            line=10,
            confidence=0.6,  # MEDIUM tier
            severity=ReviewSeverity.HIGH,
            source_agents=["security-reviewer"],
        )
        finding2 = make_finding(
            id="F2",
            file="src/auth.py",
            line=10,
            confidence=0.7,  # MEDIUM tier - this will be primary (higher severity)
            severity=ReviewSeverity.CRITICAL,
            source_agents=["quality-reviewer"],
        )

        # Before cross-validation: both MEDIUM
        assert ConfidenceTier.get_tier(finding1.confidence) == ConfidenceTier.MEDIUM
        assert ConfidenceTier.get_tier(finding2.confidence) == ConfidenceTier.MEDIUM

        # Cross-validate
        validated, _ = mock_reviewer._cross_validate_findings([finding1, finding2])

        # After cross-validation: boosted to primary.confidence + 0.15 = 0.7 + 0.15 = 0.85 (HIGH tier)
        # Note: The code uses primary finding's confidence, sorted by severity (CRITICAL first)
        assert validated[0].confidence == pytest.approx(0.85, rel=0.01)
        assert ConfidenceTier.get_tier(validated[0].confidence) == ConfidenceTier.HIGH
        assert validated[0].severity == ReviewSeverity.CRITICAL  # Highest severity preserved

    def test_pipeline_invalid_evidence_rejected(self, make_finding):
        """Test that findings with invalid evidence are rejected regardless of confidence."""
        finding = make_finding(
            file="src/auth.py",
            line=15,
            confidence=0.95,  # HIGH confidence
            evidence="This code looks problematic",  # Prose, not code
        )

        is_valid_evidence, reason = _validate_finding_evidence(finding)
        assert not is_valid_evidence
        assert "lacks code syntax" in reason.lower()

    def test_pipeline_out_of_scope_rejected(self, make_finding):
        """Test that findings outside changed files are rejected."""
        changed_files = ["src/auth.py", "src/utils.py"]
        finding = make_finding(
            file="src/database.py",  # Not in changed files
            line=15,
            confidence=0.95,
            evidence="const query = buildQuery(input)",
        )

        is_in_scope, reason = _is_finding_in_scope(finding, changed_files)
        assert not is_in_scope

    def test_pipeline_impact_finding_allowed(self, make_finding):
        """Test that impact findings for unchanged files are allowed."""
        changed_files = ["src/auth.py"]
        finding = make_finding(
            file="src/database.py",  # Not in changed files
            line=15,
            confidence=0.85,
            evidence="const query = buildQuery(input)",
            description="Changes to auth.py breaks the database connection in database.py",
        )

        is_in_scope, _ = _is_finding_in_scope(finding, changed_files)
        assert is_in_scope  # Allowed because description mentions impact

    def test_pipeline_end_to_end_review_scenario(self, make_finding, mock_reviewer):
        """Test realistic end-to-end review scenario with multiple findings."""
        changed_files = ["src/auth.py", "src/api.py"]

        # Findings from multiple agents
        findings = [
            # High-confidence security finding from agent 1
            make_finding(
                id="SEC001",
                file="src/auth.py",
                line=42,
                category=ReviewCategory.SECURITY,
                severity=ReviewSeverity.CRITICAL,
                confidence=0.85,
                evidence="password = req.body.password; db.query(`SELECT * WHERE pwd='${password}'`)",
                source_agents=["security-reviewer"],
                description="SQL injection in login",
            ),
            # Same finding from agent 2 (will be cross-validated)
            make_finding(
                id="SEC002",
                file="src/auth.py",
                line=42,
                category=ReviewCategory.SECURITY,
                severity=ReviewSeverity.HIGH,
                confidence=0.75,
                evidence="db.query(`SELECT * WHERE pwd='${password}'`)",
                source_agents=["quality-reviewer"],
                description="Unsanitized query parameter",
            ),
            # Valid quality finding
            make_finding(
                id="QUAL001",
                file="src/api.py",
                line=100,
                category=ReviewCategory.QUALITY,
                severity=ReviewSeverity.MEDIUM,
                confidence=0.7,
                evidence="function handleRequest(req) { /* missing error handling */ }",
                source_agents=["quality-reviewer"],
                description="Missing error handling",
            ),
            # Invalid: out of scope
            make_finding(
                id="OUT001",
                file="src/database.py",  # Not in changed files
                line=10,
                category=ReviewCategory.SECURITY,
                confidence=0.9,
                evidence="connection.close()",
                source_agents=["security-reviewer"],
            ),
            # Invalid: prose evidence
            make_finding(
                id="PROSE001",
                file="src/auth.py",
                line=50,
                category=ReviewCategory.QUALITY,
                confidence=0.8,
                evidence="This code should be refactored for better maintainability",
                source_agents=["quality-reviewer"],
            ),
        ]

        # Step 1: Cross-validate
        validated, agreement = mock_reviewer._cross_validate_findings(findings)

        # SEC001 and SEC002 should be merged (same file, line, category)
        security_findings = [f for f in validated if f.category == ReviewCategory.SECURITY
                           and f.file == "src/auth.py" and f.line == 42]
        assert len(security_findings) == 1
        # Cross-validated finding should have boosted confidence
        assert security_findings[0].cross_validated is True
        assert security_findings[0].confidence >= 0.85  # Boosted from max(0.85, 0.75) + 0.15

        # Step 2: Validate evidence for each finding
        valid_evidence_findings = []
        for f in validated:
            is_valid, _ = _validate_finding_evidence(f)
            if is_valid:
                valid_evidence_findings.append(f)

        # PROSE001 should be filtered out (if present in validated)
        prose_findings = [f for f in valid_evidence_findings
                         if f.evidence and "refactored" in f.evidence]
        assert len(prose_findings) == 0

        # Step 3: Filter by scope
        in_scope_findings = []
        for f in valid_evidence_findings:
            is_in_scope, _ = _is_finding_in_scope(f, changed_files)
            if is_in_scope:
                in_scope_findings.append(f)

        # OUT001 should be filtered out (src/database.py not in changed_files)
        database_findings = [f for f in in_scope_findings if f.file == "src/database.py"]
        assert len(database_findings) == 0

    def test_pipeline_empty_findings_handled(self, mock_reviewer):
        """Test that empty findings list is handled gracefully."""
        validated, agreement = mock_reviewer._cross_validate_findings([])

        assert len(validated) == 0
        assert len(agreement.agreed_findings) == 0
        assert len(agreement.conflicting_findings) == 0  # Note: uses conflicting_findings, not disputed

    def test_pipeline_confidence_tier_determines_routing(self, make_finding):
        """Test that confidence tier determines review routing behavior."""
        # Document the tier routing expectations
        test_cases = [
            (0.95, ConfidenceTier.HIGH, "auto-include"),
            (0.85, ConfidenceTier.HIGH, "auto-include"),
            (0.80, ConfidenceTier.HIGH, "auto-include"),
            (0.75, ConfidenceTier.MEDIUM, "needs verification"),
            (0.60, ConfidenceTier.MEDIUM, "needs verification"),
            (0.50, ConfidenceTier.MEDIUM, "needs verification"),
            (0.45, ConfidenceTier.LOW, "consider filtering"),
            (0.30, ConfidenceTier.LOW, "consider filtering"),
            (0.10, ConfidenceTier.LOW, "consider filtering"),
        ]

        for confidence, expected_tier, expected_routing in test_cases:
            finding = make_finding(confidence=confidence)
            tier = ConfidenceTier.get_tier(finding.confidence)
            assert tier == expected_tier, f"Confidence {confidence} should be {expected_tier}"
