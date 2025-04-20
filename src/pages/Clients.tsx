import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, Ban, Play, ArrowRight } from 'lucide-react';
import { supabase, uploadAgencyLogo } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { LogoUpload } from '../components/LogoUpload';
import { useNavigate } from 'react-router-dom';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

interface Client {
  id: string;
  agency_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_suspended?: boolean;
  project_manager_id?: string;
  agency?: {
    name: string;
  };
  stats?: {
    activeTasks: number;
    completedTasks: number;
    budgetHours: number;
    remainingHours: number;
  };
}

interface ClientFormData {
  name: string;
  agency_id: string;
  project_manager_id?: string;
}

interface Agency {
  id: string;
  name: string;
}

interface ProjectManager {
  id: string;
  email: string;
  full_name?: string;
}

export function Clients() {
  const navigate = useNavigate();
  const { systemId, agencyId, clientId, role } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    agency_id: '',
    project_manager_id: '',
  });

  useEffect(() => {
    fetchClients();
    if (role === 'system_admin') {
      fetchAgencies();
    }
    fetchProjectManagers();
  }, [systemId, agencyId, clientId, role]);

  async function fetchClients() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching clients',
        { role, systemId, agencyId, clientId }
      );
      
      let query = supabase
        .from('clients')
        .select(`
          *,
          agency:agencies(name)
        `)
        .order('name');

      if (role === 'agency_admin') {
        query = query.eq('agency_id', agencyId);
      } else if (role === 'client_admin') {
        query = query.eq('id', clientId);
      }

      const { data, error } = await query;

      if (error) {
        logApiCall('clients.select', false, { error });
        throw error;
      }
      
      logApiCall('clients.select', true, { count: data?.length });
      
      // Fetch additional stats for each client
      const clientsWithStats = await Promise.all(
        (data || []).map(async (client) => {
          const stats = await fetchClientStats(client.id);
          return { ...client, stats };
        })
      );
      
      setClients(clientsWithStats);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Clients fetched successfully',
        { count: clientsWithStats.length, role }
      );
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching clients',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }
  
  async function fetchClientStats(clientId: string) {
    try {
      // Fetch active tasks count
      const { count: activeTasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('client_id', clientId)
        .neq('status', 'done');
      
      // Fetch completed tasks count
      const { count: completedTasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('client_id', clientId)
        .eq('status', 'done');
      
      // Get current month budget
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const { data: budgetData } = await supabase
        .from('client_budgets')
        .select('hours_budget')
        .eq('client_id', clientId)
        .eq('month', currentMonth)
        .maybeSingle();
      
      const budgetHours = budgetData?.hours_budget || 0;
      
      // Get hours used this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      // Get time entries for this month through tasks
      const { data: timeEntries } = await supabase
        .from('task_time_entries')
        .select(`
          id,
          start_time,
          end_time,
          task:tasks!inner(
            id,
            client_id
          )
        `)
        .eq('task.client_id', clientId)
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())
        .not('end_time', 'is', null);
      
      // Calculate hours used
      const hoursUsed = timeEntries?.reduce((total, entry) => {
        const duration = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
        return total + (duration / (1000 * 60 * 60));
      }, 0) || 0;
      
      const remainingHours = Math.max(0, budgetHours - hoursUsed);

      return {
        activeTasks: activeTasksCount || 0,
        completedTasks: completedTasksCount || 0,
        budgetHours: budgetHours,
        remainingHours: remainingHours
      };
    } catch (err) {
      console.error('Error fetching client stats:', err);
      return {
        activeTasks: 0,
        completedTasks: 0,
        budgetHours: 0,
        remainingHours: 0
      };
    }
  }

  async function fetchAgencies() {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching agencies for client management',
        { role, systemId }
      );
      
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (error) {
        logApiCall('agencies.select', false, { error });
        throw error;
      }
      
      logApiCall('agencies.select', true, { count: data?.length });
      setAgencies(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching agencies for client management',
        { error: err }
      );
    }
  }

  async function fetchProjectManagers() {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching project managers',
        {}
      );
      
      // First try to fetch from project_managers table
      const { data, error } = await supabase
        .from('project_managers')
        .select('id, email, full_name')
        .order('full_name');

      if (error) {
        logApiCall('project_managers.select', false, { error });
        throw error;
      }
      
      if (data && data.length > 0) {
        logApiCall('project_managers.select', true, { count: data.length });
        setProjectManagers(data);
      } else {
        // If no project managers found, try to fetch system admins as fallback
        const { data: adminData, error: adminError } = await supabase
          .from('user_roles')
          .select('user_id, email')
          .eq('role', 'system_admin')
          .order('email');
          
        if (adminError) {
          logApiCall('user_roles.select', false, { error: adminError });
          throw adminError;
        }
        
        logApiCall('user_roles.select', true, { count: adminData?.length });
        
        // Transform user_roles data to match ProjectManager interface
        const adminsAsManagers = adminData?.map(admin => ({
          id: admin.user_id,
          email: admin.email,
          full_name: admin.email.split('@')[0]
        })) || [];
        
        setProjectManagers(adminsAsManagers);
      }
    } catch (err) {
      console.error('Error fetching project managers:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching project managers',
        { error: err }
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        editingId ? 'Updating client' : 'Creating client',
        { clientId: editingId, formData }
      );
      
      const clientData = {
        ...formData,
        agency_id: role === 'agency_admin' ? agencyId : formData.agency_id,
        project_manager_id: formData.project_manager_id || null
      };

      if (editingId) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', editingId);

        if (error) {
          logApiCall('clients.update', false, { error });
          throw error;
        }
        
        logApiCall('clients.update', true, {});
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([clientData]);

        if (error) {
          logApiCall('clients.insert', false, { error });
          throw error;
        }
        
        logApiCall('clients.insert', true, {});
      }

      setFormData({ name: '', agency_id: '', project_manager_id: '' });
      setEditingId(null);
      setIsCreating(false);
      await fetchClients();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.USER_ACTION,
        editingId ? 'Client updated successfully' : 'Client created successfully',
        { clientId: editingId }
      );
    } catch (err) {
      console.error('Error saving client:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        editingId ? 'Error updating client' : 'Error creating client',
        { error: err, clientId: editingId }
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this client? This will delete all associated tasks but preserve user data.')) return;

    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'Deleting client and associated data',
        { clientId: id }
      );

      // First, update user_roles to remove client_id (instead of deleting)
      const { error: userRolesError } = await supabase
        .from('user_roles')
        .update({ client_id: null })
        .eq('client_id', id);

      if (userRolesError) {
        logApiCall('user_roles.update', false, { error: userRolesError });
        throw new Error(`Error updating user roles: ${userRolesError.message}`);
      }
      logApiCall('user_roles.update', true, {});

      // Delete user client assignments
      const { error: userClientAssignmentsError } = await supabase
        .from('user_client_assignments')
        .delete()
        .eq('client_id', id);

      if (userClientAssignmentsError) {
        logApiCall('user_client_assignments.delete', false, { error: userClientAssignmentsError });
        throw new Error(`Error deleting user client assignments: ${userClientAssignmentsError.message}`);
      }
      logApiCall('user_client_assignments.delete', true, {});

      // Delete tasks
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('client_id', id);

      if (tasksError) {
        logApiCall('tasks.delete', false, { error: tasksError });
        throw new Error(`Error deleting tasks: ${tasksError.message}`);
      }
      logApiCall('tasks.delete', true, {});

      // Delete boards (which will cascade to board_columns)
      const { error: boardsError } = await supabase
        .from('boards')
        .delete()
        .eq('client_id', id);

      if (boardsError) {
        logApiCall('boards.delete', false, { error: boardsError });
        throw new Error(`Error deleting boards: ${boardsError.message}`);
      }
      logApiCall('boards.delete', true, {});

      // Delete SOPs
      const { error: sopsError } = await supabase
        .from('sops')
        .delete()
        .eq('client_id', id);

      if (sopsError) {
        logApiCall('sops.delete', false, { error: sopsError });
        throw new Error(`Error deleting SOPs: ${sopsError.message}`);
      }
      logApiCall('sops.delete', true, {});

      // Delete SOP tags
      const { error: sopTagsError } = await supabase
        .from('sop_tags')
        .delete()
        .eq('client_id', id);

      if (sopTagsError) {
        logApiCall('sop_tags.delete', false, { error: sopTagsError });
        throw new Error(`Error deleting SOP tags: ${sopTagsError.message}`);
      }
      logApiCall('sop_tags.delete', true, {});

      // Finally delete the client
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (clientError) {
        logApiCall('clients.delete', false, { error: clientError });
        throw clientError;
      }
      
      logApiCall('clients.delete', true, {});
      await fetchClients();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.USER_ACTION,
        'Client and associated data deleted successfully',
        { clientId: id }
      );
    } catch (err) {
      console.error('Error deleting client:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error deleting client',
        { error: err, clientId: id }
      );
    }
  }

  async function handleToggleSuspension(client: Client) {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        client.is_suspended ? 'Activating client' : 'Suspending client',
        { clientId: client.id, currentStatus: client.is_suspended ? 'suspended' : 'active' }
      );
      
      const { error } = await supabase
        .from('clients')
        .update({ is_suspended: !client.is_suspended })
        .eq('id', client.id);

      if (error) {
        logApiCall('clients.update', false, { error });
        throw error;
      }
      
      logApiCall('clients.update', true, {});
      await fetchClients();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.USER_ACTION,
        client.is_suspended ? 'Client activated successfully' : 'Client suspended successfully',
        { clientId: client.id }
      );
    } catch (err) {
      console.error('Error toggling client suspension:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error toggling client suspension',
        { error: err, clientId: client.id }
      );
    }
  }

  function handleEdit(client: Client) {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Editing client',
      { clientId: client.id, clientName: client.name }
    );
    
    setFormData({
      name: client.name,
      agency_id: client.agency_id,
      project_manager_id: client.project_manager_id || '',
    });
    setEditingId(client.id);
    setIsCreating(true);
  }

  function handleCancel() {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Cancelled client edit/create',
      {}
    );
    
    setFormData({ name: '', agency_id: '', project_manager_id: '' });
    setEditingId(null);
    setIsCreating(false);
  }

  function handleClientClick(clientId: string) {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.NAVIGATION,
      'Navigating to client dashboard',
      { clientId }
    );
    
    navigate(`/clients/${clientId}`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const canAddClient = role === 'system_admin' || role === 'agency_admin';

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Clients
          </h2>
        </div>
        {!isCreating && canAddClient && (
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus className="h-5 w-5" />
              Add Client
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {isCreating && canAddClient && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">
                  Client Name
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder="Enter client name"
                    required
                  />
                </div>
              </div>

              {role === 'system_admin' && (
                <div>
                  <label htmlFor="agency_id" className="block text-sm font-medium leading-6 text-gray-900">
                    Agency
                  </label>
                  <div className="mt-2">
                    <select
                      id="agency_id"
                      name="agency_id"
                      value={formData.agency_id}
                      onChange={(e) => setFormData({ ...formData, agency_id: e.target.value })}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      required
                    >
                      <option value="">Select an agency</option>
                      {agencies.map((agency) => (
                        <option key={agency.id} value={agency.id}>
                          {agency.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="project_manager_id" className="block text-sm font-medium leading-6 text-gray-900">
                  Project Manager
                </label>
                <div className="mt-2">
                  <select
                    id="project_manager_id"
                    name="project_manager_id"
                    value={formData.project_manager_id || ''}
                    onChange={(e) => setFormData({ ...formData, project_manager_id: e.target.value || undefined })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="">No Project Manager</option>
                    {projectManagers.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.full_name || pm.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-x-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <Check className="h-5 w-5" />
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-x-2 rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  <X className="h-5 w-5" />
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <table className="min-w-full divide-y divide-gray-300">
          <thead>
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                Name
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Active Tasks
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Completed Tasks
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Budget Info
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {clients.map((client) => (
              <tr 
                key={client.id} 
                className={`${client.is_suspended ? 'bg-gray-50' : ''} cursor-pointer hover:bg-gray-50`}
                onClick={() => handleClientClick(client.id)}
              >
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                  <div className="flex items-center">
                    <span>{client.name}</span>
                    <ArrowRight className="ml-2 h-4 w-4 text-gray-400" />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
                    {client.stats?.activeTasks || 0}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span className="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800">
                    {client.stats?.completedTasks || 0}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span>Budget: {client.stats?.budgetHours || 0}h</span>
                    <span>Remaining: {client.stats?.remainingHours.toFixed(1) || 0}h</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                      client.is_suspended
                        ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                        : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                    }`}
                  >
                    {client.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div className="flex justify-end gap-x-3">
                    {canAddClient && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSuspension(client);
                          }}
                          className={`${
                            client.is_suspended ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'
                          }`}
                          title={client.is_suspended ? 'Activate Client' : 'Suspend Client'}
                        >
                          {client.is_suspended ? <Play className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(client);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Pencil className="h-5 w-5" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(client.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                          <span className="sr-only">Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                  No clients found. {canAddClient ? 'Click "Add Client" to create one.' : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}