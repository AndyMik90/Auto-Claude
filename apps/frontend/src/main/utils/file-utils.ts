import { writeFileSync, renameSync, unlinkSync, readFileSync } from 'fs';

/**
 * Atomic file write to prevent TOCTOU race conditions.
 * Writes to a temporary file first, then atomically renames to target.
 * This ensures the target file is never in an inconsistent state.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(tempPath, content, 'utf-8');
    renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if rename failed
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Safe file read that handles missing files without TOCTOU issues.
 * Returns null if file doesn't exist or can't be read.
 */
export function safeReadFileSync(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    // ENOENT (file not found) is expected, other errors should be logged
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[safeReadFileSync] Error reading ${filePath}:`, error);
    }
    return null;
  }
}
