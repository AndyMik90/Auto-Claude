"""
Hybrid Provider Manager
=======================

Manages switching between Claude (cloud) and Ollama (local) providers.
Supports automatic fallback, runtime switching, and automatic hardware detection.

Features:
- Runtime provider switching via environment variables or API
- Automatic fallback to Ollama when offline
- Automatic hardware detection for optimal configuration
- Provider status monitoring and health checks

Environment Variables:
    AI_PROVIDER: Primary provider (claude|ollama) - default: claude
    AI_FALLBACK_PROVIDER: Fallback provider when primary fails - default: ollama
    MAX_PARALLEL_AGENTS: Maximum concurrent agents (auto-detected if not set)
    OLLAMA_MODEL: Model for Ollama LLM tasks (auto-detected if not set)
    CLAUDE_MODEL: Model for Claude tasks
    HYBRID_AUTO_FALLBACK: Enable automatic fallback (true|false) - default: true
"""

import os
import subprocess
import platform
import urllib.request
import urllib.error
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, Callable, List, Tuple
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
class GPUInfo:
    """Information about a detected GPU."""
    index: int
    name: str
    vram_total_gb: float
    vram_used_gb: float
    vram_free_gb: float
    driver_version: Optional[str] = None


@dataclass
class DetectedHardware:
    """Auto-detected hardware information."""
    cpu_model: str
    cpu_cores: int
    ram_total_gb: float
    ram_available_gb: float
    gpus: List[GPUInfo] = field(default_factory=list)
    platform: str = ""
    
    @property
    def has_gpu(self) -> bool:
        """Check if system has a GPU."""
        return len(self.gpus) > 0
    
    @property
    def total_vram_gb(self) -> float:
        """Get total VRAM across all GPUs."""
        return sum(gpu.vram_total_gb for gpu in self.gpus)
    
    @property
    def primary_gpu(self) -> Optional[GPUInfo]:
        """Get the primary (first) GPU."""
        return self.gpus[0] if self.gpus else None


@dataclass
class RecommendedSettings:
    """Recommended settings based on detected hardware."""
    max_parallel_agents: int
    ollama_model: str
    context_window: int
    gpu_layers: int
    hardware_description: str


def detect_gpus() -> List[GPUInfo]:
    """Detect NVIDIA GPUs using nvidia-smi."""
    gpus = []
    
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=index,name,memory.total,memory.used,memory.free,driver_version",
                "--format=csv,noheader,nounits"
            ],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                    
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 5:
                    try:
                        gpus.append(GPUInfo(
                            index=int(parts[0]),
                            name=parts[1],
                            vram_total_gb=float(parts[2]) / 1024,
                            vram_used_gb=float(parts[3]) / 1024,
                            vram_free_gb=float(parts[4]) / 1024,
                            driver_version=parts[5] if len(parts) > 5 else None
                        ))
                    except (ValueError, IndexError):
                        continue
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        pass
    
    return gpus


