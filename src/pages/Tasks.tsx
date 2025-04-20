import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { TaskBoardContainer } from '../components/TaskBoardContainer';
import { useAppContext } from '../lib/AppContext';
import { Search } from 'lucide-react';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

export function Tasks() {
  const { user, agencyId, clientId, role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<any[]>([]);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchClients();
  }, [user?.id, agencyId, clientId, role]);

  useEffect(() => {
    // If user is client_admin or client_user, set the selected client to their assigned client
    if ((role === 'client_admin' || role === 'client_user') && clientId) {
      setSelectedClientId(clientId);
    }
  }, [role, clientId]);

  // Filter clients based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [clients, searchTerm]);

  async function fetchClients() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching clients for task board',
        { role, agencyId, clientId }
      );
      
      // Fetch clients based on user role
      let query = supabase.from('clients').select('id, name, agency_id');
      
      if (role === 'agency_admin' && agencyId) {
        query = query.eq('agency_id', agencyId);
      } else if ((role === 'client_admin' || role === 'client_user') && clientId) {
        query = query.eq('id', clientId);
      }
      
      const { data, error } = await query.order('name');
      
      if (error) {
        logApiCall('clients.select', false, { error });
        throw error;
      }
      
      logApiCall('clients.select', true, { count: data?.length });
      setClients(data || []);
      setFilteredClients(data || []);
      
      // If there's only one client, select it automatically
      if (data && data.length === 1 && !selectedClientId) {
        setSelectedClientId(data[0].id);
        
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.DATA_PROCESSING,
          'Auto-selected the only available client',
          { clientId: data[0].id, clientName: data[0].name }
        );
      }
      
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching clients for task board',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClientId(e.target.value);
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User changed selected client',
      { clientId: e.target.value }
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Tasks
          </h2>
        </div>
      </div>

      {/* Streamlined Client Search Module */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Client Selector */}
          <div>
            <label htmlFor="client" className="block text-sm font-medium text-gray-700">
              Client
            </label>
            <select
              id="client"
              name="client"
              value={selectedClientId || ''}
              onChange={handleClientChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              disabled={role === 'client_admin' || role === 'client_user'}
            >
              <option value="">Select a client</option>
              {filteredClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search Clients
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="search"
                id="search"
                className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Task Board */}
      {selectedClientId ? (
        <div className="bg-white shadow rounded-lg p-4">
          <TaskBoardContainer 
            clientId={selectedClientId} 
            agencyId={clients.find(c => c.id === selectedClientId)?.agency_id || agencyId || ''} 
          />
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <Search className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No client selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Please select a client to view tasks.
          </p>
        </div>
      )}
    </div>
  );
}