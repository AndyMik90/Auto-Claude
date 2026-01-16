import { useEffect } from 'react';
import { terminalBufferManager } from '../lib/terminal-buffer-manager';

/**
 * Module-level cleanup function storage.
 *
 * DESIGN NOTE: This module-level variable is intentionally shared across all hook instances.
 * This is acceptable because:
 * 1. There's only one app instance that uses this hook (in App.tsx)
 * 2. The listener needs to persist across component re-renders
 * 3. Having a single global listener ensures all terminal output is captured
 *    regardless of which project is currently active or which terminals are rendered
 *
 * This pattern mirrors useIpc.ts where module-level state is used for IPC batching.
 */
let globalCleanup: (() => void) | null = null;

/**
 * Hook to set up global terminal output listeners that persist across project switches.
 *
 * This hook solves the terminal output freezing issue when switching between projects.
 * The problem was that terminal output listeners were registered in useTerminalEvents.ts
 * per-terminal component - when a terminal component unmounted (user switches project),
 * the listener was removed and output stopped being buffered.
 *
 * By registering the listener at the app level (like useIpcListeners), we ensure:
 * 1. Terminal output is ALWAYS buffered to terminalBufferManager, regardless of which
 *    project is active or which terminal components are mounted
 * 2. When a terminal becomes visible again, it can replay the buffered output
 * 3. No output is lost during project navigation
 *
 * This hook should be called once in App.tsx alongside useIpcListeners().
 */
export function useGlobalTerminalListeners(): void {
  useEffect(() => {
    // Only register once - prevent duplicate listeners
    if (globalCleanup) {
      if (window.DEBUG) {
        console.warn('[GlobalTerminalListeners] Listener already registered, skipping');
      }
      return;
    }

    if (window.DEBUG) {
      console.warn('[GlobalTerminalListeners] Registering global terminal output listener');
    }

    // Register global terminal output listener
    // This listener runs for ALL terminals, regardless of which project is active
    globalCleanup = window.electronAPI.onTerminalOutput((terminalId: string, data: string) => {
      // Always append to buffer - this ensures output is captured even when
      // the terminal component is not mounted (user viewing different project)
      terminalBufferManager.append(terminalId, data);

      if (window.DEBUG) {
        const bufferSize = terminalBufferManager.getSize(terminalId);
        console.warn(`[GlobalTerminalListeners] Buffered output for ${terminalId}, buffer size: ${bufferSize}`);
      }
    });

    // Cleanup on unmount (app shutdown)
    return () => {
      if (globalCleanup) {
        if (window.DEBUG) {
          console.warn('[GlobalTerminalListeners] Cleaning up global terminal output listener');
        }
        globalCleanup();
        globalCleanup = null;
      }
    };
  }, []); // Empty deps - only run once on mount
}
