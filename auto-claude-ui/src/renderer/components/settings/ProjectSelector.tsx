import { useState, useCallback } from 'react';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Separator } from '../ui/separator';
import { useProjectStore, removeProject } from '../../stores/project-store';
import { AddProjectModal } from '../AddProjectModal';
import type { Project } from '../../../shared/types';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onProjectAdded?: (project: Project, needsInit: boolean) => void;
}

export function ProjectSelector({
  selectedProjectId,
  onProjectChange,
  onProjectAdded
}: ProjectSelectorProps) {
  const projects = useProjectStore((state) => state.projects);
  const [showAddModal, setShowAddModal] = useState(false);
  const [open, setOpen] = useState(false);

  const handleValueChange = (value: string) => {
    if (value === '__add_new__') {
      setShowAddModal(true);
      setOpen(false);
    } else {
      onProjectChange(value || null);
      setOpen(false);
    }
  };

  const handleRemoveProject = useCallback(async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await removeProject(projectId);
    // Close dropdown after removal
    setOpen(false);
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <>
      <div className="space-y-2 w-full overflow-hidden">
        <Select
          value={selectedProjectId || ''}
          onValueChange={handleValueChange}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectTrigger className="w-full max-w-full overflow-hidden">
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate min-w-0 flex-1 text-left">
                {selectedProject?.name || 'Select a project...'}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent
            className="w-[var(--radix-select-trigger-width)] max-w-[280px]"
            position="popper"
            sideOffset={4}
          >
            {projects.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                <p>No projects yet</p>
              </div>
            ) : (
              projects.map((project) => (
                <SelectItem
                  key={project.id}
                  value={project.id}
                  className="pr-2"
                >
                  <div className="flex items-center gap-2 w-full min-w-0 max-w-full">
                    <span className="truncate flex-1 min-w-0" title={`${project.name} - ${project.path}`}>
                      {project.name}
                    </span>
                    <button
                      type="button"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => handleRemoveProject(project.id, e)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </SelectItem>
              ))
            )}
            <Separator className="my-1" />
            <SelectItem value="__add_new__">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 shrink-0" />
                <span>Add Project...</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Project path - shown when project is selected */}
        {selectedProject && (
          <p
            className="text-xs text-muted-foreground px-1 truncate"
            title={selectedProject.path}
          >
            {selectedProject.path}
          </p>
        )}
      </div>

      <AddProjectModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onProjectAdded={(project, needsInit) => {
          onProjectChange(project.id);
          onProjectAdded?.(project, needsInit);
        }}
      />
    </>
  );
}
