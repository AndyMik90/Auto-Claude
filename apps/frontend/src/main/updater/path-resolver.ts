/**
 * Path resolution utilities for Auto Claude updater
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Get the path to the bundled backend source
 */
export function getBundledSourcePath(): string {
  // In production, use app resources
  // In development, use the repo's apps/backend folder
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }

  // Development mode - look for backend in various locations
  const possiblePaths = [
    // New structure: apps/frontend -> apps/backend
    path.join(app.getAppPath(), '..', 'backend'),
    path.join(app.getAppPath(), '..', '..', 'apps', 'backend'),
    path.join(process.cwd(), 'apps', 'backend'),
    path.join(process.cwd(), '..', 'backend')
  ];

  for (const p of possiblePaths) {
    // Validate it's a proper backend source (must have runners/spec_runner.py)
    const markerPath = path.join(p, 'runners', 'spec_runner.py');
    if (existsSync(p) && existsSync(markerPath)) {
      return p;
    }
  }

  // Fallback - warn if this path is also invalid
  const fallback = path.join(app.getAppPath(), '..', 'backend');
  const fallbackMarker = path.join(fallback, 'runners', 'spec_runner.py');
  if (!existsSync(fallbackMarker)) {
    console.warn(
      `[path-resolver] No valid backend source found in development paths, fallback "${fallback}" may be invalid`
    );
  }
  return fallback;
}

/**
 * Get the path for storing downloaded updates
 */
export function getUpdateCachePath(): string {
  return path.join(app.getPath('userData'), 'auto-claude-updates');
}

/**
 * Get the effective source path (considers override from updates and settings)
 */
export function getEffectiveSourcePath(): string {
  // First, check user settings for configured autoBuildPath
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      if (settings.autoBuildPath && existsSync(settings.autoBuildPath)) {
        const debugSourcePath = ['true', '1', 'yes', 'on'].includes(
          (process.env.AUTO_CLAUDE_DEBUG_SOURCE_PATH ?? '').toLowerCase()
        );
        const devUsePackagedOverride = ['true', '1', 'yes', 'on'].includes(
          (process.env.AUTO_CLAUDE_DEV_USE_PACKAGED_AUTOBUILD ?? '').toLowerCase()
        );
        if (debugSourcePath) {
          console.warn('[path-resolver] EffectiveSourcePath decision', {
            appIsPackaged: app.isPackaged,
            settingsAutoBuildPath: settings.autoBuildPath,
            devUsePackagedOverride
          });
        }

        // Dev safeguard: avoid accidentally using the installed /Applications app bundle
        // as backend source when running `npm run dev`.
        //
        // To force using the packaged backend path in dev, set:
        //   AUTO_CLAUDE_DEV_USE_PACKAGED_AUTOBUILD=1
        if (
          !app.isPackaged &&
          !devUsePackagedOverride
        ) {
          const looksLikeMacAppBundle =
            settings.autoBuildPath.includes('/Applications/Auto-Claude.app/') ||
            settings.autoBuildPath.includes('/Applications/Auto Claude.app/');
          if (debugSourcePath) {
            console.warn('[path-resolver] Dev filter', {
              looksLikeMacAppBundle,
              settingsAutoBuildPath: settings.autoBuildPath
            });
          }
          if (looksLikeMacAppBundle) {
            console.warn(
              '[path-resolver] Dev mode: ignoring settings.autoBuildPath pointing at installed app bundle; using repo auto-detection instead:',
              settings.autoBuildPath
            );
            // Fall through to bundled source detection for dev (repo backend).
            return getBundledSourcePath();
          }
        }

        // Validate it's a proper backend source (must have runners/spec_runner.py)
        const markerPath = path.join(settings.autoBuildPath, 'runners', 'spec_runner.py');
        if (existsSync(markerPath)) {
          return settings.autoBuildPath;
        }
        // Invalid path - log warning and fall through to auto-detection
        console.warn(
          `[path-resolver] Configured autoBuildPath "${settings.autoBuildPath}" is missing runners/spec_runner.py, falling back to bundled source`
        );
      }
    }
  } catch {
    // Ignore settings read errors
  }

  if (app.isPackaged) {
    // Check for user-updated source first
    const overridePath = path.join(app.getPath('userData'), 'backend-source');
    const overrideMarker = path.join(overridePath, 'runners', 'spec_runner.py');
    if (existsSync(overridePath) && existsSync(overrideMarker)) {
      return overridePath;
    }
  }

  return getBundledSourcePath();
}

/**
 * Get the path where updates should be installed
 */
export function getUpdateTargetPath(): string {
  if (app.isPackaged) {
    // For packaged apps, store in userData as a source override
    return path.join(app.getPath('userData'), 'backend-source');
  } else {
    // In development, update the actual source
    return getBundledSourcePath();
  }
}
