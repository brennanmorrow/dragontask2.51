import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Plus, Clock, X, DollarSign, Send, Check, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { TimeEntries } from './TimeEntries';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface TimeEntry {
  id: string;
  task_id: string;
  task_title: string;
  start_time: string;
  duration: string;
  description: string | null;
}

interface TaskTimerProps {
  taskId: string;
  taskTitle: string;
  onTimeEntryAdded: () => void;
}

export function TaskTimer({ taskId, taskTitle, onTimeEntryAdded }: TaskTimerProps) {
  const { user } = useAuthStore();
  const [isRunning, setIsRunning] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('0:00:00');
  const [description, setDescription] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), 'HH:mm'),
    duration: '',
    description: '',
    is_billable: true,
    actual_cost: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState<string>('50');
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    checkRunningTimer();
    timerIntervalRef.current = window.setInterval(updateElapsedTime, 1000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentEntry]);

  async function checkRunningTimer() {
    if (!user) return;

    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Checking for running timer',
        { userId: user.id, taskId }
      );
      
      const { data, error } = await supabase.rpc('get_running_time_entry', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const entry = data[0];
        setCurrentEntry(entry);
        setIsRunning(entry.task_id === taskId);
        if (entry.description) {
          setDescription(entry.description);
        }
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.API_CALL,
          'Found running timer',
          { entryId: entry.id, taskId: entry.task_id }
        );
      } else {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.API_CALL,
          'No running timer found',
          { userId: user.id }
        );
      }
    } catch (err) {
      console.error('Error checking running timer:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error checking running timer',
        { error: err, userId: user?.id }
      );
    }
  }

  function updateElapsedTime(entry = currentEntry) {
    if (!entry || !entry.start_time) return;

    const start = new Date(entry.start_time);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    
    // Format as HH:MM:SS
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    setElapsedTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }

  async function handleStartTimer() {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Starting timer',
        { taskId, description }
      );
      
      const { data, error } = await supabase.rpc('start_time_tracking', {
        p_task_id: taskId,
        p_description: description
      });

      if (error) throw error;

      setIsRunning(true);
      await checkRunningTimer();
      onTimeEntryAdded();
      
      setSuccessMessage('Timer started successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Timer started successfully',
        { taskId }
      );
    } catch (err) {
      console.error('Error starting timer:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error starting timer',
        { error: err, taskId }
      );
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
    setSuccessMessage(null);
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Stopping timer',
        { entryId: currentEntry.id }
      );
      
      const { error } = await supabase.rpc('stop_time_tracking', {
        p_entry_id: currentEntry.id,
        p_description: description || currentEntry.description
      });

      if (error) throw error;

      setIsRunning(false);
      setCurrentEntry(null);
      setDescription('');
      onTimeEntryAdded();
      
      setSuccessMessage('Timer stopped successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Timer stopped successfully',
        { entryId: currentEntry.id }
      );
    } catch (err) {
      console.error('Error stopping timer:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error stopping timer',
        { error: err, entryId: currentEntry?.id }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleManualEntry() {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const startDateTime = new Date(`${manualEntry.date}T${manualEntry.startTime}`);
      const durationHours = parseFloat(manualEntry.duration);
      
      if (isNaN(durationHours) || durationHours <= 0) {
        throw new Error('Invalid duration');
      }

      const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);
      
      // Calculate cost based on duration and hourly rate if not manually specified
      let actualCost = manualEntry.actual_cost ? parseFloat(manualEntry.actual_cost) : null;
      if (!actualCost && durationHours > 0 && parseFloat(hourlyRate) > 0) {
        actualCost = durationHours * parseFloat(hourlyRate);
      }

      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Adding manual time entry',
        { 
          taskId, 
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          duration: durationHours,
          actualCost
        }
      );

      // Use the updated RPC function that accepts actual_cost
      const { error } = await supabase.rpc('add_manual_time_entry', {
        p_task_id: taskId,
        p_start_time: startDateTime.toISOString(),
        p_end_time: endDateTime.toISOString(),
        p_description: manualEntry.description,
        p_is_billable: manualEntry.is_billable,
        p_actual_cost: actualCost
      });

      if (error) throw error;

      setIsAddingManual(false);
      setManualEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: format(new Date(), 'HH:mm'),
        duration: '',
        description: '',
        is_billable: true,
        actual_cost: ''
      });
      onTimeEntryAdded();
      
      setSuccessMessage('Time entry added successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Manual time entry added successfully',
        { taskId }
      );
    } catch (err) {
      console.error('Error adding manual time entry:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error adding manual time entry',
        { error: err, taskId }
      );
    } finally {
      setIsLoading(false);
    }
  }

  const handleTimeEntryDeleted = () => {
    onTimeEntryAdded();
    setSuccessMessage('Time entry deleted successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Calculate cost based on duration
  const calculateCost = () => {
    const duration = parseFloat(manualEntry.duration);
    const rate = parseFloat(hourlyRate);
    
    if (!isNaN(duration) && !isNaN(rate) && duration > 0 && rate > 0) {
      const cost = (duration * rate).toFixed(2);
      setManualEntry(prev => ({
        ...prev,
        actual_cost: cost
      }));
    }
  };

  // Update cost when duration or hourly rate changes
  useEffect(() => {
    if (!manualEntry.actual_cost) {
      calculateCost();
    }
  }, [manualEntry.duration, hourlyRate]);

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
      
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4 mb-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">{successMessage}</div>
            </div>
          </div>
        </div>
      )}
      
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
          <div className="text-lg font-mono">{elapsedTime}</div>
          
          {isRunning ? (
            <button
              onClick={handleStopTimer}
              disabled={isLoading}
              className="inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Stopping...
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Stop
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={isLoading}
              className="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setIsAddingManual(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Time/Cost
          </button>
        </div>
      </div>

      {/* Manual Time Entry Form */}
      {isAddingManual && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">Add Manual Time or Cost Entry</h4>
            <button
              onClick={() => setIsAddingManual(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                onChange={(e) => setManualEntry({ ...manualEntry, duration: e.target.value, actual_cost: '' })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Hourly Rate ($)</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => {
                    setHourlyRate(e.target.value);
                    setManualEntry(prev => ({ ...prev, actual_cost: '' }));
                  }}
                  className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="50.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Actual Cost ($)</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualEntry.actual_cost}
                  onChange={(e) => setManualEntry({ ...manualEntry, actual_cost: e.target.value })}
                  className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder={
                    manualEntry.duration && hourlyRate 
                      ? (parseFloat(manualEntry.duration) * parseFloat(hourlyRate)).toFixed(2)
                      : "0.00"
                  }
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to auto-calculate based on duration and hourly rate
              </p>
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
          </div>

          <div className="flex items-center mt-1">
            <input
              id="is_billable"
              name="is_billable"
              type="checkbox"
              checked={manualEntry.is_billable}
              onChange={(e) => setManualEntry({ ...manualEntry, is_billable: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_billable" className="ml-2 block text-sm text-gray-700">
              Billable time
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddingManual(false)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleManualEntry}
              disabled={isLoading || !manualEntry.duration}
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
      <TimeEntries taskId={taskId} onEntryDeleted={handleTimeEntryDeleted} />
    </div>
  );
}