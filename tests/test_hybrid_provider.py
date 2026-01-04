"""
Tests for Hybrid Provider Manager
=================================

Tests the hybrid Claude/Ollama provider switching functionality.
"""

import os
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add the backend to the path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'backend'))

from integrations.hybrid_provider import (
    Provider,
    ProviderStatus,
    ProviderHealth,
    HardwareProfile,
    HybridProviderConfig,
    HybridProviderManager,
    HARDWARE_PROFILES,
    get_hybrid_manager,
    reset_hybrid_manager,
)


class TestProvider:
    """Tests for Provider enum."""
    
    def test_provider_values(self):
        """Test provider enum values."""
        assert Provider.CLAUDE.value == "claude"
        assert Provider.OLLAMA.value == "ollama"
    
    def test_provider_from_string(self):
        """Test creating provider from string."""
        assert Provider("claude") == Provider.CLAUDE
        assert Provider("ollama") == Provider.OLLAMA


class TestProviderStatus:
    """Tests for ProviderStatus enum."""
    
    def test_status_values(self):
        """Test status enum values."""
        assert ProviderStatus.AVAILABLE.value == "available"
        assert ProviderStatus.UNAVAILABLE.value == "unavailable"
        assert ProviderStatus.DEGRADED.value == "degraded"
        assert ProviderStatus.CHECKING.value == "checking"


class TestHardwareProfiles:
    """Tests for hardware profiles."""
    
    def test_rtx_3080_ti_profile(self):
        """Test RTX 3080 Ti profile settings."""
        profile = HARDWARE_PROFILES["rtx_3080_ti"]
        assert profile.max_parallel_agents == 6
        assert profile.context_window == 8192
        assert "3080" in profile.name
    
    def test_cpu_only_profile(self):
        """Test CPU-only profile settings."""
        profile = HARDWARE_PROFILES["cpu_only"]
        assert profile.max_parallel_agents == 2
        assert profile.gpu_layers == 0
        assert profile.context_window == 4096
    
    def test_all_profiles_have_required_fields(self):
        """Test all profiles have required fields."""
        for name, profile in HARDWARE_PROFILES.items():
            assert profile.name, f"Profile {name} missing name"
            assert profile.max_parallel_agents > 0, f"Profile {name} has invalid max_parallel_agents"
            assert profile.recommended_model, f"Profile {name} missing recommended_model"
            assert profile.context_window > 0, f"Profile {name} has invalid context_window"


class TestHybridProviderConfig:
    """Tests for HybridProviderConfig."""
    
    def test_default_config(self):
        """Test default configuration values."""
        config = HybridProviderConfig()
        assert config.primary_provider == Provider.CLAUDE
        assert config.fallback_provider == Provider.OLLAMA
        assert config.auto_fallback is True
        assert config.max_parallel_agents == 12
    
    def test_from_env_defaults(self):
        """Test config from environment with defaults."""
        # Clear relevant env vars
        env_vars = [
            "AI_PROVIDER", "AI_FALLBACK_PROVIDER", "HYBRID_AUTO_FALLBACK",
            "MAX_PARALLEL_AGENTS", "OLLAMA_NUM_CTX", "OLLAMA_NUM_GPU",
        ]
        with patch.dict(os.environ, {}, clear=True):
            for var in env_vars:
                os.environ.pop(var, None)
            
            config = HybridProviderConfig.from_env()
            assert config.primary_provider == Provider.CLAUDE
            assert config.fallback_provider == Provider.OLLAMA
    
    def test_from_env_custom(self):
        """Test config from environment with custom values."""
        with patch.dict(os.environ, {
            "AI_PROVIDER": "ollama",
            "AI_FALLBACK_PROVIDER": "claude",
            "MAX_PARALLEL_AGENTS": "4",
            "OLLAMA_NUM_CTX": "16384",
            "HYBRID_AUTO_FALLBACK": "false",
        }):
            config = HybridProviderConfig.from_env()
            assert config.primary_provider == Provider.OLLAMA
            assert config.fallback_provider == Provider.CLAUDE
            assert config.max_parallel_agents == 4
            assert config.ollama_context_window == 16384
            assert config.auto_fallback is False
    
    def test_apply_hardware_profile(self):
        """Test applying a hardware profile."""
        config = HybridProviderConfig()
        config.apply_hardware_profile("rtx_3080_ti")
        
        assert config.max_parallel_agents == 6
        assert config.ollama_context_window == 8192
        assert config.hardware_profile == "rtx_3080_ti"
    
    def test_apply_invalid_profile(self):
        """Test applying an invalid profile does nothing."""
        config = HybridProviderConfig()
        original_agents = config.max_parallel_agents
        
        config.apply_hardware_profile("nonexistent_profile")
        
        assert config.max_parallel_agents == original_agents
        assert config.hardware_profile is None


