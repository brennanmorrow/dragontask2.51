import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Building2, Users, Briefcase, ArrowRight, CheckSquare, FileText, BarChart2 } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';
import { UpcomingTasksCalendar } from '../components/UpcomingTasksCalendar';

interface SystemStats {
  total_agencies: number;
  total_clients: number;
  total_users: number;
  total_tasks: number;
  total_sops: number;
  recent_agencies: Array<{
    id: string;
    name: string;
    created_at: string;
  }>;
  recent_users: Array<{
    user_id: string;
    role: string;
    created_at: string;
    user_email: string;
  }>;
  recent_tasks: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
}

export function SystemDashboard() {
  const navigate = useNavigate();
  const { systemId, role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const primaryColorLight = `rgba(${parseInt(primaryColor.slice(1, 3), 16)}, ${parseInt(primaryColor.slice(3, 5), 16)}, ${parseInt(primaryColor.slice(5, 7), 16)}, 0.1)`;

  useEffect(() => {
    if (role !== 'system_admin') {
      navigate('/dashboard');
      return;
    }
    
    fetchSystemStats();
  }, [systemId]);

  async function fetchSystemStats() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching system dashboard stats',
        { systemId }
      );
      
      // Fetch system statistics
      const { data: systemData, error: systemError } = await supabase
        .from('systems')
        .select('id, name')
        .eq('id', systemId)
        .single();

      if (systemError) {
        logApiCall('systems.select', false, { error: systemError });
        throw systemError;
      }
      
      logApiCall('systems.select', true, {});

      // Fetch agencies
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name, created_at')
        .eq('system_id', systemId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (agenciesError) {
        logApiCall('agencies.select', false, { error: agenciesError });
        throw agenciesError;
      }
      
      logApiCall('agencies.select', true, { count: agenciesData?.length });

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .in('agency_id', agenciesData?.map(a => a.id) || []);

      if (clientsError) {
        logApiCall('clients.select', false, { error: clientsError });
        throw clientsError;
      }
      
      logApiCall('clients.select', true, { count: clientsData?.length });

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('user_roles')
        .select('user_id, role, email, created_at')
        .or(`system_id.eq.${systemId},agency_id.in.(${agenciesData?.map(a => a.id).join(',')})`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (usersError) {
        logApiCall('user_roles.select', false, { error: usersError });
        throw usersError;
      }
      
      logApiCall('user_roles.select', true, { count: usersData?.length });

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, created_at')
        .in('agency_id', agenciesData?.map(a => a.id) || [])
        .order('created_at', { ascending: false })
        .limit(5);

      if (tasksError) {
        logApiCall('tasks.select', false, { error: tasksError });
        throw tasksError;
      }
      
      logApiCall('tasks.select', true, { count: tasksData?.length });

      // Fetch SOPs
      const { data: sopsData, error: sopsError } = await supabase
        .from('sops')
        .select('id')
        .in('client_id', clientsData?.map(c => c.id) || []);

      if (sopsError) {
        logApiCall('sops.select', false, { error: sopsError });
        throw sopsError;
      }
      
      logApiCall('sops.select', true, { count: sopsData?.length });

      // Compile stats
      setStats({
        total_agencies: agenciesData?.length || 0,
        total_clients: clientsData?.length || 0,
        total_users: usersData?.length || 0,
        total_tasks: tasksData?.length || 0,
        total_sops: sopsData?.length || 0,
        recent_agencies: agenciesData || [],
        recent_users: usersData?.map(user => ({
          ...user,
          user_email: user.email
        })) || [],
        recent_tasks: tasksData || []
      });
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'System dashboard stats fetched successfully',
        { systemId }
      );
    } catch (err) {
      console.error('Error fetching system stats:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching system dashboard stats',
        { error: err, systemId }
      );
    } finally {
      setIsLoading(false);
    }
  }

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
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            System Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your system's agencies, clients, and activity
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/agencies')}
          style={{ borderTop: `4px solid ${primaryColor}` }}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                <Building2 className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Agencies</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats?.total_agencies || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <button 
                onClick={() => navigate('/agencies')}
                className="font-medium flex items-center"
                style={{ color: primaryColor }}
              >
                View all agencies
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/clients')}
          style={{ borderTop: `4px solid ${primaryColor}` }}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                <Briefcase className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Clients</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats?.total_clients || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <button 
                onClick={() => navigate('/clients')}
                className="font-medium flex items-center"
                style={{ color: primaryColor }}
              >
                View all clients
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/users')}
          style={{ borderTop: `4px solid ${primaryColor}` }}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                <Users className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Users</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats?.total_users || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <button 
                onClick={() => navigate('/users')}
                className="font-medium flex items-center"
                style={{ color: primaryColor }}
              >
                Manage users
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/tasks')}
          style={{ borderTop: `4px solid ${primaryColor}` }}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                <CheckSquare className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Tasks</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats?.total_tasks || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <button 
                onClick={() => navigate('/tasks')}
                className="font-medium flex items-center"
                style={{ color: primaryColor }}
              >
                View all tasks
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        <div 
          className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/sops')}
          style={{ borderTop: `4px solid ${primaryColor}` }}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                <FileText className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">SOPs</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats?.total_sops || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <button 
                onClick={() => navigate('/sops')}
                className="font-medium flex items-center"
                style={{ color: primaryColor }}
              >
                View all SOPs
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Agencies */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Agencies</h3>
          </div>
          <div className="bg-white overflow-hidden">
            <ul role="list" className="divide-y divide-gray-200">
              {stats?.recent_agencies && stats.recent_agencies.length > 0 ? (
                stats.recent_agencies.map((agency) => (
                  <li key={agency.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/agencies/${agency.id}`)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                        <p className="text-sm font-medium text-gray-900">{agency.name}</p>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-500">
                          {new Date(agency.created_at).toLocaleDateString()}
                        </span>
                        <ArrowRight className="ml-2 h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-4 py-5 sm:px-6 text-center text-sm text-gray-500">
                  No agencies found
                </li>
              )}
            </ul>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
            <div className="text-sm">
              <button 
                onClick={() => navigate('/agencies')}
                className="font-medium flex items-center"
                style={{ color: primaryColor }}
              >
                View all agencies
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Users</h3>
          </div>
          <div className="bg-white overflow-hidden">
            <ul role="list" className="divide-y divide-gray-200">
              {stats?.recent_users && stats.recent_users.length > 0 ? (
                stats.recent_users.map((user) => (
                  <li key={user.user_id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {user.user_email?.[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{user.user_email}</p>
                          <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-4 py-5 sm:px-6 text-center text-sm text-gray-500">
                  No recent user activity
                </li>
              )}
            </ul>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
            <div className="text-sm">
              <button 
                onClick={() => navigate('/users')}
                className="font-medium flex items-center"
                style={{ color: primaryColor }}
              >
                Manage users
                <span className="ml-2" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Tasks</h3>
        </div>
        <div className="bg-white overflow-hidden">
          <ul role="list" className="divide-y divide-gray-200">
            {stats?.recent_tasks && stats.recent_tasks.length > 0 ? (
              stats.recent_tasks.map((task) => (
                <li key={task.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/tasks?taskId=${task.id}`)}>
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
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        task.status === 'done' ? 'bg-green-100 text-green-800' :
                        task.status === 'doing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {task.status}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </li>
              ))
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
              style={{ color: primaryColor }}
            >
              View all tasks
              <span className="ml-2" aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View - Upcoming Tasks */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Upcoming Tasks</h3>
          <button 
            onClick={() => navigate('/reports')}
            className="inline-flex items-center text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: primaryColor }}
          >
            View Reports
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
        <UpcomingTasksCalendar />
      </div>
    </div>
  );
}