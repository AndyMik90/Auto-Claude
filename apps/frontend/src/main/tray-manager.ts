/**
 * System Tray Manager for Auto Claude
 *
 * Provides a system tray icon with:
 * - Status indicator (idle, running, review, error)
 * - Quick access menu with task counts
 * - Actions to open window, create tasks, etc.
 */

import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import { join } from 'path';
import { isWindows, isMacOS } from './platform';

export type TrayStatus = 'idle' | 'running' | 'review' | 'error';

export interface TrayTaskCounts {
  running: number;
  review: number;
  pending: number;
  completed: number;
}

let tray: Tray | null = null;
let mainWindowGetter: (() => BrowserWindow | null) | null = null;
let currentStatus: TrayStatus = 'idle';
let taskCounts: TrayTaskCounts = { running: 0, review: 0, pending: 0, completed: 0 };

/**
 * Get the path to tray icon based on status and platform
 */
function getTrayIconPath(status: TrayStatus): string {
  // For macOS, we use template images (monochrome icons that adapt to menu bar)
  // For Windows/Linux, we use colored icons
  const resourcesPath = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(__dirname, '../../resources');

  // Use the 16x16 icon as base - works on all platforms
  // In a full implementation, you'd have status-specific icons
  const iconName = isMacOS() ? 'icons/16x16.png' : 'icons/16x16.png';

  return join(resourcesPath, iconName);
}

/**
 * Create the tray icon image
 */
function createTrayImage(status: TrayStatus): Electron.NativeImage {
  const iconPath = getTrayIconPath(status);
  let image = nativeImage.createFromPath(iconPath);

  // On macOS, mark as template image so it adapts to light/dark menu bar
  if (isMacOS()) {
    image = image.resize({ width: 16, height: 16 });
    image.setTemplateImage(true);
  }

  return image;
}

/**
 * Get tooltip text based on current status and task counts
 */
function getTooltip(): string {
  const parts: string[] = ['Auto Claude'];

  if (taskCounts.running > 0) {
    parts.push(`${taskCounts.running} running`);
  }
  if (taskCounts.review > 0) {
    parts.push(`${taskCounts.review} awaiting review`);
  }

  if (parts.length === 1) {
    parts.push('Idle');
  }

  return parts.join(' - ');
}

/**
 * Build the context menu for the tray
 */
function buildContextMenu(): Electron.Menu {
  const menuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Auto Claude',
      enabled: false,
      icon: createTrayImage('idle').resize({ width: 16, height: 16 })
    },
    { type: 'separator' },
    // Status section
    {
      label: `${taskCounts.running} task${taskCounts.running !== 1 ? 's' : ''} running`,
      enabled: false
    },
    {
      label: `${taskCounts.review} awaiting review`,
      enabled: false
    },
    { type: 'separator' },
    // Actions
    {
      label: 'Open Auto Claude',
      click: () => {
        const mainWindow = mainWindowGetter?.();
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        }
      },
      accelerator: 'CmdOrCtrl+Shift+A'
    },
    {
      label: 'New Task...',
      click: () => {
        const mainWindow = mainWindowGetter?.();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // Send IPC to open new task dialog
          mainWindow.webContents.send('tray:new-task');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        const mainWindow = mainWindowGetter?.();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // Send IPC to open settings
          mainWindow.webContents.send('tray:open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Auto Claude',
      click: () => {
        app.quit();
      },
      accelerator: 'CmdOrCtrl+Q'
    }
  ];

  return Menu.buildFromTemplate(menuItems);
}

/**
 * Update the tray icon and menu
 */
function updateTray(): void {
  if (!tray) return;

  // Update icon based on status
  tray.setImage(createTrayImage(currentStatus));

  // Update tooltip
  tray.setToolTip(getTooltip());

  // Update context menu
  tray.setContextMenu(buildContextMenu());
}

/**
 * Initialize the system tray
 */
export function initializeTray(getMainWindow: () => BrowserWindow | null): Tray {
  mainWindowGetter = getMainWindow;

  // Create tray with initial icon
  const image = createTrayImage('idle');
  tray = new Tray(image);

  // Set initial tooltip and menu
  tray.setToolTip('Auto Claude - Idle');
  tray.setContextMenu(buildContextMenu());

  // Click behavior differs by platform
  // macOS: Click shows menu (default behavior)
  // Windows/Linux: Click opens the app window
  if (!isMacOS()) {
    tray.on('click', () => {
      const mainWindow = mainWindowGetter?.();
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
        } else {
          mainWindow.show();
        }
      }
    });
  }

  console.log('[tray] System tray initialized');
  return tray;
}

/**
 * Update the tray status
 */
export function setTrayStatus(status: TrayStatus): void {
  currentStatus = status;
  updateTray();
}

/**
 * Update task counts displayed in tray menu
 */
export function setTrayTaskCounts(counts: TrayTaskCounts): void {
  taskCounts = counts;

  // Determine status based on counts
  if (counts.running > 0) {
    currentStatus = 'running';
  } else if (counts.review > 0) {
    currentStatus = 'review';
  } else {
    currentStatus = 'idle';
  }

  updateTray();
}

/**
 * Destroy the tray icon
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    console.log('[tray] System tray destroyed');
  }
}

/**
 * Check if tray is initialized
 */
export function isTrayInitialized(): boolean {
  return tray !== null;
}
