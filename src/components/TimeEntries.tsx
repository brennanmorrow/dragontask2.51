import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Trash2, Clock, DollarSign, AlertCircle, User, FileText, Check, X, Edit, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string;
  start_time: string;
  end_time: string | null;
  duration: string;
  description: string | null;
  is_billable: boolean;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
}

interface TimeEntriesProps {
  taskId: string;
  onEntryDeleted: () => void;
}

export function TimeEntries({ taskId, onEntryDeleted }: TimeEntriesProps) {
  const { user, role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    is_billable: true,
    actual_cost: ''
  });

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchTimeEntries();
  }, [taskId]);

  const fetchTimeEntries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching time entries',
        { taskId }
      );
      
      const { data, error } = await supabase
        .from('task_time_entries')
        .select('*')
        .eq('task_id', taskId)
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Format the duration for each entry
      const entriesWithDuration = data?.map(entry => {
        let duration = 'In progress';
        let hours = 0;
        
        if (entry.end_time) {
          const startTime = new Date(entry.start_time);
          const endTime = new Date(entry.end_time);
          const durationMs = endTime.getTime() - startTime.getTime();
          hours = durationMs / (1000 * 60 * 60);
          const hoursInt = Math.floor(hours);
          const minutes = Math.floor((hours - hoursInt) * 60);
          duration = `${hoursInt}h ${minutes}m`;
        }

        return {
          ...entry,
          duration,
          // Provide a fallback for missing user_email
          user_email: entry.user_email || 'Unknown User'
        };
      }) || [];

      setTimeEntries(entriesWithDuration);
      
      // Calculate totals
      let totalHrs = 0;
      let totalCst = 0;
      
      entriesWithDuration.forEach(entry => {
        if (entry.end_time) {
          const startTime = new Date(entry.start_time);
          const endTime = new Date(entry.end_time);
          const durationHrs = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          totalHrs += durationHrs;
          totalCst += entry.actual_cost || 0;
        }
      });
      
      setTotalHours(totalHrs);
      setTotalCost(totalCst);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Time entries fetched successfully',
        { taskId, count: entriesWithDuration.length }
      );
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching time entries',
        { error: err, taskId }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setEditFormData({
      description: entry.description || '',
      is_billable: entry.is_billable,
      actual_cost: entry.actual_cost ? entry.actual_cost.toString() : ''
    });
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditFormData({
      description: '',
      is_billable: true,
      actual_cost: ''
    });
  };

  const handleSaveEdit = async (entryId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Updating time entry',
        { entryId, taskId }
      );
      
      const updates = {
        description: editFormData.description,
        is_billable: editFormData.is_billable,
        actual_cost: editFormData.actual_cost ? parseFloat(editFormData.actual_cost) : null
      };
      
      const { error } = await supabase
        .from('task_time_entries')
        .update(updates)
        .eq('id', entryId);

      if (error) throw error;
      
      // Reset edit state
      setEditingEntryId(null);
      setEditFormData({
        description: '',
        is_billable: true,
        actual_cost: ''
      });
      
      // Refresh entries
      await fetchTimeEntries();
      
      // Show success message
      setSuccessMessage('Time entry updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Time entry updated successfully',
        { entryId, taskId }
      );
    } catch (err) {
      console.error('Error updating time entry:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error updating time entry',
        { error: err, entryId, taskId }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      setIsDeleting(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Deleting time entry',
        { entryId, taskId }
      );
      
      const { error } = await supabase
        .from('task_time_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      
      // Remove the entry from the local state
      setTimeEntries(prev => prev.filter(entry => entry.id !== entryId));
      
      // Reset delete confirmation
      setDeleteConfirmation(null);
      
      // Show success message
      setSuccessMessage('Time entry deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Notify parent component
      onEntryDeleted();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Time entry deleted successfully',
        { entryId, taskId }
      );
    } catch (err) {
      console.error('Error deleting time entry:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error deleting time entry',
        { error: err, entryId, taskId }
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if user can delete an entry
  const canDeleteEntry = (entry: TimeEntry) => {
    // System admins and agency admins can delete any entry
    if (role === 'system_admin' || role === 'agency_admin') {
      return true;
    }
    
    // Users can delete their own entries
    return entry.user_id === user?.id;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: primaryColor }}></div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Time & Cost Entries</h3>
        
        {/* Summary stats */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-gray-500 mr-1" />
            <span className="font-medium">{totalHours.toFixed(1)}h</span>
          </div>
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 text-gray-500 mr-1" />
            <span className="font-medium">${totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}
      
      {timeEntries.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Clock className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No time or cost entries</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start tracking time or add a manual entry to see it here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                  Date & Time
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Duration
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  User
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Description
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Cost
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {timeEntries.map((entry) => (
                <tr key={entry.id} className={entry.is_running ? 'bg-blue-50' : ''}>
                  {editingEntryId === entry.id ? (
                    // Edit mode
                    <>
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-6" colSpan={2}>
                        <div className="font-medium text-gray-900">
                          {format(new Date(entry.start_time), 'MMM d, yyyy h:mm a')}
                          {entry.end_time && ` - ${format(new Date(entry.end_time), 'h:mm a')}`}
                        </div>
                        <div className="text-gray-500 mt-1">
                          Duration: {entry.duration}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {entry.user_email}
                      </td>
                      <td className="px-3 py-4 text-sm">
                        <input
                          type="text"
                          value={editFormData.description || ''}
                          onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Description"
                        />
                      </td>
                      <td className="px-3 py-4 text-sm">
                        <div className="space-y-2">
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <DollarSign className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editFormData.actual_cost}
                              onChange={(e) => setEditFormData({...editFormData, actual_cost: e.target.value})}
                              className="block w-full pl-8 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex items-center">
                            <input
                              id={`billable-${entry.id}`}
                              type="checkbox"
                              checked={editFormData.is_billable}
                              onChange={(e) => setEditFormData({...editFormData, is_billable: e.target.checked})}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor={`billable-${entry.id}`} className="ml-2 block text-xs text-gray-700">
                              Billable
                            </label>
                          </div>
                        </div>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleSaveEdit(entry.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Save changes"
                          >
                            <Save className="h-5 w-5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-400 hover:text-gray-600"
                            title="Cancel"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // View mode
                    <>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                        <div className="font-medium text-gray-900">{format(new Date(entry.start_time), 'MMM d, yyyy')}</div>
                        <div className="text-gray-500">{format(new Date(entry.start_time), 'h:mm a')}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className={entry.is_running ? 'text-blue-600 font-medium' : ''}>
                          {entry.duration}
                        </span>
                        {entry.is_running && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Running
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1 text-gray-400" />
                          {entry.user_email}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          {entry.description ? (
                            <>
                              <FileText className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="line-clamp-2">{entry.description}</span>
                            </>
                          ) : (
                            <span className="text-gray-400 italic">No description</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
                          {entry.actual_cost ? `$${entry.actual_cost.toFixed(2)}` : 'N/A'}
                        </div>
                        {!entry.is_billable && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Non-billable
                          </span>
                        )}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        {deleteConfirmation === entry.id ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={isDeleting}
                              className="text-red-600 hover:text-red-900"
                              title="Confirm delete"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation(null)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Cancel"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            {!entry.is_running && (
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit entry"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                            )}
                            {canDeleteEntry(entry) && (
                              <button
                                onClick={() => setDeleteConfirmation(entry.id)}
                                className="text-gray-400 hover:text-red-600"
                                title="Delete time entry"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                  Totals:
                </td>
                <td className="px-3 py-3 text-sm font-medium text-gray-900">
                  {totalHours.toFixed(1)} hours
                </td>
                <td className="px-3 py-3 text-sm font-medium text-gray-900">
                  ${totalCost.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}