"""
Git Provider Factory
====================

Factory for creating provider instances based on configuration.
Provides a unified interface for GitHub, GitLab, Bitbucket, etc.
"""

from .factory import create_provider, ProviderConfig

__all__ = ["create_provider", "ProviderConfig"]
