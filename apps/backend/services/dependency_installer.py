#!/usr/bin/env python3
"""
Dependency Installer Module
===========================

Installs requirements.txt to both bundled and venv Python interpreters.
Ensures dependencies are synchronized across all Python environments used by Auto-Claude.

The dependency installer is used by:
- Startup sequence: To ensure both interpreters have required packages
- Manual recovery: To fix dependency mismatches between interpreters
- CI/CD: To verify dependency synchronization

Usage:
    # Verify dependencies are synchronized (no installation)
    python services/dependency_installer.py --verify-only

    # Install to both interpreters
    python services/dependency_installer.py --install-all

    # Install to specific interpreter
    python services/dependency_installer.py --install-bundled
    python services/dependency_installer.py --install-venv

    # Validate from code
    from dependency_installer import DependencyInstaller

    installer = DependencyInstaller()
    result = installer.install_to_both()
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

# Default timeout for pip operations (5 minutes)
DEFAULT_PIP_TIMEOUT = 300

# Packages to verify after installation
VERIFICATION_PACKAGES = [
    "claude_agent_sdk",
    "dotenv",
    "pydantic",
]


# =============================================================================
# DATA CLASSES
# =============================================================================


@dataclass
class PackageInfo:
    """
    Information about an installed package.

    Attributes:
        name: Package name
        version: Installed version
    """

    name: str
    version: str


@dataclass
class InstallationResult:
    """
    Result of a single interpreter installation.

    Attributes:
        success: Whether installation succeeded
        interpreter_path: Path to the Python interpreter
        interpreter_type: Type of interpreter (bundled, venv)
        packages_installed: List of packages that were installed
        packages_failed: List of packages that failed to install
        stdout: Standard output from pip
        stderr: Standard error from pip
        errors: List of error messages
    """

    success: bool = False
    interpreter_path: str = ""
    interpreter_type: str = ""
    packages_installed: list[str] = field(default_factory=list)
    packages_failed: list[str] = field(default_factory=list)
    stdout: str = ""
    stderr: str = ""
    errors: list[str] = field(default_factory=list)


@dataclass
class SyncResult:
    """
    Result of dependency synchronization across interpreters.

    Attributes:
        success: Whether all interpreters are synchronized
        bundled: Installation result for bundled Python
        venv: Installation result for venv Python
        synchronized: Whether both interpreters have same packages
        differences: List of package differences between interpreters
        summary: Human-readable summary
    """

    success: bool = False
    bundled: InstallationResult | None = None
    venv: InstallationResult | None = None
    synchronized: bool = False
    differences: list[str] = field(default_factory=list)
    summary: str = ""


@dataclass
class VerificationResult:
    """
    Result of dependency verification (no installation).

    Attributes:
        success: Whether verification passed
        bundled_packages: Packages installed in bundled Python
        venv_packages: Packages installed in venv Python
        synchronized: Whether both have same packages
        differences: List of differences found
        missing_in_bundled: Packages in venv but not bundled
        missing_in_venv: Packages in bundled but not venv
        summary: Human-readable summary
    """

    success: bool = False
    bundled_packages: dict[str, str] = field(default_factory=dict)
    venv_packages: dict[str, str] = field(default_factory=dict)
    synchronized: bool = False
    differences: list[str] = field(default_factory=list)
    missing_in_bundled: list[str] = field(default_factory=list)
    missing_in_venv: list[str] = field(default_factory=list)
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


def get_requirements_path() -> Path | None:
    """
    Get the path to requirements.txt.

    Searches for requirements.txt in common locations.

    Returns:
        Path to requirements.txt, or None if not found.
    """
    # Try relative to this script
    script_dir = Path(__file__).parent
    candidates = [
        script_dir.parent / "requirements.txt",  # apps/backend/requirements.txt
        script_dir / "requirements.txt",
        Path.cwd() / "requirements.txt",
    ]

    # Platform-specific bundled locations
    system = platform.system()
    if system == "Darwin":
        candidates.extend(
            [
                Path(
                    "/Applications/Auto-Claude.app/Contents/Resources/auto-claude/requirements.txt"
                ),
                Path(
                    "/Applications/Auto-Claude.app/Contents/Resources/backend/requirements.txt"
                ),
            ]
        )
    elif system == "Windows":
        appdata_local = Path.home() / "AppData/Local"
        candidates.extend(
            [
                appdata_local
                / "Programs/auto-claude-ui/resources/auto-claude/requirements.txt",
                appdata_local
                / "Programs/auto-claude-ui/resources/backend/requirements.txt",
            ]
        )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


# =============================================================================
# DEPENDENCY INSTALLER
# =============================================================================


class DependencyInstaller:
    """
    Installs and synchronizes dependencies across Python interpreters.

    Handles:
    - Installing requirements.txt to bundled Python
    - Installing requirements.txt to venv Python
    - Verifying both interpreters have synchronized packages
    - Detailed error reporting for installation failures
    """

    def __init__(
        self,
        requirements_path: str | Path | None = None,
        timeout: int = DEFAULT_PIP_TIMEOUT,
    ) -> None:
        """
        Initialize the dependency installer.

        Args:
            requirements_path: Path to requirements.txt (auto-detected if None)
            timeout: Timeout for pip operations in seconds
        """
        self.requirements_path = (
            Path(requirements_path) if requirements_path else get_requirements_path()
        )
        self.timeout = timeout

    def install_to_interpreter(
        self,
        python_path: str | Path,
        interpreter_type: str = "unknown",
    ) -> InstallationResult:
        """
        Install requirements to a specific Python interpreter.

        Args:
            python_path: Path to the Python interpreter
            interpreter_type: Label for the interpreter (bundled, venv)

        Returns:
            InstallationResult with detailed status
        """
        result = InstallationResult(
            interpreter_path=str(python_path),
            interpreter_type=interpreter_type,
        )

        if not self.requirements_path:
            result.errors.append("requirements.txt not found")
            return result

        if not self.requirements_path.exists():
            result.errors.append(
                f"requirements.txt not found at: {self.requirements_path}"
            )
            return result

        python_path = Path(python_path)
        if not python_path.exists():
            result.errors.append(f"Python interpreter not found: {python_path}")
            return result

        # Build pip install command
        cmd = [
            str(python_path),
            "-m",
            "pip",
            "install",
            "-r",
            str(self.requirements_path),
            "--quiet",  # Reduce output noise
        ]

        try:
            proc_result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )

            result.stdout = proc_result.stdout
            result.stderr = proc_result.stderr

            if proc_result.returncode == 0:
                result.success = True
                # Get list of installed packages
                result.packages_installed = self._get_installed_packages(python_path)
            else:
                result.success = False
                result.errors.append(
                    f"pip install failed with exit code {proc_result.returncode}"
                )
                if proc_result.stderr:
                    result.errors.append(f"STDERR: {proc_result.stderr.strip()}")
                if proc_result.stdout:
                    result.errors.append(f"STDOUT: {proc_result.stdout.strip()}")

        except subprocess.TimeoutExpired:
            result.errors.append(f"pip install timed out after {self.timeout} seconds")
        except FileNotFoundError:
            result.errors.append(f"Python interpreter not found: {python_path}")
        except Exception as e:
            result.errors.append(f"Installation error: {e}")

        return result

    def install_to_bundled(self) -> InstallationResult:
        """
        Install requirements to the bundled Python interpreter.

        Returns:
            InstallationResult with installation status
        """
        bundled_path = get_bundled_python_path()

        if not bundled_path:
            result = InstallationResult(interpreter_type="bundled")
            result.errors.append(
                "Bundled Python interpreter not found. "
                "This is expected in development environments."
            )
            return result

        return self.install_to_interpreter(bundled_path, "bundled")

    def install_to_venv(self) -> InstallationResult:
        """
        Install requirements to the venv Python interpreter.

        Returns:
            InstallationResult with installation status
        """
        venv_path = get_venv_python_path()

        if not venv_path:
            result = InstallationResult(interpreter_type="venv")
            result.errors.append(
                "Venv Python interpreter not found. "
                "Please create a venv first using the app's Python environment manager."
            )
            return result

        return self.install_to_interpreter(venv_path, "venv")

    def install_to_both(self) -> SyncResult:
        """
        Install requirements to both bundled and venv interpreters.

        Returns:
            SyncResult with status for both interpreters
        """
        result = SyncResult()
        summaries = []

        # Install to bundled Python
        bundled_path = get_bundled_python_path()
        if bundled_path:
            result.bundled = self.install_to_interpreter(bundled_path, "bundled")
            if result.bundled.success:
                summaries.append(f"Bundled Python ({bundled_path}): Installation OK")
            else:
                summaries.append(
                    f"Bundled Python ({bundled_path}): FAILED - {', '.join(result.bundled.errors)}"
                )
        else:
            summaries.append(
                "Bundled Python: Not found (expected for development environment)"
            )

        # Install to venv Python
        venv_path = get_venv_python_path()
        if venv_path:
            result.venv = self.install_to_interpreter(venv_path, "venv")
            if result.venv.success:
                summaries.append(f"Venv Python ({venv_path}): Installation OK")
            else:
                summaries.append(
                    f"Venv Python ({venv_path}): FAILED - {', '.join(result.venv.errors)}"
                )
        else:
            summaries.append("Venv Python: Not found (create venv first)")

        # Check synchronization after installation
        verification = self.verify_synchronization()
        result.synchronized = verification.synchronized
        result.differences = verification.differences

        # Overall success requires at least one interpreter installed
        bundled_ok = result.bundled is not None and result.bundled.success
        venv_ok = result.venv is not None and result.venv.success

        result.success = bundled_ok or venv_ok
        result.summary = "\n".join(summaries)

        if result.synchronized:
            result.summary += "\n\nDependencies synchronized across both interpreters"
        elif result.differences:
            result.summary += "\n\nSynchronization differences:\n  " + "\n  ".join(
                result.differences
            )

        return result

    def verify_synchronization(
        self,
        bundled_path: str | Path | None = None,
        venv_path: str | Path | None = None,
    ) -> VerificationResult:
        """
        Verify that dependencies are synchronized across interpreters.

        Does not install anything, only checks current state.

        Args:
            bundled_path: Path to bundled Python (auto-detected if None)
            venv_path: Path to venv Python (auto-detected if None)

        Returns:
            VerificationResult with synchronization status
        """
        result = VerificationResult()
        summaries = []

        # Get bundled packages
        if bundled_path is None:
            bundled_path = get_bundled_python_path()

        if bundled_path and Path(bundled_path).exists():
            result.bundled_packages = self._get_packages_dict(bundled_path)
            summaries.append(f"Bundled Python: {len(result.bundled_packages)} packages")
        else:
            summaries.append("Bundled Python: Not available")

        # Get venv packages
        if venv_path is None:
            venv_path = get_venv_python_path()

        if venv_path and Path(venv_path).exists():
            result.venv_packages = self._get_packages_dict(venv_path)
            summaries.append(f"Venv Python: {len(result.venv_packages)} packages")
        else:
            summaries.append("Venv Python: Not available")

        # Compare packages (only if both are available)
        if result.bundled_packages and result.venv_packages:
            # Check for critical packages in both
            for pkg in VERIFICATION_PACKAGES:
                pkg_lower = pkg.lower().replace("_", "-")
                in_bundled = any(
                    p.lower().replace("_", "-") == pkg_lower
                    for p in result.bundled_packages
                )
                in_venv = any(
                    p.lower().replace("_", "-") == pkg_lower
                    for p in result.venv_packages
                )

                if not in_bundled and in_venv:
                    result.missing_in_bundled.append(pkg)
                    result.differences.append(f"{pkg}: missing in bundled")
                elif in_bundled and not in_venv:
                    result.missing_in_venv.append(pkg)
                    result.differences.append(f"{pkg}: missing in venv")

            # Check version differences for common packages
            bundled_lower = {
                k.lower().replace("_", "-"): v
                for k, v in result.bundled_packages.items()
            }
            venv_lower = {
                k.lower().replace("_", "-"): v for k, v in result.venv_packages.items()
            }

            for pkg in set(bundled_lower.keys()) & set(venv_lower.keys()):
                if bundled_lower[pkg] != venv_lower[pkg]:
                    result.differences.append(
                        f"{pkg}: bundled={bundled_lower[pkg]}, venv={venv_lower[pkg]}"
                    )

            result.synchronized = (
                len(result.missing_in_bundled) == 0 and len(result.missing_in_venv) == 0
            )
        elif result.bundled_packages or result.venv_packages:
            # Only one interpreter available
            result.synchronized = True  # Can't compare, assume OK
            summaries.append("Note: Only one interpreter available for comparison")
        else:
            # Neither interpreter available
            result.synchronized = False
            summaries.append("Warning: No interpreters found to verify")

        result.success = result.synchronized
        result.summary = "\n".join(summaries)

        if result.synchronized:
            result.summary += "\n\nDependencies synchronized across both interpreters"

        return result

    def _get_installed_packages(self, python_path: str | Path) -> list[str]:
        """
        Get list of installed package names.

        Args:
            python_path: Path to Python interpreter

        Returns:
            List of package names
        """
        packages_dict = self._get_packages_dict(python_path)
        return list(packages_dict.keys())

    def _get_packages_dict(self, python_path: str | Path) -> dict[str, str]:
        """
        Get dictionary of installed packages and versions.

        Args:
            python_path: Path to Python interpreter

        Returns:
            Dictionary mapping package names to versions
        """
        packages: dict[str, str] = {}

        try:
            cmd = [
                str(python_path),
                "-m",
                "pip",
                "list",
                "--format=json",
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                try:
                    package_list = json.loads(result.stdout)
                    for pkg in package_list:
                        packages[pkg.get("name", "")] = pkg.get("version", "")
                except json.JSONDecodeError:
                    pass

        except Exception:
            pass

        return packages


# =============================================================================
# CLI
# =============================================================================


def main() -> int:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Install and synchronize dependencies across Python interpreters",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Verify dependencies are synchronized (no installation)
    python services/dependency_installer.py --verify-only

    # Install to both interpreters
    python services/dependency_installer.py --install-all

    # Install to specific interpreter
    python services/dependency_installer.py --install-bundled
    python services/dependency_installer.py --install-venv

    # Specify custom requirements file
    python services/dependency_installer.py --install-all --requirements /path/to/requirements.txt
        """,
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify synchronization, don't install anything",
    )
    parser.add_argument(
        "--install-all",
        action="store_true",
        help="Install to both bundled and venv interpreters",
    )
    parser.add_argument(
        "--install-bundled",
        action="store_true",
        help="Install to bundled Python interpreter",
    )
    parser.add_argument(
        "--install-venv",
        action="store_true",
        help="Install to venv Python interpreter",
    )
    parser.add_argument(
        "--requirements",
        type=Path,
        default=None,
        help="Path to requirements.txt file",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_PIP_TIMEOUT,
        help=f"Timeout for pip operations in seconds (default: {DEFAULT_PIP_TIMEOUT})",
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
        help="Show detailed package information",
    )

    args = parser.parse_args()

    installer = DependencyInstaller(
        requirements_path=args.requirements,
        timeout=args.timeout,
    )

    # Default to verify-only if no action specified
    if not any(
        [args.verify_only, args.install_all, args.install_bundled, args.install_venv]
    ):
        args.verify_only = True

    # Handle verify-only mode
    if args.verify_only:
        result = installer.verify_synchronization()
        return _output_verification_result(result, args.json, args.verbose)

    # Handle installation modes
    if args.install_all:
        result = installer.install_to_both()
        return _output_sync_result(result, args.json, args.verbose)

    if args.install_bundled:
        result = installer.install_to_bundled()
        return _output_installation_result(result, args.json, args.verbose)

    if args.install_venv:
        result = installer.install_to_venv()
        return _output_installation_result(result, args.json, args.verbose)

    return 0


