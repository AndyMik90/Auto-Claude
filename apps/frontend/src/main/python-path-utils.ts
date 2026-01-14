/**
 * Python Path Utilities
 *
 * Centralized utilities for constructing Python executable paths
 * across different environment types (conda, venv) and platforms.
 */

import path from 'path';

/**
 * Get the Python executable path within a conda environment.
 * Conda environments have python.exe at the root level on Windows.
 */
export function getCondaPythonPath(envPath: string): string {
  if (process.platform === 'win32') {
    return path.join(envPath, 'python.exe');
  }
  return path.join(envPath, 'bin', 'python');
}

/**
 * Get the Python executable path within a venv.
 * Venvs have python.exe in the Scripts folder on Windows.
 */
export function getVenvPythonPath(venvPath: string): string {
  if (process.platform === 'win32') {
    return path.join(venvPath, 'Scripts', 'python.exe');
  }
  return path.join(venvPath, 'bin', 'python');
}

/**
 * Get the pip executable path within an environment.
 * Both conda and venv use Scripts folder on Windows.
 */
export function getPipPath(envPath: string): string {
  if (process.platform === 'win32') {
    return path.join(envPath, 'Scripts', 'pip.exe');
  }
  return path.join(envPath, 'bin', 'pip');
}
