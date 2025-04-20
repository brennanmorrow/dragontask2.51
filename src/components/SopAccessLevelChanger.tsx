import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Check, Building2, Briefcase, Users, AlertCircle } from 'lucide-react';
import { SopAccessLevel } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface SopAccessLevelChangerProps {
  sopId: string;
  currentAccessLevel: SopAccessLevel;
  currentEntityId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface System {
  id: string;
  name: string;
}

interface Agency {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

export function SopAccessLevelChanger({ 
  sopId, 
  currentAccessLevel, 
  currentEntityId,
  onClose, 
  onSuccess 
}: SopAccessLevelChangerProps) {
  const { role, systemId, agencyId } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<SopAccessLevel>(currentAccessLevel);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(currentEntityId);
  const [reason, setReason] = useState('');
  const [systems, setSystems] = useState<System[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Fetch available entities based on selected access level
  useEffect(() => {
    if (selectedAccessLevel !== currentAccessLevel) {
      fetchEntities(selectedAccessLevel);
    } else {
      // Initialize with current entity
      if (currentEntityId) {
        setSelectedEntityId(currentEntityId);
      }
    }
  }, [selectedAccessLevel, currentAccessLevel, currentEntityId]);

  // Initial fetch of all entity types
  useEffect(() => {
    const fetchAllEntities = async () => {
      setIsLoadingEntities(true);
      try {
        await Promise.all([
          fetchSystems(),
          fetchAgencies(),
          fetchClients()
        ]);
      } catch (err) {
        console.error('Error fetching entities:', err);
        setError('Failed to load available entities');
      } finally {
        setIsLoadingEntities(false);
      }
    };
    
    fetchAllEntities();
  }, []);

  const fetchEntities = async (accessLevel: SopAccessLevel) => {
    try {
      setIsLoadingEntities(true);
      setError(null);

      if (accessLevel === 'system') {
        await fetchSystems();
      } 
      else if (accessLevel === 'agency') {
        await fetchAgencies();
      } 
      else if (accessLevel === 'client') {
        await fetchClients();
      }
    } catch (err) {
      console.error(`Error fetching ${accessLevel} entities:`, err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        `Error fetching ${accessLevel} entities`,
        { error: err }
      );
    } finally {
      setIsLoadingEntities(false);
    }
  };

  const fetchSystems = async () => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching systems for SOP access level',
        {}
      );
      
      const { data, error } = await supabase
        .from('systems')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSystems(data || []);
      
      // Auto-select if only one option or if user is not system admin
      if ((data && data.length === 1) || role !== 'system_admin') {
        setSelectedEntityId(data?.[0]?.id || systemId);
      } else {
        setSelectedEntityId(null);
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Systems fetched successfully',
        { count: data?.length }
      );
    } catch (err) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching systems',
        { error: err }
      );
      throw err;
    }
  };

  const fetchAgencies = async () => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching agencies for SOP access level',
        { role, systemId, agencyId }
      );
      
      let query = supabase
        .from('agencies')
        .select('id, name')
        .order('name');
          
      // If not system admin, limit to user's agency
      if (role !== 'system_admin') {
        query = query.eq('id', agencyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAgencies(data || []);
      
      // Auto-select if only one option or if user is agency admin
      if ((data && data.length === 1) || role === 'agency_admin') {
        setSelectedEntityId(data?.[0]?.id || agencyId);
      } else {
        setSelectedEntityId(null);
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Agencies fetched successfully',
        { count: data?.length }
      );
    } catch (err) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching agencies',
        { error: err }
      );
      throw err;
    }
  };

  const fetchClients = async () => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching clients for SOP access level',
        { role, agencyId }
      );
      
      let query = supabase
        .from('clients')
        .select('id, name')
        .order('name');
          
      // If agency admin, limit to agency's clients
      if (role === 'agency_admin') {
        query = query.eq('agency_id', agencyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
      setSelectedEntityId(null);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Clients fetched successfully',
        { count: data?.length }
      );
    } catch (err) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching clients',
        { error: err }
      );
      throw err;
    }
  };

  const handleSubmit = async () => {
    if (!selectedEntityId) {
      setError('Please select an entity');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Changing SOP access level',
        { 
          sopId, 
          oldAccessLevel: currentAccessLevel, 
          newAccessLevel: selectedAccessLevel,
          oldEntityId: currentEntityId,
          newEntityId: selectedEntityId,
          reason
        }
      );

      // Call the function to change access level
      const { error } = await supabase.rpc(
        'change_sop_access_level',
        {
          p_sop_id: sopId,
          p_new_access_level: selectedAccessLevel,
          p_new_entity_id: selectedEntityId,
          p_reason: reason || null
        }
      );

      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error changing SOP access level',
          { error, sopId }
        );
        throw error;
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP access level changed successfully',
        { sopId, newAccessLevel: selectedAccessLevel }
      );

      // Call onSuccess callback to notify parent component
      onSuccess();
    } catch (err) {
      console.error('Error changing SOP access level:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error changing SOP access level',
        { error: err, sopId }
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user has permission to change access level
  const canChangeToSystem = role === 'system_admin';
  const canChangeToAgency = ['system_admin', 'agency_admin'].includes(role);
  const canChangeToClient = ['system_admin', 'agency_admin', 'client_admin'].includes(role);

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Change Access Level
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Access Level
              </label>
              <div className="flex items-center space-x-2">
                {currentAccessLevel === 'system' && <Building2 className="h-5 w-5 text-purple-500" />}
                {currentAccessLevel === 'agency' && <Briefcase className="h-5 w-5 text-blue-500" />}
                {currentAccessLevel === 'client' && <Users className="h-5 w-5 text-indigo-500" />}
                <span className="text-sm font-medium text-gray-900 capitalize">{currentAccessLevel}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Access Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {canChangeToSystem && (
                  <button
                    type="button"
                    onClick={() => setSelectedAccessLevel('system')}
                    className={`flex flex-col items-center justify-center p-3 border rounded-md ${
                      selectedAccessLevel === 'system' 
                        ? 'border-purple-500 bg-purple-50 text-purple-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Building2 className="h-6 w-6 mb-1" />
                    <span className="text-sm font-medium">System</span>
                  </button>
                )}
                
                {canChangeToAgency && (
                  <button
                    type="button"
                    onClick={() => setSelectedAccessLevel('agency')}
                    className={`flex flex-col items-center justify-center p-3 border rounded-md ${
                      selectedAccessLevel === 'agency' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Briefcase className="h-6 w-6 mb-1" />
                    <span className="text-sm font-medium">Agency</span>
                  </button>
                )}
                
                {canChangeToClient && (
                  <button
                    type="button"
                    onClick={() => setSelectedAccessLevel('client')}
                    className={`flex flex-col items-center justify-center p-3 border rounded-md ${
                      selectedAccessLevel === 'client' 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-6 w-6 mb-1" />
                    <span className="text-sm font-medium">Client</span>
                  </button>
                )}
              </div>
            </div>

            {/* Entity Selection */}
            {selectedAccessLevel === 'system' && (
              <div>
                <label htmlFor="system" className="block text-sm font-medium text-gray-700 mb-2">
                  System
                </label>
                {isLoadingEntities ? (
                  <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
                ) : (
                  <select
                    id="system"
                    value={selectedEntityId || ''}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                    disabled={role !== 'system_admin'}
                  >
                    <option value="">Select a system</option>
                    {systems.map(system => (
                      <option key={system.id} value={system.id}>
                        {system.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {selectedAccessLevel === 'agency' && (
              <div>
                <label htmlFor="agency" className="block text-sm font-medium text-gray-700 mb-2">
                  Agency
                </label>
                {isLoadingEntities ? (
                  <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
                ) : (
                  <select
                    id="agency"
                    value={selectedEntityId || ''}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                    disabled={role === 'agency_admin'}
                  >
                    <option value="">Select an agency</option>
                    {agencies.map(agency => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {selectedAccessLevel === 'client' && (
              <div>
                <label htmlFor="client" className="block text-sm font-medium text-gray-700 mb-2">
                  Client
                </label>
                {isLoadingEntities ? (
                  <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
                ) : (
                  <select
                    id="client"
                    value={selectedEntityId || ''}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                  >
                    <option value="">Select a client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Change
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Explain why you're changing the access level..."
              />
            </div>

            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Access Level Information</h4>
              <div className="text-sm text-gray-500 space-y-1">
                <p><strong>System-wide:</strong> Accessible to all users across the platform.</p>
                <p><strong>Agency-level:</strong> Visible to all agency staff and their clients.</p>
                <p><strong>Client-level:</strong> Restricted to the specific client only.</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !selectedEntityId || (selectedAccessLevel === currentAccessLevel && selectedEntityId === currentEntityId)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Update Access Level
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}