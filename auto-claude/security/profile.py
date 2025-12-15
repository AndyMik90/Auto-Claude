"""
Security Profile Management
============================

Manages security profiles for projects, including caching and validation.
Uses project_analyzer to create dynamic security profiles based on detected stacks.
"""

from pathlib import Path
from typing import Optional

from project_analyzer import (
    SecurityProfile,
    get_or_create_profile,
    is_command_allowed,
    needs_validation,
    BASE_COMMANDS,
)


# =============================================================================
# GLOBAL STATE
# =============================================================================

# Cache the security profile to avoid re-analyzing on every command
_cached_profile: Optional[SecurityProfile] = None
_cached_project_dir: Optional[Path] = None


def get_security_profile(project_dir: Path, spec_dir: Optional[Path] = None) -> SecurityProfile:
    """
    Get the security profile for a project, using cache when possible.

    Args:
        project_dir: Project root directory
        spec_dir: Optional spec directory

    Returns:
        SecurityProfile for the project
    """
    global _cached_profile, _cached_project_dir

    project_dir = Path(project_dir).resolve()

    # Return cached profile if same project
    if _cached_profile is not None and _cached_project_dir == project_dir:
        return _cached_profile

    # Analyze and cache
    _cached_profile = get_or_create_profile(project_dir, spec_dir)
    _cached_project_dir = project_dir

    return _cached_profile


def reset_profile_cache() -> None:
    """Reset the cached profile (useful for testing or re-analysis)."""
    global _cached_profile, _cached_project_dir
    _cached_profile = None
    _cached_project_dir = None
