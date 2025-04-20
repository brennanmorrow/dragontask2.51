import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Check, X, AlertCircle, Search, Edit, Mail } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface ClientProjectManagerAssignmentProps {
  clientId: string;
  clientName: string;
  onAssignmentUpdated?: () => void;
}

interface ProjectManager {
  id: string;
  email: string;
  full_name?: string;
}

export function ClientProjectManagerAssignment({ 
  clientId, 
  clientName,
  onAssignmentUpdated 
}: ClientProjectManagerAssignmentProps) {
  const { role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [currentManager, setCurrentManager] = useState<ProjectManager | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Check if user has permission to edit
  const canEdit = ['system_admin', 'agency_admin', 'client_admin'].includes(role);

  useEffect(() => {
    fetchCurrentManager();
    fetchAvailableManagers();
  }, [clientId]);

  const fetchCurrentManager = async () => {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching current project manager for client',
        { clientId }
      );
      
      // Get the client's project manager from client_project_managers table
      const { data, error } = await supabase
        .from('client_project_managers')
        .select(`
          pm:pm_id (
            id,
            email,
            full_name
          )
        `)
        .eq('client_id', clientId)
        .maybeSingle(); // Changed from .single() to .maybeSingle()
      
      if (error) throw error;
      
      // Only set the manager if data exists and contains pm info
      if (data?.pm) {
        setCurrentManager(data.pm);
        setSelectedManagerId(data.pm.id);
      } else {
        // Clear the current manager if none is assigned
        setCurrentManager(null);
        setSelectedManagerId('');
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Current project manager fetched successfully',
        { clientId, hasManager: !!data?.pm }
      );
    } catch (err) {
      console.error('Error fetching current project manager:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching current project manager',
        { error: err, clientId }
      );
      
      // Set error message for user feedback
      setError('Failed to fetch project manager information');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableManagers = async () => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching available project managers',
        {}
      );
      
      // Get project managers from project_managers table
      const { data, error } = await supabase
        .from('project_managers')
        .select(`
          id,
          email,
          full_name
        `)
        .eq('status', 'active')
        .order('email');
      
      if (error) throw error;
      
      const managers = data?.map(pm => ({
        id: pm.id,
        email: pm.email,
        full_name: pm.full_name || pm.email.split('@')[0]
      })) || [];
      
      setProjectManagers(managers);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Available project managers fetched successfully',
        { count: managers.length }
      );
    } catch (err) {
      console.error('Error fetching available managers:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching available project managers',
        { error: err }
      );
    }
  };

  const handleAssignManager = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Assigning project manager to client',
        { clientId, managerId: selectedManagerId }
      );

      if (selectedManagerId) {
        // Insert or update the client_project_managers record
        const { error } = await supabase
          .from('client_project_managers')
          .upsert({
            client_id: clientId,
            pm_id: selectedManagerId
          }, {
            onConflict: 'client_id'
          });
        
        if (error) throw error;
      } else {
        // Remove the project manager assignment
        const { error } = await supabase
          .from('client_project_managers')
          .delete()
          .eq('client_id', clientId);
        
        if (error) throw error;
      }
      
      setSuccess('Project manager assignment updated successfully');
      setIsEditing(false);
      
      // Refresh the current manager
      await fetchCurrentManager();
      
      if (onAssignmentUpdated) {
        onAssignmentUpdated();
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Project manager assigned successfully',
        { clientId, managerId: selectedManagerId }
      );
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error assigning project manager:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error assigning project manager',
        { error: err, clientId, managerId: selectedManagerId }
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Filter project managers based on search term
  const filteredManagers = searchTerm.trim() === '' 
    ? projectManagers 
    : projectManagers.filter(pm => 
        pm.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pm.full_name && pm.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Assign Project Manager</h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}
          
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
                  placeholder="Search by name or email..."
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project Manager
              </label>
              <div className="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto">
                <div 
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedManagerId === '' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedManagerId('')}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <X className="h-5 w-5 text-gray-500" />
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900">No Project Manager</h4>
                      <p className="text-xs text-gray-500">Remove current assignment</p>
                    </div>
                    {selectedManagerId === '' && (
                      <div className="ml-auto">
                        <Check className="h-5 w-5 text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
                
                {filteredManagers.map(manager => (
                  <div 
                    key={manager.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedManagerId === manager.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedManagerId(manager.id)}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-gray-900">{manager.full_name || manager.email.split('@')[0]}</h4>
                        <p className="text-xs text-gray-500">{manager.email}</p>
                      </div>
                      {selectedManagerId === manager.id && (
                        <div className="ml-auto">
                          <Check className="h-5 w-5 text-blue-500" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {filteredManagers.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No project managers found matching your search
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                <X className="h-4 w-4 inline-block mr-1" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignManager}
                disabled={isSaving}
                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 inline-block mr-1" />
                    {selectedManagerId ? 'Assign Manager' : 'Remove Assignment'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Project Manager</h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-gray-500"
              title="Change Project Manager"
            >
              <Edit className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      
      <div className="px-4 py-5 sm:p-6">
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <Check className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        {currentManager ? (
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-500" />
              </div>
            </div>
            <div className="ml-4">
              <h4 className="text-lg font-medium text-gray-900">{currentManager.full_name || currentManager.email.split('@')[0]}</h4>
              <p className="text-sm text-gray-500">{currentManager.email}</p>
              <div className="mt-2">
                <a 
                  href={`mailto:${currentManager.email}?subject=Regarding ${clientName}`}
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Contact Project Manager
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Project Manager Assigned</h3>
            <p className="mt-1 text-sm text-gray-500">
              This client doesn't have a dedicated project manager yet.
            </p>
            
            {canEdit && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <User className="h-4 w-4 mr-2" />
                  Assign Project Manager
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}