def _output_verification_result(
    result: VerificationResult, as_json: bool, verbose: bool
) -> int:
    """Output verification result."""
    if as_json:
        output: dict[str, Any] = {
            "success": result.success,
            "synchronized": result.synchronized,
            "differences": result.differences,
            "missing_in_bundled": result.missing_in_bundled,
            "missing_in_venv": result.missing_in_venv,
        }
        if verbose:
            output["bundled_packages"] = result.bundled_packages
            output["venv_packages"] = result.venv_packages
        print(json.dumps(output, indent=2))
    else:
        status = "OK" if result.success else "NEEDS SYNC"
        print(f"Dependency Verification: {status}")
        print()
        print(result.summary)

        if result.differences:
            print("\nDifferences found:")
            for diff in result.differences:
                print(f"  - {diff}")

        if verbose:
            if result.bundled_packages:
                print(f"\nBundled packages ({len(result.bundled_packages)}):")
                for pkg, version in sorted(result.bundled_packages.items())[:10]:
                    print(f"  {pkg}=={version}")
                if len(result.bundled_packages) > 10:
                    print(f"  ... and {len(result.bundled_packages) - 10} more")

            if result.venv_packages:
                print(f"\nVenv packages ({len(result.venv_packages)}):")
                for pkg, version in sorted(result.venv_packages.items())[:10]:
                    print(f"  {pkg}=={version}")
                if len(result.venv_packages) > 10:
                    print(f"  ... and {len(result.venv_packages) - 10} more")

        if result.success:
            print("\nDependencies synchronized across both interpreters")

    return 0 if result.success else 1


