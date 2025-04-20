import React, { useState, useEffect } from 'react';
import { FileText, Search, Plus, X, Link2, Eye, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SOP } from '../lib/types';
import { useAuthStore } from '../lib/store';
import { SopViewer } from './SopViewer';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

interface TaskSopSelectorProps {
  taskId: string;
  clientId: string;
  onClose: () => void;
}

export function TaskSopSelector({ taskId, clientId, onClose }: TaskSopSelectorProps) {
  const [sops, setSops] = useState<SOP[]>([]);
  const [linkedSops, setLinkedSops] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSop, setSelectedSop] = useState<SOP | null>(null);
  const [sopContent, setSopContent] = useState<string>('');
  const { role, agencyId, systemId } = useAuthStore();

  useEffect(() => {
    fetchSOPs();
    fetchLinkedSOPs();
  }, [taskId, clientId]);

  async function fetchSOPs() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching SOPs for task',
        { taskId, clientId }
      );
      
      // Make sure clientId is valid before proceeding
      if (!clientId) {
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.API_CALL,
          'Missing clientId when fetching SOPs for task',
          { taskId }
        );
        setSops([]);
        setIsLoading(false);
        return;
      }
      
      // Build a query that includes:
      // 1. Client-specific SOPs for this client
      // 2. Agency-level SOPs for the client's agency
      // 3. System-wide SOPs
      // Only include approved SOPs
      let query = supabase
        .from('sops')
        .select(`
          id,
          title,
          description,
          status,
          access_level,
          client_id,
          agency_id,
          system_id,
          created_at,
          updated_at
        `)
        .eq('status', 'approved');
      
      // Build OR conditions for access levels
      const conditions = [];
      
      // Client-specific SOPs
      conditions.push(`client_id.eq.${clientId}`);
      
      // Agency-level SOPs (if we have agencyId)
      if (agencyId) {
        conditions.push(`access_level.eq.agency,agency_id.eq.${agencyId}`);
      }
      
      // System-wide SOPs
      conditions.push('access_level.eq.system');
      
      // Apply the OR conditions
      query = query.or(conditions.join(','));

      const { data, error: sopsError } = await query.order('title');

      if (sopsError) {
        logApiCall('sops.select', false, { error: sopsError });
        throw sopsError;
      }
      
      logApiCall('sops.select', true, { count: data?.length });
      setSops(data || []);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOPs fetched successfully for task',
        { taskId, clientId, count: data?.length || 0 }
      );
    } catch (err) {
      console.error('Error fetching SOPs:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching SOPs',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLinkedSOPs() {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching linked SOPs',
        { taskId }
      );
      
      const { data, error } = await supabase
        .from('task_sops')
        .select('sop_id')
        .eq('task_id', taskId);

      if (error) {
        logApiCall('task_sops.select', false, { error });
        throw error;
      }
      
      logApiCall('task_sops.select', true, { count: data?.length });
      setLinkedSops(data.map(item => item.sop_id));
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Linked SOPs fetched successfully',
        { taskId, linkedCount: data.length }
      );
    } catch (err) {
      console.error('Error fetching linked SOPs:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching linked SOPs',
        { error: err, taskId }
      );
    }
  }

  async function handleToggleSop(sopId: string) {
    try {
      if (linkedSops.includes(sopId)) {
        // Unlink SOP
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.API_CALL,
          'Unlinking SOP from task',
          { taskId, sopId }
        );
        
        const { error } = await supabase
          .from('task_sops')
          .delete()
          .eq('task_id', taskId)
          .eq('sop_id', sopId);

        if (error) {
          logApiCall('task_sops.delete', false, { error });
          throw error;
        }
        
        logApiCall('task_sops.delete', true, {});
        setLinkedSops(linkedSops.filter(id => id !== sopId));
        
        // If this was the selected SOP, clear it
        if (selectedSop && selectedSop.id === sopId) {
          setSelectedSop(null);
          setSopContent('');
        }
      } else {
        // Link SOP
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.API_CALL,
          'Linking SOP to task',
          { taskId, sopId }
        );
        
        const { error } = await supabase
          .from('task_sops')
          .insert([{ task_id: taskId, sop_id: sopId }]);

        if (error) {
          logApiCall('task_sops.insert', false, { error });
          throw error;
        }
        
        logApiCall('task_sops.insert', true, {});
        setLinkedSops([...linkedSops, sopId]);
      }
    } catch (err) {
      console.error('Error toggling SOP link:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error toggling SOP link',
        { error: err }
      );
    }
  }

  async function handleViewSop(sop: SOP) {
    try {
      setSelectedSop(sop);
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching SOP content',
        { sopId: sop.id }
      );
      
      // Fetch the latest version of the SOP
      const { data, error } = await supabase
        .from('sop_versions')
        .select('content')
        .eq('sop_id', sop.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        logApiCall('sop_versions.select', false, { error });
        throw error;
      }
      
      logApiCall('sop_versions.select', true, {});
      setSopContent(data.content);
    } catch (err) {
      console.error('Error fetching SOP content:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching SOP content',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Filter SOPs based on search term
  const filteredSOPs = sops.filter(sop => 
    sop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sop.description && sop.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // If a SOP is selected, show its content
  if (selectedSop) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => setSelectedSop(null)}
              className="mr-4 text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900">{selectedSop.title}</h3>
          </div>
          <div className="flex space-x-2">
            <a
              href={`/sops/${selectedSop.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in New Tab
            </a>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <SopViewer content={sopContent} />
        )}
      </div>
    );
  }

  if (isLoading && !selectedSop) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Link SOPs to Task</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full rounded-md border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Search SOPs..."
        />
      </div>

      {/* SOPs List */}
      <div className="overflow-y-auto max-h-96 border border-gray-200 rounded-md">
        {filteredSOPs.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {filteredSOPs.map((sop) => (
              <li key={sop.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{sop.title}</h4>
                      {sop.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">{sop.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewSop(sop)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => handleToggleSop(sop.id)}
                      className={`inline-flex items-center px-2.5 py-1.5 border text-xs font-medium rounded ${
                        linkedSops.includes(sop.id)
                          ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                          : 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {linkedSops.includes(sop.id) ? (
                        <>
                          <X className="h-3 w-3 mr-1" />
                          Unlink
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No SOPs found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm
                ? 'Try adjusting your search term'
                : 'No approved SOPs available for this client'}
            </p>
            {['system_admin', 'agency_admin', 'client_admin'].includes(role) && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => window.open('/sops/new', '_blank')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New SOP
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}