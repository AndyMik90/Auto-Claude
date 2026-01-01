#!/usr/bin/env python3
"""
Environment Validator Module
============================

Validates Python version and dependency imports in both bundled and venv interpreters.
Provides detailed diagnostics when validation fails.

The environment validator is used by:
- Startup sequence: To verify dependencies before running features
- Installation flow: To confirm successful dependency installation
- Troubleshooting: To diagnose "Process exited with code 1" errors

Usage:
    # Check both interpreters
    python services/environment_validator.py --check-bundled --check-venv

    # Check specific interpreter
    python services/environment_validator.py --check-bundled

    # Use custom Python path
    python services/environment_validator.py --python /path/to/python

    # Validate from code
    from environment_validator import EnvironmentValidator

    validator = EnvironmentValidator()
    result = validator.validate_environment("/path/to/python")
    if not result.success:
        print(result.errors)
"""

from __future__ import annotations

import json
import platform
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# =============================================================================
# CONSTANTS
# =============================================================================

# Minimum Python version required
MIN_PYTHON_VERSION = (3, 12)

# Core dependencies that must be importable
CORE_DEPENDENCIES = [
    "claude_agent_sdk",
    "dotenv",
    "pydantic",
]

# Optional dependencies (Python 3.12+ only)
OPTIONAL_DEPENDENCIES = [
    "real_ladybug",
    "graphiti_core",
    "google.generativeai",
]


# =============================================================================
# DATA CLASSES
# =============================================================================


@dataclass
class DependencyStatus:
    """
    Status of a single dependency.

    Attributes:
        name: Name of the dependency/module
        installed: Whether the dependency is importable
        version: Version string if available
        error: Error message if import failed
    """

    name: str
    installed: bool = False
    version: str | None = None
    error: str | None = None


@dataclass
class ValidationResult:
    """
    Result of environment validation.

    Attributes:
        success: Whether all required validations passed
        python_path: Path to the Python interpreter validated
        python_version: Python version string (e.g., "3.12.0")
        python_version_valid: Whether Python version meets minimum requirement
        dependencies: List of dependency statuses
        missing_required: List of missing required dependencies
        missing_optional: List of missing optional dependencies
        errors: List of error messages
        warnings: List of warning messages
    """

    success: bool = False
    python_path: str = ""
    python_version: str = ""
    python_version_valid: bool = False
    dependencies: list[DependencyStatus] = field(default_factory=list)
    missing_required: list[str] = field(default_factory=list)
    missing_optional: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class DualValidationResult:
    """
    Result of validating both bundled and venv interpreters.

    Attributes:
        success: Whether both interpreters are valid
        bundled: Validation result for bundled Python
        venv: Validation result for venv Python
        summary: Human-readable summary of validation
    """

    success: bool = False
    bundled: ValidationResult | None = None
    venv: ValidationResult | None = None
    summary: str = ""


# =============================================================================
# PATH DETECTION
# =============================================================================


