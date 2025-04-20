import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

import 'react-big-calendar/lib/css/react-big-calendar.css';

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

interface Task {
  id: string;
  title: string;
  status: string;
  priority: 'low' | 'medium' | 'high';
  finish_date: string | null;
  assigned_to: string | null;
  assigned_to_email: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: Task;
}

interface UpcomingTasksCalendarProps {
  clientId?: string;
  agencyId?: string;
  onTaskClick?: (taskId: string) => void;
}

export function UpcomingTasksCalendar({ clientId, agencyId, onTaskClick }: UpcomingTasksCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { systemSettings } = useAppContext();

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchTasks();
  }, [clientId, agencyId, currentDate]);

  useEffect(() => {
    // Convert tasks to calendar events
    const taskEvents = tasks
      .filter(task => task.finish_date) // Only include tasks with due dates
      .map(task => {
        const dueDate = new Date(task.finish_date!);
        return {
          id: task.id,
          title: task.title,
          start: dueDate,
          end: dueDate,
          allDay: true,
          resource: task,
        };
      });

    setEvents(taskEvents);
  }, [tasks]);

  async function fetchTasks() {
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching tasks for calendar',
        { clientId, agencyId, month: format(currentDate, 'yyyy-MM') }
      );
      
      // Get first and last day of current month
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      let query = supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          priority,
          finish_date,
          assigned_to
        `)
        .or(`finish_date.gte.${firstDay.toISOString()},finish_date.lte.${lastDay.toISOString()}`);

      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (agencyId) {
        query = query.eq('agency_id', agencyId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logApiCall('tasks.select', false, { error: fetchError });
        throw fetchError;
      }
      
      logApiCall('tasks.select', true, { count: data?.length });

      // Get assigned user emails in a separate query
      const tasksWithAssignees = data || [];
      const assignedUserIds = tasksWithAssignees
        .map(task => task.assigned_to)
        .filter(id => id != null);

      if (assignedUserIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from('user_roles')
          .select('user_id, email')
          .in('user_id', assignedUserIds);

        if (userError) {
          logApiCall('user_roles.select', false, { error: userError });
          throw userError;
        }
        
        logApiCall('user_roles.select', true, { count: userData?.length });

        // Create a map of user IDs to emails
        const userEmailMap = new Map(userData?.map(user => [user.user_id, user.email]) || []);

        // Add email to tasks
        const tasksWithEmails = tasksWithAssignees.map(task => ({
          ...task,
          assigned_to_email: task.assigned_to ? userEmailMap.get(task.assigned_to) : null
        }));

        setTasks(tasksWithEmails);
      } else {
        setTasks(tasksWithAssignees);
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Tasks fetched successfully for calendar',
        { count: tasksWithAssignees.length }
      );
    } catch (err) {
      console.error('Error fetching tasks for calendar:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching tasks for calendar',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }

  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'PREV') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (action === 'NEXT') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (action === 'TODAY') {
      setCurrentDate(new Date());
    }
  };

  // Custom event styling based on task status and priority
  const eventStyleGetter = (event: CalendarEvent) => {
    const task = event.resource;
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
  const CustomToolbar = ({ onNavigate, label }: any) => {
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('PREV')}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onNavigate('TODAY')}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={() => onNavigate('NEXT')}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {label}
        </h2>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 500 }}
        onSelectEvent={(event) => onTaskClick && onTaskClick(event.id)}
        eventPropGetter={eventStyleGetter}
        components={{
          toolbar: CustomToolbar,
        }}
        date={currentDate}
        onNavigate={handleNavigate}
      />
    </div>
  );
}