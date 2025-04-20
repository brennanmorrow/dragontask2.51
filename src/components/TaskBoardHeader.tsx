import React from 'react';
import { Calendar, List, BarChart2, GanttChartSquare, KanbanSquare, Plus } from 'lucide-react';
import { TaskBoardView } from '../lib/types';
import clsx from 'clsx';
import { useAppContext } from '../lib/AppContext';

interface TaskBoardHeaderProps {
  view: TaskBoardView;
  onViewChange: (view: TaskBoardView) => void;
  onNewTask: () => void;
}

const views: { id: TaskBoardView; icon: typeof KanbanSquare; label: string }[] = [
  { id: 'kanban', icon: KanbanSquare, label: 'Kanban' },
  { id: 'list', icon: List, label: 'List' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'gantt', icon: GanttChartSquare, label: 'Gantt' },
  { id: 'reports', icon: BarChart2, label: 'Reports' },
];

export function TaskBoardHeader({ view, onViewChange, onNewTask }: TaskBoardHeaderProps) {
  const { systemSettings } = useAppContext();
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const primaryColorLight = `rgba(${parseInt(primaryColor.slice(1, 3), 16)}, ${parseInt(primaryColor.slice(3, 5), 16)}, ${parseInt(primaryColor.slice(5, 7), 16)}, 0.1)`;
  
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-2">
        {views.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={clsx(
              'inline-flex items-center px-3 py-2 text-sm font-medium rounded-md',
              view === id
                ? 'text-primary'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
            style={view === id ? { backgroundColor: primaryColorLight, color: primaryColor } : {}}
          >
            <Icon className="h-5 w-5 mr-1.5" style={view === id ? { color: primaryColor } : {}} />
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={onNewTask}
        className="inline-flex items-center gap-x-2 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm"
        style={{ 
          backgroundColor: primaryColor,
          '&:hover': { backgroundColor: systemSettings?.secondary_color || '#B91C1C' }
        }}
      >
        <Plus className="h-5 w-5" />
        New Task
      </button>
    </div>
  );
}