class TestHybridProviderManager:
    """Tests for HybridProviderManager."""
    
    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        reset_hybrid_manager()
        return HybridProviderManager()
    
    def test_initial_state(self, manager):
        """Test initial manager state."""
        assert manager.current_provider == Provider.CLAUDE
        assert manager.is_fallback_active is False
    
    def test_check_ollama_health_unavailable(self, manager):
        """Test Ollama health check when unavailable."""
        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.side_effect = Exception("Connection refused")
            
            health = manager.check_ollama_health(timeout=1.0)
            
            assert health.provider == Provider.OLLAMA
            assert health.status == ProviderStatus.UNAVAILABLE
            assert health.error_message is not None
    
    def test_check_ollama_health_available(self, manager):
        """Test Ollama health check when available."""
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"models": [{"name": "llama3.1:8b-instruct-q4_K_M"}]}'
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        
        with patch('urllib.request.urlopen', return_value=mock_response):
            health = manager.check_ollama_health(timeout=1.0)
            
            assert health.provider == Provider.OLLAMA
            assert health.status == ProviderStatus.AVAILABLE
            assert health.model_available is True
    
    def test_check_claude_health_no_token(self, manager):
        """Test Claude health check without token."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("CLAUDE_CODE_OAUTH_TOKEN", None)
            os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)
            
            health = manager.check_claude_health()
            
            assert health.provider == Provider.CLAUDE
            assert health.status == ProviderStatus.UNAVAILABLE
    
    def test_check_claude_health_with_token(self, manager):
        """Test Claude health check with token."""
        with patch.dict(os.environ, {"CLAUDE_CODE_OAUTH_TOKEN": "test-token"}):
            health = manager.check_claude_health()
            
            assert health.provider == Provider.CLAUDE
            assert health.status == ProviderStatus.AVAILABLE
    
    def test_select_provider_primary_available(self, manager):
        """Test provider selection when primary is available."""
        with patch.dict(os.environ, {"CLAUDE_CODE_OAUTH_TOKEN": "test-token"}):
            provider = manager.select_provider()
            
            assert provider == Provider.CLAUDE
            assert manager.is_fallback_active is False
    
    def test_select_provider_offline_mode(self, manager):
        """Test provider selection for offline mode."""
        provider = manager.select_provider(task_type="offline")
        
        assert provider == Provider.OLLAMA
    
    def test_switch_provider_success(self, manager):
        """Test manual provider switch."""
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"models": [{"name": "llama3.1:8b-instruct-q4_K_M"}]}'
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        
        with patch('urllib.request.urlopen', return_value=mock_response):
            success = manager.switch_provider(Provider.OLLAMA)
            
            assert success is True
            assert manager.current_provider == Provider.OLLAMA
    
    def test_get_current_model_claude(self, manager):
        """Test getting current model for Claude."""
        manager._current_provider = Provider.CLAUDE
        model = manager.get_current_model()
        
        assert "claude" in model.lower()
    
    def test_get_current_model_ollama(self, manager):
        """Test getting current model for Ollama."""
        manager._current_provider = Provider.OLLAMA
        model = manager.get_current_model()
        
        assert model == manager.config.ollama_model
    
    def test_get_max_parallel_agents_claude(self, manager):
        """Test max agents for Claude."""
        manager._current_provider = Provider.CLAUDE
        max_agents = manager.get_max_parallel_agents()
        
        assert max_agents == manager.config.max_parallel_agents
    
    def test_get_max_parallel_agents_ollama(self, manager):
        """Test max agents for Ollama (should be limited)."""
        manager.config.max_parallel_agents = 12
        manager._current_provider = Provider.OLLAMA
        max_agents = manager.get_max_parallel_agents()
        
        assert max_agents <= 6  # Ollama should be limited
    
    def test_get_context_window_claude(self, manager):
        """Test context window for Claude."""
        manager._current_provider = Provider.CLAUDE
        context = manager.get_context_window()
        
        assert context == 200000  # Claude's large context
    
    def test_get_context_window_ollama(self, manager):
        """Test context window for Ollama."""
        manager._current_provider = Provider.OLLAMA
        context = manager.get_context_window()
        
        assert context == manager.config.ollama_context_window
    
    def test_get_provider_info(self, manager):
        """Test getting comprehensive provider info."""
        info = manager.get_provider_info()
        
        assert "current_provider" in info
        assert "fallback_active" in info
        assert "current_model" in info
        assert "max_parallel_agents" in info
        assert "context_window" in info
        assert "health" in info


class TestGlobalManager:
    """Tests for global manager instance."""
    
    def test_get_hybrid_manager_singleton(self):
        """Test that get_hybrid_manager returns singleton."""
        reset_hybrid_manager()
        
        manager1 = get_hybrid_manager()
        manager2 = get_hybrid_manager()
        
        assert manager1 is manager2
    
    def test_reset_hybrid_manager(self):
        """Test resetting the global manager."""
        manager1 = get_hybrid_manager()
        reset_hybrid_manager()
        manager2 = get_hybrid_manager()
        
        assert manager1 is not manager2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
