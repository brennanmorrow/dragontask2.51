import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ProjectManager } from '../lib/types';
import { Plus, Pencil, Trash2, User, Mail, Phone, Briefcase, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { ProjectManagerForm } from '../components/ProjectManagerForm';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

export function ProjectManagers() {
  const { role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchProjectManagers();
  }, []);

  const fetchProjectManagers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching project managers',
        {}
      );
      
      const { data, error } = await supabase
        .from('project_managers')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      
      setProjectManagers(data || []);
      
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
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project manager? This will remove them from all client assignments.')) {
      return;
    }
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Deleting project manager',
        { projectManagerId: id }
      );
      
      const { error } = await supabase
        .from('project_managers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Refresh the list
      fetchProjectManagers();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Project manager deleted successfully',
        { projectManagerId: id }
      );
    } catch (err) {
      console.error('Error deleting project manager:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error deleting project manager',
        { error: err, projectManagerId: id }
      );
    }
  };

  const handleSave = () => {
    fetchProjectManagers();
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  // Filter project managers based on search term
  const filteredProjectManagers = projectManagers.filter(pm => 
    pm.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pm.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pm.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  // Check if user has permission to manage project managers
  const canManageProjectManagers = ['system_admin', 'agency_admin'].includes(role);

  if (!canManageProjectManagers) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Permission Error</h3>
            <div className="mt-2 text-sm text-yellow-700">
              You don't have permission to manage project managers. Please contact your administrator.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCreating || editingId) {
    return (
      <ProjectManagerForm
        projectManagerId={editingId || undefined}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Project Managers
          </h2>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-x-2 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="h-5 w-5" />
            Add Project Manager
          </button>
        </div>
      </div>

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

      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">
            Search Project Managers
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Search by name, email, or title..."
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
          </div>
        ) : filteredProjectManagers.length > 0 ? (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Project Manager
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Contact
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Workload
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredProjectManagers.map((pm) => (
                  <tr key={pm.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
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
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">{pm.full_name}</div>
                          <div className="text-gray-500">{pm.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{pm.email}</span>
                        </div>
                        {pm.phone && (
                          <div className="flex items-center mt-1">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            <span>{pm.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pm.status)}`}>
                        {pm.status.charAt(0).toUpperCase() + pm.status.slice(1)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getWorkloadColor(pm.workload)}`}
                            style={{ width: `${pm.workload}%` }}
                          ></div>
                        </div>
                        <span className="ml-2">{pm.workload}%</span>
                      </div>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        type="button"
                        onClick={() => setEditingId(pm.id)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <Pencil className="h-5 w-5" />
                        <span className="sr-only">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(pm.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-5 w-5" />
                        <span className="sr-only">Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No project managers</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new project manager.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Project Manager
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}