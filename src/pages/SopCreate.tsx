import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { SopTag, SopAccessLevel } from '../lib/types';
import { useAppContext } from '../lib/AppContext';
import { SopTagSelector } from '../components/SopTagSelector';
import { extractLinksFromHtml } from '../lib/supabase';
import { RichTextEditor } from '../components/RichTextEditor';
import { GoogleDocsImportButton } from '../components/GoogleDocsImportButton';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface Client {
  id: string;
  name: string;
}

interface Agency {
  id: string;
  name: string;
}

interface System {
  id: string;
  name: string;
}

export function SopCreate() {
  const navigate = useNavigate();
  const { user, role, clientId, agencyId, systemId } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [accessLevel, setAccessLevel] = useState<SopAccessLevel>('client');
  const [selectedClient, setSelectedClient] = useState<string>(clientId || '');
  const [selectedAgency, setSelectedAgency] = useState<string>(agencyId || '');
  const [selectedSystem, setSelectedSystem] = useState<string>(systemId || '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<SopTag[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchAvailableTags();
    if (role === 'system_admin') {
      fetchSystems();
      fetchAgencies();
      fetchClients();
    } else if (role === 'agency_admin') {
      fetchClients();
    }
  }, [clientId, agencyId, systemId, role]);

  useEffect(() => {
    // Set default access level based on user role
    if (role === 'system_admin') {
      setAccessLevel('system');
      setSelectedSystem(systemId || '');
    } else if (role === 'agency_admin') {
      setAccessLevel('agency');
      setSelectedAgency(agencyId || '');
    } else {
      setAccessLevel('client');
      setSelectedClient(clientId || '');
    }
  }, [role, systemId, agencyId, clientId]);

  async function fetchAvailableTags() {
    try {
      let query = supabase
        .from('sop_tags')
        .select('*')
        .order('name');

      // Filter tags based on user role and selected access level
      if (accessLevel === 'client') {
        query = query.eq('access_level', 'client').eq('client_id', selectedClient || clientId);
      } else if (accessLevel === 'agency') {
        query = query.eq('access_level', 'agency').eq('agency_id', selectedAgency || agencyId);
      } else if (accessLevel === 'system') {
        query = query.eq('access_level', 'system').eq('system_id', selectedSystem || systemId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (err) {
      console.error('Error fetching available tags:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchSystems() {
    try {
      const { data, error } = await supabase
        .from('systems')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSystems(data || []);
    } catch (err) {
      console.error('Error fetching systems:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchAgencies() {
    try {
      let query = supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (role === 'agency_admin') {
        query = query.eq('id', agencyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAgencies(data || []);
    } catch (err) {
      console.error('Error fetching agencies:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchClients() {
    try {
      let query = supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (role === 'agency_admin') {
        query = query.eq('agency_id', agencyId);
      } else if (role === 'client_admin' || role === 'client_user') {
        query = query.eq('id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create an SOP');
      return;
    }
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    
    // Validate access level and entity selection
    if (accessLevel === 'system' && !selectedSystem) {
      setError('Please select a system for system-level SOP');
      return;
    }
    
    if (accessLevel === 'agency' && !selectedAgency) {
      setError('Please select an agency for agency-level SOP');
      return;
    }
    
    if (accessLevel === 'client' && !selectedClient) {
      setError('Please select a client for client-level SOP');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Create the SOP with appropriate access level
      const initialSopData: any = {
        title: title.trim(),
        description: description.trim() || null,
        status: 'draft',
        created_by: user.id,
        access_level: accessLevel
      };

      // Set the appropriate ID based on access level
      if (accessLevel === 'system') {
        initialSopData.system_id = selectedSystem;
      } else if (accessLevel === 'agency') {
        initialSopData.agency_id = selectedAgency;
      } else {
        initialSopData.client_id = selectedClient;
      }

      const { data: newSopData, error: sopError } = await supabase
        .from('sops')
        .insert([initialSopData])
        .select()
        .single();

      if (sopError) throw sopError;
      
      // The initial version is created automatically via a trigger
      
      // If there's content, update the initial version
      if (content.trim()) {
        const { error: versionError } = await supabase
          .from('sop_versions')
          .update({ content: content.trim() })
          .eq('sop_id', newSopData.id)
          .eq('version_number', 1);

        if (versionError) throw versionError;
      }
      
      // Add tags if selected
      if (selectedTags.length > 0) {
        const tagAssignments = selectedTags.map(tagId => ({
          sop_id: newSopData.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase
          .from('sop_tag_assignments')
          .insert(tagAssignments);

        if (tagError) throw tagError;
      }
      
      // Extract and add references
      const links = extractLinksFromHtml(content);
      
      if (links.length > 0) {
        const references = links.map(link => ({
          sop_id: newSopData.id,
          title: link.title || link.url,
          url: link.url,
          created_by: user.id
        }));

        const { error: refError } = await supabase
          .from('sop_references')
          .insert(references);

        if (refError) throw refError;
      }
      
      // Navigate to the new SOP
      navigate(`/sops/${newSopData.id}`);
    } catch (err) {
      console.error('Error creating SOP:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while creating the SOP');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle content import from Google Docs
  const handleImportContent = (importedContent: string) => {
    setContent(importedContent);
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Content imported from Google Docs',
      { contentLength: importedContent.length }
    );
  };

  // Check if user has permission to create SOPs
  if (!['system_admin', 'agency_admin', 'client_admin'].includes(role)) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Permission Error</h3>
            <div className="mt-2 text-sm text-yellow-700">
              You don't have permission to create SOPs. Please contact your administrator.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/sops')}
            className="mr-4 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Create New SOP
          </h2>
        </div>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="Enter SOP title"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="Brief description of this SOP"
              />
            </div>

            <div>
              <label htmlFor="access-level" className="block text-sm font-medium text-gray-700">
                Access Level <span className="text-red-500">*</span>
              </label>
              <select
                id="access-level"
                value={accessLevel}
                onChange={(e) => {
                  setAccessLevel(e.target.value as SopAccessLevel);
                  // Reset selected entity when access level changes
                  setSelectedClient('');
                  setSelectedAgency('');
                  setSelectedSystem('');
                  // Reset selected tags
                  setSelectedTags([]);
                  // Fetch tags for the new access level
                  fetchAvailableTags();
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                required
                disabled={role !== 'system_admin'}
              >
                {role === 'system_admin' && <option value="system">System-wide (Global)</option>}
                {['system_admin', 'agency_admin'].includes(role) && <option value="agency">Agency-level</option>}
                <option value="client">Client-level</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {accessLevel === 'system' 
                  ? 'System-wide SOPs are accessible to all users across the platform.' 
                  : accessLevel === 'agency' 
                    ? 'Agency-level SOPs are visible to all agency staff and clients.' 
                    : 'Client-level SOPs are restricted to the specific client only.'}
              </p>
            </div>

            {accessLevel === 'system' && role === 'system_admin' && (
              <div>
                <label htmlFor="system" className="block text-sm font-medium text-gray-700">
                  System <span className="text-red-500">*</span>
                </label>
                <select
                  id="system"
                  value={selectedSystem}
                  onChange={(e) => {
                    setSelectedSystem(e.target.value);
                    // Reset tags when system changes
                    setSelectedTags([]);
                    // Fetch tags for the selected system
                    fetchAvailableTags();
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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

            {accessLevel === 'agency' && ['system_admin', 'agency_admin'].includes(role) && (
              <div>
                <label htmlFor="agency" className="block text-sm font-medium text-gray-700">
                  Agency <span className="text-red-500">*</span>
                </label>
                <select
                  id="agency"
                  value={selectedAgency}
                  onChange={(e) => {
                    setSelectedAgency(e.target.value);
                    // Reset tags when agency changes
                    setSelectedTags([]);
                    // Fetch tags for the selected agency
                    fetchAvailableTags();
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
              </div>
            )}

            {accessLevel === 'client' && (
              <div>
                <label htmlFor="client" className="block text-sm font-medium text-gray-700">
                  Client <span className="text-red-500">*</span>
                </label>
                <select
                  id="client"
                  value={selectedClient}
                  onChange={(e) => {
                    setSelectedClient(e.target.value);
                    // Reset tags when client changes
                    setSelectedTags([]);
                    // Fetch tags for the selected client
                    fetchAvailableTags();
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                  required
                  disabled={role === 'client_admin' || role === 'client_user'}
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center mb-2">
                <Tag className="h-4 w-4 text-gray-500 mr-2" />
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                  Tags
                </label>
              </div>
              <SopTagSelector
                availableTags={availableTags}
                selectedTags={selectedTags}
                onChange={setSelectedTags}
                accessLevel={accessLevel}
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              
              {/* Google Docs Import Button */}
              <GoogleDocsImportButton onImport={handleImportContent} />
              
              <RichTextEditor 
                content={content} 
                onChange={setContent} 
                placeholder="Start writing your SOP content here..."
              />
              <p className="mt-2 text-sm text-gray-500">
                Use the formatting toolbar to style your content. Links will be automatically extracted to the References section.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/sops')}
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
                <Save className="h-4 w-4 inline-block mr-1" />
                Create SOP
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}