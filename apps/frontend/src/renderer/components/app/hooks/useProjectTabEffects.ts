import { useEffect } from 'react';
import type { Project } from '@shared/types';
import { useProjectStore } from '@/stores/project-store';

/**
 * Hook to handle project tab management effects
 * Handles tab restoration and automatic tab opening
 */
export function useProjectTabEffects(
  projects: Project[],
  openProjectIds: string[],
  activeProjectId: string | null,
  selectedProjectId: string | null
) {
  const { getProjectTabs, openProjectTab, setActiveProject } = useProjectStore();

  // Get tabs and selected project
  const projectTabs = getProjectTabs();

  // Restore tab state and open tabs for loaded projects
  useEffect(() => {
    console.log('[useProjectTabEffects] Tab restore useEffect triggered:', {
      projectsCount: projects.length,
      openProjectIds,
      activeProjectId,
      selectedProjectId,
      projectTabsCount: projectTabs.length,
      projectTabIds: projectTabs.map(p => p.id)
    });

    if (projects.length > 0) {
      // Check openProjectIds (persisted state) instead of projectTabs (computed)
      // to avoid race condition where projectTabs is empty before projects load
      if (openProjectIds.length === 0) {
        // No tabs persisted at all, open the first available project
        const projectToOpen = activeProjectId || selectedProjectId || projects[0].id;
        console.log('[useProjectTabEffects] No tabs persisted, opening project:', projectToOpen);
        // Verify the project exists before opening
        if (projects.some(p => p.id === projectToOpen)) {
          openProjectTab(projectToOpen);
          setActiveProject(projectToOpen);
        } else {
          // Fallback to first project if stored IDs are invalid
          console.log('[useProjectTabEffects] Project not found, falling back to first project:', projects[0].id);
          openProjectTab(projects[0].id);
          setActiveProject(projects[0].id);
        }
        return;
      }
      console.log('[useProjectTabEffects] Tabs already persisted, checking active project');
      // If there's an active project but no tabs open for it, open a tab
      // Note: Use openProjectIds instead of projectTabs to avoid re-render loop
      // (projectTabs creates a new array on every render)
      if (activeProjectId && !openProjectIds.includes(activeProjectId)) {
        console.log('[useProjectTabEffects] Active project has no tab, opening:', activeProjectId);
        openProjectTab(activeProjectId);
      }
      // If there's a selected project but no active project, make it active
      else if (selectedProjectId && !activeProjectId) {
        console.log('[useProjectTabEffects] No active project, using selected:', selectedProjectId);
        setActiveProject(selectedProjectId);
        openProjectTab(selectedProjectId);
      } else {
        console.log('[useProjectTabEffects] Tab state is valid, no action needed');
      }
    }
  }, [projects, activeProjectId, selectedProjectId, openProjectIds, openProjectTab, setActiveProject, projectTabs]);
}
