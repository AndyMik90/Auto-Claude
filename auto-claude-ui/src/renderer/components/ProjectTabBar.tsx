import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { SortableProjectTab } from './SortableProjectTab';
import type { Project } from '../../shared/types';

interface ProjectTabBarProps {
  projects: Project[];
  activeProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectClose: (projectId: string) => void;
  onAddProject: () => void;
  className?: string;
}

export function ProjectTabBar({
  projects,
  activeProjectId,
  onProjectSelect,
  onProjectClose,
  onAddProject,
  className
}: ProjectTabBarProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center border-b border-border bg-background',
      'overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
      className
    )}>
      <div className="flex items-center flex-1 min-w-0">
        {projects.map((project) => (
          <SortableProjectTab
            key={project.id}
            project={project}
            isActive={activeProjectId === project.id}
            canClose={projects.length > 1}
            onSelect={() => onProjectSelect(project.id)}
            onClose={(e) => {
              e.stopPropagation();
              onProjectClose(project.id);
            }}
          />
        ))}
      </div>

      <div className="flex items-center px-2 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onAddProject}
          title="Add Project"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}