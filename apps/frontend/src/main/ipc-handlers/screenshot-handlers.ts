/**
 * Screenshot IPC Handlers
 *
 * Provides screenshot capture functionality using Electron's desktopCapturer API.
 * Users can capture screenshots of their entire screen or individual application windows.
 */
import { ipcMain } from 'electron';
import { desktopCapturer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';

export interface ScreenshotSource {
  id: string;
  name: string;
  thumbnail: string; // base64 encoded PNG
}

export interface ScreenshotCaptureOptions {
  sourceId: string;
}

/**
 * Register screenshot capture handlers
 */
export function registerScreenshotHandlers(): void {
  /**
   * Get available screenshot sources (screens and windows)
   */
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_GET_SOURCES, async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: {
          width: 320,
          height: 240
        }
      });

      return {
        success: true,
        data: sources.map((source): ScreenshotSource => ({
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL()
        }))
      };
    } catch (error) {
      console.error('Failed to get screenshot sources:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get screenshot sources'
      };
    }
  });

  /**
   * Capture screenshot from selected source
   * Returns full resolution screenshot as base64 PNG
   */
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_CAPTURE, async (_event, options: ScreenshotCaptureOptions) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: {
          // Capture at 2x resolution for retina display support
          width: 3840,
          height: 2160
        }
      });

      const selectedSource = sources.find(s => s.id === options.sourceId);
      if (!selectedSource) {
        return {
          success: false,
          error: 'Source not found'
        };
      }

      // Return the thumbnail which is our high-res capture
      const dataUrl = selectedSource.thumbnail.toDataURL();

      return {
        success: true,
        data: dataUrl
      };
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture screenshot'
      };
    }
  });

  console.warn('[IPC] Screenshot handlers registered');
}