def get_bundled_python_path() -> Path | None:
    """
    Get the path to the bundled Python interpreter.

    Returns:
        Path to bundled Python, or None if not found.
    """
    system = platform.system()

    if system == "Darwin":  # macOS
        # Try multiple possible locations
        candidates = [
            Path("/Applications/Auto-Claude.app/Contents/Resources/python/bin/python3"),
            Path.home()
            / "Applications/Auto-Claude.app/Contents/Resources/python/bin/python3",
        ]
    elif system == "Windows":
        appdata_local = Path.home() / "AppData/Local"
        candidates = [
            appdata_local / "Programs/auto-claude-ui/resources/python/python.exe",
            Path.home()
            / "AppData/Roaming/../Local/Programs/auto-claude-ui/resources/python/python.exe",
        ]
    else:  # Linux
        candidates = [
            Path("/opt/auto-claude/python/bin/python3"),
            Path.home() / ".local/share/auto-claude/python/bin/python3",
        ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def get_venv_python_path() -> Path | None:
    """
    Get the path to the venv Python interpreter.

    Returns:
        Path to venv Python, or None if not found.
    """
    system = platform.system()

    if system == "Darwin":  # macOS
        venv_path = (
            Path.home()
            / "Library/Application Support/auto-claude-ui/python-venv/bin/python"
        )
    elif system == "Windows":
        venv_path = (
            Path.home()
            / "AppData/Roaming/auto-claude-ui/python-venv/Scripts/python.exe"
        )
    else:  # Linux
        venv_path = Path.home() / ".config/auto-claude-ui/python-venv/bin/python"

    if venv_path.exists():
        return venv_path

    return None


# =============================================================================
# ENVIRONMENT VALIDATOR
# =============================================================================


class EnvironmentValidator:
    """
    Validates Python environments for Auto-Claude.

    Checks:
    - Python version >= 3.12
    - Core dependencies are importable
    - Optional dependencies (reports warnings if missing)
    """

    def __init__(
        self,
        core_dependencies: list[str] | None = None,
        optional_dependencies: list[str] | None = None,
    ) -> None:
        """
        Initialize the environment validator.

        Args:
            core_dependencies: List of required module names to check
            optional_dependencies: List of optional module names to check
        """
        self.core_dependencies = core_dependencies or CORE_DEPENDENCIES
        self.optional_dependencies = optional_dependencies or OPTIONAL_DEPENDENCIES

    def validate_environment(self, python_path: str | Path) -> ValidationResult:
        """
        Validate a Python environment.

        Args:
            python_path: Path to the Python interpreter to validate

        Returns:
            ValidationResult with detailed status
        """
        result = ValidationResult(python_path=str(python_path))

        # Check Python version
        version_result = self._check_python_version(python_path)
        if not version_result["success"]:
            result.errors.append(
                version_result.get("error", "Failed to get Python version")
            )
            return result

        result.python_version = version_result["version"]
        result.python_version_valid = version_result["valid"]

        if not result.python_version_valid:
            result.errors.append(
                f"Python version {result.python_version} is below minimum required "
                f"{MIN_PYTHON_VERSION[0]}.{MIN_PYTHON_VERSION[1]}"
            )
            return result

        # Check core dependencies
        for dep in self.core_dependencies:
            status = self._check_dependency(python_path, dep)
            result.dependencies.append(status)
            if not status.installed:
                result.missing_required.append(dep)

        # Check optional dependencies (only for Python 3.12+)
        for dep in self.optional_dependencies:
            status = self._check_dependency(python_path, dep)
            result.dependencies.append(status)
            if not status.installed:
                result.missing_optional.append(dep)
                result.warnings.append(
                    f"Optional dependency '{dep}' not installed (some features may be unavailable)"
                )

        # Set overall success
        result.success = (
            len(result.missing_required) == 0 and result.python_version_valid
        )

        if result.missing_required:
            result.errors.append(
                f"Missing required dependencies: {', '.join(result.missing_required)}"
            )

        return result

    def _check_python_version(self, python_path: str | Path) -> dict[str, Any]:
        """
        Check the Python version of an interpreter.

        Args:
            python_path: Path to Python interpreter

        Returns:
            Dict with version info and validation result
        """
        try:
            cmd = [
                str(python_path),
                "-c",
                "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')",
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Failed to get Python version: {result.stderr.strip()}",
                }

            version_str = result.stdout.strip()
            parts = version_str.split(".")
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 else 0

            is_valid = (major, minor) >= MIN_PYTHON_VERSION

            return {
                "success": True,
                "version": version_str,
                "valid": is_valid,
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Timeout while checking Python version",
            }
        except FileNotFoundError:
            return {
                "success": False,
                "error": f"Python interpreter not found: {python_path}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Error checking Python version: {e}",
            }

    def _check_dependency(
        self, python_path: str | Path, module_name: str
    ) -> DependencyStatus:
        """
        Check if a dependency is importable.

        Args:
            python_path: Path to Python interpreter
            module_name: Name of the module to import

        Returns:
            DependencyStatus with import result
        """
        status = DependencyStatus(name=module_name)

        try:
            # Build import check script
            # Handle dotted module names (e.g., "google.generativeai")
            import_name = module_name.split(".")[0]
            # Use string concatenation to avoid f-string escaping issues
            version_code = (
                """
import sys
import json
try:
    import """
                + import_name
                + """
    version = getattr("""
                + import_name
                + """, '__version__', 'unknown')
    print(json.dumps({"installed": True, "version": version}))
except ImportError as e:
    print(json.dumps({"installed": False, "error": str(e)}))
"""
            )

            cmd = [str(python_path), "-c", version_code]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                try:
                    output = json.loads(result.stdout.strip())
                    status.installed = output.get("installed", False)
                    status.version = output.get("version")
                    status.error = output.get("error")
                except json.JSONDecodeError:
                    status.installed = False
                    status.error = f"Failed to parse output: {result.stdout.strip()}"
            else:
                status.installed = False
                status.error = result.stderr.strip() or "Unknown error"

        except subprocess.TimeoutExpired:
            status.error = "Timeout while checking dependency"
        except Exception as e:
            status.error = str(e)

        return status

    def validate_dual_environment(
        self,
        bundled_path: str | Path | None = None,
        venv_path: str | Path | None = None,
    ) -> DualValidationResult:
        """
        Validate both bundled and venv Python environments.

        Args:
            bundled_path: Path to bundled Python (auto-detected if None)
            venv_path: Path to venv Python (auto-detected if None)

        Returns:
            DualValidationResult with status for both environments
        """
        result = DualValidationResult()
        summaries = []

        # Validate bundled Python
        if bundled_path is None:
            bundled_path = get_bundled_python_path()

        if bundled_path:
            result.bundled = self.validate_environment(bundled_path)
            if result.bundled.success:
                summaries.append(f"Bundled Python ({bundled_path}): OK")
            else:
                summaries.append(
                    f"Bundled Python ({bundled_path}): FAILED - {', '.join(result.bundled.errors)}"
                )
        else:
            summaries.append(
                "Bundled Python: Not found (expected for development environment)"
            )

        # Validate venv Python
        if venv_path is None:
            venv_path = get_venv_python_path()

        if venv_path:
            result.venv = self.validate_environment(venv_path)
            if result.venv.success:
                summaries.append(f"Venv Python ({venv_path}): OK")
            else:
                summaries.append(
                    f"Venv Python ({venv_path}): FAILED - {', '.join(result.venv.errors)}"
                )
        else:
            summaries.append(
                "Venv Python: Not found (run 'pip install -r requirements.txt' in venv)"
            )

        # Overall success requires at least one valid environment
        # In production, both should be valid, but in dev mode venv is sufficient
        bundled_ok = result.bundled is not None and result.bundled.success
        venv_ok = result.venv is not None and result.venv.success

        result.success = bundled_ok or venv_ok
        result.summary = "\n".join(summaries)

        return result


# =============================================================================
# CLI
# =============================================================================


def main() -> int:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate Python environments for Auto-Claude",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Check both bundled and venv interpreters
    python services/environment_validator.py --check-bundled --check-venv

    # Check only venv interpreter
    python services/environment_validator.py --check-venv

    # Check a specific Python interpreter
    python services/environment_validator.py --python /path/to/python
        """,
    )
    parser.add_argument(
        "--check-bundled",
        action="store_true",
        help="Check bundled Python interpreter",
    )
    parser.add_argument(
        "--check-venv",
        action="store_true",
        help="Check venv Python interpreter",
    )
    parser.add_argument(
        "--python",
        type=Path,
        default=None,
        help="Path to specific Python interpreter to check",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed dependency information",
    )

    args = parser.parse_args()

    validator = EnvironmentValidator()

    # If no options specified, check current Python
    if not args.check_bundled and not args.check_venv and args.python is None:
        args.python = Path(sys.executable)

    # Single interpreter check
    if args.python:
        result = validator.validate_environment(args.python)
        return _output_single_result(result, args.json, args.verbose)

    # Dual interpreter check
    result = validator.validate_dual_environment(
        bundled_path=get_bundled_python_path() if args.check_bundled else None,
        venv_path=get_venv_python_path() if args.check_venv else None,
    )
    return _output_dual_result(result, args)


def _output_single_result(
    result: ValidationResult, as_json: bool, verbose: bool
) -> int:
    """Output single validation result."""
    if as_json:
        output = {
            "success": result.success,
            "python_path": result.python_path,
            "python_version": result.python_version,
            "python_version_valid": result.python_version_valid,
            "missing_required": result.missing_required,
            "missing_optional": result.missing_optional,
            "errors": result.errors,
            "warnings": result.warnings,
        }
        if verbose:
            output["dependencies"] = [
                {
                    "name": d.name,
                    "installed": d.installed,
                    "version": d.version,
                    "error": d.error,
                }
                for d in result.dependencies
            ]
        print(json.dumps(output, indent=2))
    else:
        status = "OK" if result.success else "FAILED"
        print(f"Python Environment Validation: {status}")
        print(f"  Path: {result.python_path}")
        print(
            f"  Version: {result.python_version} (valid: {result.python_version_valid})"
        )

        if verbose:
            print("\nDependencies:")
            for dep in result.dependencies:
                status_str = "OK" if dep.installed else "MISSING"
                version_str = f" ({dep.version})" if dep.version else ""
                error_str = f" - {dep.error}" if dep.error else ""
                print(f"  {dep.name}: {status_str}{version_str}{error_str}")

        if result.errors:
            print("\nErrors:")
            for error in result.errors:
                print(f"  - {error}")

        if result.warnings:
            print("\nWarnings:")
            for warning in result.warnings:
                print(f"  - {warning}")

    return 0 if result.success else 1


def _output_dual_result(result: DualValidationResult, args: Any) -> int:
    """Output dual validation result."""
    if args.json:
        output = {
            "success": result.success,
            "summary": result.summary,
            "bundled": None,
            "venv": None,
        }

        if result.bundled:
            output["bundled"] = {
                "success": result.bundled.success,
                "python_path": result.bundled.python_path,
                "python_version": result.bundled.python_version,
                "missing_required": result.bundled.missing_required,
                "errors": result.bundled.errors,
            }

        if result.venv:
            output["venv"] = {
                "success": result.venv.success,
                "python_path": result.venv.python_path,
                "python_version": result.venv.python_version,
                "missing_required": result.venv.missing_required,
                "errors": result.venv.errors,
            }

        print(json.dumps(output, indent=2))
    else:
        status = "OK" if result.success else "FAILED"
        print(f"Dual Environment Validation: {status}")
        print()
        print(result.summary)

        # Show detailed info if verbose
        if args.verbose:
            if result.bundled:
                print("\n--- Bundled Python Details ---")
                _output_single_result(result.bundled, False, True)

            if result.venv:
                print("\n--- Venv Python Details ---")
                _output_single_result(result.venv, False, True)

    if result.success:
        print("\nBoth interpreters validated successfully")

    return 0 if result.success else 1


if __name__ == "__main__":
    sys.exit(main())
