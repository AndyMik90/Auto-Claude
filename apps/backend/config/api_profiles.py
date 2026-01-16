"""
API Profile Management for Auto Claude
=======================================

Python interface to read and manage API profiles configured in the Electron frontend.

The frontend stores API profiles in ~/.config/Auto-Claude/profiles.json with the structure:
{
  "profiles": [
    {
      "id": "uuid",
      "name": "Profile Name",
      "baseUrl": "https://api.example.com",
      "apiKey": "sk-...",
      "models": {
        "default": "custom-model-name",
        "haiku": "custom-haiku-model",
        "sonnet": "custom-sonnet-model",
        "opus": "custom-opus-model"
      },
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000
    }
  ],
  "activeProfileId": "uuid" | null,
  "version": 1
}

When a profile is active, the backend should:
1. Set ANTHROPIC_AUTH_TOKEN to profile.apiKey
2. Set ANTHROPIC_BASE_URL to profile.baseUrl
3. Set model environment variables if profile.models is defined
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class APIProfile:
    """Represents an API profile configuration."""

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize API profile from JSON data.

        Args:
            data: Profile data from profiles.json
        """
        self.id: str = data["id"]
        self.name: str = data["name"]
        self.base_url: str = data["baseUrl"]
        self.api_key: str = data["apiKey"]
        self.models: Optional[Dict[str, str]] = data.get("models")
        self.created_at: int = data["createdAt"]
        self.updated_at: int = data["updatedAt"]

    def __repr__(self) -> str:
        """String representation (masks API key for security)."""
        masked_key = self.api_key[:8] + "..." + self.api_key[-4:] if len(self.api_key) > 12 else "***"
        return f"APIProfile(id={self.id}, name={self.name}, baseUrl={self.base_url}, apiKey={masked_key})"


class APIProfileManager:
    """Manages API profiles stored by the Electron frontend."""

    def __init__(self, config_path: Optional[Path] = None):
        """
        Initialize profile manager.

        Args:
            config_path: Optional path to profiles.json (defaults to ~/.config/Auto-Claude/profiles.json)
        """
        if config_path is None:
            # Default path matches Electron app (cross-platform)
            if os.name == "nt":  # Windows
                config_dir = Path(os.environ.get("APPDATA", "~/.config")) / "Auto-Claude"
            else:  # macOS/Linux
                config_dir = Path.home() / ".config" / "Auto-Claude"
            config_path = config_dir / "profiles.json"

        self.config_path = Path(config_path)
        self._profiles: Optional[Dict[str, APIProfile]] = None
        self._active_profile_id: Optional[str] = None

    def _load_profiles_file(self) -> Dict[str, Any]:
        """
        Load profiles from JSON file.

        Returns:
            Parsed JSON data

        Raises:
            FileNotFoundError: If profiles.json doesn't exist
            json.JSONDecodeError: If profiles.json is invalid
        """
        if not self.config_path.exists():
            logger.debug(f"Profiles file not found: {self.config_path}")
            return {"profiles": [], "activeProfileId": None, "version": 1}

        try:
            with open(self.config_path, encoding="utf-8") as f:
                data = json.load(f)
                logger.debug(f"Loaded {len(data.get('profiles', []))} profiles from {self.config_path}")
                return data
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse profiles file: {e}")
            raise

    def load_profiles(self) -> Dict[str, APIProfile]:
        """
        Load all profiles from file.

        Returns:
            Dict of profile_id -> APIProfile
        """
        data = self._load_profiles_file()

        profiles = {}
        for profile_data in data.get("profiles", []):
            try:
                profile = APIProfile(profile_data)
                profiles[profile.id] = profile
            except (KeyError, TypeError) as e:
                logger.warning(f"Skipping invalid profile: {e}")
                continue

        self._profiles = profiles
        self._active_profile_id = data.get("activeProfileId")

        return profiles

    def get_active_profile(self) -> Optional[APIProfile]:
        """
        Get the currently active profile.

        Returns:
            Active APIProfile, or None if no profile is active
        """
        if self._profiles is None:
            self.load_profiles()

        if self._active_profile_id is None:
            logger.debug("No active API profile - using OAuth token")
            return None

        profile = self._profiles.get(self._active_profile_id) if self._profiles else None

        if profile:
            logger.info(f"Using active API profile: {profile.name}")
        else:
            logger.warning(f"Active profile ID {self._active_profile_id} not found")

        return profile

    def get_profile_env_vars(self, profile: APIProfile) -> Dict[str, str]:
        """
        Convert an API profile to environment variables.

        Args:
            profile: The API profile to convert

        Returns:
            Dict of environment variable name -> value
        """
        env_vars = {
            "ANTHROPIC_AUTH_TOKEN": profile.api_key,
            "ANTHROPIC_BASE_URL": profile.base_url,
        }

        # Add model overrides if specified
        if profile.models:
            if "default" in profile.models:
                env_vars["ANTHROPIC_MODEL"] = profile.models["default"]
            if "haiku" in profile.models:
                env_vars["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = profile.models["haiku"]
            if "sonnet" in profile.models:
                env_vars["ANTHROPIC_DEFAULT_SONNET_MODEL"] = profile.models["sonnet"]
            if "opus" in profile.models:
                env_vars["ANTHROPIC_DEFAULT_OPUS_MODEL"] = profile.models["opus"]

        return env_vars

    def apply_active_profile_to_env(self) -> bool:
        """
        Apply active profile to current process environment.

        This modifies os.environ to set ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL,
        and any custom model mappings from the active profile.

        Returns:
            True if a profile was applied, False if using OAuth (no active profile)
        """
        profile = self.get_active_profile()

        if profile is None:
            return False

        # Apply profile environment variables
        env_vars = self.get_profile_env_vars(profile)
        for key, value in env_vars.items():
            os.environ[key] = value
            logger.debug(f"Set {key} from API profile '{profile.name}'")

        return True


# Global singleton instance
_profile_manager: Optional[APIProfileManager] = None


def get_profile_manager() -> APIProfileManager:
    """
    Get the global API profile manager instance.

    Returns:
        Singleton APIProfileManager instance
    """
    global _profile_manager
    if _profile_manager is None:
        _profile_manager = APIProfileManager()
    return _profile_manager


def get_active_profile() -> Optional[APIProfile]:
    """
    Get the currently active API profile.

    Convenience function that uses the global profile manager.

    Returns:
        Active APIProfile, or None if no profile is active
    """
    return get_profile_manager().get_active_profile()


def apply_active_profile() -> bool:
    """
    Apply active profile to current process environment.

    Convenience function that uses the global profile manager.

    Returns:
        True if a profile was applied, False if using OAuth
    """
    return get_profile_manager().apply_active_profile_to_env()
