import { contextBridge } from 'electron';
import { createElectronAPI } from './api';
import { getEnvVar } from '../shared/platform';

// Create the unified API by combining all domain-specific APIs
const electronAPI = createElectronAPI();

// Expose to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Expose debug flag for debug logging
contextBridge.exposeInMainWorld('DEBUG', getEnvVar('DEBUG') === 'true');
