/**
 * Environment utility functions for augmenting child process environments.
 *
 * Provides augmented PATH to ensure common tools like GitHub CLI (gh)
 * are accessible even when installed via Homebrew or other non-standard locations.
 */

/**
 * Get augmented environment with common PATH additions.
 * Ensures Homebrew and other common installation locations are available.
 *
 * This is particularly important for Electron apps on macOS, where the app
 * doesn't inherit the user's shell environment (which includes Homebrew paths).
 *
 * @returns Environment object with augmented PATH
 *
 * @example
 * ```typescript
 * execSync('gh --version', { env: getAugmentedEnv() });
 * ```
 */
export function getAugmentedEnv(): NodeJS.ProcessEnv {
  const currentPath = process.env.PATH || '';

  // Common PATH additions by platform
  const pathAdditions: string[] = [];

  if (process.platform === 'darwin') {
    // macOS: Homebrew paths
    pathAdditions.push(
      '/opt/homebrew/bin',      // Apple Silicon Homebrew
      '/opt/homebrew/sbin',
      '/usr/local/bin',         // Intel Homebrew
      '/usr/local/sbin'
    );
  } else if (process.platform === 'linux') {
    // Linux: Common installation locations
    pathAdditions.push(
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      `${process.env.HOME}/.local/bin`
    );
  } else if (process.platform === 'win32') {
    // Windows: gh CLI common locations
    pathAdditions.push(
      'C:\\Program Files\\GitHub CLI',
      'C:\\Program Files (x86)\\GitHub CLI'
    );
  }

  // Filter out paths already in PATH and deduplicate
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const currentPaths = currentPath.split(pathSeparator).filter(p => p.length > 0);
  const uniqueAdditions = pathAdditions.filter(p => !currentPaths.includes(p));

  // Prepend new paths to ensure they're checked first
  const newPath = [...uniqueAdditions, ...currentPaths].join(pathSeparator);

  return {
    ...process.env,
    PATH: newPath
  };
}
