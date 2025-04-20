import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Users, CheckSquare, ArrowLeft, Calendar, Clock, CheckCircle, AlertCircle, BarChart2, DollarSign } from 'lucide-react';
import { TaskBoard } from '../components/TaskBoard';
import { UpcomingTasksCalendar } from '../components/UpcomingTasksCalendar';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';
import { ClientBudgetManager } from '../components/ClientBudgetManager';
import { ClientBudgetReport } from '../components/ClientBudgetReport';

interface Client {
  id: string;
  name: string;
  agency: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  client_project_managers?: Array<{
    pm: {
      id: string;
      email: string;
      full_name?: string;
    };
  }>;
}

interface DashboardStats {
  activeTasks: number;
  completedTasks: number;
  budgetHours: number;
  remainingHours: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  finish_date: string | null;
  assigned_to_email: string | null;
}

export function ClientDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'board' | 'calendar' | 'list' | 'budget'>('board');

  useEffect(() => {
    async function fetchClientData() {
      try {
        setIsLoading(true);
        
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.API_CALL,
          'Fetching client data',
          { clientId: id }
        );
        
        // Fetch client details with correct relationship query
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select(`
            *,
            agency:agencies (
              id,
              name,
              logo_url
            ),
            client_project_managers (
              pm:pm_id (
                id,
                email,
                full_name
              )
            )
          `)
          .eq('id', id)
          .single();

        if (clientError) {
          logApiCall('clients.select', false, { error: clientError });
          throw clientError;
        }
        
        logApiCall('clients.select', true, {});
        setClient(clientData);

        // Fetch client statistics
        // Active tasks
        const { count: activeTasksCount, error: activeTasksError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact' })
          .eq('client_id', id)
          .neq('status', 'done');

        if (activeTasksError) {
          logApiCall('tasks.select (active)', false, { error: activeTasksError });
          throw activeTasksError;
        }
        
        // Completed tasks
        const { count: completedTasksCount, error: completedTasksError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact' })
          .eq('client_id', id)
          .eq('status', 'done');

        if (completedTasksError) {
          logApiCall('tasks.select (completed)', false, { error: completedTasksError });
          throw completedTasksError;
        }
        
        // Get current month budget
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
        const { data: budgetData, error: budgetError } = await supabase
          .from('client_budgets')
          .select('hours_budget')
          .eq('client_id', id)
          .eq('month', currentMonth)
          .maybeSingle();

        if (budgetError) {
          logApiCall('client_budgets.select', false, { error: budgetError });
          throw budgetError;
        }
        
        const budgetHours = budgetData?.hours_budget || 0;
        
        // Get hours used this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);
        endOfMonth.setHours(23, 59, 59, 999);
        
        // Get time entries for this month through tasks
        const { data: timeEntries, error: timeError } = await supabase
          .from('task_time_entries')
          .select(`
            id,
            start_time,
            end_time,
            task:tasks!inner(
              id,
              client_id
            )
          `)
          .eq('task.client_id', id)
          .gte('start_time', startOfMonth.toISOString())
          .lte('start_time', endOfMonth.toISOString())
          .not('end_time', 'is', null);

        if (timeError) {
          logApiCall('task_time_entries.select', false, { error: timeError });
          throw timeError;
        }
        
        // Calculate hours used
        const hoursUsed = timeEntries?.reduce((total, entry) => {
          const duration = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
          return total + (duration / (1000 * 60 * 60));
        }, 0) || 0;
        
        const remainingHours = Math.max(0, budgetHours - hoursUsed);

        setStats({
          activeTasks: activeTasksCount || 0,
          completedTasks: completedTasksCount || 0,
          budgetHours: budgetHours,
          remainingHours: remainingHours
        });

        // Fetch recent tasks
        const { data: recentTasksData, error: recentTasksError } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            status,
            priority,
            finish_date,
            assigned_to
          `)
          .eq('client_id', id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentTasksError) {
          logApiCall('tasks.select (recent)', false, { error: recentTasksError });
          throw recentTasksError;
        }
        
        logApiCall('tasks.select (recent)', true, { count: recentTasksData?.length });

        // Get assigned user emails
        const assignedUserIds = recentTasksData
          ?.map(task => task.assigned_to)
          .filter(id => id != null) || [];

        if (assignedUserIds.length > 0) {
          const { data: userRolesData, error: userRolesError } = await supabase
            .from('user_roles')
            .select('user_id, email')
            .in('user_id', assignedUserIds);

          if (userRolesError) {
            logApiCall('user_roles.select', false, { error: userRolesError });
            throw userRolesError;
          }
          
          logApiCall('user_roles.select', true, { count: userRolesData?.length });

          // Create a map of user IDs to emails
          const userEmailMap = new Map(userRolesData?.map(user => [user.user_id, user.email]) || []);

          // Add email to tasks
          const tasksWithEmails = recentTasksData?.map(task => ({
            ...task,
            assigned_to_email: task.assigned_to ? userEmailMap.get(task.assigned_to) : null
          })) || [];

          setRecentTasks(tasksWithEmails);
        } else {
          setRecentTasks(recentTasksData || []);
        }
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.API_CALL,
          'Client data fetched successfully',
          { clientId: id }
        );
      } catch (err) {
        console.error('Error fetching client data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching client data',
          { error: err, clientId: id }
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchClientData();
    }
  }, [id]);

  const handleTaskClick = (taskId: string) => {
    navigate(`/tasks?taskId=${taskId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              {error || 'Client not found'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get the project manager from the client_project_managers array
  const projectManager = client.client_project_managers?.[0]?.pm;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mr-4 text-gray-400 hover:text-gray-500"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                {client.name}
              </h2>
              <div className="mt-1 text-sm text-gray-500 flex flex-col">
                <span>Agency: {client.agency.name}</span>
                {projectManager && (
                  <span>Project Manager: {projectManager.full_name || projectManager.email}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* View Selector - Always visible */}
        <div className="mt-4 flex md:ml-4 md:mt-0 space-x-2">
          <button
            type="button"
            onClick={() => setActiveView('board')}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              activeView === 'board' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Task Board
          </button>
          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              activeView === 'calendar' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveView('budget')}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              activeView === 'budget' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Budget
          </button>
          <button
            type="button"
            onClick={() => setActiveView('list')}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              activeView === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <BarChart2 className="h-4 w-4 mr-1" />
            Reports
          </button>
        </div>
      </div>

      {/* Task Board - Only show when activeView is 'board' */}
      {client && activeView === 'board' && (
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
          {/* Ensure we pass both clientId and agencyId */}
          <TaskBoard 
            clientId={client.id} 
            agencyId={client.agency.id} 
          />
        </div>
      )}

      {/* Stats - Only shown in list view */}
      {activeView === 'list' && stats && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckSquare className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Tasks</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{stats.activeTasks}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed Tasks</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{stats.completedTasks}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Status Overview */}
      {activeView === 'list' && stats && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Budget Overview</h3>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 rounded-md bg-blue-100">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Monthly Budget</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.budgetHours.toFixed(1)}h</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 rounded-md bg-green-100">
                      <Clock className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Hours Remaining</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.remainingHours.toFixed(1)}h</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Tasks */}
      {activeView === 'list' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Tasks</h3>
          </div>
          <div className="bg-white overflow-hidden">
            <ul role="list" className="divide-y divide-gray-200">
              {recentTasks.length > 0 ? (
                recentTasks.map((task) => {
                  const isOverdue = task.finish_date && new Date(task.finish_date) < new Date() && task.status !== 'done';
                  
                  return (
                    <li key={task.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => handleTaskClick(task.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-4 w-4 rounded-full ${
                            task.status === 'done' ? 'bg-green-500' :
                            task.status === 'doing' ? 'bg-yellow-500' :
                            'bg-blue-500'
                          }`}></div>
                          <p className="ml-3 text-sm font-medium text-gray-900">{task.title}</p>
                        </div>
                        <div className="flex items-center">
                          {task.priority && (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {task.priority}
                            </span>
                          )}
                          {task.finish_date && (
                            <span className={`ml-2 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {isOverdue ? 'Overdue' : 'Due'}: {new Date(task.finish_date).toLocaleDateString()}
                            </span>
                          )}
                          {task.assigned_to_email && (
                            <span className="ml-2 text-xs text-gray-500">
                              Assigned to: {task.assigned_to_email}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-5 sm:px-6 text-center text-sm text-gray-500">
                  No recent tasks found
                </li>
              )}
            </ul>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
            <div className="text-sm">
              <button 
                type="button"
                onClick={() => navigate('/tasks')}
                className="font-medium flex items-center text-blue-600 hover:text-blue-500"
              >
                View all tasks
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {activeView === 'calendar' && id && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Task Calendar</h3>
          <UpcomingTasksCalendar 
            clientId={id} 
            onTaskClick={handleTaskClick}
          />
        </div>
      )}

      {/* Budget View */}
      {activeView === 'budget' && id && (
        <div className="space-y-6">
          <ClientBudgetManager clientId={id} />
          <ClientBudgetReport clientId={id} />
        </div>
      )}
    </div>
  );
}