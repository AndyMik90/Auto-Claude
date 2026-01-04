"""
Hybrid Provider Manager
=======================

Manages switching between Claude (cloud) and Ollama (local) providers.
Supports automatic fallback, runtime switching, and hardware-optimized configurations.

Features:
- Runtime provider switching via environment variables or API
- Automatic fallback to Ollama when offline
- Hardware-optimized settings for different GPU/RAM configurations
- Provider status monitoring and health checks

Environment Variables:
    AI_PROVIDER: Primary provider (claude|ollama) - default: claude
    AI_FALLBACK_PROVIDER: Fallback provider when primary fails - default: ollama
    MAX_PARALLEL_AGENTS: Maximum concurrent agents (default: 12, recommended 4-6 for Ollama)
    OLLAMA_MODEL: Model for Ollama LLM tasks
    CLAUDE_MODEL: Model for Claude tasks
    HYBRID_AUTO_FALLBACK: Enable automatic fallback (true|false) - default: true
"""

import os
import urllib.request
import urllib.error
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timedelta
import threading


class Provider(str, Enum):
    """Supported AI providers."""
    CLAUDE = "claude"
    OLLAMA = "ollama"


class ProviderStatus(str, Enum):
    """Provider availability status."""
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    DEGRADED = "degraded"
    CHECKING = "checking"


@dataclass
class ProviderHealth:
    """Health status for a provider."""
    provider: Provider
    status: ProviderStatus
    last_check: datetime
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    model_available: bool = False


@dataclass
class HardwareProfile:
    """Hardware configuration profile for optimal performance."""
    name: str
    max_parallel_agents: int
    recommended_model: str
    context_window: int
    gpu_layers: int
    description: str


# Predefined hardware profiles
HARDWARE_PROFILES: Dict[str, HardwareProfile] = {
    "rtx_3080_ti": HardwareProfile(
        name="RTX 3080 Ti (12GB VRAM)",
        max_parallel_agents=6,
        recommended_model="llama3.1:8b-instruct-q4_K_M",
        context_window=8192,
        gpu_layers=-1,  # Auto-detect
        description="Optimized for NVIDIA RTX 3080 Ti with 12GB VRAM and 32GB RAM"
    ),
    "rtx_3090": HardwareProfile(
        name="RTX 3090 (24GB VRAM)",
        max_parallel_agents=8,
        recommended_model="llama3.1:70b-instruct-q4_K_M",
        context_window=16384,
        gpu_layers=-1,
        description="Optimized for NVIDIA RTX 3090 with 24GB VRAM"
    ),
    "rtx_4090": HardwareProfile(
        name="RTX 4090 (24GB VRAM)",
        max_parallel_agents=10,
        recommended_model="llama3.1:70b-instruct-q4_K_M",
        context_window=32768,
        gpu_layers=-1,
        description="Optimized for NVIDIA RTX 4090 with 24GB VRAM"
    ),
    "cpu_only": HardwareProfile(
        name="CPU Only",
        max_parallel_agents=2,
        recommended_model="llama3.2:3b",
        context_window=4096,
        gpu_layers=0,
        description="CPU-only mode for systems without GPU"
    ),
    "low_memory": HardwareProfile(
        name="Low Memory (16GB RAM)",
        max_parallel_agents=2,
        recommended_model="llama3.2:3b",
        context_window=4096,
        gpu_layers=-1,
        description="Optimized for systems with limited RAM (16GB)"
    ),
    "high_memory": HardwareProfile(
        name="High Memory (64GB+ RAM)",
        max_parallel_agents=12,
        recommended_model="llama3.1:70b-instruct-q4_K_M",
        context_window=32768,
        gpu_layers=-1,
        description="Optimized for high-memory systems (64GB+ RAM)"
    ),
}


