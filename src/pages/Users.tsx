import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, Ban, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import clsx from 'clsx';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';
import { UserCreateForm } from '../components/UserCreateForm';
import { UserAssignmentForm } from '../components/UserAssignmentForm';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  assignments: {
    systems: Array<{ id: string; name: string }>;
    agencies: Array<{ id: string; name: string }>;
    clients: Array<{ id: string; name: string }>;
  };
  is_suspended?: boolean;
}

export function Users() {
  const { systemId, agencyId, clientId, role: currentUserRole } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [systemId, agencyId, clientId]);

  async function fetchUsers() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching users',
        { role: currentUserRole, systemId, agencyId, clientId }
      );
      
      // First get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Get system assignments
      const { data: systemAssignments, error: systemError } = await supabase
        .from('user_system_assignments')
        .select(`
          user_id,
          system:systems(id, name)
        `);

      if (systemError) throw systemError;

      // Get agency assignments
      const { data: agencyAssignments, error: agencyError } = await supabase
        .from('user_agency_assignments')
        .select(`
          user_id,
          agency:agencies(id, name)
        `);

      if (agencyError) throw agencyError;

      // Get client assignments
      const { data: clientAssignments, error: clientError } = await supabase
        .from('user_client_assignments')
        .select(`
          user_id,
          client:clients(id, name)
        `);

      if (clientError) throw clientError;

      // Transform the data
      const transformedUsers = userRoles?.map(userRole => {
        const userSystemAssignments = systemAssignments
          ?.filter(sa => sa.user_id === userRole.user_id)
          .map(sa => sa.system) || [];

        const userAgencyAssignments = agencyAssignments
          ?.filter(aa => aa.user_id === userRole.user_id)
          .map(aa => aa.agency) || [];

        const userClientAssignments = clientAssignments
          ?.filter(ca => ca.user_id === userRole.user_id)
          .map(ca => ca.client) || [];

        return {
          id: userRole.user_id,
          username: userRole.username || 'Unknown',
          email: userRole.email,
          role: userRole.role,
          assignments: {
            systems: userSystemAssignments,
            agencies: userAgencyAssignments,
            clients: userClientAssignments,
          },
          is_suspended: userRole.is_suspended,
        };
      });

      setUsers(transformedUsers || []);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Users fetched successfully',
        { count: transformedUsers?.length || 0 }
      );
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching users',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'Deleting user',
        { userId: id }
      );
      
      const { error } = await supabase.rpc('delete_user', { user_id: id });
      
      if (error) throw error;
      
      await fetchUsers();
      
      setSuccessMessage('User deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.USER_ACTION,
        'User deleted successfully',
        { userId: id }
      );
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error deleting user',
        { error: err, userId: id }
      );
    }
  }

  async function handleToggleSuspension(user: User) {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        user.is_suspended ? 'Activating user' : 'Suspending user',
        { userId: user.id, username: user.username }
      );
      
      const { error } = await supabase
        .from('user_roles')
        .update({ is_suspended: !user.is_suspended })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await fetchUsers();
      
      setSuccessMessage(`User ${user.is_suspended ? 'activated' : 'suspended'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.USER_ACTION,
        user.is_suspended ? 'User activated successfully' : 'User suspended successfully',
        { userId: user.id, username: user.username }
      );
    } catch (err) {
      console.error('Error toggling user suspension:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error toggling user suspension',
        { error: err, userId: user.id }
      );
    }
  }

  function handleEdit(user: User) {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Editing user',
      { userId: user.id, username: user.username }
    );
    
    setEditingId(user.id);
    setIsCreating(false);
  }

  function handleCancel() {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Cancelled user edit/create',
      {}
    );
    
    setEditingId(null);
    setIsCreating(false);
  }

  function handleCreateSuccess() {
    setIsCreating(false);
    fetchUsers();
    setSuccessMessage('User created successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  function handleEditSuccess() {
    setEditingId(null);
    fetchUsers();
    setSuccessMessage('User updated successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Users
          </h2>
        </div>
        {!isCreating && !editingId && (
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus className="h-5 w-5" />
              Add User
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

      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">{successMessage}</div>
            </div>
          </div>
        </div>
      )}

      {isCreating && (
        <UserCreateForm 
          onSuccess={handleCreateSuccess}
          onCancel={handleCancel}
        />
      )}

      {editingId && (
        <UserAssignmentForm
          userId={editingId}
          userEmail={users.find(u => u.id === editingId)?.email || ''}
          username={users.find(u => u.id === editingId)?.username || ''}
          currentRole={users.find(u => u.id === editingId)?.role || ''}
          onSave={handleEditSuccess}
          onCancel={handleCancel}
        />
      )}

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <table className="min-w-full divide-y divide-gray-300">
          <thead>
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                Username
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Email
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Role
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Assignments
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
            {users.map((user) => (
              <tr key={user.id} className={user.is_suspended ? 'bg-gray-50' : ''}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                  {user.username}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                  {user.role.replace('_', ' ')}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  <div className="space-y-1">
                    {user.assignments.systems.length > 0 && (
                      <div>
                        <span className="font-medium">Systems:</span>{' '}
                        {user.assignments.systems.map(s => s.name).join(', ')}
                      </div>
                    )}
                    {user.assignments.agencies.length > 0 && (
                      <div>
                        <span className="font-medium">Agencies:</span>{' '}
                        {user.assignments.agencies.map(a => a.name).join(', ')}
                      </div>
                    )}
                    {user.assignments.clients.length > 0 && (
                      <div>
                        <span className="font-medium">Clients:</span>{' '}
                        {user.assignments.clients.map(c => c.name).join(', ')}
                      </div>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                      user.is_suspended
                        ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                        : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                    )}
                  >
                    {user.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div className="flex justify-end gap-x-3">
                    <button
                      onClick={() => handleToggleSuspension(user)}
                      className={clsx(
                        user.is_suspended ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'
                      )}
                      title={user.is_suspended ? 'Activate User' : 'Suspend User'}
                    >
                      {user.is_suspended ? <Play className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Pencil className="h-5 w-5" />
                      <span className="sr-only">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                      <span className="sr-only">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                  No users found. Click "Add User" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}