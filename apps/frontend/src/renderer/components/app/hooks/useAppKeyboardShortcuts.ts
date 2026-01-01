import { useEffect } from 'react';
import type { SidebarView } from '@/components/Sidebar';
import { useProjectStore, openProjectTab } from '@/stores/project-store';
import type { Project } from '@shared/types';

/**
 * Hook to handle keyboard shortcuts at the app level
 */
export function useAppKeyboardShortcuts(
  activeView: SidebarView,
  openProjectTab: (projectId: string) => void
) {
  // Global keyboard shortcut: Cmd/Ctrl+T to add project (when not on terminals view)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Skip if in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Cmd/Ctrl+T: Add new project (only when not on terminals view)
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && activeView !== 'terminals') {
        e.preventDefault();
        try {
          const path = await window.electronAPI.selectDirectory();
          if (path) {
            const { addProject } = useProjectStore.getState();
            const project = await addProject(path);
            if (project) {
              openProjectTab(project.id);
            }
          }
        } catch (error) {
          console.error('Failed to add project:', error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, openProjectTab]);
}