@dataclass
class HybridProviderConfig:
    """Configuration for hybrid provider management."""
    
    # Primary and fallback providers
    primary_provider: Provider = Provider.CLAUDE
    fallback_provider: Provider = Provider.OLLAMA
    
    # Auto-fallback settings
    auto_fallback: bool = True
    fallback_timeout_seconds: float = 5.0
    
    # Provider-specific settings
    claude_model: str = "claude-3-5-sonnet-20241022"
    ollama_model: str = "llama3.1:8b-instruct-q4_K_M"
    ollama_base_url: str = "http://localhost:11434"
    
    # Hardware optimization
    max_parallel_agents: int = 12
    hardware_profile: Optional[str] = None
    
    # Context management
    ollama_context_window: int = 8192
    ollama_gpu_layers: int = -1
    
    @classmethod
    def from_env(cls) -> "HybridProviderConfig":
        """Create configuration from environment variables."""
        primary = os.environ.get("AI_PROVIDER", "claude").lower()
        fallback = os.environ.get("AI_FALLBACK_PROVIDER", "ollama").lower()
        
        # Parse provider enums
        try:
            primary_provider = Provider(primary)
        except ValueError:
            primary_provider = Provider.CLAUDE
            
        try:
            fallback_provider = Provider(fallback)
        except ValueError:
            fallback_provider = Provider.OLLAMA
        
        # Parse other settings
        auto_fallback = os.environ.get("HYBRID_AUTO_FALLBACK", "true").lower() in ("true", "1", "yes")
        
        try:
            max_agents = int(os.environ.get("MAX_PARALLEL_AGENTS", "12"))
        except ValueError:
            max_agents = 12
            
        try:
            context_window = int(os.environ.get("OLLAMA_NUM_CTX", "8192"))
        except ValueError:
            context_window = 8192
            
        try:
            gpu_layers = int(os.environ.get("OLLAMA_NUM_GPU", "-1"))
        except ValueError:
            gpu_layers = -1
        
        return cls(
            primary_provider=primary_provider,
            fallback_provider=fallback_provider,
            auto_fallback=auto_fallback,
            claude_model=os.environ.get("CLAUDE_MODEL", os.environ.get("AUTO_BUILD_MODEL", "claude-3-5-sonnet-20241022")),
            ollama_model=os.environ.get("OLLAMA_MODEL", os.environ.get("OLLAMA_LLM_MODEL", "llama3.1:8b-instruct-q4_K_M")),
            ollama_base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            max_parallel_agents=max_agents,
            hardware_profile=os.environ.get("HARDWARE_PROFILE"),
            ollama_context_window=context_window,
            ollama_gpu_layers=gpu_layers,
        )
    
    def apply_hardware_profile(self, profile_name: str) -> None:
        """Apply a predefined hardware profile."""
        if profile_name in HARDWARE_PROFILES:
            profile = HARDWARE_PROFILES[profile_name]
            self.max_parallel_agents = profile.max_parallel_agents
            self.ollama_model = profile.recommended_model
            self.ollama_context_window = profile.context_window
            self.ollama_gpu_layers = profile.gpu_layers
            self.hardware_profile = profile_name


