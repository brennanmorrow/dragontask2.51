import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ProjectManager } from '../lib/types';
import { User, Search, Plus, Check, X, AlertCircle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface ProjectManagerSelectorProps {
  clientId: string;
  clientName: string;
  currentPmId?: string;
  onAssign: (pmId: string, notes: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProjectManagerSelector({
  clientId,
  clientName,
  currentPmId,
  onAssign,
  onCancel,
  isLoading = false
}: ProjectManagerSelectorProps) {
  const { systemSettings } = useAppContext();
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [filteredPMs, setFilteredPMs] = useState<ProjectManager[]>([]);
  const [selectedPmId, setSelectedPmId] = useState<string>(currentPmId || '');
  const [notes, setNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoadingPMs, setIsLoadingPMs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchProjectManagers();
  }, []);

  // Filter project managers based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPMs(projectManagers);
    } else {
      const filtered = projectManagers.filter(pm => 
        pm.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPMs(filtered);
    }
  }, [projectManagers, searchTerm]);

  const fetchProjectManagers = async () => {
    try {
      setIsLoadingPMs(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching project managers',
        { clientId }
      );
      
      const { data, error } = await supabase
        .from('project_managers')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      
      setProjectManagers(data || []);
      setFilteredPMs(data || []);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Project managers fetched successfully',
        { count: data?.length }
      );
    } catch (err) {
      console.error('Error fetching project managers:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching project managers',
        { error: err }
      );
    } finally {
      setIsLoadingPMs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPmId) {
      setError('Please select a project manager');
      return;
    }
    
    await onAssign(selectedPmId, notes);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'away':
        return 'bg-yellow-100 text-yellow-800';
      case 'busy':
        return 'bg-red-100 text-red-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload < 50) return 'bg-green-500';
    if (workload < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search Project Managers
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                placeholder="Search by name, email, or title..."
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select Project Manager for {clientName}
            </label>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isLoadingPMs ? (
                <div className="col-span-2 flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
                </div>
              ) : filteredPMs.length > 0 ? (
                filteredPMs.map(pm => (
                  <div 
                    key={pm.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedPmId === pm.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedPmId(pm.id)}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {pm.avatar_url ? (
                          <img 
                            src={pm.avatar_url} 
                            alt={pm.full_name} 
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-gray-900">{pm.full_name}</h4>
                        <p className="text-xs text-gray-500">{pm.title}</p>
                        <div className="mt-1 flex items-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pm.status)}`}>
                            {pm.status}
                          </span>
                          <div className="ml-2 flex items-center">
                            <div className="w-8 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${getWorkloadColor(pm.workload)}`}
                                style={{ width: `${pm.workload}%` }}
                              ></div>
                            </div>
                            <span className="ml-1 text-xs text-gray-500">{pm.workload}%</span>
                          </div>
                        </div>
                      </div>
                      {selectedPmId === pm.id && (
                        <div className="ml-auto">
                          <Check className="h-5 w-5 text-blue-500" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-4 text-gray-500">
                  No project managers found
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Assignment Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Add any notes about this assignment..."
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              <X className="h-4 w-4 inline-block mr-1" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedPmId}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
              style={{ 
                backgroundColor: primaryColor,
                opacity: isLoading || !selectedPmId ? 0.5 : 1 
              }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Assigning...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 inline-block mr-1" />
                  Assign Project Manager
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}