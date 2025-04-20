import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  assigned_to: string;
  assigned_to_email?: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
}

interface TaskColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

export function TaskColumn({ id, title, tasks, onTaskClick }: TaskColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex-shrink-0 w-80">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title} ({tasks.length})</h3>
        <div
          ref={setNodeRef}
          className="space-y-3"
        >
          <SortableContext
            items={tasks.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
              />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}