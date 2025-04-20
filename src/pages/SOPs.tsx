import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Tag, Filter, FileText, Clock, CheckCircle, XCircle, ArrowUpRight, Building2, Briefcase, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { SOP, SopTag, SopAccessLevel } from '../lib/types';
import { useAppContext } from '../lib/AppContext';
import { format } from 'date-fns';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

interface Client {
  id: string;
  name: string;
}

interface Agency {
  id: string;
  name: string;
}

export function SOPs() {
  const navigate = useNavigate();
  const { user, role, clientId, agencyId, systemId } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [sops, setSops] = useState<SOP[]>([]);
  const [tags, setTags] = useState<SopTag[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<SopAccessLevel[]>([]);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const secondaryColor = systemSettings?.secondary_color || '#B91C1C';

  useEffect(() => {
    fetchSOPs();
    fetchTags();
    fetchClientsAndAgencies();
  }, [clientId, agencyId, systemId]);

  async function fetchClientsAndAgencies() {
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Fetch agencies
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name');

      if (agenciesError) throw agenciesError;
      setAgencies(agenciesData || []);
    } catch (err) {
      console.error('Error fetching clients and agencies:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchSOPs() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching SOPs',
        { role, clientId, agencyId, systemId }
      );
      
      let query = supabase
        .from('sops')
        .select('*')
        .order('updated_at', { ascending: false });

      // Apply filters based on user role and access level
      if (role === 'client_admin' || role === 'client_user') {
        // Client users can see:
        // 1. Their client-specific SOPs
        // 2. Agency-level SOPs from their agency
        // 3. System-wide SOPs
        const conditions = ['access_level.eq.system'];
        
        if (clientId) {
          conditions.push(`client_id.eq.${clientId}`);
        }
        if (agencyId) {
          conditions.push(`access_level.eq.agency`, `agency_id.eq.${agencyId}`);
        }
        
        query = query.or(conditions.join(','));
      } else if (role === 'agency_admin') {
        // Agency admins can see:
        // 1. All client SOPs for clients in their agency
        // 2. Their agency-level SOPs
        // 3. System-wide SOPs
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('agency_id', agencyId);
        
        const conditions = ['access_level.eq.system'];
        
        if (agencyId) {
          conditions.push(`agency_id.eq.${agencyId}`);
        }
        
        if (clients && clients.length > 0) {
          const clientIds = clients.map(c => c.id);
          conditions.push(`client_id.in.(${clientIds.join(',')})`);
        }
        
        query = query.or(conditions.join(','));
      }
      // System admins can see all SOPs, so no additional filters needed

      const { data: sopsData, error: sopsError } = await query;

      if (sopsError) {
        logApiCall('sops.select', false, { error: sopsError });
        throw sopsError;
      }
      
      logApiCall('sops.select', true, { count: sopsData?.length });

      // Get unique creator IDs
      const creatorIds = [...new Set((sopsData || []).map(sop => sop.created_by))];

      // Fetch creator emails in a single query
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, email')
        .in('user_id', creatorIds);

      if (userRolesError) {
        logApiCall('user_roles.select', false, { error: userRolesError });
        throw userRolesError;
      }
      
      logApiCall('user_roles.select', true, { count: userRoles?.length });

      // Create a map of user IDs to emails
      const userEmailMap = new Map(userRoles?.map(ur => [ur.user_id, ur.email]));

      // Fetch tags for each SOP and add creator emails
      const sopsWithTagsAndCreator = await Promise.all(
        (sopsData || []).map(async (sop) => {
          const { data: tagAssignments } = await supabase
            .from('sop_tag_assignments')
            .select(`
              tag:sop_tags(id, name, color, access_level)
            `)
            .eq('sop_id', sop.id);

          return {
            ...sop,
            tags: tagAssignments?.map(ta => ta.tag) || [],
            created_by_email: userEmailMap.get(sop.created_by)
          };
        })
      );

      // Sort by access level priority (system > agency > client)
      const sortedSops = sopsWithTagsAndCreator.sort((a, b) => {
        const accessLevelPriority = { 'system': 0, 'agency': 1, 'client': 2 };
        return accessLevelPriority[a.access_level] - accessLevelPriority[b.access_level];
      });

      setSops(sortedSops);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOPs fetched successfully',
        { count: sortedSops.length }
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

  async function fetchTags() {
    try {
      let query = supabase
        .from('sop_tags')
        .select('*')
        .order('name');

      // Filter tags based on user role
      if (role === 'client_admin' || role === 'client_user') {
        // Client users can see:
        // 1. Their client-specific tags
        // 2. Agency-level tags from their agency
        // 3. System-wide tags
        const conditions = ['access_level.eq.system'];
        
        if (clientId) {
          conditions.push(`client_id.eq.${clientId}`);
        }
        if (agencyId) {
          conditions.push(`access_level.eq.agency`, `agency_id.eq.${agencyId}`);
        }
        
        query = query.or(conditions.join(','));
      } else if (role === 'agency_admin') {
        // Agency admins can see:
        // 1. All client tags for clients in their agency
        // 2. Their agency-level tags
        // 3. System-wide tags
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('agency_id', agencyId);
        
        const conditions = ['access_level.eq.system'];
        
        if (agencyId) {
          conditions.push(`agency_id.eq.${agencyId}`);
        }
        
        if (clients && clients.length > 0) {
          const clientIds = clients.map(c => c.id);
          conditions.push(`client_id.in.(${clientIds.join(',')})`);
        }
        
        query = query.or(conditions.join(','));
      }
      // System admins can see all tags, so no additional filters needed

      const { data, error } = await query;

      if (error) {
        logApiCall('sop_tags.select', false, { error });
        throw error;
      }
      
      logApiCall('sop_tags.select', true, { count: data?.length });
      setTags(data || []);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP tags fetched successfully',
        { count: data?.length }
      );
    } catch (err) {
      console.error('Error fetching tags:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching SOP tags',
        { error: err }
      );
    }
  }

  // Filter SOPs based on search term, tags, status, and access level
  const filteredSOPs = sops.filter(sop => {
    // Search term filter
    const matchesSearch = searchTerm === '' || 
      sop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sop.description && sop.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Tags filter
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.every(tagId => sop.tags?.some(tag => tag.id === tagId));
    
    // Status filter
    const matchesStatus = selectedStatus.length === 0 ||
      selectedStatus.includes(sop.status);
    
    // Access level filter
    const matchesAccessLevel = selectedAccessLevel.length === 0 ||
      selectedAccessLevel.includes(sop.access_level);
    
    return matchesSearch && matchesTags && matchesStatus && matchesAccessLevel;
  });

  function handleTagToggle(tagId: string) {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId) 
        : [...prev, tagId]
    );
  }

  function handleStatusToggle(status: string) {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  }

  function handleAccessLevelToggle(level: SopAccessLevel) {
    setSelectedAccessLevel(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level) 
        : [...prev, level]
    );
  }

  function getStatusBadgeColor(status: string) {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />;
      case 'review':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'archived':
        return <XCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  function getAccessLevelIcon(level: SopAccessLevel) {
    switch (level) {
      case 'system':
        return <Building2 className="h-4 w-4" />;
      case 'agency':
        return <Briefcase className="h-4 w-4" />;
      case 'client':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  function getAccessLevelBadgeColor(level: SopAccessLevel) {
    switch (level) {
      case 'system':
        return 'bg-purple-100 text-purple-800';
      case 'agency':
        return 'bg-blue-100 text-blue-800';
      case 'client':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getAccessLevelLabel(sop: SOP) {
    switch (sop.access_level) {
      case 'system':
        return 'System-wide';
      case 'agency': {
        const agency = agencies.find(a => a.id === sop.agency_id);
        return agency ? agency.name : 'Agency';
      }
      case 'client': {
        const client = clients.find(c => c.id === sop.client_id);
        return client ? client.name : 'Client';
      }
      default:
        return 'Unknown';
    }
  }

  if (isLoading) {
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
            Standard Operating Procedures
          </h2>
        </div>
        {['system_admin', 'agency_admin', 'client_admin'].includes(role) && (
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              onClick={() => navigate('/sops/new')}
              className="inline-flex items-center gap-x-2 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="h-5 w-5" />
              New SOP
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

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Search */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Search SOPs..."
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex flex-wrap gap-2">
              {['draft', 'review', 'approved', 'archived'].map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusToggle(status)}
                  className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ${
                    selectedStatus.includes(status)
                      ? 'ring-2 ring-offset-1'
                      : ''
                  } ${getStatusBadgeColor(status)}`}
                  style={selectedStatus.includes(status) ? { ringColor: primaryColor } : {}}
                >
                  {getStatusIcon(status)}
                  <span className="ml-1 capitalize">{status}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Access Level Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
            <div className="flex flex-wrap gap-2">
              {(['system', 'agency', 'client'] as SopAccessLevel[]).map(level => (
                <button
                  key={level}
                  onClick={() => handleAccessLevelToggle(level)}
                  className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ${
                    selectedAccessLevel.includes(level)
                      ? 'ring-2 ring-offset-1'
                      : ''
                  } ${getAccessLevelBadgeColor(level)}`}
                  style={selectedAccessLevel.includes(level) ? { ringColor: primaryColor } : {}}
                >
                  {getAccessLevelIcon(level)}
                  <span className="ml-1 capitalize">{level}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tags Filter */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => handleTagToggle(tag.id)}
                className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ${
                  selectedTags.includes(tag.id)
                    ? 'ring-2 ring-offset-1'
                    : ''
                }`}
                style={{
                  backgroundColor: `${tag.color}20`, // 20% opacity
                  color: tag.color,
                  ...(selectedTags.includes(tag.id) ? { ringColor: tag.color } : {})
                }}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag.name}
                {tag.access_level && (
                  <span className="ml-1 text-xs opacity-75">
                    ({tag.access_level.charAt(0).toUpperCase()})
                  </span>
                )}
              </button>
            ))}
            {tags.length === 0 && (
              <span className="text-sm text-gray-500">No tags available</span>
            )}
          </div>
        </div>

        {/* Active filters summary */}
        {(searchTerm || selectedTags.length > 0 || selectedStatus.length > 0 || selectedAccessLevel.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTags([]);
                setSelectedStatus([]);
                setSelectedAccessLevel([]);
              }}
              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* SOPs Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSOPs.length > 0 ? (
          filteredSOPs.map(sop => (
            <div 
              key={sop.id} 
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/sops/${sop.id}`)}
            >
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-gray-900 truncate">{sop.title}</h3>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(sop.status)}`}>
                      {getStatusIcon(sop.status)}
                      <span className="ml-1">{sop.status}</span>
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getAccessLevelBadgeColor(sop.access_level)}`}>
                      {getAccessLevelIcon(sop.access_level)}
                      <span className="ml-1">{getAccessLevelLabel(sop)}</span>
                    </span>
                  </div>
                </div>
                
                {sop.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{sop.description}</p>
                )}
                
                {/* Tags */}
                {sop.tags && sop.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sop.tags.map(tag => (
                      <span 
                        key={tag.id}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                  <span>Created by {sop.created_by_email}</span>
                  <span>Updated {format(new Date(sop.updated_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {format(new Date(sop.created_at), 'MMM d, yyyy')}
                  </span>
                  <span className="inline-flex items-center text-xs font-medium text-blue-600">
                    View Details
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No SOPs found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedTags.length > 0 || selectedStatus.length > 0 || selectedAccessLevel.length > 0
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first SOP'}
            </p>
            {['system_admin', 'agency_admin', 'client_admin'].includes(role) && (
              <button
                type="button"
                onClick={() => navigate('/sops/new')}
                className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create SOP
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}