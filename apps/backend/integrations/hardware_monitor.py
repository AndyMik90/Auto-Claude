"""
Hardware Resource Monitor
=========================

Monitors system hardware resources (CPU, GPU, RAM, VRAM) for optimal
Ollama performance and automatic configuration adjustment.

Features:
- Real-time CPU, RAM, and GPU monitoring
- NVIDIA GPU support via nvidia-smi
- Automatic hardware profile detection
- Resource usage alerts and recommendations
- Integration with hybrid provider for dynamic adjustment

Dependencies:
- psutil (required): pip install psutil
- nvidia-ml-py3 (optional): pip install nvidia-ml-py3

Environment Variables:
    HARDWARE_MONITOR_INTERVAL: Monitoring interval in seconds (default: 5)
    HARDWARE_ALERT_CPU_THRESHOLD: CPU usage alert threshold % (default: 90)
    HARDWARE_ALERT_RAM_THRESHOLD: RAM usage alert threshold % (default: 85)
    HARDWARE_ALERT_VRAM_THRESHOLD: VRAM usage alert threshold % (default: 90)
"""

import os
import subprocess
import json
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, List, Callable, Any
from enum import Enum


class ResourceType(str, Enum):
    """Types of monitored resources."""
    CPU = "cpu"
    RAM = "ram"
    GPU = "gpu"
    VRAM = "vram"
    DISK = "disk"


class AlertLevel(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class ResourceUsage:
    """Current usage of a resource."""
    resource_type: ResourceType
    used: float  # Absolute value (GB for memory, % for CPU)
    total: float  # Total available
    percent: float  # Usage percentage
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class GPUInfo:
    """Information about a GPU."""
    index: int
    name: str
    memory_total_gb: float
    memory_used_gb: float
    memory_free_gb: float
    memory_percent: float
    gpu_utilization: float
    temperature: Optional[float] = None
    power_draw: Optional[float] = None


@dataclass
class SystemResources:
    """Complete system resource snapshot."""
    cpu_percent: float
    cpu_count: int
    ram_total_gb: float
    ram_used_gb: float
    ram_available_gb: float
    ram_percent: float
    gpus: List[GPUInfo] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)
    
    @property
    def has_gpu(self) -> bool:
        """Check if system has GPU(s)."""
        return len(self.gpus) > 0
    
    @property
    def total_vram_gb(self) -> float:
        """Get total VRAM across all GPUs."""
        return sum(gpu.memory_total_gb for gpu in self.gpus)
    
    @property
    def available_vram_gb(self) -> float:
        """Get available VRAM across all GPUs."""
        return sum(gpu.memory_free_gb for gpu in self.gpus)
    
    @property
    def vram_percent(self) -> float:
        """Get average VRAM usage percentage."""
        if not self.gpus:
            return 0.0
        return sum(gpu.memory_percent for gpu in self.gpus) / len(self.gpus)


@dataclass
class ResourceAlert:
    """An alert about resource usage."""
    resource_type: ResourceType
    level: AlertLevel
    message: str
    current_value: float
    threshold: float
    timestamp: datetime = field(default_factory=datetime.now)
    recommendation: Optional[str] = None


@dataclass
class HardwareMonitorConfig:
    """Configuration for hardware monitoring."""
    monitor_interval: float = 5.0  # seconds
    cpu_alert_threshold: float = 90.0  # percent
    ram_alert_threshold: float = 85.0  # percent
    vram_alert_threshold: float = 90.0  # percent
    enable_gpu_monitoring: bool = True
    history_size: int = 60  # Keep last N readings
    
    @classmethod
    def from_env(cls) -> "HardwareMonitorConfig":
        """Create configuration from environment variables."""
        try:
            interval = float(os.environ.get("HARDWARE_MONITOR_INTERVAL", "5"))
        except ValueError:
            interval = 5.0
            
        try:
            cpu_threshold = float(os.environ.get("HARDWARE_ALERT_CPU_THRESHOLD", "90"))
        except ValueError:
            cpu_threshold = 90.0
            
        try:
            ram_threshold = float(os.environ.get("HARDWARE_ALERT_RAM_THRESHOLD", "85"))
        except ValueError:
            ram_threshold = 85.0
            
        try:
            vram_threshold = float(os.environ.get("HARDWARE_ALERT_VRAM_THRESHOLD", "90"))
        except ValueError:
            vram_threshold = 90.0
        
        return cls(
            monitor_interval=interval,
            cpu_alert_threshold=cpu_threshold,
            ram_alert_threshold=ram_threshold,
            vram_alert_threshold=vram_threshold,
        )