def detect_hardware() -> DetectedHardware:
    """Auto-detect system hardware."""
    import os as _os
    
    # CPU info
    cpu_model = "Unknown"
    cpu_cores = _os.cpu_count() or 1
    
    try:
        if platform.system() == "Linux":
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if line.startswith("model name"):
                        cpu_model = line.split(":")[1].strip()
                        break
        elif platform.system() == "Darwin":
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                cpu_model = result.stdout.strip()
        elif platform.system() == "Windows":
            import winreg
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                               r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            cpu_model = winreg.QueryValueEx(key, "ProcessorNameString")[0]
            winreg.CloseKey(key)
    except Exception:
        pass
    
    # RAM info
    ram_total_gb = 0.0
    ram_available_gb = 0.0
    
    try:
        if platform.system() == "Linux":
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal"):
                        ram_total_gb = int(line.split()[1]) / (1024 * 1024)
                    elif line.startswith("MemAvailable"):
                        ram_available_gb = int(line.split()[1]) / (1024 * 1024)
        elif platform.system() == "Darwin":
            result = subprocess.run(
                ["sysctl", "-n", "hw.memsize"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                ram_total_gb = int(result.stdout.strip()) / (1024 ** 3)
                ram_available_gb = ram_total_gb * 0.7  # Estimate
        elif platform.system() == "Windows":
            import ctypes
            kernel32 = ctypes.windll.kernel32
            c_ulong = ctypes.c_ulong
            class MEMORYSTATUS(ctypes.Structure):
                _fields_ = [
                    ('dwLength', c_ulong),
                    ('dwMemoryLoad', c_ulong),
                    ('dwTotalPhys', c_ulong),
                    ('dwAvailPhys', c_ulong),
                    ('dwTotalPageFile', c_ulong),
                    ('dwAvailPageFile', c_ulong),
                    ('dwTotalVirtual', c_ulong),
                    ('dwAvailVirtual', c_ulong)
                ]
            memstat = MEMORYSTATUS()
            memstat.dwLength = ctypes.sizeof(MEMORYSTATUS)
            kernel32.GlobalMemoryStatus(ctypes.byref(memstat))
            ram_total_gb = memstat.dwTotalPhys / (1024 ** 3)
            ram_available_gb = memstat.dwAvailPhys / (1024 ** 3)
    except Exception:
        ram_total_gb = 8.0  # Default assumption
        ram_available_gb = 4.0
    
    # GPU info
    gpus = detect_gpus()
    
    return DetectedHardware(
        cpu_model=cpu_model,
        cpu_cores=cpu_cores,
        ram_total_gb=round(ram_total_gb, 2),
        ram_available_gb=round(ram_available_gb, 2),
        gpus=gpus,
        platform=platform.system()
    )


def get_recommended_settings(hardware: DetectedHardware) -> RecommendedSettings:
    """Get recommended settings based on detected hardware."""
    
    # Default settings
    max_agents = 12
    model = "llama3.1:8b-instruct-q4_K_M"
    context = 8192
    gpu_layers = -1  # Auto
    description = "Standard configuration"
    
    # Adjust based on RAM
    if hardware.ram_total_gb < 16:
        max_agents = 2
        model = "llama3.2:3b"
        context = 4096
        description = f"Low memory system ({hardware.ram_total_gb:.1f}GB RAM)"
    elif hardware.ram_total_gb < 32:
        max_agents = 4
        context = 8192
        description = f"Standard system ({hardware.ram_total_gb:.1f}GB RAM)"
    elif hardware.ram_total_gb >= 64:
        max_agents = 12
        context = 16384
        description = f"High memory system ({hardware.ram_total_gb:.1f}GB RAM)"
    
    # Adjust based on GPU
    if hardware.has_gpu:
        gpu = hardware.primary_gpu
        total_vram = hardware.total_vram_gb
        gpu_name = gpu.name.lower() if gpu else ""
        
        if total_vram >= 24:
            model = "llama3.1:70b-instruct-q4_K_M"
            context = 32768
            max_agents = min(10, max_agents)
            
            if "4090" in gpu_name:
                description = f"RTX 4090 detected ({total_vram:.1f}GB VRAM)"
            elif "3090" in gpu_name:
                description = f"RTX 3090 detected ({total_vram:.1f}GB VRAM)"
            else:
                description = f"High-end GPU ({total_vram:.1f}GB VRAM)"
                
        elif total_vram >= 12:
            model = "llama3.1:8b-instruct-q4_K_M"
            context = 8192
            max_agents = min(6, max_agents)
            
            if "3080" in gpu_name:
                description = f"RTX 3080 Ti detected ({total_vram:.1f}GB VRAM)"
            elif "4070" in gpu_name:
                description = f"RTX 4070 detected ({total_vram:.1f}GB VRAM)"
            else:
                description = f"Mid-range GPU ({total_vram:.1f}GB VRAM)"
                
        elif total_vram >= 8:
            model = "qwen2.5-coder:7b"
            context = 8192
            max_agents = min(4, max_agents)
            description = f"Entry GPU ({total_vram:.1f}GB VRAM)"
            
        else:
            model = "llama3.2:3b"
            context = 4096
            max_agents = min(2, max_agents)
            description = f"Low VRAM GPU ({total_vram:.1f}GB)"
    else:
        # CPU only
        gpu_layers = 0
        max_agents = 2
        model = "llama3.2:3b"
        context = 4096
        description = f"CPU-only mode ({hardware.cpu_model})"
    
    return RecommendedSettings(
        max_parallel_agents=max_agents,
        ollama_model=model,
        context_window=context,
        gpu_layers=gpu_layers,
        hardware_description=description
    )


# Cache for detected hardware (avoid repeated detection)
_hardware_cache: Optional[DetectedHardware] = None
_hardware_cache_time: Optional[datetime] = None
_HARDWARE_CACHE_TTL = timedelta(minutes=5)


def get_detected_hardware(force_refresh: bool = False) -> DetectedHardware:
    """Get detected hardware with caching."""
    global _hardware_cache, _hardware_cache_time
    
    now = datetime.now()
    if (
        force_refresh or
        _hardware_cache is None or
        _hardware_cache_time is None or
        (now - _hardware_cache_time) > _HARDWARE_CACHE_TTL
    ):
        _hardware_cache = detect_hardware()
        _hardware_cache_time = now
    
    return _hardware_cache


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
    claude_model: str = "claude-sonnet-4-20250514"
    ollama_model: str = "llama3.1:8b-instruct-q4_K_M"
    ollama_base_url: str = "http://localhost:11434"
    
    # Hardware optimization (auto-detected if not set)
    max_parallel_agents: int = 12
    hardware_description: Optional[str] = None
    
    # Context management
    ollama_context_window: int = 8192
    ollama_gpu_layers: int = -1
    
    # Auto-detection flag
    _auto_detected: bool = False
    
    @classmethod
    def from_env(cls, auto_detect: bool = True) -> "HybridProviderConfig":
        """Create configuration from environment variables with optional auto-detection."""
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
        
        # Check if settings are explicitly set in environment
        max_agents_env = os.environ.get("MAX_PARALLEL_AGENTS")
        ollama_model_env = os.environ.get("OLLAMA_MODEL", os.environ.get("OLLAMA_LLM_MODEL"))
        context_window_env = os.environ.get("OLLAMA_NUM_CTX")
        gpu_layers_env = os.environ.get("OLLAMA_NUM_GPU")
        
        # Auto-detect hardware if settings not explicitly set
        hardware_description = None
        auto_detected = False
        
        if auto_detect and not all([max_agents_env, ollama_model_env, context_window_env]):
            hardware = get_detected_hardware()
            recommended = get_recommended_settings(hardware)
            hardware_description = recommended.hardware_description
            auto_detected = True
            
            # Use recommended values for unset settings
            max_agents = int(max_agents_env) if max_agents_env else recommended.max_parallel_agents
            ollama_model = ollama_model_env or recommended.ollama_model
            context_window = int(context_window_env) if context_window_env else recommended.context_window
            gpu_layers = int(gpu_layers_env) if gpu_layers_env else recommended.gpu_layers
        else:
            # Use environment values or defaults
            try:
                max_agents = int(max_agents_env) if max_agents_env else 12
            except ValueError:
                max_agents = 12
                
            ollama_model = ollama_model_env or "llama3.1:8b-instruct-q4_K_M"
            
            try:
                context_window = int(context_window_env) if context_window_env else 8192
            except ValueError:
                context_window = 8192
                
            try:
                gpu_layers = int(gpu_layers_env) if gpu_layers_env else -1
            except ValueError:
                gpu_layers = -1
        
        return cls(
            primary_provider=primary_provider,
            fallback_provider=fallback_provider,
            auto_fallback=auto_fallback,
            claude_model=os.environ.get("CLAUDE_MODEL", os.environ.get("AUTO_BUILD_MODEL", "claude-sonnet-4-20250514")),
            ollama_model=ollama_model,
            ollama_base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            max_parallel_agents=max_agents,
            hardware_description=hardware_description,
            ollama_context_window=context_window,
            ollama_gpu_layers=gpu_layers,
            _auto_detected=auto_detected,
        )
    
    def apply_recommended_settings(self) -> None:
        """Apply recommended settings based on auto-detected hardware."""
        hardware = get_detected_hardware(force_refresh=True)
        recommended = get_recommended_settings(hardware)
        
        self.max_parallel_agents = recommended.max_parallel_agents
        self.ollama_model = recommended.ollama_model
        self.ollama_context_window = recommended.context_window
        self.ollama_gpu_layers = recommended.gpu_layers
        self.hardware_description = recommended.hardware_description
        self._auto_detected = True


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
    
    @property
    def current_provider(self) -> Provider:
        """Get the currently active provider."""
        return self._current_provider
    
    @property
    def is_fallback_active(self) -> bool:
        """Check if fallback provider is currently active."""
        return self._fallback_active
    
    def get_hardware_info(self) -> DetectedHardware:
        """Get detected hardware information."""
        return get_detected_hardware()
    
    def get_recommended_settings(self) -> RecommendedSettings:
        """Get recommended settings for current hardware."""
        hardware = get_detected_hardware()
        return get_recommended_settings(hardware)
    
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
        # Check for OAuth token
        oauth_token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")
        auth_token = os.environ.get("ANTHROPIC_AUTH_TOKEN", "")
        
        has_auth = bool(oauth_token or auth_token)
        
        return ProviderHealth(
            provider=Provider.CLAUDE,
            status=ProviderStatus.AVAILABLE if has_auth else ProviderStatus.UNAVAILABLE,
            last_check=datetime.now(),
            model_available=has_auth,
            error_message=None if has_auth else "No Claude OAuth token configured"
        )
    
    def select_provider(self, task_type: Optional[str] = None) -> Provider:
        """
        Select the best provider for a task.
        
        Args:
            task_type: Optional task type hint (e.g., "offline", "complex", "simple")
            
        Returns:
            The selected provider
        """
        # Force Ollama for offline tasks
        if task_type == "offline":
            return Provider.OLLAMA
        
        # Check primary provider health
        primary_health = self._get_cached_health(self.config.primary_provider)
        
        if primary_health.status == ProviderStatus.AVAILABLE:
            self._current_provider = self.config.primary_provider
            self._fallback_active = False
            return self.config.primary_provider
        
        # Try fallback if enabled
        if self.config.auto_fallback:
            fallback_health = self._get_cached_health(self.config.fallback_provider)
            
            if fallback_health.status != ProviderStatus.UNAVAILABLE:
                self._current_provider = self.config.fallback_provider
                self._fallback_active = True
                return self.config.fallback_provider
        
        # Default to primary even if unavailable
        self._current_provider = self.config.primary_provider
        self._fallback_active = False
        return self.config.primary_provider
    
    def _get_cached_health(self, provider: Provider) -> ProviderHealth:
        """Get cached health or perform fresh check."""
        with self._lock:
            cached = self._health_cache.get(provider)
            
            if cached and (datetime.now() - cached.last_check) < self._health_check_interval:
                return cached
            
            # Perform fresh check
            if provider == Provider.CLAUDE:
                health = self.check_claude_health()
            else:
                health = self.check_ollama_health()
            
            self._health_cache[provider] = health
            return health
    
    def switch_provider(self, provider: Provider) -> bool:
        """
        Manually switch to a specific provider.
        
        Args:
            provider: The provider to switch to
            
        Returns:
            True if switch was successful
        """
        health = self._get_cached_health(provider)
        
        if health.status == ProviderStatus.UNAVAILABLE:
            return False
        
        with self._lock:
            self._current_provider = provider
            self._fallback_active = (provider != self.config.primary_provider)
        
        return True
    
    def get_current_model(self) -> str:
        """Get the model name for the current provider."""
        if self._current_provider == Provider.CLAUDE:
            return self.config.claude_model
        return self.config.ollama_model
    
    def get_max_parallel_agents(self) -> int:
        """Get the maximum parallel agents for the current provider."""
        if self._current_provider == Provider.CLAUDE:
            return self.config.max_parallel_agents
        # Ollama typically needs more conservative limits
        return min(self.config.max_parallel_agents, 6)
    
    def get_context_window(self) -> int:
        """Get the context window size for the current provider."""
        if self._current_provider == Provider.CLAUDE:
            return 200000  # Claude's large context
        return self.config.ollama_context_window
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get comprehensive provider information."""
        claude_health = self._get_cached_health(Provider.CLAUDE)
        ollama_health = self._get_cached_health(Provider.OLLAMA)
        
        return {
            "current_provider": self._current_provider.value,
            "fallback_active": self._fallback_active,
            "primary_provider": self.config.primary_provider.value,
            "fallback_provider": self.config.fallback_provider.value,
            "current_model": self.get_current_model(),
            "max_parallel_agents": self.get_max_parallel_agents(),
            "context_window": self.get_context_window(),
            "hardware_description": self.config.hardware_description,
            "auto_detected": self.config._auto_detected,
            "auto_fallback_enabled": self.config.auto_fallback,
            "health": {
                "claude": {
                    "status": claude_health.status.value,
                    "model_available": claude_health.model_available,
                    "error": claude_health.error_message,
                },
                "ollama": {
                    "status": ollama_health.status.value,
                    "model_available": ollama_health.model_available,
                    "response_time_ms": ollama_health.response_time_ms,
                    "error": ollama_health.error_message,
                },
            },
        }


# Global instance
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
