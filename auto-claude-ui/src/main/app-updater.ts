/**
 * Electron App Auto-Updater
 *
 * Manages automatic updates for the packaged Electron application using electron-updater.
 * Updates are published through GitHub Releases and automatically downloaded and installed.
 *
 * Update flow:
 * 1. Check for updates 3 seconds after app launch
 * 2. Download updates automatically when available
 * 3. Notify user when update is downloaded
 * 4. Install and restart when user confirms
 *
 * Events sent to renderer:
 * - APP_UPDATE_AVAILABLE: New update available (with version info)
 * - APP_UPDATE_DOWNLOADED: Update downloaded and ready to install
 * - APP_UPDATE_PROGRESS: Download progress updates
 * - APP_UPDATE_ERROR: Error during update process
 */

import { autoUpdater } from 'electron-updater';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import type { AppUpdateInfo } from '../shared/types';

// Configure electron-updater
autoUpdater.autoDownload = true;  // Automatically download updates when available
autoUpdater.autoInstallOnAppQuit = true;  // Automatically install on app quit

let mainWindow: BrowserWindow | null = null;

/**
 * Initialize the app updater system
 *
 * Sets up event handlers and starts periodic update checks.
 * Should only be called in production (app.isPackaged).
 *
 * @param window - The main BrowserWindow for sending update events
 */
export function initializeAppUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // Log updater configuration
  console.log('[app-updater] Initializing app auto-updater');
  console.log('[app-updater] Current version:', autoUpdater.currentVersion.version);
  console.log('[app-updater] Auto-download enabled:', autoUpdater.autoDownload);

  // ============================================
  // Event Handlers
  // ============================================

  // Update available - new version found
  autoUpdater.on('update-available', (info) => {
    console.log('[app-updater] Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.APP_UPDATE_AVAILABLE, {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
    }
  });

  // Update downloaded - ready to install
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[app-updater] Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.APP_UPDATE_DOWNLOADED, {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
    }
  });

  // Download progress
  autoUpdater.on('download-progress', (progress) => {
    console.log(`[app-updater] Download progress: ${progress.percent.toFixed(2)}%`);
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.APP_UPDATE_PROGRESS, {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  // Error handling
  autoUpdater.on('error', (error) => {
    console.error('[app-updater] Update error:', error);
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.APP_UPDATE_ERROR, {
        message: error.message,
        stack: error.stack
      });
    }
  });

  // No update available
  autoUpdater.on('update-not-available', (info) => {
    console.log('[app-updater] No updates available. Current version:', info.version);
  });

  // Checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('[app-updater] Checking for updates...');
  });

  // ============================================
  // Update Check Schedule
  // ============================================

  // Check for updates 3 seconds after launch
  setTimeout(() => {
    console.log('[app-updater] Performing initial update check');
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('[app-updater] Initial update check failed:', error);
    });
  }, 3000);

  // Check for updates every 4 hours
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  setInterval(() => {
    console.log('[app-updater] Performing periodic update check');
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('[app-updater] Periodic update check failed:', error);
    });
  }, FOUR_HOURS);

  console.log('[app-updater] Auto-updater initialized successfully');
}

/**
 * Manually check for updates
 * Called from IPC handler when user requests manual check
 */
export async function checkForUpdates(): Promise<AppUpdateInfo | null> {
  try {
    console.log('[app-updater] Manual update check requested');
    const result = await autoUpdater.checkForUpdates();

    if (!result) {
      return null;
    }

    const updateAvailable = result.updateInfo.version !== autoUpdater.currentVersion.version;

    if (!updateAvailable) {
      return null;
    }

    return {
      version: result.updateInfo.version,
      releaseNotes: result.updateInfo.releaseNotes as string | undefined,
      releaseDate: result.updateInfo.releaseDate
    };
  } catch (error) {
    console.error('[app-updater] Manual update check failed:', error);
    throw error;
  }
}

/**
 * Manually download update
 * Called from IPC handler when user requests manual download
 */
export async function downloadUpdate(): Promise<void> {
  try {
    console.log('[app-updater] Manual update download requested');
    await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error('[app-updater] Manual update download failed:', error);
    throw error;
  }
}

/**
 * Quit and install update
 * Called from IPC handler when user confirms installation
 */
export function quitAndInstall(): void {
  console.log('[app-updater] Quitting and installing update');
  autoUpdater.quitAndInstall(false, true);
}

/**
 * Get current app version
 */
export function getCurrentVersion(): string {
  return autoUpdater.currentVersion.version;
}
