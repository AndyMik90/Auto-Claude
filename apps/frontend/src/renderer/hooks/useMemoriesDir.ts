import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch the platform-specific memories directory path.
 * Reduces duplication across components that need this path.
 */
export function useMemoriesDir(): string {
  const [memoriesDir, setMemoriesDir] = useState<string>('');

  useEffect(() => {
    window.electronAPI.getMemoriesDir()
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
