import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Building2, Users, Briefcase, ArrowLeft, BarChart2, Calendar, Clock, DollarSign, CheckSquare, AlertCircle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import clsx from 'clsx';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';
import { ClientBudgetReport } from '../components/ClientBudgetReport';

export function Reports() {
  const navigate = useNavigate();
  const { role, systemId, agencyId, clientId } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [agency, setAgency] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId);
  const [activeTab, setActiveTab] = useState<'overview' | 'budget'>('overview');

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Calculate date range based on selection
  const dateRangeValues = React.useMemo(() => {
    const today = new Date();
    let startDate: Date;
    let endDate = endOfDay(today);
    
    switch (dateRange) {
      case '7':
        startDate = startOfDay(subDays(today, 7));
        break;
      case '30':
        startDate = startOfDay(subDays(today, 30));
        break;
      case '90':
        startDate = startOfDay(subDays(today, 90));
        break;
      default:
        startDate = startOfDay(subDays(today, 30));
    }
    
    return { startDate, endDate };
  }, [dateRange]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.API_CALL,
          'Fetching reports data',
          { role, systemId, agencyId, clientId, dateRange }
        );
        
        // Fetch available clients for selection
        if (role === 'system_admin' || role === 'agency_admin') {
          let query = supabase.from('clients').select('id, name');
          
          if (role === 'agency_admin' && agencyId) {
            query = query.eq('agency_id', agencyId);
          }
          
          const { data: clientsData, error: clientsError } = await query.order('name');
          
          if (clientsError) {
            logApiCall('clients.select', false, { error: clientsError });
            throw clientsError;
          }
          
          setClients(clientsData || []);
          
          // If no client is selected but we have clients, select the first one
          if (!selectedClientId && clientsData && clientsData.length > 0) {
            setSelectedClientId(clientsData[0].id);
          }
        }
        
        // Fetch context data (agency or client)
        if (agencyId) {
          const { data: agencyData, error: agencyError } = await supabase
            .from('agencies')
            .select('*')
            .eq('id', agencyId)
            .single();

          if (agencyError) {
            logApiCall('agencies.select', false, { error: agencyError });
            throw agencyError;
          }
          
          logApiCall('agencies.select', true, {});
          setAgency(agencyData);
        } else if (clientId) {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select(`
              *,
              agency:agencies (
                id,
                name,
                logo_url
              )
            `)
            .eq('id', clientId)
            .single();

          if (clientError) {
            logApiCall('clients.select', false, { error: clientError });
            throw clientError;
          }
          
          logApiCall('clients.select', true, {});
          setClient(clientData);
          setSelectedClientId(clientId);
        }

        // Fetch statistics based on context
        const { startDate, endDate } = dateRangeValues;
        
        if (agencyId) {
          // Fetch agency statistics
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select(`
              id,
              title,
              client_id,
              agency_id,
              estimated_hours,
              estimated_cost,
              status,
              finish_date,
              start_date,
              client:clients(name)
            `)
            .eq('agency_id', agencyId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (tasksError) {
            logApiCall('tasks.select', false, { error: tasksError });
            throw tasksError;
          }
          
          logApiCall('tasks.select', true, { count: tasksData?.length });

          // Fetch time entries
          const { data: timeEntries, error: timeError } = await supabase
            .from('task_time_entries')
            .select(`
              id,
              task_id,
              user_id,
              start_time,
              end_time,
              is_billable,
              task:tasks!inner(
                id,
                title,
                client_id,
                agency_id,
                estimated_hours,
                estimated_cost,
                status
              )
            `)
            .eq('task.agency_id', agencyId)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString());

          if (timeError) {
            logApiCall('task_time_entries.select', false, { error: timeError });
            throw timeError;
          }
          
          logApiCall('task_time_entries.select', true, { count: timeEntries?.length });

          // Process the data
          const processedStats = processAgencyStats(tasksData || [], timeEntries || []);
          setStats(processedStats);
        } else if (selectedClientId) {
          // Fetch client statistics
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select(`
              id,
              title,
              client_id,
              agency_id,
              estimated_hours,
              estimated_cost,
              status,
              finish_date,
              start_date
            `)
            .eq('client_id', selectedClientId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (tasksError) {
            logApiCall('tasks.select', false, { error: tasksError });
            throw tasksError;
          }
          
          logApiCall('tasks.select', true, { count: tasksData?.length });

          // Fetch time entries
          const { data: timeEntries, error: timeError } = await supabase
            .from('task_time_entries')
            .select(`
              id,
              task_id,
              user_id,
              start_time,
              end_time,
              is_billable,
              task:tasks!inner(
                id,
                title,
                client_id,
                estimated_hours,
                estimated_cost,
                status
              )
            `)
            .eq('task.client_id', selectedClientId)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString());

          if (timeError) {
            logApiCall('task_time_entries.select', false, { error: timeError });
            throw timeError;
          }
          
          logApiCall('task_time_entries.select', true, { count: timeEntries?.length });

          // Process the data
          const processedStats = processClientStats(tasksData || [], timeEntries || []);
          setStats(processedStats);
        } else {
          // No specific context, show system-wide stats
          setError('Please select an agency or client to view reports');
        }
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.API_CALL,
          'Reports data fetched successfully',
          { role, systemId, agencyId, clientId }
        );
      } catch (err) {
        console.error('Error fetching reports data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching reports data',
          { error: err }
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [agencyId, selectedClientId, dateRange, dateRangeValues]);

  // Process agency statistics
  const processAgencyStats = (tasks: any[], timeEntries: any[]) => {
    // Calculate time and cost stats
    const completedHours = timeEntries.reduce((acc, entry) => {
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      return acc + duration;
    }, 0);
    
    const hourlyRate = 50; // Assuming $50/hour as a default rate
    const actualCost = timeEntries.reduce((acc, entry) => {
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      return acc + (duration * hourlyRate);
    }, 0);

    const estimatedHours = tasks.reduce((acc, task) => {
      return acc + (task.estimated_hours || 0);
    }, 0);

    const estimatedCost = tasks.reduce((acc, task) => {
      return acc + (task.estimated_cost || 0);
    }, 0);

    const completionPercentage = estimatedHours > 0 
      ? Math.min(100, (completedHours / estimatedHours) * 100) 
      : 0;

    const costEfficiencyPercentage = estimatedCost > 0 
      ? Math.min(100, (actualCost / estimatedCost) * 100) 
      : 0;

    // Calculate client stats
    const clientMap = new Map();
    
    // Initialize with task data
    tasks.forEach(task => {
      if (!task.client || !task.client.name) {
        // Skip tasks with missing client data
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.DATA_PROCESSING,
          'Task has missing client data',
          { taskId: task.id }
        );
        return;
      }
      
      const clientId = task.client_id;
      const clientName = task.client.name;
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          id: clientId,
          name: clientName,
          total_hours_completed: 0,
          total_hours_estimated: 0,
          total_cost_actual: 0,
          total_cost_estimated: 0,
          task_count: 0,
          completed_tasks: 0
        });
      }
      
      const client = clientMap.get(clientId);
      client.task_count++;
      client.total_hours_estimated += task.estimated_hours || 0;
      client.total_cost_estimated += task.estimated_cost || 0;
      
      if (task.status === 'done') {
        client.completed_tasks++;
      }
    });
    
    // Add time entry data
    timeEntries.forEach(entry => {
      if (!entry.task || !entry.task.client_id) {
        // Skip entries with missing task data
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.DATA_PROCESSING,
          'Time entry has missing task data',
          { entryId: entry.id }
        );
        return;
      }
      
      const clientId = entry.task.client_id;
      if (clientMap.has(clientId)) {
        const client = clientMap.get(clientId);
        const duration = entry.end_time 
          ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
          : 0;
        
        client.total_hours_completed += duration;
        client.total_cost_actual += (duration * hourlyRate); // Calculate cost based on duration
      }
    });

    // Calculate daily stats
    const dailyData = new Map<string, { hours: number; cost: number }>();
    timeEntries.forEach(entry => {
      const date = format(new Date(entry.start_time), 'yyyy-MM-dd');
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;

      const existing = dailyData.get(date) || { hours: 0, cost: 0 };
      dailyData.set(date, {
        hours: existing.hours + duration,
        cost: existing.cost + (duration * hourlyRate), // Calculate cost based on duration
      });
    });

    const dailyStats = Array.from(dailyData.entries())
      .map(([date, stats]) => ({
        date: format(new Date(date), 'MMM d'),
        hours: stats.hours,
        cost: stats.cost,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate user stats
    const userMap = new Map();
    
    // Process time entries for user stats
    timeEntries.forEach(entry => {
      if (!entry.user_id) return;
      
      if (!userMap.has(entry.user_id)) {
        userMap.set(entry.user_id, {
          id: entry.user_id,
          email: 'Unknown User', // Will be updated later
          total_hours: 0,
          total_cost: 0,
          assigned_tasks: 0,
          completed_tasks: 0,
          efficiency: 100
        });
      }
      
      const user = userMap.get(entry.user_id);
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      
      user.total_hours += duration;
      user.total_cost += (duration * hourlyRate); // Calculate cost based on duration
    });

    // Get user emails
    const userIds = [...userMap.keys()];
    if (userIds.length > 0) {
      supabase
        .from('user_roles')
        .select('user_id, email')
        .in('user_id', userIds)
        .then(({ data }) => {
          if (data) {
            data.forEach(user => {
              if (userMap.has(user.user_id)) {
                userMap.get(user.user_id).email = user.email;
              }
            });
          }
        });
    }

    // Get task assignments for users
    tasks.forEach(task => {
      if (task.assigned_to && userMap.has(task.assigned_to)) {
        const user = userMap.get(task.assigned_to);
        user.assigned_tasks++;
        
        if (task.status === 'done') {
          user.completed_tasks++;
        }
      }
    });

    return {
      timeStats: {
        total_hours_completed: completedHours,
        total_hours_estimated: estimatedHours,
        total_cost_estimated: estimatedCost,
        total_cost_actual: actualCost,
        completion_percentage: completionPercentage,
        cost_efficiency_percentage: costEfficiencyPercentage
      },
      clientStats: Array.from(clientMap.values()),
      userStats: Array.from(userMap.values()),
      dailyStats,
      statusStats: calculateStatusStats(tasks)
    };
  };

  // Process client statistics
  const processClientStats = (tasks: any[], timeEntries: any[]) => {
    // Similar to processAgencyStats but focused on client-specific data
    // Calculate time and cost stats
    const completedHours = timeEntries.reduce((acc, entry) => {
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      return acc + duration;
    }, 0);
    
    const hourlyRate = 50; // Assuming $50/hour as a default rate
    const actualCost = timeEntries.reduce((acc, entry) => {
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      return acc + (duration * hourlyRate);
    }, 0);

    const estimatedHours = tasks.reduce((acc, task) => {
      return acc + (task.estimated_hours || 0);
    }, 0);

    const estimatedCost = tasks.reduce((acc, task) => {
      return acc + (task.estimated_cost || 0);
    }, 0);

    const completionPercentage = estimatedHours > 0 
      ? Math.min(100, (completedHours / estimatedHours) * 100) 
      : 0;

    const costEfficiencyPercentage = estimatedCost > 0 
      ? Math.min(100, (actualCost / estimatedCost) * 100) 
      : 0;

    // Calculate daily stats
    const dailyData = new Map();
    timeEntries.forEach(entry => {
      const date = format(new Date(entry.start_time), 'yyyy-MM-dd');
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;

      const existing = dailyData.get(date) || { hours: 0, cost: 0 };
      dailyData.set(date, {
        hours: existing.hours + duration,
        cost: existing.cost + (duration * hourlyRate),
      });
    });

    const dailyStats = Array.from(dailyData.entries())
      .map(([date, stats]) => ({
        date: format(new Date(date), 'MMM d'),
        hours: stats.hours,
        cost: stats.cost,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate user stats
    const userMap = new Map();
    
    // Process time entries for user stats
    timeEntries.forEach(entry => {
      if (!entry.user_id) return;
      
      if (!userMap.has(entry.user_id)) {
        userMap.set(entry.user_id, {
          id: entry.user_id,
          email: 'Unknown User', // Will be updated later
          total_hours: 0,
          total_cost: 0,
          assigned_tasks: 0,
          completed_tasks: 0,
          efficiency: 100
        });
      }
      
      const user = userMap.get(entry.user_id);
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      
      user.total_hours += duration;
      user.total_cost += (duration * hourlyRate);
    });

    // Get user emails
    const userIds = [...userMap.keys()];
    if (userIds.length > 0) {
      supabase
        .from('user_roles')
        .select('user_id, email')
        .in('user_id', userIds)
        .then(({ data }) => {
          if (data) {
            data.forEach(user => {
              if (userMap.has(user.user_id)) {
                userMap.get(user.user_id).email = user.email;
              }
            });
          }
        });
    }

    return {
      timeStats: {
        total_hours_completed: completedHours,
        total_hours_estimated: estimatedHours,
        total_cost_estimated: estimatedCost,
        total_cost_actual: actualCost,
        completion_percentage: completionPercentage,
        cost_efficiency_percentage: costEfficiencyPercentage
      },
      userStats: Array.from(userMap.values()),
      dailyStats,
      statusStats: calculateStatusStats(tasks)
    };
  };

  // Calculate status statistics
  const calculateStatusStats = (tasks: any[]) => {
    const statusCounts: Record<string, number> = {};
    const total = tasks.length;
    
    // Count tasks by status
    tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    
    // Convert to array with percentages
    return Object.entries(statusCounts).map(([status, count]) => {
      return {
        status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-4 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex items-center">
            {agency?.logo_url && (
              <img
                src={agency.logo_url}
                alt={`${agency.name} logo`}
                className="h-12 w-12 object-contain mr-4"
              />
            )}
            {client?.agency?.logo_url && (
              <img
                src={client.agency.logo_url}
                alt={`${client.agency.name} logo`}
                className="h-12 w-12 object-contain mr-4"
              />
            )}
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {agency ? `${agency.name} Reports` : client ? `${client.name} Reports` : 'Reports'}
            </h2>
          </div>
        </div>
        
        {/* Client Selector (for system admins and agency admins) */}
        {(role === 'system_admin' || role === 'agency_admin') && clients.length > 0 && (
          <div className="flex items-center space-x-4">
            <div>
              <label htmlFor="client-select" className="sr-only">Select Client</label>
              <select
                id="client-select"
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value || null)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            
            {/* Tab Selector */}
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                } rounded-l-md`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('budget')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'budget'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                } rounded-r-md`}
              >
                Budget
              </button>
            </div>
          </div>
        )}
        
        {/* Date Range Selector */}
        {activeTab === 'overview' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDateRange('7')}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md',
                dateRange === '7'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              )}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange('30')}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md',
                dateRange === '30'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              )}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDateRange('90')}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md',
                dateRange === '90'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              )}
            >
              Last 90 Days
            </button>
          </div>
        )}
      </div>

      {/* Budget Report View */}
      {activeTab === 'budget' && selectedClientId && (
        <ClientBudgetReport clientId={selectedClientId} />
      )}

      {/* Overview Report */}
      {activeTab === 'overview' && stats && (
        <>
          {/* Task Status Overview */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                Task Status Overview
              </h3>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
                  <dt className="truncate text-sm font-medium text-gray-500">Total Tasks</dt>
                  <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
                    {stats.statusStats.reduce((sum: number, stat: any) => sum + stat.count, 0)}
                  </dd>
                </div>
                
                {stats.statusStats.slice(0, 3).map((stat: any) => (
                  <div key={stat.status} className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
                    <dt className="truncate text-sm font-medium text-gray-500">{stat.status.charAt(0).toUpperCase() + stat.status.slice(1)}</dt>
                    <dd className="mt-1 flex items-baseline">
                      <div className="text-3xl font-semibold tracking-tight text-gray-900">
                        {stat.count}
                      </div>
                      <div className="ml-2">
                        <span className="text-sm text-gray-500">
                          ({stat.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Time and Cost Overview */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                Time and Cost Overview
              </h3>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
                  <dt className="truncate text-sm font-medium text-gray-500">Hours Completed</dt>
                  <dd className="mt-1 flex items-baseline justify-between">
                    <div className="flex items-baseline text-2xl font-semibold text-gray-900">
                      {stats.timeStats.total_hours_completed.toFixed(1)}h
                      <span className="ml-2 text-sm text-gray-500">
                        of {stats.timeStats.total_hours_estimated.toFixed(1)}h estimated
                      </span>
                    </div>
                    <div className={clsx(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      stats.timeStats.completion_percentage >= 100 
                        ? "bg-red-100 text-red-800" 
                        : stats.timeStats.completion_percentage >= 75 
                          ? "bg-yellow-100 text-yellow-800" 
                          : "bg-green-100 text-green-800"
                    )}>
                      {stats.timeStats.completion_percentage.toFixed(0)}%
                    </div>
                  </dd>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={clsx(
                        "h-2.5 rounded-full",
                        stats.timeStats.completion_percentage >= 100 
                          ? "bg-red-600" 
                          : stats.timeStats.completion_percentage >= 75 
                            ? "bg-yellow-500" 
                            : "bg-green-500"
                      )}
                      style={{ width: `${Math.min(100, stats.timeStats.completion_percentage)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
                  <dt className="truncate text-sm font-medium text-gray-500">Total Estimated Cost</dt>
                  <dd className="mt-1 flex items-baseline justify-between">
                    <div className="flex items-baseline text-2xl font-semibold text-gray-900">
                      ${stats.timeStats.total_cost_estimated.toFixed(2)}
                    </div>
                  </dd>
                  <dt className="mt-4 truncate text-sm font-medium text-gray-500">Actual Cost</dt>
                  <dd className="mt-1 flex items-baseline justify-between">
                    <div className="flex items-baseline text-xl font-semibold text-gray-900">
                      ${stats.timeStats.total_cost_actual.toFixed(2)}
                    </div>
                    <div className={clsx(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      stats.timeStats.cost_efficiency_percentage > 100 
                        ? "bg-red-100 text-red-800" 
                        : stats.timeStats.cost_efficiency_percentage > 90 
                          ? "bg-yellow-100 text-yellow-800" 
                          : "bg-green-100 text-green-800"
                    )}>
                      {stats.timeStats.cost_efficiency_percentage.toFixed(0)}%
                    </div>
                  </dd>
                </div>

                <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
                  <dt className="truncate text-sm font-medium text-gray-500">Task Completion Rate</dt>
                  <dd className="mt-1 flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats.clientStats ? 
                        `${stats.clientStats.reduce((sum: number, client: any) => sum + client.completed_tasks, 0)} / ${stats.clientStats.reduce((sum: number, client: any) => sum + client.task_count, 0)}` :
                        `${stats.statusStats.find((s: any) => s.status === 'done')?.count || 0} / ${stats.statusStats.reduce((sum: number, stat: any) => sum + stat.count, 0)}`
                      }
                    </div>
                  </dd>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ 
                        width: stats.clientStats 
                          ? `${stats.clientStats.reduce((sum: number, client: any) => sum + client.task_count, 0) > 0 
                              ? (stats.clientStats.reduce((sum: number, client: any) => sum + client.completed_tasks, 0) / 
                                 stats.clientStats.reduce((sum: number, client: any) => sum + client.task_count, 0)) * 100 
                              : 0}%` 
                          : `${stats.statusStats.reduce((sum: number, stat: any) => sum + stat.count, 0) > 0
                              ? (stats.statusStats.find((s: any) => s.status === 'done')?.count || 0) / 
                                stats.statusStats.reduce((sum: number, stat: any) => sum + stat.count, 0) * 100
                              : 0}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
                  <dt className="truncate text-sm font-medium text-gray-500">Time Period</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {format(dateRangeValues.startDate, 'MMM d')} - {format(dateRangeValues.endDate, 'MMM d, yyyy')}
                  </dd>
                  <p className="mt-2 text-sm text-gray-500">
                    {dateRange === '7' ? '7 days' : dateRange === '30' ? '30 days' : '90 days'} of data
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Stats Chart */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                Daily Activity
              </h3>
              <div className="mt-5 h-64">
                <div className="h-full flex items-end justify-between">
                  {stats.dailyStats.length > 0 ? (
                    stats.dailyStats.map(({ date, hours, cost }: any) => (
                      <div key={date} className="flex flex-col items-center">
                        <div className="flex flex-col items-center">
                          <div 
                            className="w-8 bg-blue-500 rounded-t"
                            style={{ height: `${(hours / Math.max(...stats.dailyStats.map((d: any) => d.hours), 0.1)) * 100}%` }}
                            title={`${hours.toFixed(1)} hours`}
                          />
                          <div 
                            className="w-8 bg-green-500 rounded-t mt-1"
                            style={{ height: `${(cost / Math.max(...stats.dailyStats.map((d: any) => d.cost), 0.1)) * 100}%` }}
                            title={`$${cost.toFixed(2)}`}
                          />
                        </div>
                        <div className="mt-2 text-xs text-gray-500 -rotate-45 origin-top-left">
                          {date}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="w-full flex items-center justify-center">
                      <p className="text-gray-500">No data available for the selected period</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-center space-x-8">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded mr-2" />
                  <span className="text-sm text-gray-600">Hours</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded mr-2" />
                  <span className="text-sm text-gray-600">Cost</span>
                </div>
              </div>
            </div>
          </div>

          {/* Client Performance (only for agency reports) */}
          {agency && stats.clientStats && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                  Client Performance
                </h3>
                <div className="mt-5">
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                            Client
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            Hours Completed
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            Estimated Hours
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            Actual Cost
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            Estimated Cost
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            Task Completion
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {stats.clientStats.length > 0 ? (
                          stats.clientStats.map((client: any) => (
                            <tr key={client.id}>
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                {client.name}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {client.total_hours_completed.toFixed(1)}h
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {client.total_hours_estimated.toFixed(1)}h
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                ${client.total_cost_actual.toFixed(2)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                ${client.total_cost_estimated.toFixed(2)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {client.task_count > 0 
                                  ? (
                                    <div className="flex items-center">
                                      <span className="mr-2">{client.completed_tasks} / {client.task_count}</span>
                                      <div className="w-20 bg-gray-200 rounded-full h-2.5">
                                        <div 
                                          className="bg-blue-600 h-2.5 rounded-full"
                                          style={{ width: `${(client.completed_tasks / client.task_count) * 100}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  )
                                  : 'N/A'
                                }
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                              No client data available for the selected period
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Productivity */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                User Productivity
              </h3>
              <div className="mt-5">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                          User
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Hours Logged
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Tasks
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Completion Rate
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Efficiency
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {stats.userStats.length > 0 ? (
                        stats.userStats.map((stat: any) => (
                          <tr key={stat.id}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                              {stat.email}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {stat.total_hours.toFixed(1)}h
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {stat.completed_tasks} / {stat.assigned_tasks}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {stat.assigned_tasks > 0 
                                ? (
                                  <div className="flex items-center">
                                    <span className="mr-2">{((stat.completed_tasks / stat.assigned_tasks) * 100).toFixed(0)}%</span>
                                    <div className="w-20 bg-gray-200 rounded-full h-2.5">
                                      <div 
                                        className="bg-blue-600 h-2.5 rounded-full"
                                        style={{ width: `${(stat.completed_tasks / stat.assigned_tasks) * 100}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )
                                : 'N/A'
                              }
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              <div className="flex items-center">
                                <div 
                                  className={clsx(
                                    'h-2 rounded-full',
                                    stat.efficiency <= 90 ? 'bg-green-500' :
                                    stat.efficiency <= 110 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  )}
                                  style={{ width: `${Math.min(stat.efficiency, 200) / 2}%` }}
                                />
                                <span className="ml-2">{stat.efficiency}%</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                            No user data available for the selected period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}