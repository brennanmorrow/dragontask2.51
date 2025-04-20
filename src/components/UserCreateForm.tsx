import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';
import { useAppContext } from '../lib/AppContext';

interface UserCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserCreateForm({ onSuccess, onCancel }: UserCreateFormProps) {
  const { systemId, agencyId, clientId, role: currentUserRole } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: '',
    systemId: '',
    agencyId: '',
    clientId: '',
    fullName: '',
    phone: ''
  });
  const [systems, setSystems] = useState<{id: string, name: string}[]>([]);
  const [agencies, setAgencies] = useState<{id: string, name: string, system_id: string}[]>([]);
  const [clients, setClients] = useState<{id: string, name: string, agency_id: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    // Load available entities based on user role
    const loadEntities = async () => {
      try {
        setIsLoading(true);
        
        if (currentUserRole === 'system_admin') {
          // Load systems
          const { data: systemsData, error: systemsError } = await supabase
            .from('systems')
            .select('id, name')
            .order('name');
          
          if (systemsError) throw systemsError;
          setSystems(systemsData || []);
          
          // Set default system if there's only one
          if (systemsData && systemsData.length === 1) {
            setFormData(prev => ({ ...prev, systemId: systemsData[0].id }));
          }
        }
        
        if (['system_admin', 'agency_admin'].includes(currentUserRole)) {
          // Load agencies
          let query = supabase
            .from('agencies')
            .select('id, name, system_id')
            .order('name');
            
          if (currentUserRole === 'agency_admin') {
            query = query.eq('id', agencyId);
          }
          
          const { data: agenciesData, error: agenciesError } = await query;
          
          if (agenciesError) throw agenciesError;
          setAgencies(agenciesData || []);
          
          // Set default agency if there's only one or if user is agency admin
          if (agencyId || (agenciesData && agenciesData.length === 1)) {
            setFormData(prev => ({ ...prev, agencyId: agencyId || agenciesData?.[0]?.id || '' }));
          }
        }
        
        if (['system_admin', 'agency_admin', 'client_admin'].includes(currentUserRole)) {
          // Load clients
          let query = supabase
            .from('clients')
            .select('id, name, agency_id')
            .order('name');
            
          if (currentUserRole === 'agency_admin' && agencyId) {
            query = query.eq('agency_id', agencyId);
          } else if (currentUserRole === 'client_admin' && clientId) {
            query = query.eq('id', clientId);
          }
          
          const { data: clientsData, error: clientsError } = await query;
          
          if (clientsError) throw clientsError;
          setClients(clientsData || []);
          
          // Set default client if there's only one or if user is client admin
          if (clientId || (clientsData && clientsData.length === 1)) {
            setFormData(prev => ({ ...prev, clientId: clientId || clientsData?.[0]?.id || '' }));
          }
        }
        
        // Set default role based on user role
        if (currentUserRole === 'system_admin') {
          setFormData(prev => ({ ...prev, role: 'system_admin' }));
        } else if (currentUserRole === 'agency_admin') {
          setFormData(prev => ({ ...prev, role: 'agency_admin' }));
        } else if (currentUserRole === 'client_admin') {
          setFormData(prev => ({ ...prev, role: 'client_user' }));
        }
      } catch (err) {
        console.error('Error loading entities:', err);
        setError('Failed to load available entities');
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error loading entities for user creation',
          { error: err }
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEntities();
  }, [currentUserRole, systemId, agencyId, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Validate role and entity selection
      if (formData.role === 'system_admin' && !formData.systemId) {
        throw new Error('System admin must be assigned to a system');
      }
      
      if (formData.role === 'agency_admin' && !formData.agencyId) {
        throw new Error('Agency admin must be assigned to an agency');
      }
      
      if (['client_admin', 'client_user'].includes(formData.role) && !formData.clientId) {
        throw new Error('Client roles must be assigned to a client');
      }
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'Creating new user',
        { 
          username: formData.username, 
          email: formData.email,
          role: formData.role,
          systemId: formData.systemId || undefined,
          agencyId: formData.agencyId || undefined,
          clientId: formData.clientId || undefined
        }
      );
      
      // Step 1: Create user in auth.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            role: formData.role,
            system_id: formData.systemId || null,
            agency_id: formData.agencyId || null,
            client_id: formData.clientId || null,
            full_name: formData.fullName || null
          }
        }
      });
      
      if (authError) {
        throw new Error(`Auth error: ${authError.message}`);
      }
      
      if (!authData.user) {
        throw new Error('Failed to create user');
      }
      
      const userId = authData.user.id;
      
      // Step 2: Verify user_roles entry exists and create it if not
      const { error: verifyError } = await supabase
        .rpc('verify_user_creation', {
          p_user_id: userId,
          p_email: formData.email,
          p_username: formData.username,
          p_role: formData.role,
          p_system_id: formData.systemId || null,
          p_agency_id: formData.agencyId || null,
          p_client_id: formData.clientId || null
        });
        
      if (verifyError) {
        throw new Error(`Error verifying user creation: ${verifyError.message}`);
      }
      
      // Step 3: Create or update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          email: formData.email,
          full_name: formData.fullName,
          phone: formData.phone
        });
        
      if (profileError) {
        throw new Error(`Error creating user profile: ${profileError.message}`);
      }
      
      // Step 4: Create notification preferences
      const { error: notifError } = await supabase
        .from('user_notification_preferences')
        .insert({
          user_id: userId,
          email_mentions: true,
          email_task_assignments: true,
          email_task_due_soon: true,
          email_sop_approvals: true
        })
        .onConflict('user_id')
        .ignore();
        
      if (notifError) {
        throw new Error(`Error creating notification preferences: ${notifError.message}`);
      }
      
      // Step 5: Create appropriate assignments based on role
      if (formData.role === 'system_admin' && formData.systemId) {
        const { error: assignError } = await supabase
          .from('user_system_assignments')
          .insert({
            user_id: userId,
            system_id: formData.systemId
          })
          .onConflict(['user_id', 'system_id'])
          .ignore();
          
        if (assignError) {
          throw new Error(`Error creating system assignment: ${assignError.message}`);
        }
      } else if (formData.role === 'agency_admin' && formData.agencyId) {
        const { error: assignError } = await supabase
          .from('user_agency_assignments')
          .insert({
            user_id: userId,
            agency_id: formData.agencyId
          })
          .onConflict(['user_id', 'agency_id'])
          .ignore();
          
        if (assignError) {
          throw new Error(`Error creating agency assignment: ${assignError.message}`);
        }
      } else if (['client_admin', 'client_user'].includes(formData.role) && formData.clientId) {
        const { error: assignError } = await supabase
          .from('user_client_assignments')
          .insert({
            user_id: userId,
            client_id: formData.clientId
          })
          .onConflict(['user_id', 'client_id'])
          .ignore();
          
        if (assignError) {
          throw new Error(`Error creating client assignment: ${assignError.message}`);
        }
      }
      
      setSuccess('User created successfully');
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.USER_ACTION,
        'User created successfully',
        { username: formData.username, role: formData.role, userId }
      );
      
      // Wait a moment to show success message before closing
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error creating user',
        { error: err, username: formData.username }
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Filter available roles based on current user's role
  const availableRoles = () => {
    switch (currentUserRole) {
      case 'system_admin':
        return ['system_admin', 'agency_admin', 'client_admin', 'client_user'];
      case 'agency_admin':
        return ['agency_admin', 'client_admin', 'client_user'];
      case 'client_admin':
        return ['client_admin', 'client_user'];
      default:
        return [];
    }
  };

  // Filter available agencies based on selected system
  const filteredAgencies = formData.systemId
    ? agencies.filter(agency => agency.system_id === formData.systemId)
    : agencies;

  // Filter available clients based on selected agency
  const filteredClients = formData.agencyId
    ? clients.filter(client => client.agency_id === formData.agencyId)
    : clients;

  if (isLoading && !formData.role) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
      
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
      
      {success && (
        <div className="rounded-md bg-green-50 p-4 mb-4">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
            minLength={3}
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
            minLength={6}
          />
          <p className="mt-1 text-xs text-gray-500">
            Password must be at least 6 characters long
          </p>
        </div>
        
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          >
            <option value="">Select a role</option>
            {availableRoles().map(r => (
              <option key={r} value={r}>
                {r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        
        {currentUserRole === 'system_admin' && formData.role === 'system_admin' && (
          <div>
            <label htmlFor="systemId" className="block text-sm font-medium text-gray-700">
              System
            </label>
            <select
              id="systemId"
              value={formData.systemId}
              onChange={(e) => {
                setFormData({ 
                  ...formData, 
                  systemId: e.target.value,
                  // Reset dependent selections
                  agencyId: '',
                  clientId: ''
                });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            >
              <option value="">Select a system</option>
              {systems.map(system => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {['system_admin', 'agency_admin'].includes(currentUserRole) && 
         formData.role === 'agency_admin' && (
          <div>
            <label htmlFor="agencyId" className="block text-sm font-medium text-gray-700">
              Agency
            </label>
            <select
              id="agencyId"
              value={formData.agencyId}
              onChange={(e) => {
                setFormData({ 
                  ...formData, 
                  agencyId: e.target.value,
                  // Reset dependent selections
                  clientId: ''
                });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            >
              <option value="">Select an agency</option>
              {filteredAgencies.map(agency => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {['system_admin', 'agency_admin', 'client_admin'].includes(currentUserRole) && 
         ['client_admin', 'client_user'].includes(formData.role) && (
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
              Client
            </label>
            <select
              id="clientId"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            >
              <option value="">Select a client</option>
              {filteredClients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
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
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 inline-block mr-1" />
                Create User
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}