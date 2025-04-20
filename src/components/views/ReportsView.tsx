import React, { useState, useEffect, useMemo } from 'react';
import { Task, TimeEntry } from '../../lib/types';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { BarChart2, Clock, DollarSign, CheckSquare, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface ReportsViewProps {
  clientId: string;
  boardId: string;
  tasks: Task[];
  columns: any[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onTaskClick: (taskId: string) => void;
}

interface TimeStats {
  hours_completed: number;
  hours_estimated: number;
  cost_actual: number;
  cost_estimated: number;
  completion_percentage: number;
  cost_efficiency_percentage: number;
}

interface UserStats {
  user_id: string;
  user_email: string;
  hours_completed: number;
  cost_actual: number;
  tasks_assigned: number;
  tasks_completed: number;
  efficiency_percentage: number;
}

interface StatusStats {
  status: string;
  status_name: string;
  count: number;
  percentage: number;
}

export function ReportsView({ tasks, columns, onTaskClick }: ReportsViewProps) {
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch time entries when date range changes
  useEffect(() => {
    async function fetchTimeEntries() {
      try {
        setIsLoading(true);
        const { startDate, endDate } = dateRangeValues;

        const { data, error } = await supabase
          .from('task_time_entries')
          .select(`
            *,
            task:tasks(id, title, status, priority, estimated_hours, estimated_cost)
          `)
          .gte('start_time', startDate.toISOString())
          .lte('start_time', endDate.toISOString())
          .order('start_time', { ascending: false });

        if (error) throw error;
        setTimeEntries(data || []);
      } catch (err) {
        console.error('Error fetching time entries:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTimeEntries();
  }, [dateRange, dateRangeValues]);

  // Calculate task status metrics
  const statusStats = useMemo(() => {
    const total = tasks.length;
    const statusCounts: Record<string, number> = {};
    
    // Initialize with all column statuses
    columns.forEach(column => {
      statusCounts[column.key] = 0;
    });
    
    // Count tasks by status
    tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    
    // Convert to array with percentages
    return Object.entries(statusCounts).map(([status, count]) => {
      const columnInfo = columns.find(c => c.key === status) || { name: status };
      return {
        status,
        status_name: columnInfo.name || status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      };
    });
  }, [tasks, columns]);

  // Calculate time and cost stats
  const timeStats = useMemo((): TimeStats => {
    // Calculate completed hours and actual cost from time entries
    const hoursCompleted = timeEntries.reduce((sum, entry) => {
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      return sum + duration;
    }, 0);
    
    const costActual = timeEntries.reduce((sum, entry) => {
      return sum + (entry.actual_cost || 0);
    }, 0);
    
    // Calculate estimated hours and cost from tasks
    const hoursEstimated = tasks.reduce((sum, task) => {
      return sum + (task.estimated_hours || 0);
    }, 0);
    
    const costEstimated = tasks.reduce((sum, task) => {
      return sum + (task.estimated_cost || 0);
    }, 0);
    
    // Calculate percentages
    const completionPercentage = hoursEstimated > 0 
      ? Math.min(100, (hoursCompleted / hoursEstimated) * 100) 
      : 0;
    
    const costEfficiencyPercentage = costEstimated > 0 
      ? Math.min(100, (costActual / costEstimated) * 100) 
      : 0;
    
    return {
      hours_completed: hoursCompleted,
      hours_estimated: hoursEstimated,
      cost_actual: costActual,
      cost_estimated: costEstimated,
      completion_percentage: completionPercentage,
      cost_efficiency_percentage: costEfficiencyPercentage
    };
  }, [timeEntries, tasks]);

  // Calculate user stats
  const userStats = useMemo((): UserStats[] => {
    const userMap = new Map<string, UserStats>();
    
    // Process time entries for user stats
    timeEntries.forEach(entry => {
      if (!entry.user_id || !entry.user_email) return;
      
      if (!userMap.has(entry.user_id)) {
        userMap.set(entry.user_id, {
          user_id: entry.user_id,
          user_email: entry.user_email,
          hours_completed: 0,
          cost_actual: 0,
          tasks_assigned: 0,
          tasks_completed: 0,
          efficiency_percentage: 100
        });
      }
      
      const user = userMap.get(entry.user_id)!;
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;
      
      user.hours_completed += duration;
      user.cost_actual += entry.actual_cost || 0;
    });
    
    // Add task assignment data
    tasks.forEach(task => {
      if (!task.assigned_to) return;
      
      if (!userMap.has(task.assigned_to)) {
        userMap.set(task.assigned_to, {
          user_id: task.assigned_to,
          user_email: task.assigned_to_email || 'Unknown',
          hours_completed: 0,
          cost_actual: 0,
          tasks_assigned: 0,
          tasks_completed: 0,
          efficiency_percentage: 100
        });
      }
      
      const user = userMap.get(task.assigned_to)!;
      user.tasks_assigned++;
      
      if (task.status === 'done') {
        user.tasks_completed++;
      }
    });
    
    // Calculate efficiency
    userMap.forEach(user => {
      // Find tasks assigned to this user
      const userTasks = tasks.filter(t => t.assigned_to === user.user_id);
      const estimatedHours = userTasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0);
      
      if (estimatedHours > 0 && user.hours_completed > 0) {
        user.efficiency_percentage = Math.round((user.hours_completed / estimatedHours) * 100);
      }
    });
    
    return Array.from(userMap.values())
      .sort((a, b) => b.hours_completed - a.hours_completed);
  }, [timeEntries, tasks]);

  // Calculate daily hours
  const dailyHours = useMemo(() => {
    const hours = new Map<string, number>();
    const costs = new Map<string, number>();

    timeEntries.forEach(entry => {
      const date = format(new Date(entry.start_time), 'yyyy-MM-dd');
      const duration = entry.end_time 
        ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
        : 0;

      hours.set(date, (hours.get(date) || 0) + duration);
      costs.set(date, (costs.get(date) || 0) + (entry.actual_cost || 0));
    });

    return Array.from(hours.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, hours]) => ({
        date: format(new Date(date), 'MMM d'),
        hours,
        cost: costs.get(date) || 0
      }));
  }, [timeEntries]);

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
        <h2 className="text-lg font-medium text-gray-900">Reports Dashboard</h2>
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
                {tasks.length}
              </dd>
            </div>
            
            {statusStats.slice(0, 3).map(stat => (
              <div key={stat.status} className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
                <dt className="truncate text-sm font-medium text-gray-500">{stat.status_name}</dt>
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
                  {timeStats.hours_completed.toFixed(1)}h
                  <span className="ml-2 text-sm text-gray-500">
                    of {timeStats.hours_estimated.toFixed(1)}h estimated
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
              <dt className="truncate text-sm font-medium text-gray-500">Total Estimated Cost</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <div className="flex items-baseline text-2xl font-semibold text-gray-900">
                  ${timeStats.cost_estimated.toFixed(2)}
                </div>
              </dd>
              <dt className="mt-4 truncate text-sm font-medium text-gray-500">Actual Cost</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <div className="flex items-baseline text-xl font-semibold text-gray-900">
                  ${timeStats.cost_actual.toFixed(2)}
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
              <dt className="truncate text-sm font-medium text-gray-500">Task Completion</dt>
              <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
                {tasks.filter(t => t.status === 'done').length} / {tasks.length}
              </dd>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ 
                    width: `${tasks.length > 0 
                      ? (tasks.filter(t => t.status === 'done').length / tasks.length) * 100 
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

      {/* Daily Hours Chart */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            Daily Hours
          </h3>
          <div className="mt-5 h-64">
            <div className="h-full flex items-end justify-between">
              {dailyHours.length > 0 ? (
                dailyHours.map(({ date, hours, cost }) => (
                  <div key={date} className="flex flex-col items-center">
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-8 bg-blue-500 rounded-t"
                        style={{ height: `${(hours / Math.max(...dailyHours.map(d => d.hours), 0.1)) * 100}%` }}
                        title={`${hours.toFixed(1)} hours`}
                      />
                      <div 
                        className="w-8 bg-green-500 rounded-t mt-1"
                        style={{ height: `${(cost / Math.max(...dailyHours.map(d => d.cost), 0.1)) * 100}%` }}
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

      {/* User Stats */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            User Activity
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
                      <tr key={stat.user_id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                          {stat.user_email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {stat.hours_completed.toFixed(1)}h
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {stat.tasks_completed} / {stat.tasks_assigned}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {stat.tasks_assigned > 0 
                            ? (
                              <div className="flex items-center">
                                <span className="mr-2">{((stat.tasks_completed / stat.tasks_assigned) * 100).toFixed(0)}%</span>
                                <div className="w-20 bg-gray-200 rounded-full h-2.5">
                                  <div 
                                    className="bg-blue-600 h-2.5 rounded-full"
                                    style={{ width: `${(stat.tasks_completed / stat.tasks_assigned) * 100}%` }}
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
                                stat.efficiency_percentage <= 90 ? 'bg-green-500' :
                                stat.efficiency_percentage <= 110 ? 'bg-yellow-500' :
                                'bg-red-500'
                              )}
                              style={{ width: `${Math.min(stat.efficiency_percentage, 200) / 2}%` }}
                            />
                            <span className="ml-2">{stat.efficiency_percentage}%</span>
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