import { BrowserWindow, screen, nativeImage, app } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';

/**
 * Information about a managed window
 */
export interface WindowInfo {
  id: string;
  type: 'main' | 'project';
  window: BrowserWindow;
  projectId?: string; // For project windows
  bounds: Electron.Rectangle;
}

/**
 * Tab state for persistence (includes detached windows)
 */
export interface TabState {
  openProjectIds: string[];
  activeProjectId: string | null;
  tabOrder: string[];
  detachedProjects: Array<{
    projectId: string;
    windowId: string;
    bounds?: Electron.Rectangle;
  }>;
}

/**
 * Centralized window lifecycle manager for Auto Claude.
 * Manages both the main multi-project window and detached single-project windows.
 */
export class WindowManager {
  private windows: Map<string, WindowInfo> = new Map();
  private mainWindow: BrowserWindow | null = null;

  /**
   * Get the icon path based on platform
   */
  private getIconPath(): string {
    const resourcesPath = is.dev
      ? join(__dirname, '../../resources')
      : join(process.resourcesPath);

    let iconName: string;
    if (process.platform === 'darwin') {
      iconName = is.dev ? 'icon-256.png' : 'icon.icns';
    } else if (process.platform === 'win32') {
      iconName = 'icon.ico';
    } else {
      iconName = 'icon.png';
    }

    return join(resourcesPath, iconName);
  }

  /**
   * Create and register the main window
   */
  createMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 10 },
      icon: this.getIconPath(),
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    // Show window when ready
    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Register window
    const windowId = this.mainWindow.id.toString();
    this.windows.set(windowId, {
      id: windowId,
      type: 'main',
      window: this.mainWindow,
      bounds: this.mainWindow.getBounds()
    });

    // Update bounds on move/resize
    this.mainWindow.on('move', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.updateWindowBounds(windowId);
      }
    });

    this.mainWindow.on('resize', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.updateWindowBounds(windowId);
      }
    });

    // Clean up on close
    this.mainWindow.on('closed', () => {
      this.windows.delete(windowId);
      this.mainWindow = null;
    });

    console.log(`[WindowManager] Created main window (ID: ${windowId})`);
    return this.mainWindow;
  }

  /**
   * Create a detached project window
   */
  createProjectWindow(
    projectId: string,
    position?: { x: number; y: number }
  ): BrowserWindow {
    // Check if window already exists for this project
    const existingWindow = this.getProjectWindow(projectId);
    if (existingWindow) {
      existingWindow.focus();
      return existingWindow;
    }

    // Calculate position respecting screen bounds
    let x: number;
    let y: number;

    if (position) {
      // Find which display the position is on
      const targetDisplay = screen.getDisplayNearestPoint(position);
      const bounds = targetDisplay.workArea;

      // Ensure window stays within display bounds
      x = Math.max(bounds.x, Math.min(position.x, bounds.x + bounds.width - 800));
      y = Math.max(bounds.y, Math.min(position.y, bounds.y + bounds.height - 600));
    } else {
      // Default to center of primary display with offset
      const primaryDisplay = screen.getPrimaryDisplay();
      const bounds = primaryDisplay.workArea;
      x = bounds.x + 100;
      y = bounds.y + 100;
    }

    const projectWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      x,
      y,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 10 },
      icon: this.getIconPath(),
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    // Show window when ready
    projectWindow.on('ready-to-show', () => {
      projectWindow.show();
    });

    // Load the renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      projectWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      projectWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // Open DevTools in development
    if (is.dev) {
      projectWindow.webContents.openDevTools({ mode: 'right' });
    }

    // Register window
    const windowId = projectWindow.id.toString();
    this.windows.set(windowId, {
      id: windowId,
      type: 'project',
      window: projectWindow,
      projectId,
      bounds: projectWindow.getBounds()
    });

    // Update bounds on move/resize
    projectWindow.on('move', () => {
      if (!projectWindow.isDestroyed()) {
        this.updateWindowBounds(windowId);
      }
    });

    projectWindow.on('resize', () => {
      if (!projectWindow.isDestroyed()) {
        this.updateWindowBounds(windowId);
      }
    });

    // Clean up on close
    projectWindow.on('closed', () => {
      this.windows.delete(windowId);
      console.log(`[WindowManager] Closed project window for ${projectId} (ID: ${windowId})`);
    });

    console.log(`[WindowManager] Created project window for ${projectId} (ID: ${windowId})`);
    return projectWindow;
  }

  /**
   * Update stored bounds for a window
   */
  private updateWindowBounds(windowId: string): void {
    const windowInfo = this.windows.get(windowId);
    if (windowInfo && !windowInfo.window.isDestroyed()) {
      windowInfo.bounds = windowInfo.window.getBounds();
    }
  }

  /**
   * Get the main window
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
  }

  /**
   * Get a project window by project ID
   */
  getProjectWindow(projectId: string): BrowserWindow | null {
    for (const windowInfo of this.windows.values()) {
      if (windowInfo.type === 'project' && windowInfo.projectId === projectId) {
        return !windowInfo.window.isDestroyed() ? windowInfo.window : null;
      }
    }
    return null;
  }

  /**
   * Get window info by window ID
   */
  getWindowById(windowId: string): WindowInfo | null {
    const windowInfo = this.windows.get(windowId);
    if (windowInfo && !windowInfo.window.isDestroyed()) {
      return windowInfo;
    }
    return null;
  }

  /**
   * Get all managed windows
   */
  getAllWindows(): Map<string, WindowInfo> {
    // Filter out destroyed windows
    const activeWindows = new Map<string, WindowInfo>();
    for (const [id, info] of this.windows.entries()) {
      if (!info.window.isDestroyed()) {
        activeWindows.set(id, info);
      }
    }
    return activeWindows;
  }

  /**
   * Close a project window
   */
  closeProjectWindow(projectId: string): boolean {
    const projectWindow = this.getProjectWindow(projectId);
    if (projectWindow) {
      projectWindow.close();
      return true;
    }
    return false;
  }

  /**
   * Recreate detached windows on app startup
   */
  async recreateDetachedWindows(tabState: TabState): Promise<void> {
    if (!tabState.detachedProjects || tabState.detachedProjects.length === 0) {
      return;
    }

    console.log(`[WindowManager] Recreating ${tabState.detachedProjects.length} detached window(s)`);

    for (const detached of tabState.detachedProjects) {
      try {
        // Use saved bounds if available
        const position = detached.bounds
          ? { x: detached.bounds.x, y: detached.bounds.y }
          : undefined;

        const projectWindow = this.createProjectWindow(detached.projectId, position);

        // Restore full bounds if available
        if (detached.bounds) {
          projectWindow.setBounds(detached.bounds);
        }

        console.log(`[WindowManager] Recreated detached window for project: ${detached.projectId}`);
      } catch (error) {
        console.error(`[WindowManager] Failed to recreate window for project ${detached.projectId}:`, error);
      }
    }
  }

  /**
   * Handle window closed event
   */
  handleWindowClosed(windowId: string): void {
    this.windows.delete(windowId);
  }

  /**
   * Get detached project state for persistence
   */
  getDetachedProjectsState(): Array<{ projectId: string; windowId: string; bounds: Electron.Rectangle }> {
    const detached: Array<{ projectId: string; windowId: string; bounds: Electron.Rectangle }> = [];

    for (const [windowId, windowInfo] of this.windows.entries()) {
      if (windowInfo.type === 'project' && windowInfo.projectId) {
        detached.push({
          projectId: windowInfo.projectId,
          windowId,
          bounds: windowInfo.bounds
        });
      }
    }

    return detached;
  }
}
