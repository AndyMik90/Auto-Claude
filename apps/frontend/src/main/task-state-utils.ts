import { DEFAULT_APP_SETTINGS } from '../shared/constants';
import type { AppSettings } from '../shared/types';
import { readSettingsFile } from './settings-utils';

export function isXstateEnabled(): boolean {
  const savedSettings = readSettingsFile();
  const settings = { ...DEFAULT_APP_SETTINGS, ...savedSettings } as AppSettings;
  return settings.useXstateTaskMachine === true;
}

export function isDebugEnabled(): boolean {
  return process.env.DEBUG === 'true';
}