class GPUMonitor:
    """Monitors NVIDIA GPU resources."""
    
    def __init__(self):
        self._nvidia_smi_available: Optional[bool] = None
        self._pynvml_available: Optional[bool] = None
    
    def _check_nvidia_smi(self) -> bool:
        """Check if nvidia-smi is available."""
        if self._nvidia_smi_available is not None:
            return self._nvidia_smi_available
        
        try:
            result = subprocess.run(
                ["nvidia-smi", "--version"],
                capture_output=True,
                timeout=5,
            )
            self._nvidia_smi_available = result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self._nvidia_smi_available = False
        
        return self._nvidia_smi_available
    
    def _check_pynvml(self) -> bool:
        """Check if pynvml is available."""
        if self._pynvml_available is not None:
            return self._pynvml_available
        
        try:
            import pynvml
            pynvml.nvmlInit()
            self._pynvml_available = True
        except (ImportError, Exception):
            self._pynvml_available = False
        
        return self._pynvml_available
    
    def get_gpu_info_nvidia_smi(self) -> List[GPUInfo]:
        """Get GPU info using nvidia-smi."""
        if not self._check_nvidia_smi():
            return []
        
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            
            if result.returncode != 0:
                return []
            
            gpus = []
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 6:
                    continue
                
                try:
                    index = int(parts[0])
                    name = parts[1]
                    memory_total = float(parts[2]) / 1024  # MB to GB
                    memory_used = float(parts[3]) / 1024
                    memory_free = float(parts[4]) / 1024
                    gpu_util = float(parts[5])
                    temperature = float(parts[6]) if len(parts) > 6 and parts[6] != "[N/A]" else None
                    power_draw = float(parts[7]) if len(parts) > 7 and parts[7] != "[N/A]" else None
                    
                    gpus.append(GPUInfo(
                        index=index,
                        name=name,
                        memory_total_gb=memory_total,
                        memory_used_gb=memory_used,
                        memory_free_gb=memory_free,
                        memory_percent=(memory_used / memory_total * 100) if memory_total > 0 else 0,
                        gpu_utilization=gpu_util,
                        temperature=temperature,
                        power_draw=power_draw,
                    ))
                except (ValueError, IndexError):
                    continue
            
            return gpus
            
        except (subprocess.TimeoutExpired, Exception):
            return []
    
    def get_gpu_info_pynvml(self) -> List[GPUInfo]:
        """Get GPU info using pynvml."""
        if not self._check_pynvml():
            return []
        
        try:
            import pynvml
            
            gpus = []
            device_count = pynvml.nvmlDeviceGetCount()
            
            for i in range(device_count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                name = pynvml.nvmlDeviceGetName(handle)
                if isinstance(name, bytes):
                    name = name.decode("utf-8")
                
                memory = pynvml.nvmlDeviceGetMemoryInfo(handle)
                utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
                
                try:
                    temperature = pynvml.nvmlDeviceGetTemperature(
                        handle, pynvml.NVML_TEMPERATURE_GPU
                    )
                except:
                    temperature = None
                
                try:
                    power = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000  # mW to W
                except:
                    power = None
                
                memory_total_gb = memory.total / (1024 ** 3)
                memory_used_gb = memory.used / (1024 ** 3)
                memory_free_gb = memory.free / (1024 ** 3)
                
                gpus.append(GPUInfo(
                    index=i,
                    name=name,
                    memory_total_gb=memory_total_gb,
                    memory_used_gb=memory_used_gb,
                    memory_free_gb=memory_free_gb,
                    memory_percent=(memory_used_gb / memory_total_gb * 100) if memory_total_gb > 0 else 0,
                    gpu_utilization=utilization.gpu,
                    temperature=temperature,
                    power_draw=power,
                ))
            
            return gpus
            
        except Exception:
            return []
    
    def get_gpu_info(self) -> List[GPUInfo]:
        """Get GPU info using the best available method."""
        # Try pynvml first (more reliable)
        gpus = self.get_gpu_info_pynvml()
        if gpus:
            return gpus
        
        # Fall back to nvidia-smi
        return self.get_gpu_info_nvidia_smi()


class HardwareMonitor:
    """
    Monitors system hardware resources.
    
    Provides real-time monitoring of CPU, RAM, and GPU resources
    with alert generation and history tracking.
    """
    
    def __init__(self, config: Optional[HardwareMonitorConfig] = None):
        """Initialize the hardware monitor."""
        self.config = config or HardwareMonitorConfig.from_env()
        self._gpu_monitor = GPUMonitor()
        self._history: List[SystemResources] = []
        self._alerts: List[ResourceAlert] = []
        self._callbacks: List[Callable[[ResourceAlert], None]] = []
        self._monitoring = False
        self._monitor_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        
        # Try to import psutil
        try:
            import psutil
            self._psutil = psutil
        except ImportError:
            self._psutil = None
    
    def _get_cpu_usage(self) -> float:
        """Get current CPU usage percentage."""
        if self._psutil:
            return self._psutil.cpu_percent(interval=0.1)
        
        # Fallback: read from /proc/stat on Linux
        try:
            with open("/proc/stat", "r") as f:
                line = f.readline()
                parts = line.split()
                if parts[0] == "cpu":
                    idle = int(parts[4])
                    total = sum(int(p) for p in parts[1:])
                    return 100.0 * (1 - idle / total) if total > 0 else 0.0
        except:
            pass
        
        return 0.0
    
    def _get_ram_info(self) -> tuple:
        """Get RAM info (total_gb, used_gb, available_gb, percent)."""
        if self._psutil:
            mem = self._psutil.virtual_memory()
            return (
                mem.total / (1024 ** 3),
                mem.used / (1024 ** 3),
                mem.available / (1024 ** 3),
                mem.percent,
            )
        
        # Fallback: read from /proc/meminfo on Linux
        try:
            with open("/proc/meminfo", "r") as f:
                lines = f.readlines()
                info = {}
                for line in lines:
                    parts = line.split()
                    if len(parts) >= 2:
                        info[parts[0].rstrip(":")] = int(parts[1])
                
                total = info.get("MemTotal", 0) / (1024 ** 2)  # KB to GB
                available = info.get("MemAvailable", 0) / (1024 ** 2)
                used = total - available
                percent = (used / total * 100) if total > 0 else 0
                
                return (total, used, available, percent)
        except:
            pass
        
        return (0.0, 0.0, 0.0, 0.0)
    
    def _get_cpu_count(self) -> int:
        """Get CPU core count."""
        if self._psutil:
            return self._psutil.cpu_count() or 1
        
        try:
            return os.cpu_count() or 1
        except:
            return 1
    
    def get_current_resources(self) -> SystemResources:
        """Get current system resource snapshot."""
        cpu_percent = self._get_cpu_usage()
        cpu_count = self._get_cpu_count()
        ram_total, ram_used, ram_available, ram_percent = self._get_ram_info()
        
        gpus = []
        if self.config.enable_gpu_monitoring:
            gpus = self._gpu_monitor.get_gpu_info()
        
        return SystemResources(
            cpu_percent=cpu_percent,
            cpu_count=cpu_count,
            ram_total_gb=ram_total,
            ram_used_gb=ram_used,
            ram_available_gb=ram_available,
            ram_percent=ram_percent,
            gpus=gpus,
        )
    
    def _check_alerts(self, resources: SystemResources) -> List[ResourceAlert]:
        """Check for resource alerts."""
        alerts = []
        
        # CPU alert
        if resources.cpu_percent >= self.config.cpu_alert_threshold:
            level = AlertLevel.CRITICAL if resources.cpu_percent >= 95 else AlertLevel.WARNING
            alerts.append(ResourceAlert(
                resource_type=ResourceType.CPU,
                level=level,
                message=f"High CPU usage: {resources.cpu_percent:.1f}%",
                current_value=resources.cpu_percent,
                threshold=self.config.cpu_alert_threshold,
                recommendation="Consider reducing parallel agents or waiting for current tasks to complete.",
            ))
        
        # RAM alert
        if resources.ram_percent >= self.config.ram_alert_threshold:
            level = AlertLevel.CRITICAL if resources.ram_percent >= 95 else AlertLevel.WARNING
            alerts.append(ResourceAlert(
                resource_type=ResourceType.RAM,
                level=level,
                message=f"High RAM usage: {resources.ram_percent:.1f}% ({resources.ram_used_gb:.1f}GB / {resources.ram_total_gb:.1f}GB)",
                current_value=resources.ram_percent,
                threshold=self.config.ram_alert_threshold,
                recommendation="Consider using smaller models or reducing parallel agents.",
            ))
        
        # VRAM alerts
        for gpu in resources.gpus:
            if gpu.memory_percent >= self.config.vram_alert_threshold:
                level = AlertLevel.CRITICAL if gpu.memory_percent >= 95 else AlertLevel.WARNING
                alerts.append(ResourceAlert(
                    resource_type=ResourceType.VRAM,
                    level=level,
                    message=f"High VRAM usage on GPU {gpu.index} ({gpu.name}): {gpu.memory_percent:.1f}%",
                    current_value=gpu.memory_percent,
                    threshold=self.config.vram_alert_threshold,
                    recommendation="Consider using quantized models or reducing context window size.",
                ))
        
        return alerts
    
    def _monitor_loop(self) -> None:
        """Main monitoring loop."""
        while self._monitoring:
            try:
                resources = self.get_current_resources()
                
                with self._lock:
                    # Add to history
                    self._history.append(resources)
                    
                    # Trim history
                    if len(self._history) > self.config.history_size:
                        self._history = self._history[-self.config.history_size:]
                    
                    # Check alerts
                    alerts = self._check_alerts(resources)
                    self._alerts.extend(alerts)
                    
                    # Trim alerts
                    if len(self._alerts) > 100:
                        self._alerts = self._alerts[-100:]
                
                # Notify callbacks
                for alert in alerts:
                    for callback in self._callbacks:
                        try:
                            callback(alert)
                        except Exception:
                            pass
                
            except Exception as e:
                pass  # Silently continue monitoring
            
            time.sleep(self.config.monitor_interval)
    
    def start_monitoring(self) -> None:
        """Start background monitoring."""
        if self._monitoring:
            return
        
        self._monitoring = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
    
    def stop_monitoring(self) -> None:
        """Stop background monitoring."""
        self._monitoring = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=self.config.monitor_interval * 2)
            self._monitor_thread = None
    
    def add_alert_callback(self, callback: Callable[[ResourceAlert], None]) -> None:
        """Add a callback for resource alerts."""
        self._callbacks.append(callback)
    
    def remove_alert_callback(self, callback: Callable[[ResourceAlert], None]) -> None:
        """Remove an alert callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    def get_history(self) -> List[SystemResources]:
        """Get resource history."""
        with self._lock:
            return list(self._history)
    
    def get_alerts(self, since: Optional[datetime] = None) -> List[ResourceAlert]:
        """Get alerts, optionally filtered by time."""
        with self._lock:
            if since is None:
                return list(self._alerts)
            return [a for a in self._alerts if a.timestamp >= since]
    
    def clear_alerts(self) -> None:
        """Clear all alerts."""
        with self._lock:
            self._alerts.clear()
    
    def get_recommended_settings(self) -> Dict[str, Any]:
        """Get recommended settings based on current hardware."""
        resources = self.get_current_resources()
        
        recommendations = {
            "max_parallel_agents": 12,
            "ollama_model": "llama3.1:8b-instruct-q4_K_M",
            "context_window": 8192,
            "hardware_profile": None,
        }
        
        # Adjust based on RAM
        if resources.ram_total_gb < 16:
            recommendations["max_parallel_agents"] = 2
            recommendations["ollama_model"] = "llama3.2:3b"
            recommendations["context_window"] = 4096
            recommendations["hardware_profile"] = "low_memory"
        elif resources.ram_total_gb < 32:
            recommendations["max_parallel_agents"] = 4
            recommendations["context_window"] = 8192
        elif resources.ram_total_gb >= 64:
            recommendations["max_parallel_agents"] = 12
            recommendations["context_window"] = 16384
            recommendations["hardware_profile"] = "high_memory"
        
        # Adjust based on GPU
        if resources.has_gpu:
            total_vram = resources.total_vram_gb
            
            if total_vram >= 24:
                recommendations["ollama_model"] = "llama3.1:70b-instruct-q4_K_M"
                recommendations["context_window"] = 32768
                recommendations["max_parallel_agents"] = min(10, recommendations["max_parallel_agents"])
                recommendations["hardware_profile"] = "rtx_4090"
            elif total_vram >= 12:
                recommendations["ollama_model"] = "llama3.1:8b-instruct-q4_K_M"
                recommendations["context_window"] = 8192
                recommendations["max_parallel_agents"] = min(6, recommendations["max_parallel_agents"])
                recommendations["hardware_profile"] = "rtx_3080_ti"
            elif total_vram >= 8:
                recommendations["ollama_model"] = "qwen2.5-coder:7b"
                recommendations["context_window"] = 8192
                recommendations["max_parallel_agents"] = min(4, recommendations["max_parallel_agents"])
            else:
                recommendations["ollama_model"] = "llama3.2:3b"
                recommendations["context_window"] = 4096
                recommendations["max_parallel_agents"] = min(2, recommendations["max_parallel_agents"])
        else:
            # CPU only
            recommendations["hardware_profile"] = "cpu_only"
            recommendations["max_parallel_agents"] = 2
            recommendations["ollama_model"] = "llama3.2:3b"
            recommendations["context_window"] = 4096
        
        return recommendations
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert current state to dictionary."""
        resources = self.get_current_resources()
        
        return {
            "cpu": {
                "percent": resources.cpu_percent,
                "cores": resources.cpu_count,
            },
            "ram": {
                "total_gb": round(resources.ram_total_gb, 2),
                "used_gb": round(resources.ram_used_gb, 2),
                "available_gb": round(resources.ram_available_gb, 2),
                "percent": round(resources.ram_percent, 1),
            },
            "gpus": [
                {
                    "index": gpu.index,
                    "name": gpu.name,
                    "vram_total_gb": round(gpu.memory_total_gb, 2),
                    "vram_used_gb": round(gpu.memory_used_gb, 2),
                    "vram_free_gb": round(gpu.memory_free_gb, 2),
                    "vram_percent": round(gpu.memory_percent, 1),
                    "utilization": round(gpu.gpu_utilization, 1),
                    "temperature": gpu.temperature,
                    "power_draw": round(gpu.power_draw, 1) if gpu.power_draw else None,
                }
                for gpu in resources.gpus
            ],
            "timestamp": resources.timestamp.isoformat(),
            "recommendations": self.get_recommended_settings(),
        }


# Global instance
_monitor_instance: Optional[HardwareMonitor] = None


def get_hardware_monitor() -> HardwareMonitor:
    """Get or create the global hardware monitor instance."""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = HardwareMonitor()
    return _monitor_instance


def reset_hardware_monitor() -> None:
    """Reset the global hardware monitor (useful for testing)."""
    global _monitor_instance
    if _monitor_instance:
        _monitor_instance.stop_monitoring()
    _monitor_instance = None
