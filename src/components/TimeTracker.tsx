import React, { useState, useEffect } from 'react';
import { Play, Pause, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

interface TimeTrackerProps {
  taskId: string;
  estimatedHours: number | null;
  estimatedCost: number | null;
  onTimeEntryAdded: () => void;
}

interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  duration: string;
  description: string | null;
  is_billable: boolean;
  actual_cost: number | null;
}

interface TimeStats {
  total_hours: number;
  total_cost: number;
  hours_variance: number;
  cost_variance: number;
}

export function TimeTracker({ taskId, estimatedHours, estimatedCost, onTimeEntryAdded }: TimeTrackerProps) {
  const { user } = useAuthStore();
  const [isTracking, setIsTracking] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<TimeStats>({
    total_hours: 0,
    total_cost: 0,
    hours_variance: 0,
    cost_variance: 0
  });
  const [description, setDescription] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), 'HH:mm'),
    duration: '',
    description: '',
    cost: '',
    is_billable: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeEntries();
    checkRunningTimer();
  }, [taskId]);

  async function fetchTimeEntries() {
    try {
      const { data, error } = await supabase
        .from('task_time_entries')
        .select('*')
        .eq('task_id', taskId)
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Format the duration for each entry
      const entriesWithDuration = data?.map(entry => {
        let duration = 'In progress';
        if (entry.end_time) {
          const startTime = new Date(entry.start_time);
          const endTime = new Date(entry.end_time);
          const durationMs = endTime.getTime() - startTime.getTime();
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          duration = `${hours}h ${minutes}m`;
        }
        return {
          ...entry,
          duration
        };
      }) || [];

      setTimeEntries(entriesWithDuration);
      calculateStats(entriesWithDuration);
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function checkRunningTimer() {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_running_time_entry', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const entry = data[0];
        setCurrentEntry(entry);
        setIsTracking(entry.task_id === taskId);
        if (entry.description) {
          setDescription(entry.description);
        }
      }
    } catch (err) {
      console.error('Error checking running timer:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  function calculateStats(entries: TimeEntry[]) {
    const totalHours = entries.reduce((sum, entry) => {
      if (!entry.end_time) return sum;
      const duration = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
      return sum + (duration / (1000 * 60 * 60));
    }, 0);

    const totalCost = entries.reduce((sum, entry) => sum + (entry.actual_cost || 0), 0);

    setStats({
      total_hours: totalHours,
      total_cost: totalCost,
      hours_variance: estimatedHours ? estimatedHours - totalHours : 0,
      cost_variance: estimatedCost ? estimatedCost - totalCost : 0
    });
  }

  async function handleStartTimer() {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('start_time_tracking', {
        p_task_id: taskId,
        p_description: description
      });

      if (error) throw error;

      setIsTracking(true);
      await checkRunningTimer();
      onTimeEntryAdded();
    } catch (err) {
      console.error('Error starting timer:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStopTimer() {
    if (!currentEntry) {
      setError('No active time entry found');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.rpc('stop_time_tracking', {
        p_entry_id: currentEntry.id,
        p_description: description || currentEntry.description
      });

      if (error) throw error;

      setIsTracking(false);
      setCurrentEntry(null);
      setDescription('');
      onTimeEntryAdded();
    } catch (err) {
      console.error('Error stopping timer:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleManualEntry() {
    setIsLoading(true);
    setError(null);
    
    try {
      const startDateTime = new Date(`${manualEntry.date}T${manualEntry.startTime}`);
      const durationHours = parseFloat(manualEntry.duration);
      
      if (isNaN(durationHours) || durationHours <= 0) {
        throw new Error('Invalid duration');
      }

      const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

      const { error } = await supabase.rpc('add_manual_time_entry', {
        p_task_id: taskId,
        p_start_time: startDateTime.toISOString(),
        p_end_time: endDateTime.toISOString(),
        p_description: manualEntry.description,
        p_is_billable: manualEntry.is_billable
      });

      if (error) throw error;

      setIsAddingManual(false);
      setManualEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: format(new Date(), 'HH:mm'),
        duration: '',
        description: '',
        cost: '',
        is_billable: true
      });
      onTimeEntryAdded();
    } catch (err) {
      console.error('Error adding manual time entry:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Time & Cost Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Time Tracking</h3>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-semibold text-gray-900">
              {stats.total_hours.toFixed(1)}h
            </span>
            {estimatedHours && (
              <span className={`ml-2 text-sm ${stats.hours_variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                / {estimatedHours}h
              </span>
            )}
          </div>
          {estimatedHours && (
            <p className="mt-1 text-sm text-gray-500">
              Variance: {stats.hours_variance.toFixed(1)}h
            </p>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Cost Tracking</h3>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-semibold text-gray-900">
              ${stats.total_cost.toFixed(2)}
            </span>
            {estimatedCost && (
              <span className={`ml-2 text-sm ${stats.cost_variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                / ${estimatedCost.toFixed(2)}
              </span>
            )}
          </div>
          {estimatedCost && (
            <p className="mt-1 text-sm text-gray-500">
              Variance: ${stats.cost_variance.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you working on?"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {isTracking ? (
            <button
              onClick={handleStopTimer}
              disabled={isLoading}
              className="inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <Pause className="h-4 w-4 mr-1" />
              )}
              Stop
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={isLoading}
              className="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Start
            </button>
          )}

          <button
            onClick={() => setIsAddingManual(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            <Clock className="h-4 w-4 mr-1" />
            Add Time
          </button>
        </div>
      </div>

      {/* Manual Time Entry Form */}
      {isAddingManual && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={manualEntry.date}
                onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                value={manualEntry.startTime}
                onChange={(e) => setManualEntry({ ...manualEntry, startTime: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (hours)</label>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={manualEntry.duration}
                onChange={(e) => setManualEntry({ ...manualEntry, duration: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Cost</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualEntry.cost}
                  onChange={(e) => setManualEntry({ ...manualEntry, cost: e.target.value })}
                  className="block w-full pl-10 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={manualEntry.description}
                onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="What did you work on?"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={manualEntry.is_billable}
                  onChange={(e) => setManualEntry({ ...manualEntry, is_billable: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="ml-2 text-sm text-gray-700">Billable time</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAddingManual(false)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleManualEntry}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Add Entry'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Time Entries List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Time Entries</h3>
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Date</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Duration</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Description</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cost</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Billable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {timeEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                    {format(new Date(entry.start_time), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {entry.duration}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    {entry.description || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {entry.actual_cost ? `$${entry.actual_cost.toFixed(2)}` : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {entry.is_billable ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
              {timeEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-gray-500">
                    No time entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}