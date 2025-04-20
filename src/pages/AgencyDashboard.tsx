import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Building2, Users, Briefcase, ArrowLeft, BarChart2, Calendar, Clock, CheckCircle, AlertCircle, CheckSquare } from 'lucide-react';
import { AgencyReportsDashboard } from '../components/AgencyReportsDashboard';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';
import { UpcomingTasksCalendar } from '../components/UpcomingTasksCalendar';

interface Agency {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
}

interface DashboardStats {
  total_clients: number;
  total_users: number;
  total_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  finish_date: string | null;
  assigned_to_email: string | null;
}

export function AgencyDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuthStore();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'calendar' | 'tasks'>('overview');

  // Check if the URL has a view=reports query parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const view = searchParams.get('view');
    if (view === 'reports') {
      setShowReports(true);
    }
  }, [location.search]);

  useEffect(() => {
    async function fetchAgencyData() {
      if (!id) {
        setError('Agency ID is missing');
        setIsLoading(false);
        return;
      }
      
      try {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.API_CALL,
          'Fetching agency data',
          { agencyId: id }
        );
        
        // Fetch agency details
        const { data: agencyData, error: agencyError } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', id)
          .single();

        if (agencyError) {
          logApiCall('agencies.select', false, { error: agencyError });
          throw agencyError;
        }
        
        logApiCall('agencies.select', true, { agency: agencyData });
        setAgency(agencyData);

        // Fetch agency statistics
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id', { count: 'exact' })
          .eq('agency_id', id);

        if (clientsError) {
          logApiCall('clients.select', false, { error: clientsError });
          throw clientsError;
        }
        
        logApiCall('clients.select', true, { count: clientsData?.length });

        const { data: usersData, error: usersError } = await supabase
          .from('user_agency_assignments')
          .select('id', { count: 'exact' })
          .eq('agency_id', id);

        if (usersError) {
          logApiCall('user_agency_assignments.select', false, { error: usersError });
          throw usersError;
        }
        
        logApiCall('user_agency_assignments.select', true, { count: usersData?.length });

        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, status, finish_date', { count: 'exact' })
          .eq('agency_id', id);

        if (tasksError) {
          logApiCall('tasks.select', false, { error: tasksError });
          throw tasksError;
        }
        
        logApiCall('tasks.select', true, { count: tasksData?.length });

        // Calculate task statistics
        const now = new Date();
        const activeTasks = tasksData?.filter(t => t.status !== 'done') || [];
        const completedTasks = tasksData?.filter(t => t.status === 'done') || [];
        const overdueTasks = tasksData?.filter(t => 
          t.status !== 'done' && 
          t.finish_date && 
          new Date(t.finish_date) < now
        ) || [];

        setStats({
          total_clients: clientsData?.length || 0,
          total_users: usersData?.length || 0,
          total_tasks: tasksData?.length || 0,
          active_tasks: activeTasks.length,
          completed_tasks: completedTasks.length,
          overdue_tasks: overdueTasks.length
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
          .eq('agency_id', id)
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
          'Agency data fetched successfully',
          { agencyId: id }
        );
      } catch (err) {
        console.error('Error fetching agency data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching agency data',
          { error: err, agencyId: id }
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchAgencyData();
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

  if (error || !agency) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              {error || 'Agency not found'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showReports) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <button
            onClick={() => setShowReports(false)}
            className="mr-4 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex items-center">
            {agency.logo_url && (
              <img
                src={agency.logo_url}
                alt={`${agency.name} logo`}
                className="h-12 w-12 object-contain mr-4"
              />
            )}
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {agency.name} Reports
            </h2>
          </div>
        </div>

        {id && <AgencyReportsDashboard agencyId={id} />}
      </div>
    );
  }

  // Get theme colors
  const themeColors = {
    primary: agency.primary_color || '#EF4444',
    secondary: agency.secondary_color || '#B91C1C',
    accent: agency.accent_color || '#FCA5A5',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-4 text-gray-400 hover:text-gray-500"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center">
              {agency.logo_url && (
                <img
                  src={agency.logo_url}
                  alt={`${agency.name} logo`}
                  className="h-12 w-12 object-contain mr-4"
                />
              )}
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                {agency.name}
              </h2>
            </div>
          </div>
        </div>
        
        {/* View Selector */}
        <div className="mt-4 flex md:ml-4 md:mt-0 space-x-2">
          <button
            onClick={() => setActiveView('overview')}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              activeView === 'overview' 
                ? 'bg-primary text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
            style={activeView === 'overview' ? { backgroundColor: themeColors.primary } : {}}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('calendar')}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              activeView === 'calendar' 
                ? 'bg-primary text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
            style={activeView === 'calendar' ? { backgroundColor: themeColors.primary } : {}}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Calendar
          </button>
          <button
            onClick={() => setActiveView('tasks')}
            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
              activeView === 'tasks' 
                ? 'bg-primary text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
            style={activeView === 'tasks' ? { backgroundColor: themeColors.primary } : {}}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Tasks
          </button>
          <button
            onClick={() => setShowReports(true)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            <BarChart2 className="h-4 w-4 mr-1" />
            Reports
          </button>
        </div>
      </div>

      {activeView === 'overview' && (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Building2 className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.total_clients}</div>
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
                      <Users className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.total_users}</div>
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
                      <CheckSquare className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Tasks</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.total_tasks}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Task Status Overview */}
          {stats && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Task Status Overview</h3>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-md bg-blue-100">
                          <Clock className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Active Tasks</dt>
                            <dd className="flex items-baseline">
                              <div className="text-2xl font-semibold text-gray-900">{stats.active_tasks}</div>
                              <div className="ml-2">
                                <div className="text-sm font-medium text-gray-500">
                                  {stats.total_tasks > 0 
                                    ? `(${Math.round((stats.active_tasks / stats.total_tasks) * 100)}%)` 
                                    : '(0%)'}
                                </div>
                              </div>
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
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Completed Tasks</dt>
                            <dd className="flex items-baseline">
                              <div className="text-2xl font-semibold text-gray-900">{stats.completed_tasks}</div>
                              <div className="ml-2">
                                <div className="text-sm font-medium text-gray-500">
                                  {stats.total_tasks > 0 
                                    ? `(${Math.round((stats.completed_tasks / stats.total_tasks) * 100)}%)` 
                                    : '(0%)'}
                                </div>
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-md bg-red-100">
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Overdue Tasks</dt>
                            <dd className="flex items-baseline">
                              <div className="text-2xl font-semibold text-gray-900">{stats.overdue_tasks}</div>
                              <div className="ml-2">
                                <div className="text-sm font-medium text-gray-500">
                                  {stats.total_tasks > 0 
                                    ? `(${Math.round((stats.overdue_tasks / stats.total_tasks) * 100)}%)` 
                                    : '(0%)'}
                                </div>
                              </div>
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
                                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
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
                  onClick={() => navigate('/tasks')}
                  className="font-medium flex items-center"
                  style={{ color: themeColors.primary }}
                >
                  View all tasks
                  <span className="ml-2" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => navigate('/clients')}
              className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <span className="mt-2 block text-sm font-semibold text-gray-900">Manage Clients</span>
            </button>

            <button
              onClick={() => navigate('/users')}
              className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <span className="mt-2 block text-sm font-semibold text-gray-900">Manage Users</span>
            </button>

            <button
              onClick={() => navigate('/tasks')}
              className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <CheckSquare className="mx-auto h-12 w-12 text-gray-400" />
              <span className="mt-2 block text-sm font-semibold text-gray-900">View Tasks</span>
            </button>

            <button
              onClick={() => setShowReports(true)}
              className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <BarChart2 className="mx-auto h-12 w-12 text-gray-400" />
              <span className="mt-2 block text-sm font-semibold text-gray-900">View Reports</span>
            </button>
          </div>
        </>
      )}

      {/* Calendar View */}
      {activeView === 'calendar' && id && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Task Calendar</h3>
          <UpcomingTasksCalendar 
            agencyId={id} 
            onTaskClick={handleTaskClick}
          />
        </div>
      )}

      {/* Tasks View */}
      {activeView === 'tasks' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">All Tasks</h3>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentTasks.length > 0 ? (
                    recentTasks.map((task) => {
                      const isOverdue = task.finish_date && new Date(task.finish_date) < new Date() && task.status !== 'done';
                      
                      return (
                        <tr 
                          key={task.id} 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleTaskClick(task.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {task.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              task.status === 'done' ? 'bg-green-100 text-green-800' :
                              task.status === 'doing' ? 'bg-yellow-100 text-yellow-800' :
                              task.status === 'todo' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {task.status === 'done' ? 'Completed' :
                               task.status === 'doing' ? 'In Progress' :
                               task.status === 'todo' ? 'To Do' : 'Inbox'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.assigned_to_email || 'Unassigned'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.finish_date ? (
                              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                {new Date(task.finish_date).toLocaleDateString()}
                                {isOverdue && ' (Overdue)'}
                              </span>
                            ) : (
                              'No due date'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        No tasks found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Showing the {Math.min(recentTasks.length, 5)} most recent tasks
                </div>
                <button
                  onClick={() => navigate('/tasks')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  View All Tasks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}