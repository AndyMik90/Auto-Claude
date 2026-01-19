import { useState, useEffect } from 'react';

/**
 * Hook to fetch platform-specific memories directory path.
 * Centralizes the logic for getting the memories directory across components.
 *
 * @returns The memories directory path or empty string if not yet loaded
 */
export function useMemoriesDir(): string {
  const [memoriesDir, setMemoriesDir] = useState<string>('');

  useEffect(() => {
    window.electronAPI
      .getMemoriesDir()
      .then((result) => {
        if (result.success && result.data) {
          setMemoriesDir(result.data);
        }
      })
      .catch((err) => {
        console.error('Failed to get memories directory:', err);
      });
  }, []);

  return memoriesDir;
}
