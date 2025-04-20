import React, { useEffect, useState, useMemo } from 'react';
import { Task } from '../../lib/types';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface GanttViewProps {
  clientId: string;
  boardId: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onTaskClick: (taskId: string) => void;
}

interface GanttTask {
  id: string;
  title: string;
  start: Date;
  end: Date;
  progress: number;
  dependencies: string[];
  status: string;
  priority: string;
}

export function GanttView({ tasks, onTaskClick }: GanttViewProps) {
  const [timeScale, setTimeScale] = useState<'day' | 'week' | 'month'>('week');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Calculate date range for the Gantt chart
  const dateRange = useMemo(() => {
    const range: Date[] = [];
    const end = new Date(startDate);

    switch (timeScale) {
      case 'day':
        end.setDate(end.getDate() + 14); // Show 2 weeks
        for (let d = new Date(startDate); d <= end; d.setDate(d.getDate() + 1)) {
          range.push(new Date(d));
        }
        break;
      case 'week':
        end.setDate(end.getDate() + 56); // Show 8 weeks
        for (let d = new Date(startDate); d <= end; d.setDate(d.getDate() + 7)) {
          range.push(new Date(d));
        }
        break;
      case 'month':
        end.setMonth(end.getMonth() + 6); // Show 6 months
        for (let d = new Date(startDate); d <= end; d.setMonth(d.getMonth() + 1)) {
          range.push(new Date(d));
        }
        break;
    }

    return range;
  }, [startDate, timeScale]);

  // Process tasks for Gantt display
  const ganttTasks = useMemo(() => {
    return tasks
      .filter(task => task.start_date || task.finish_date)
      .map(task => ({
        id: task.id,
        title: task.title,
        start: task.start_date ? new Date(task.start_date) : new Date(task.finish_date!),
        end: task.finish_date ? new Date(task.finish_date) : new Date(task.start_date!),
        progress: task.status === 'done' ? 100 : task.status === 'doing' ? 50 : 0,
        dependencies: [], // TODO: Implement task dependencies
        status: task.status,
        priority: task.priority,
      }));
  }, [tasks]);

  // Calculate task position and width
  const getTaskStyle = (task: GanttTask) => {
    const totalDays = Math.ceil((dateRange[dateRange.length - 1].getTime() - dateRange[0].getTime()) / (1000 * 60 * 60 * 24));
    const taskStart = Math.max(task.start.getTime(), dateRange[0].getTime());
    const taskEnd = Math.min(task.end.getTime(), dateRange[dateRange.length - 1].getTime());
    
    const left = ((taskStart - dateRange[0].getTime()) / (totalDays * 24 * 60 * 60 * 1000)) * 100;
    const width = ((taskEnd - taskStart) / (totalDays * 24 * 60 * 60 * 1000)) * 100;

    return {
      left: `${left}%`,
      width: `${width}%`,
    };
  };

  // Get background color based on task status
  const getTaskColor = (task: GanttTask) => {
    switch (task.status) {
      case 'inbox':
        return 'bg-gray-400';
      case 'todo':
        return 'bg-blue-500';
      case 'doing':
        return 'bg-yellow-500';
      case 'done':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  // Get border color based on task priority
  const getTaskBorder = (task: GanttTask) => {
    switch (task.priority) {
      case 'low':
        return 'border-l-4 border-green-500';
      case 'medium':
        return 'border-l-4 border-yellow-500';
      case 'high':
        return 'border-l-4 border-red-500';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTimeScale('day')}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md',
                timeScale === 'day'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              )}
            >
              Day
            </button>
            <button
              onClick={() => setTimeScale('week')}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md',
                timeScale === 'week'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              )}
            >
              Week
            </button>
            <button
              onClick={() => setTimeScale('month')}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md',
                timeScale === 'month'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              )}
            >
              Month
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const newDate = new Date(startDate);
                switch (timeScale) {
                  case 'day':
                    newDate.setDate(newDate.getDate() - 14);
                    break;
                  case 'week':
                    newDate.setDate(newDate.getDate() - 56);
                    break;
                  case 'month':
                    newDate.setMonth(newDate.getMonth() - 6);
                    break;
                }
                setStartDate(newDate);
              }}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setStartDate(new Date())}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={() => {
                const newDate = new Date(startDate);
                switch (timeScale) {
                  case 'day':
                    newDate.setDate(newDate.getDate() + 14);
                    break;
                  case 'week':
                    newDate.setDate(newDate.getDate() + 56);
                    break;
                  case 'month':
                    newDate.setMonth(newDate.getMonth() + 6);
                    break;
                }
                setStartDate(newDate);
              }}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden">
            <div className="min-w-full">
              {/* Timeline Header */}
              <div className="grid" style={{ gridTemplateColumns: '300px 1fr' }}>
                <div className="bg-gray-50 px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Task
                </div>
                <div className="bg-gray-50">
                  <div className="flex">
                    {dateRange.map((date, index) => (
                      <div
                        key={date.toISOString()}
                        className="flex-1 px-2 py-3 text-center text-sm font-semibold text-gray-900 border-l border-gray-200"
                      >
                        {format(date, timeScale === 'day' ? 'MMM d' : timeScale === 'week' ? 'MMM d' : 'MMM yyyy')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="divide-y divide-gray-200 bg-white">
                {ganttTasks.length === 0 ? (
                  <div className="px-6 py-4 text-center text-sm text-gray-500">
                    No tasks with dates found
                  </div>
                ) : (
                  ganttTasks.map((task) => (
                    <div
                      key={task.id}
                      className="grid hover:bg-gray-50 cursor-pointer"
                      style={{ gridTemplateColumns: '300px 1fr' }}
                      onClick={() => onTaskClick(task.id)}
                    >
                      <div className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <span className="truncate">{task.title}</span>
                          {task.priority === 'high' && (
                            <AlertCircle className="ml-2 h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="relative py-4">
                        <div
                          className={`absolute h-6 rounded ${getTaskColor(task)} ${getTaskBorder(task)}`}
                          style={getTaskStyle(task)}
                        >
                          <div className="px-2 py-1 text-xs font-medium text-white truncate">
                            {task.title}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}