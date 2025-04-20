import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ProjectManager } from '../lib/types';
import { User, Mail, Phone, Briefcase, Save, X, AlertCircle, Check } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface ProjectManagerFormProps {
  projectManagerId?: string;
  onSave: () => void;
  onCancel: () => void;
}

export function ProjectManagerForm({ projectManagerId, onSave, onCancel }: ProjectManagerFormProps) {
  const { user } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [formData, setFormData] = useState<Partial<ProjectManager>>({
    full_name: '',
    email: '',
    phone: '',
    title: 'Project Manager',
    bio: '',
    status: 'active',
    workload: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<{id: string, email: string}[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    if (projectManagerId) {
      fetchProjectManager();
    }
    fetchAvailableUsers();
  }, [projectManagerId]);

  const fetchProjectManager = async () => {
    try {
      setIsLoadingData(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching project manager details',
        { projectManagerId }
      );
      
      const { data, error } = await supabase
        .from('project_managers')
        .select('*')
        .eq('id', projectManagerId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setFormData(data);
        setSelectedUserId(data.user_id);
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Project manager details fetched successfully',
        { projectManagerId }
      );
    } catch (err) {
      console.error('Error fetching project manager:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching project manager details',
        { error: err, projectManagerId }
      );
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching available users for project manager assignment',
        {}
      );
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, email')
        .order('email');
      
      if (error) throw error;
      
      setAvailableUsers(data?.map(user => ({
        id: user.user_id,
        email: user.email
      })) || []);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Available users fetched successfully',
        { count: data?.length }
      );
    } catch (err) {
      console.error('Error fetching available users:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching available users',
        { error: err }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Get user email from selected user
      const selectedUser = availableUsers.find(u => u.id === selectedUserId);
      if (!selectedUser) {
        throw new Error('Selected user not found');
      }
      
      const pmData = {
        ...formData,
        user_id: selectedUserId,
        email: selectedUser.email
      };
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        projectManagerId ? 'Updating project manager' : 'Creating project manager',
        { projectManagerId, userId: selectedUserId }
      );
      
      if (projectManagerId) {
        // Update existing project manager
        const { error } = await supabase
          .from('project_managers')
          .update(pmData)
          .eq('id', projectManagerId);
        
        if (error) throw error;
      } else {
        // Create new project manager
        const { error } = await supabase
          .from('project_managers')
          .insert([pmData]);
        
        if (error) throw error;
      }
      
      setSuccess('Project manager saved successfully');
      setTimeout(() => {
        onSave();
      }, 1500);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        projectManagerId ? 'Project manager updated successfully' : 'Project manager created successfully',
        { projectManagerId, userId: selectedUserId }
      );
    } catch (err) {
      console.error('Error saving project manager:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error saving project manager',
        { error: err, projectManagerId }
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {projectManagerId ? 'Edit Project Manager' : 'Create Project Manager'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
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
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="user_id" className="block text-sm font-medium text-gray-700">
              User Account <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <select
                id="user_id"
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  // Auto-fill email if user is selected
                  const selectedUser = availableUsers.find(u => u.id === e.target.value);
                  if (selectedUser) {
                    setFormData(prev => ({
                      ...prev,
                      email: selectedUser.email
                    }));
                  }
                }}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              >
                <option value="">Select a user</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Select the user account that will be associated with this project manager
            </p>
          </div>
          
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="John Doe"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="john.doe@example.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="tel"
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Briefcase className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Project Manager"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              value={formData.bio || ''}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Brief professional bio..."
            />
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              >
                <option value="active">Active</option>
                <option value="away">Away</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="workload" className="block text-sm font-medium text-gray-700">
                Workload (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="workload"
                min="0"
                max="100"
                value={formData.workload}
                onChange={(e) => setFormData({ ...formData, workload: parseInt(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>
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
              disabled={isLoading}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 inline-block mr-1" />
                  {projectManagerId ? 'Update' : 'Create'} Project Manager
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}