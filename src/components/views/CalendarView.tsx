import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Task } from '../../lib/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

interface CalendarViewProps {
  clientId: string;
  boardId: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onTaskClick: (taskId: string) => void;
}

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  // Convert tasks to calendar events
  const events = useMemo(() => {
    return tasks
      .filter(task => task.start_date || task.finish_date) // Only include tasks with dates
      .map(task => ({
        id: task.id,
        title: task.title,
        start: task.start_date ? new Date(task.start_date) : new Date(task.finish_date!),
        end: task.finish_date ? new Date(task.finish_date) : new Date(task.start_date!),
        allDay: false,
        resource: task,
      }));
  }, [tasks]);

  // Custom event styling based on task status and priority
  const eventStyleGetter = (event: any) => {
    const task = event.resource as Task;
    let backgroundColor = '#3B82F6'; // Default blue

    // Status-based colors
    switch (task.status) {
      case 'inbox':
        backgroundColor = '#94A3B8';
        break;
      case 'todo':
        backgroundColor = '#3B82F6';
        break;
      case 'doing':
        backgroundColor = '#EAB308';
        break;
      case 'done':
        backgroundColor = '#22C55E';
        break;
    }

    // Priority indicator
    let borderLeft = '4px solid';
    switch (task.priority) {
      case 'low':
        borderLeft += ' #22C55E';
        break;
      case 'medium':
        borderLeft += ' #EAB308';
        break;
      case 'high':
        borderLeft += ' #EF4444';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderLeft,
        color: '#fff',
        borderRadius: '4px',
      },
    };
  };

  // Custom toolbar to match app styling
  const CustomToolbar = (toolbar: any) => {
    const goToBack = () => {
      toolbar.onNavigate('PREV');
    };

    const goToNext = () => {
      toolbar.onNavigate('NEXT');
    };

    const goToCurrent = () => {
      toolbar.onNavigate('TODAY');
    };

    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={goToBack}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            onClick={goToCurrent}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={goToNext}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Next
          </button>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {toolbar.label}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toolbar.onView(Views.MONTH)}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              toolbar.view === Views.MONTH
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => toolbar.onView(Views.WEEK)}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              toolbar.view === Views.WEEK
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => toolbar.onView(Views.DAY)}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              toolbar.view === Views.DAY
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Day
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-16rem)] bg-white rounded-lg shadow p-6">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        onSelectEvent={(event) => onTaskClick(event.id)}
        eventPropGetter={eventStyleGetter}
        components={{
          toolbar: CustomToolbar,
        }}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        defaultView={Views.MONTH}
      />
    </div>
  );
}