import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Building2, Users, Briefcase, ArrowRight, CheckSquare, FileText, BarChart2, Calendar, Clock, DollarSign } from 'lucide-react';
import clsx from 'clsx';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

interface AgencyReportsProps {
  agencyId: string;
}

interface TimeStats {
  total_hours_completed: number;
  total_hours_estimated: number;
  total_cost_estimated: number;
  total_cost_actual: number;
  completion_percentage: number;
  cost_efficiency_percentage: number;
  budget_hours_available: number;
  budget_hours_utilization: number;
}

interface ClientStats {
  id: string;
  name: string;
  total_hours_completed: number;
  total_hours_estimated: number;
  total_cost_actual: number;
  total_cost_estimated: number;
  task_count: number;
  completed_tasks: number;
  budget_hours: number;
  budget_hours_utilization: number;
}

interface UserStats {
  id: string;
  email: string;
  total_hours: number;
  total_cost: number;
  assigned_tasks: number;
  completed_tasks: number;
  efficiency: number;
}

export function AgencyReportsDashboard({ agencyId }: AgencyReportsProps) {
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeStats, setTimeStats] = useState<TimeStats>({
    total_hours_completed: 0,
    total_hours_estimated: 0,
    total_cost_estimated: 0,
    total_cost_actual: 0,
    completion_percentage: 0,
    cost_efficiency_percentage: 0,
    budget_hours_available: 0,
    budget_hours_utilization: 0
  });
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [dailyStats, setDailyStats] = useState<{ date: string; hours: number; cost: number }[]>([]);

  // Calculate date range based on selection
  const dateRangeValues = useMemo(() => {
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
    fetchAgencyStats();
  }, [agencyId, dateRange, dateRangeValues]);

  async function fetchAgencyStats() {
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching agency stats',
        { agencyId, dateRange }
      );
      
      const { startDate, endDate } = dateRangeValues;

      // Fetch tasks for the agency within the date range
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

      // First fetch time entries
      const { data: timeEntries, error: timeError } = await supabase
        .from('task_time_entries')
        .select(`
          id,
          task_id,
          user_id,
          start_time,
          end_time,
          is_billable,
          actual_cost,
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

      // Fetch client budgets
      const { data: clientBudgets, error: budgetError } = await supabase
        .from('client_budgets')
        .select(`
          id,
          client_id,
          month,
          hours_budget,
          cost_budget
        `)
        .gte('month', format(startDate, 'yyyy-MM'))
        .lte('month', format(endDate, 'yyyy-MM'));

      if (budgetError) {
        logApiCall('client_budgets.select', false, { error: budgetError });
        throw budgetError;
      }
      
      logApiCall('client_budgets.select', true, { count: clientBudgets?.length });

      // Then fetch user emails separately
      const userIds = [...new Set(timeEntries?.map(entry => entry.user_id) || [])];
      
      if (userIds.length === 0) {
        // Handle case with no time entries
        setTimeStats({
          total_hours_completed: 0,
          total_hours_estimated: 0,
          total_cost_estimated: 0,
          total_cost_actual: 0,
          completion_percentage: 0,
          cost_efficiency_percentage: 0,
          budget_hours_available: 0,
          budget_hours_utilization: 0
        });
        setClientStats([]);
        setUserStats([]);
        setDailyStats([]);
        setIsLoading(false);
        return;
      }
      
      const { data: users, error: usersError } = await supabase
        .from('user_roles')
        .select('user_id, email')
        .in('user_id', userIds);

      if (usersError) {
        logApiCall('user_roles.select', false, { error: usersError });
        throw usersError;
      }
      
      logApiCall('user_roles.select', true, { count: users?.length });

      // Create a map of user IDs to emails
      const userEmailMap = new Map(users?.map(user => [user.user_id, user.email]) || []);

      // Calculate time and cost stats
      const completedHours = timeEntries.reduce((acc, entry) => {
        const duration = entry.end_time 
          ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
          : 0;
        return acc + duration;
      }, 0);

      // Use actual_cost from time entries if available
      const actualCost = timeEntries.reduce((acc, entry) => {
        return acc + (entry.actual_cost || 0);
      }, 0);

      const estimatedHours = tasksData?.reduce((acc, task) => {
        return acc + (task.estimated_hours || 0);
      }, 0) || 0;

      const estimatedCost = tasksData?.reduce((acc, task) => {
        return acc + (task.estimated_cost || 0);
      }, 0) || 0;

      // Calculate total budget hours available
      const totalBudgetHours = clientBudgets?.reduce((acc, budget) => {
        return acc + (budget.hours_budget || 0);
      }, 0) || 0;

      // Calculate budget utilization percentage
      const budgetHoursUtilization = totalBudgetHours > 0 
        ? Math.min(100, (estimatedHours / totalBudgetHours) * 100) 
        : 0;

      const completionPercentage = estimatedHours > 0 
        ? Math.min(100, (completedHours / estimatedHours) * 100) 
        : 0;

      const costEfficiencyPercentage = estimatedCost > 0 
        ? Math.min(100, (actualCost / estimatedCost) * 100) 
        : 0;

      setTimeStats({
        total_hours_completed: completedHours,
        total_hours_estimated: estimatedHours,
        total_cost_estimated: estimatedCost,
        total_cost_actual: actualCost,
        completion_percentage: completionPercentage,
        cost_efficiency_percentage: costEfficiencyPercentage,
        budget_hours_available: totalBudgetHours,
        budget_hours_utilization: budgetHoursUtilization
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
          cost: existing.cost + (entry.actual_cost || 0), // Use actual_cost from entry
        });
      });

      setDailyStats(
        Array.from(dailyData.entries())
          .map(([date, stats]) => ({
            date: format(new Date(date), 'MMM d'),
            hours: stats.hours,
            cost: stats.cost,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );

      // Calculate client stats
      const clientMap = new Map<string, ClientStats>();
      
      // Create a map of client IDs to budget hours
      const clientBudgetMap = new Map<string, number>();
      clientBudgets?.forEach(budget => {
        const existing = clientBudgetMap.get(budget.client_id) || 0;
        clientBudgetMap.set(budget.client_id, existing + budget.hours_budget);
      });
      
      // Initialize with task data
      tasksData?.forEach(task => {
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
        const clientBudgetHours = clientBudgetMap.get(clientId) || 0;
        
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            id: clientId,
            name: clientName,
            total_hours_completed: 0,
            total_hours_estimated: 0,
            total_cost_actual: 0,
            total_cost_estimated: 0,
            task_count: 0,
            completed_tasks: 0,
            budget_hours: clientBudgetHours,
            budget_hours_utilization: 0
          });
        }
        
        const client = clientMap.get(clientId)!;
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
          const client = clientMap.get(clientId)!;
          const duration = entry.end_time 
            ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
            : 0;
          
          client.total_hours_completed += duration;
          client.total_cost_actual += (entry.actual_cost || 0); // Use actual_cost from entry
        }
      });

      // Calculate budget utilization for each client
      clientMap.forEach(client => {
        if (client.budget_hours > 0) {
          client.budget_hours_utilization = Math.min(100, (client.total_hours_estimated / client.budget_hours) * 100);
        }
      });

      setClientStats(Array.from(clientMap.values()));

      // Calculate user stats
      const userMap = new Map<string, UserStats>();
      
      // Process time entries for user stats
      timeEntries.forEach(entry => {
        if (!entry.user_id) return;
        
        if (!userMap.has(entry.user_id)) {
          userMap.set(entry.user_id, {
            id: entry.user_id,
            email: userEmailMap.get(entry.user_id) || 'Unknown User',
            total_hours: 0,
            total_cost: 0,
            assigned_tasks: 0,
            completed_tasks: 0,
            efficiency: 100
          });
        }
        
        const user = userMap.get(entry.user_id)!;
        const duration = entry.end_time 
          ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
          : 0;
        
        user.total_hours += duration;
        user.total_cost += (entry.actual_cost || 0); // Use actual_cost from entry
      });
      
      // Get task assignments for users
      for (const userId of userMap.keys()) {
        const { data: userTasks, error: userTasksError } = await supabase
          .from('tasks')
          .select('id, status, estimated_hours')
          .eq('agency_id', agencyId)
          .eq('assigned_to', userId);
          
        if (userTasksError) {
          logApiCall('tasks.select (user tasks)', false, { error: userTasksError });
          throw userTasksError;
        }
        
        if (userTasks) {
          const user = userMap.get(userId)!;
          user.assigned_tasks = userTasks.length;
          user.completed_tasks = userTasks.filter(t => t.status === 'done').length;
          
          const estimatedHours = userTasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0);
          if (estimatedHours > 0) {
            user.efficiency = Math.round((user.total_hours / estimatedHours) * 100);
          }
        }
      }

      setUserStats(Array.from(userMap.values()));
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.DATA_PROCESSING,
        'Agency stats processed successfully',
        { 
          agencyId,
          clientCount: clientMap.size,
          userCount: userMap.size,
          timeEntriesCount: timeEntries.length
        }
      );
    } catch (err) {
      console.error('Error fetching agency stats:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching agency stats',
        { error: err, agencyId }
      );
    } finally {
      setIsLoading(false);
    }
  }

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
      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Agency Reports Dashboard</h2>
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
                  {timeStats.total_hours_completed.toFixed(1)}h
                  <span className="ml-2 text-sm text-gray-500">
                    of {timeStats.total_hours_estimated.toFixed(1)}h estimated
                  </span>
                </div>
                <div className={clsx(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  timeStats.completion_percentage >= 100 
                    ? "bg-red-100 text-red-800" 
                    : timeStats.completion_percentage >= 75 
                      ? "bg-yellow-100 text-yellow-800" 
                      : "bg-green-100 text-green-800"
                )}>
                  {timeStats.completion_percentage.toFixed(0)}%
                </div>
              </dd>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={clsx(
                    "h-2.5 rounded-full",
                    timeStats.completion_percentage >= 100 
                      ? "bg-red-600" 
                      : timeStats.completion_percentage >= 75 
                        ? "bg-yellow-500" 
                        : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(100, timeStats.completion_percentage)}%` }}
                ></div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
              <dt className="truncate text-sm font-medium text-gray-500">Budget Hours Utilization</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <div className="flex items-baseline text-2xl font-semibold text-gray-900">
                  {timeStats.total_hours_estimated.toFixed(1)}h
                  <span className="ml-2 text-sm text-gray-500">
                    of {timeStats.budget_hours_available.toFixed(1)}h available
                  </span>
                </div>
                <div className={clsx(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  timeStats.budget_hours_utilization >= 100 
                    ? "bg-red-100 text-red-800" 
                    : timeStats.budget_hours_utilization >= 75 
                      ? "bg-yellow-100 text-yellow-800" 
                      : "bg-green-100 text-green-800"
                )}>
                  {timeStats.budget_hours_utilization.toFixed(0)}%
                </div>
              </dd>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={clsx(
                    "h-2.5 rounded-full",
                    timeStats.budget_hours_utilization >= 100 
                      ? "bg-red-600" 
                      : timeStats.budget_hours_utilization >= 75 
                        ? "bg-yellow-500" 
                        : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(100, timeStats.budget_hours_utilization)}%` }}
                ></div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
              <dt className="truncate text-sm font-medium text-gray-500">Total Estimated Cost</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <div className="flex items-baseline text-2xl font-semibold text-gray-900">
                  ${timeStats.total_cost_estimated.toFixed(2)}
                </div>
              </dd>
              <dt className="mt-4 truncate text-sm font-medium text-gray-500">Actual Cost</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <div className="flex items-baseline text-xl font-semibold text-gray-900">
                  ${timeStats.total_cost_actual.toFixed(2)}
                </div>
                <div className={clsx(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  timeStats.cost_efficiency_percentage > 100 
                    ? "bg-red-100 text-red-800" 
                    : timeStats.cost_efficiency_percentage > 90 
                      ? "bg-yellow-100 text-yellow-800" 
                      : "bg-green-100 text-green-800"
                )}>
                  {timeStats.cost_efficiency_percentage.toFixed(0)}%
                </div>
              </dd>
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
              {dailyStats.length > 0 ? (
                dailyStats.map(({ date, hours, cost }) => (
                  <div key={date} className="flex flex-col items-center">
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-8 bg-blue-500 rounded-t"
                        style={{ height: `${(hours / Math.max(...dailyStats.map(d => d.hours), 0.1)) * 100}%` }}
                        title={`${hours.toFixed(1)} hours`}
                      />
                      <div 
                        className="w-8 bg-green-500 rounded-t mt-1"
                        style={{ height: `${(cost / Math.max(...dailyStats.map(d => d.cost), 0.1)) * 100}%` }}
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

      {/* Client Performance */}
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
                      Budget Hours
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Budget Utilization
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
                  {clientStats.length > 0 ? (
                    clientStats.map((client) => (
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
                          {client.budget_hours.toFixed(1)}h
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {client.budget_hours > 0 ? (
                            <div className="flex items-center">
                              <span className="mr-2">{client.budget_hours_utilization.toFixed(0)}%</span>
                              <div className="w-20 bg-gray-200 rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full ${
                                    client.budget_hours_utilization > 100 
                                      ? 'bg-red-500' 
                                      : client.budget_hours_utilization > 75 
                                        ? 'bg-yellow-500' 
                                        : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(100, client.budget_hours_utilization)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : 'N/A'}
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
                      <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
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
                  {userStats.length > 0 ? (
                    userStats.map((stat) => (
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
    </div>
  );
}