def _output_installation_result(
    result: InstallationResult, as_json: bool, verbose: bool
) -> int:
    """Output single installation result."""
    if as_json:
        output: dict[str, Any] = {
            "success": result.success,
            "interpreter_path": result.interpreter_path,
            "interpreter_type": result.interpreter_type,
            "errors": result.errors,
        }
        if verbose:
            output["packages_installed"] = result.packages_installed
            output["stdout"] = result.stdout
            output["stderr"] = result.stderr
        print(json.dumps(output, indent=2))
    else:
        status = "OK" if result.success else "FAILED"
        print(f"Dependency Installation ({result.interpreter_type}): {status}")
        print(f"  Interpreter: {result.interpreter_path}")

        if result.errors:
            print("\nErrors:")
            for error in result.errors:
                print(f"  - {error}")

        if verbose and result.packages_installed:
            print(f"\nInstalled packages ({len(result.packages_installed)}):")
            for pkg in result.packages_installed[:10]:
                print(f"  {pkg}")
            if len(result.packages_installed) > 10:
                print(f"  ... and {len(result.packages_installed) - 10} more")

    return 0 if result.success else 1


def _output_sync_result(result: SyncResult, as_json: bool, verbose: bool) -> int:
    """Output sync result for both interpreters."""
    if as_json:
        output: dict[str, Any] = {
            "success": result.success,
            "synchronized": result.synchronized,
            "differences": result.differences,
            "bundled": None,
            "venv": None,
        }

        if result.bundled:
            output["bundled"] = {
                "success": result.bundled.success,
                "interpreter_path": result.bundled.interpreter_path,
                "errors": result.bundled.errors,
            }
            if verbose:
                output["bundled"]["packages_installed"] = (
                    result.bundled.packages_installed
                )

        if result.venv:
            output["venv"] = {
                "success": result.venv.success,
                "interpreter_path": result.venv.interpreter_path,
                "errors": result.venv.errors,
            }
            if verbose:
                output["venv"]["packages_installed"] = result.venv.packages_installed

        print(json.dumps(output, indent=2))
    else:
        status = "OK" if result.success else "FAILED"
        print(f"Dependency Installation (both): {status}")
        print()
        print(result.summary)

        if verbose:
            if result.bundled and result.bundled.packages_installed:
                print(f"\nBundled packages ({len(result.bundled.packages_installed)}):")
                for pkg in result.bundled.packages_installed[:5]:
                    print(f"  {pkg}")

            if result.venv and result.venv.packages_installed:
                print(f"\nVenv packages ({len(result.venv.packages_installed)}):")
                for pkg in result.venv.packages_installed[:5]:
                    print(f"  {pkg}")

    return 0 if result.success else 1


if __name__ == "__main__":
    sys.exit(main())
