/**
 * Version management utilities
 */

import { app } from 'electron';

/**
 * Get the current app/framework version
 *
 * Uses app.getVersion() (from package.json) as the single source of truth.
 * Both the Electron app and auto-claude framework share the same version.
 */
export function getBundledVersion(): string {
  return app.getVersion();
}

/**
 * Parse version from GitHub release tag
 * Handles tags like "v1.2.0", "1.2.0", "v1.2.0-beta"
 */
export function parseVersionFromTag(tag: string): string {
  // Remove leading 'v' if present
  return tag.replace(/^v/, '');
}

/**
 * Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}
