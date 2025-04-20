import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { ClientBudget } from '../lib/types';
import { useAppContext } from '../lib/AppContext';
import { ChevronLeft, ChevronRight, DollarSign, Clock, AlertCircle } from 'lucide-react';

interface ClientBudgetReportProps {
  clientId: string;
}

export function ClientBudgetReport({ clientId }: ClientBudgetReportProps) {
  const { systemSettings } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completionData, setCompletionData] = useState<{
    total_hours_estimated: number;
    total_hours_completed: number;
    completion_percentage: number;
    tasks_with_dates: number;
    tasks_without_dates: number;
    budget_hours_available: number;
    budget_hours_utilization: number;
  }>({
    total_hours_estimated: 0,
    total_hours_completed: 0,
    completion_percentage: 0,
    tasks_with_dates: 0,
    tasks_without_dates: 0,
    budget_hours_available: 0,
    budget_hours_utilization: 0
  });

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchBudgetReport();
    fetchCompletionData();
  }, [clientId, currentDate]);

  async function fetchBudgetReport() {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate 3 months before and after current month
      const startMonth = format(subMonths(startOfMonth(currentDate), 3), 'yyyy-MM');
      const endMonth = format(addMonths(startOfMonth(currentDate), 3), 'yyyy-MM');

      const { data, error: rpcError } = await supabase.rpc(
        'get_client_budget_report',
        {
          p_client_id: clientId,
          p_start_month: startMonth,
          p_end_month: endMonth
        }
      );

      if (rpcError) throw rpcError;
      setReportData(data || []);
    } catch (err) {
      console.error('Error fetching budget report:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCompletionData() {
    try {
      // Get the current month in yyyy-MM format
      const currentMonth = format(currentDate, 'yyyy-MM');
      
      // Fetch tasks for the client
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          estimated_hours,
          status,
          finish_date,
          start_date
        `)
        .eq('client_id', clientId);

      if (tasksError) throw tasksError;

      // Fetch time entries for completed hours
      const { data: timeEntries, error: timeError } = await supabase
        .from('task_time_entries')
        .select(`
          id,
          task_id,
          start_time,
          end_time,
          task:tasks!inner(
            id,
            client_id
          )
        `)
        .eq('task.client_id', clientId);

      if (timeError) throw timeError;

      // Fetch budget for the current month
      const { data: budgetData, error: budgetError } = await supabase
        .from('client_budgets')
        .select('hours_budget, cost_budget')
        .eq('client_id', clientId)
        .eq('month', currentMonth)
        .maybeSingle();

      if (budgetError) throw budgetError;

      // Calculate completed hours
      const completedHours = timeEntries.reduce((acc, entry) => {
        const duration = entry.end_time 
          ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
          : 0;
        return acc + duration;
      }, 0);

      // Calculate estimated hours for tasks with finish dates in the current month
      const currentMonthStart = startOfMonth(currentDate);
      const currentMonthEnd = endOfMonth(currentDate);
      
      const estimatedHours = tasksData?.reduce((acc, task) => {
        // Check if task has a finish date in the current month
        if (task.finish_date) {
          const finishDate = new Date(task.finish_date);
          if (finishDate >= currentMonthStart && finishDate <= currentMonthEnd) {
            return acc + (task.estimated_hours || 0);
          }
        }
        return acc;
      }, 0) || 0;

      // Count tasks with and without finish dates
      const tasksWithDates = tasksData?.filter(task => task.finish_date).length || 0;
      const tasksWithoutDates = (tasksData?.length || 0) - tasksWithDates;

      // Calculate completion percentage
      const completionPercentage = estimatedHours > 0 
        ? Math.min(100, (completedHours / estimatedHours) * 100) 
        : 0;

      // Get budget hours available
      const budgetHours = budgetData?.hours_budget || 0;
      
      // Calculate budget utilization percentage
      const budgetUtilization = budgetHours > 0
        ? Math.min(100, (estimatedHours / budgetHours) * 100)
        : 0;

      setCompletionData({
        total_hours_estimated: estimatedHours,
        total_hours_completed: completedHours,
        completion_percentage: completionPercentage,
        tasks_with_dates: tasksWithDates,
        tasks_without_dates: tasksWithoutDates,
        budget_hours_available: budgetHours,
        budget_hours_utilization: budgetUtilization
      });
    } catch (err) {
      console.error('Error fetching completion data:', err);
    }
  }

  const handlePreviousMonth = () => {
    setCurrentDate(prevDate => subMonths(prevDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const isCurrentMonth = (monthStr: string) => {
    const currentMonth = format(currentDate, 'yyyy-MM');
    return monthStr === currentMonth;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Budget Report</h3>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePreviousMonth}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>
          <span className="text-sm font-medium">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Task Completion Stats */}
      <div className="bg-white shadow rounded-lg p-6">
        <h4 className="text-base font-medium text-gray-900 mb-4">Task Completion Summary</h4>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Clock className="h-5 w-5 mr-2 text-gray-500" />
              <h5 className="text-sm font-medium text-gray-700">Task Hours Completion</h5>
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-2xl font-bold">{completionData.total_hours_completed.toFixed(1)}h</span>
              <span className="text-sm text-gray-500">
                of {completionData.total_hours_estimated.toFixed(1)}h estimated
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div 
                className={`h-2.5 rounded-full ${
                  completionData.completion_percentage >= 100 
                    ? 'bg-red-500' 
                    : completionData.completion_percentage >= 75 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, completionData.completion_percentage)}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-gray-600">
                Completion rate: {completionData.completion_percentage.toFixed(0)}%
              </span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Clock className="h-5 w-5 mr-2 text-gray-500" />
              <h5 className="text-sm font-medium text-gray-700">Budget Utilization</h5>
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-2xl font-bold">{completionData.total_hours_estimated.toFixed(1)}h</span>
              <span className="text-sm text-gray-500">
                of {completionData.budget_hours_available.toFixed(1)}h budgeted
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div 
                className={`h-2.5 rounded-full ${
                  completionData.budget_hours_utilization >= 100 
                    ? 'bg-red-500' 
                    : completionData.budget_hours_utilization >= 75 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, completionData.budget_hours_utilization)}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm">
              <span className={completionData.budget_hours_utilization >= 100 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                Budget utilization: {completionData.budget_hours_utilization.toFixed(0)}%
                {completionData.budget_hours_utilization > 100 && ' (Over budget)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {reportData.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">No budget data available for this period.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours Budget
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours Used
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((report) => {
                  const isCurrentMonthReport = isCurrentMonth(report.month);
                  
                  return (
                    <tr 
                      key={report.month} 
                      className={isCurrentMonthReport ? 'bg-blue-50' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatMonth(report.month)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-gray-400" />
                          {report.hours_budget.toFixed(1)}h
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          {report.hours_used.toFixed(1)}h
                          <span className="ml-1 text-xs">
                            ({report.hours_percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className={`h-1.5 rounded-full ${
                              report.hours_percentage > 100 
                                ? 'bg-red-500' 
                                : report.hours_percentage > 75 
                                  ? 'bg-yellow-500' 
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, report.hours_percentage)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={report.hours_remaining < 0 ? 'text-red-600 font-medium' : ''}>
                          {report.hours_remaining.toFixed(1)}h
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h4 className="text-base font-medium text-gray-900 mb-4">Budget Summary</h4>
        
        {reportData.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Hours Budget Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Clock className="h-5 w-5 mr-2 text-gray-500" />
                <h5 className="text-sm font-medium text-gray-700">Hours Budget</h5>
              </div>
              
              {(() => {
                const currentMonthData = reportData.find(r => isCurrentMonth(r.month));
                if (!currentMonthData) return <p className="text-sm text-gray-500">No data for current month</p>;
                
                return (
                  <>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-2xl font-bold">{currentMonthData.hours_used.toFixed(1)}h</span>
                      <span className="text-sm text-gray-500">of {currentMonthData.hours_budget.toFixed(1)}h</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          currentMonthData.hours_percentage > 100 
                            ? 'bg-red-500' 
                            : currentMonthData.hours_percentage > 75 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, currentMonthData.hours_percentage)}%` }}
                      ></div>
                    </div>
                    
                    <div className="mt-2 text-sm">
                      <span className={currentMonthData.hours_remaining < 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {currentMonthData.hours_remaining < 0 ? 'Over budget by ' : 'Remaining: '}
                        {Math.abs(currentMonthData.hours_remaining).toFixed(1)}h
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center">No budget data available.</p>
        )}
      </div>
    </div>
  );
}