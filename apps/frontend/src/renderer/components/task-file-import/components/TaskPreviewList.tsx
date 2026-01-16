/**
 * TaskPreviewList - Scrollable list of task preview cards
 */

import { ScrollArea } from '../../ui/scroll-area';
import { TaskPreviewCard } from './TaskPreviewCard';
import type { ParsedTask } from '../types';

interface TaskPreviewListProps {
  tasks: ParsedTask[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
}

export function TaskPreviewList({
  tasks,
  selectedIds,
  onToggle,
  disabled = false
}: TaskPreviewListProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <ScrollArea className="flex-1 -mx-1 px-1">
      <div className="space-y-2 py-1">
        {tasks.map((task) => (
          <TaskPreviewCard
            key={task.parseId}
            task={task}
            isSelected={selectedIds.has(task.parseId)}
            onToggle={() => onToggle(task.parseId)}
            disabled={disabled}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
