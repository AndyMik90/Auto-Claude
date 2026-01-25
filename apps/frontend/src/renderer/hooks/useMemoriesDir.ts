import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch the platform-specific memories directory path.
 * Reduces duplication across components that need this path.
 */
export function useMemoriesDir(): string {
  const [memoriesDir, setMemoriesDir] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    window.electronAPI.getMemoriesDir()
      .then((result) => {
        if (isMounted && result.success && result.data) {
          setMemoriesDir(result.data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to get memories directory:', err);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return memoriesDir;
}
