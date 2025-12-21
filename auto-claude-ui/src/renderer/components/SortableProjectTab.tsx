import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';
import type { Project } from '../../shared/types';

interface SortableProjectTabProps {
  project: Project;
  isActive: boolean;
  canClose: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}

export function SortableProjectTab({
  project,
  isActive,
  canClose,
  onSelect,
  onClose
}: SortableProjectTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Prevent z-index stacking issues during drag
    zIndex: isDragging ? 50 : undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center min-w-0 max-w-[200px]',
        'border-r border-border last:border-r-0',
        'touch-none transition-all duration-200',
        isDragging && 'opacity-60 scale-[0.98] shadow-lg'
      )}
      {...attributes}
    >
      <div
        className={cn(
          'flex-1 flex items-center gap-2 px-4 py-2.5 text-sm',
          'min-w-0 truncate hover:bg-muted/50 transition-colors',
          'border-b-2 border-transparent',
          isActive && [
            'bg-background border-b-primary text-foreground',
            'hover:bg-background'
          ],
          !isActive && [
            'text-muted-foreground',
            'hover:text-foreground'
          ]
        )}
        onClick={onSelect}
        title={project.name}
      >
        {/* Drag handle - visible on hover */}
        <div
          {...listeners}
          className={cn(
            'opacity-0 group-hover:opacity-60 transition-opacity',
            'cursor-grab active:cursor-grabbing',
            'w-1 h-4 bg-muted-foreground rounded-full'
          )}
        />
        <span className="truncate font-medium">
          {project.name}
        </span>
      </div>

      {canClose && (
        <button
          className={cn(
            'h-6 w-6 p-0 mr-1 opacity-0 group-hover:opacity-100',
            'transition-opacity duration-200',
            'hover:bg-destructive hover:text-destructive-foreground',
            isActive && 'opacity-100'
          )}
          onClick={onClose}
          title={`Close ${project.name}`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}