import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { TaskColumn } from './TaskColumn';
import { TASK_STATUS_COLUMNS } from '../constants/tasks';
import type { Task, TaskStatus } from '../types';

// Type guard for valid drop column targets
const VALID_DROP_COLUMNS = new Set<string>(TASK_STATUS_COLUMNS);
function isValidDropColumn(id: string): id is typeof TASK_STATUS_COLUMNS[number] {
  return VALID_DROP_COLUMNS.has(id);
}

/**
 * Get the visual column for a task status.
 * pr_created and error tasks are mapped to appropriate columns for display.
 */
function getVisualColumn(status: TaskStatus): typeof TASK_STATUS_COLUMNS[number] {
  if (status === 'pr_created') return 'done';
  if (status === 'error') return 'human_review';
  return status;
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onNewTaskClick?: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  onNewTaskClick,
  onStatusChange,
  onDelete
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // 8px movement required before drag starts
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Group tasks by status column
  const tasksByStatus = useMemo(() => {
    const grouped: Record<typeof TASK_STATUS_COLUMNS[number], Task[]> = {
      backlog: [],
      queue: [],
      in_progress: [],
      ai_review: [],
      human_review: [],
      done: []
    };

    tasks.forEach((task) => {
      // Map tasks to visual columns
      const targetColumn = getVisualColumn(task.status);
      if (grouped[targetColumn]) {
        grouped[targetColumn].push(task);
      }
    });

    // Sort tasks within each column by updatedAt (newest first)
    Object.keys(grouped).forEach((status) => {
      const statusKey = status as typeof TASK_STATUS_COLUMNS[number];
      grouped[statusKey].sort((a, b) => {
        const dateA = new Date(a.metadata.updatedAt).getTime();
        const dateB = new Date(b.metadata.updatedAt).getTime();
        return dateB - dateA;
      });
    });

    return grouped;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (!over) {
      setOverColumnId(null);
      return;
    }

    const overId = over.id as string;

    // Check if over a column
    if (isValidDropColumn(overId)) {
      setOverColumnId(overId);
      return;
    }

    // Check if over a task - get its column
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      setOverColumnId(getVisualColumn(overTask.status));
    }
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Find the task being dragged
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;

    // Determine target status
    let newStatus: TaskStatus | null = null;

    // Check if dropped on a column
    if (isValidDropColumn(overId)) {
      newStatus = overId;
    } else {
      // Check if dropped on another task
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        const taskVisualColumn = getVisualColumn(task.status);
        const overTaskVisualColumn = getVisualColumn(overTask.status);

        // Same column: just reordering, no status change needed
        if (taskVisualColumn === overTaskVisualColumn) {
          return;
        }

        // Different column: move to that task's column
        newStatus = overTask.status;
      }
    }

    if (!newStatus || newStatus === task.status) return;

    // Call status change handler if provided
    if (onStatusChange) {
      await onStatusChange(activeTaskId, newStatus);
    }
  }, [tasks, onStatusChange]);

  const handleStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    if (onStatusChange) {
      onStatusChange(taskId, newStatus);
    }
  }, [onStatusChange]);

  const handleDelete = useCallback((taskId: string) => {
    if (onDelete) {
      onDelete(taskId);
    }
  }, [onDelete]);

  return (
    <div className="flex h-full flex-col">
      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {TASK_STATUS_COLUMNS.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskClick={onTaskClick}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              isOver={overColumnId === status}
              onAddClick={status === 'backlog' ? onNewTaskClick : undefined}
            />
          ))}
        </div>

        {/* Drag overlay - shows task being dragged */}
        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 scale-105 shadow-2xl">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
