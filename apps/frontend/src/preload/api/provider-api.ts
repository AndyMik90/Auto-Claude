import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';

// Types for provider management
export type Provider = 'claude' | 'ollama';
export type ProviderStatus = 'available' | 'unavailable' | 'degraded' | 'checking';

export interface ProviderHealth {
  provider: Provider;
  status: ProviderStatus;
  model_available: boolean;
  response_time_ms?: number;
  error_message?: string;
}

export interface GPUInfo {
  index: number;
  name: string;
  vram_total_gb: number;
  vram_used_gb: number;
  vram_free_gb: number;
  vram_percent: number;
  utilization: number;
  temperature: number | null;
  power_draw: number | null;
}

export interface HardwareInfo {
  cpu: {
    model: string;
    cores: number;
    threads: number;
    percent: number;
  };
  ram: {
    total_gb: number;
    used_gb: number;
    available_gb: number;
    percent: number;
  };
  gpus: GPUInfo[];
  platform: string;
  arch: string;
}

export interface RecommendedSettings {
  max_parallel_agents: number;
  ollama_model: string;
  context_window: number;
  hardware_profile: string | null;
  gpu_layers: number;
}

export interface ProviderInfo {
  current_provider: Provider;
  fallback_active: boolean;
  primary_provider: Provider;
  fallback_provider: Provider;
  current_model: string;
  max_parallel_agents: number;
  context_window: number;
  hardware_profile: string | null;
  auto_fallback_enabled: boolean;
  health: {
    claude: ProviderHealth;
    ollama: ProviderHealth;
  };
}

export interface ProviderSettings {
  primary_provider: Provider;
  fallback_provider: Provider;
  auto_fallback: boolean;
  ollama_model: string;
  max_parallel_agents: number;
  context_window: number;
}

export interface ProviderAPI {
  // Get comprehensive provider information
  getProviderInfo: () => Promise<IPCResult<ProviderInfo>>;

  // Switch to a specific provider
  switchProvider: (provider: Provider) => Promise<IPCResult<{ success: boolean }>>;

  // Get hardware information
  getHardwareInfo: () => Promise<IPCResult<HardwareInfo>>;

  // Check provider health
  checkProviderHealth: (provider: Provider) => Promise<IPCResult<ProviderHealth>>;

  // Get recommended settings based on hardware
  getRecommendedSettings: () => Promise<IPCResult<RecommendedSettings>>;

  // Save provider settings
  saveProviderSettings: (settings: Partial<ProviderSettings>) => Promise<IPCResult<{ success: boolean }>>;
}

export const createProviderAPI = (): ProviderAPI => ({
  getProviderInfo: (): Promise<IPCResult<ProviderInfo>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_INFO),

  switchProvider: (provider: Provider): Promise<IPCResult<{ success: boolean }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_SWITCH, provider),

  getHardwareInfo: (): Promise<IPCResult<HardwareInfo>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_HARDWARE),

  checkProviderHealth: (provider: Provider): Promise<IPCResult<ProviderHealth>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_CHECK_HEALTH, provider),

  getRecommendedSettings: (): Promise<IPCResult<RecommendedSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_RECOMMENDED_SETTINGS),

  saveProviderSettings: (settings: Partial<ProviderSettings>): Promise<IPCResult<{ success: boolean }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_SAVE_SETTINGS, settings),
});
