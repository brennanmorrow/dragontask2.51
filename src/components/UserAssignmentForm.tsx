import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';
import { useAppContext } from '../lib/AppContext';

interface UserAssignmentFormProps {
  userId: string;
  userEmail: string;
  username: string;
  currentRole: string;
  onSave: () => void;
  onCancel: () => void;
}

interface System {
  id: string;
  name: string;
}

interface Agency {
  id: string;
  name: string;
  system_id: string;
}

interface Client {
  id: string;
  name: string;
  agency_id: string;
}

export function UserAssignmentForm({ userId, userEmail, username, currentRole, onSave, onCancel }: UserAssignmentFormProps) {
  const { systemSettings } = useAppContext();
  const [role, setRole] = useState(currentRole);
  const [systems, setSystems] = useState<System[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchEntities();
    fetchCurrentAssignments();
  }, [userId]);

  async function fetchEntities() {
    try {
      setIsLoading(true);
      
      // Fetch systems
      const { data: systemsData, error: systemsError } = await supabase
        .from('systems')
        .select('id, name')
        .order('name');
        
      if (systemsError) throw systemsError;
      setSystems(systemsData || []);
      
      // Fetch agencies
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name, system_id')
        .order('name');
        
      if (agenciesError) throw agenciesError;
      setAgencies(agenciesData || []);
      
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, agency_id')
        .order('name');
        
      if (clientsError) throw clientsError;
      setClients(clientsData || []);
    } catch (err) {
      console.error('Error fetching entities:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching entities for user assignment',
        { error: err, userId }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCurrentAssignments() {
    try {
      // Get current assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .rpc('get_user_assignments', { p_user_id: userId });

      if (assignmentsError) throw assignmentsError;

      if (assignments && assignments.length > 0) {
        const assignment = assignments[0];
        setSelectedSystems(assignment.systems.map((s: any) => s.id));
        setSelectedAgencies(assignment.agencies.map((a: any) => a.id));
        setSelectedClients(assignment.clients.map((c: any) => c.id));
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching user assignments',
        { error: err, userId }
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Updating user assignments',
        { 
          userId, 
          role,
          systemIds: selectedSystems,
          agencyIds: selectedAgencies,
          clientIds: selectedClients
        }
      );

      const { error: assignError } = await supabase.rpc('assign_user_to_entity', {
        p_user_id: userId,
        p_role: role,
        p_system_ids: role === 'system_admin' ? selectedSystems : [],
        p_agency_ids: role === 'agency_admin' ? selectedAgencies : [],
        p_client_ids: ['client_admin', 'client_user'].includes(role) ? selectedClients : []
      });

      if (assignError) throw assignError;
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'User assignments updated successfully',
        { userId, role }
      );

      onSave();
    } catch (err) {
      console.error('Error saving assignments:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error updating user assignments',
        { error: err, userId }
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Filter available agencies based on selected systems
  const availableAgencies = selectedSystems.length > 0
    ? agencies.filter(agency => selectedSystems.includes(agency.system_id))
    : agencies;

  // Filter available clients based on selected agencies
  const availableClients = selectedAgencies.length > 0
    ? clients.filter(client => selectedAgencies.includes(client.agency_id))
    : clients;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Username</label>
        <div className="mt-1">
          <input
            type="text"
            value={username}
            disabled
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-gray-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <div className="mt-1">
          <input
            type="text"
            value={userEmail}
            disabled
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-gray-50"
          />
        </div>
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            // Reset selections when role changes
            setSelectedSystems([]);
            setSelectedAgencies([]);
            setSelectedClients([]);
          }}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        >
          <option value="">Select a role</option>
          <option value="system_admin">System Admin</option>
          <option value="agency_admin">Agency Admin</option>
          <option value="client_admin">Client Admin</option>
          <option value="client_user">Client User</option>
        </select>
      </div>

      {role === 'system_admin' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Systems</label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
            {systems.map(system => (
              <label key={system.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedSystems.includes(system.id)}
                  onChange={(e) => {
                    const newSystems = e.target.checked
                      ? [...selectedSystems, system.id]
                      : selectedSystems.filter(id => id !== system.id);
                    setSelectedSystems(newSystems);
                    // Clear dependent selections
                    setSelectedAgencies([]);
                    setSelectedClients([]);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-900">{system.name}</span>
              </label>
            ))}
            {systems.length === 0 && (
              <p className="text-sm text-gray-500 p-2">No systems available</p>
            )}
          </div>
        </div>
      )}

      {(role === 'system_admin' || role === 'agency_admin') && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Agencies</label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
            {availableAgencies.map(agency => (
              <label key={agency.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedAgencies.includes(agency.id)}
                  onChange={(e) => {
                    const newAgencies = e.target.checked
                      ? [...selectedAgencies, agency.id]
                      : selectedAgencies.filter(id => id !== agency.id);
                    setSelectedAgencies(newAgencies);
                    // Clear dependent selections
                    setSelectedClients([]);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-900">{agency.name}</span>
              </label>
            ))}
            {availableAgencies.length === 0 && (
              <p className="text-sm text-gray-500 p-2">
                {selectedSystems.length > 0 
                  ? 'No agencies available for the selected system' 
                  : 'No agencies available'}
              </p>
            )}
          </div>
        </div>
      )}

      {(role === 'client_admin' || role === 'client_user') && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Clients</label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
            {availableClients.map(client => (
              <label key={client.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedClients.includes(client.id)}
                  onChange={(e) => {
                    const newClients = e.target.checked
                      ? [...selectedClients, client.id]
                      : selectedClients.filter(id => id !== client.id);
                    setSelectedClients(newClients);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-900">{client.name}</span>
              </label>
            ))}
            {availableClients.length === 0 && (
              <p className="text-sm text-gray-500 p-2">
                {selectedAgencies.length > 0 
                  ? 'No clients available for the selected agency' 
                  : 'No clients available'}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </button>
        <button
          type="submit"
          className={clsx(
            "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white",
            "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          )}
          style={{ backgroundColor: primaryColor }}
        >
          <Check className="h-4 w-4 mr-2" />
          Save Assignments
        </button>
      </div>
    </form>
  );
}