class HybridProviderManager:
    """
    Manages hybrid Claude/Ollama provider switching.
    
    Provides automatic fallback, health monitoring, and runtime switching
    between cloud (Claude) and local (Ollama) AI providers.
    """
    
    def __init__(self, config: Optional[HybridProviderConfig] = None):
        """Initialize the hybrid provider manager."""
        self.config = config or HybridProviderConfig.from_env()
        self._health_cache: Dict[Provider, ProviderHealth] = {}
        self._health_check_interval = timedelta(seconds=30)
        self._lock = threading.Lock()
        self._current_provider: Provider = self.config.primary_provider
        self._fallback_active: bool = False
        
        # Apply hardware profile if specified
        if self.config.hardware_profile:
            self.config.apply_hardware_profile(self.config.hardware_profile)
    
    @property
    def current_provider(self) -> Provider:
        """Get the currently active provider."""
        return self._current_provider
    
    @property
    def is_fallback_active(self) -> bool:
        """Check if fallback provider is currently active."""
        return self._fallback_active
    
    def check_ollama_health(self, timeout: float = 5.0) -> ProviderHealth:
        """Check Ollama server health and model availability."""
        start_time = datetime.now()
        
        try:
            url = f"{self.config.ollama_base_url.rstrip('/')}/api/tags"
            req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
            
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = json.loads(response.read().decode())
                response_time = (datetime.now() - start_time).total_seconds() * 1000
                
                # Check if the configured model is available
                models = data.get("models", [])
                model_names = [m.get("name", "") for m in models]
                model_available = any(
                    self.config.ollama_model in name or name in self.config.ollama_model
                    for name in model_names
                )
                
                return ProviderHealth(
                    provider=Provider.OLLAMA,
                    status=ProviderStatus.AVAILABLE if model_available else ProviderStatus.DEGRADED,
                    last_check=datetime.now(),
                    response_time_ms=response_time,
                    model_available=model_available,
                    error_message=None if model_available else f"Model {self.config.ollama_model} not found"
                )
                
        except urllib.error.URLError as e:
            return ProviderHealth(
                provider=Provider.OLLAMA,
                status=ProviderStatus.UNAVAILABLE,
                last_check=datetime.now(),
                error_message=f"Connection failed: {str(e)}"
            )
        except Exception as e:
            return ProviderHealth(
                provider=Provider.OLLAMA,
                status=ProviderStatus.UNAVAILABLE,
                last_check=datetime.now(),
                error_message=str(e)
            )
    
    def check_claude_health(self, timeout: float = 5.0) -> ProviderHealth:
        """
        Check Claude availability.
        
        Note: Claude health is determined by OAuth token presence.
        Actual API availability is checked during requests.
        """
        start_time = datetime.now()
        
        # Check for OAuth token
        oauth_token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")
        auth_token = os.environ.get("ANTHROPIC_AUTH_TOKEN", "")
        
        has_auth = bool(oauth_token or auth_token)
        
        return ProviderHealth(
            provider=Provider.CLAUDE,
            status=ProviderStatus.AVAILABLE if has_auth else ProviderStatus.UNAVAILABLE,
            last_check=datetime.now(),
            response_time_ms=(datetime.now() - start_time).total_seconds() * 1000,
            model_available=has_auth,
            error_message=None if has_auth else "No Claude authentication configured"
        )
    
    def get_provider_health(self, provider: Provider, force_refresh: bool = False) -> ProviderHealth:
        """Get health status for a provider, using cache if available."""
        with self._lock:
            cached = self._health_cache.get(provider)
            
            if cached and not force_refresh:
                age = datetime.now() - cached.last_check
                if age < self._health_check_interval:
                    return cached
            
            # Perform health check
            if provider == Provider.OLLAMA:
                health = self.check_ollama_health()
            else:
                health = self.check_claude_health()
            
            self._health_cache[provider] = health
            return health
    
    def get_all_health_status(self) -> Dict[Provider, ProviderHealth]:
        """Get health status for all providers."""
        return {
            Provider.CLAUDE: self.get_provider_health(Provider.CLAUDE),
            Provider.OLLAMA: self.get_provider_health(Provider.OLLAMA),
        }
    
    def select_provider(self, task_type: Optional[str] = None) -> Provider:
        """
        Select the best available provider for a task.
        
        Args:
            task_type: Optional task type hint (e.g., "complex", "simple", "offline")
            
        Returns:
            The selected provider
        """
        # Check if offline mode is requested
        if task_type == "offline":
            return Provider.OLLAMA
        
        # Check primary provider health
        primary_health = self.get_provider_health(self.config.primary_provider)
        
        if primary_health.status == ProviderStatus.AVAILABLE:
            self._current_provider = self.config.primary_provider
            self._fallback_active = False
            return self._current_provider
        
        # Try fallback if enabled
        if self.config.auto_fallback:
            fallback_health = self.get_provider_health(self.config.fallback_provider)
            
            if fallback_health.status in (ProviderStatus.AVAILABLE, ProviderStatus.DEGRADED):
                self._current_provider = self.config.fallback_provider
                self._fallback_active = True
                return self._current_provider
        
        # Return primary even if unavailable (let the actual call handle the error)
        self._current_provider = self.config.primary_provider
        self._fallback_active = False
        return self._current_provider
    
    def switch_provider(self, provider: Provider) -> bool:
        """
        Manually switch to a specific provider.
        
        Args:
            provider: The provider to switch to
            
        Returns:
            True if switch was successful, False otherwise
        """
        health = self.get_provider_health(provider, force_refresh=True)
        
        if health.status in (ProviderStatus.AVAILABLE, ProviderStatus.DEGRADED):
            with self._lock:
                self._current_provider = provider
                self._fallback_active = (provider != self.config.primary_provider)
            return True
        
        return False
    
    def get_current_model(self) -> str:
        """Get the model name for the current provider."""
        if self._current_provider == Provider.CLAUDE:
            return self.config.claude_model
        return self.config.ollama_model
    
    def get_max_parallel_agents(self) -> int:
        """Get the maximum parallel agents for current configuration."""
        # Reduce parallel agents when using Ollama
        if self._current_provider == Provider.OLLAMA:
            return min(self.config.max_parallel_agents, 6)
        return self.config.max_parallel_agents
    
    def get_context_window(self) -> int:
        """Get the context window size for current provider."""
        if self._current_provider == Provider.OLLAMA:
            return self.config.ollama_context_window
        # Claude has much larger context windows
        return 200000
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get comprehensive information about current provider state."""
        return {
            "current_provider": self._current_provider.value,
            "fallback_active": self._fallback_active,
            "primary_provider": self.config.primary_provider.value,
            "fallback_provider": self.config.fallback_provider.value,
            "current_model": self.get_current_model(),
            "max_parallel_agents": self.get_max_parallel_agents(),
            "context_window": self.get_context_window(),
            "hardware_profile": self.config.hardware_profile,
            "auto_fallback_enabled": self.config.auto_fallback,
            "health": {
                p.value: {
                    "status": h.status.value,
                    "model_available": h.model_available,
                    "response_time_ms": h.response_time_ms,
                    "error": h.error_message,
                }
                for p, h in self.get_all_health_status().items()
            }
        }


# Global instance for easy access
_manager_instance: Optional[HybridProviderManager] = None


def get_hybrid_manager() -> HybridProviderManager:
    """Get or create the global hybrid provider manager instance."""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = HybridProviderManager()
    return _manager_instance


def reset_hybrid_manager() -> None:
    """Reset the global hybrid provider manager (useful for testing)."""
    global _manager_instance
    _manager_instance = None
