import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, Ban, Play, ArrowRight } from 'lucide-react';
import { supabase, uploadAgencyLogo } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { LogoUpload } from '../components/LogoUpload';
import { useNavigate } from 'react-router-dom';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

interface Agency {
  id: string;
  system_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  created_at: string;
  updated_at: string;
  is_suspended?: boolean;
}

interface AgencyFormData {
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  system_id?: string;
}

const initialFormData: AgencyFormData = {
  name: '',
  logo_url: '',
  primary_color: '#2563eb',
  secondary_color: '#1e40af',
  accent_color: '#3b82f6',
  font_family: 'Inter',
};

export function Agencies() {
  const navigate = useNavigate();
  const { systemId, role } = useAuthStore();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AgencyFormData>(initialFormData);

  useEffect(() => {
    fetchAgencies();
  }, [systemId]);

  async function fetchAgencies() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching agencies',
        { role, systemId }
      );
      
      let query = supabase
        .from('agencies')
        .select('*')
        .order('name');

      if (role !== 'system_admin' && systemId) {
        query = query.eq('system_id', systemId);
      }

      const { data, error } = await query;

      if (error) {
        logApiCall('agencies.select', false, { error });
        throw error;
      }
      
      logApiCall('agencies.select', true, { count: data?.length });
      setAgencies(data || []);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Agencies fetched successfully',
        { count: data?.length }
      );
    } catch (err) {
      console.error('Error fetching agencies:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching agencies',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!systemId) {
      setError('No system ID available. Please ensure you are properly authenticated.');
      return;
    }

    try {
      const agencyData = {
        ...formData,
        system_id: systemId,
      };

      if (editingId) {
        const { error } = await supabase
          .from('agencies')
          .update(agencyData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agencies')
          .insert([agencyData]);

        if (error) throw error;
      }

      setFormData(initialFormData);
      setEditingId(null);
      setIsCreating(false);
      await fetchAgencies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this agency? This will remove all user assignments and associated data. This action cannot be undone.')) {
      return;
    }

    try {
      // First, delete all user agency assignments
      const { error: assignmentsError } = await supabase
        .from('user_agency_assignments')
        .delete()
        .eq('agency_id', id);

      if (assignmentsError) throw assignmentsError;

      // Then delete all user roles associated with this agency
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('agency_id', id);

      if (rolesError) throw rolesError;

      // Finally, delete the agency
      const { error: agencyError } = await supabase
        .from('agencies')
        .delete()
        .eq('id', id);

      if (agencyError) throw agencyError;

      await fetchAgencies();
    } catch (err) {
      console.error('Error deleting agency:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting the agency');
    }
  }

  async function handleToggleSuspension(agency: Agency) {
    try {
      const { error } = await supabase
        .from('agencies')
        .update({ is_suspended: !agency.is_suspended })
        .eq('id', agency.id);

      if (error) throw error;
      await fetchAgencies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  function handleEdit(agency: Agency) {
    setFormData({
      name: agency.name,
      logo_url: agency.logo_url || '',
      primary_color: agency.primary_color || '#2563eb',
      secondary_color: agency.secondary_color || '#1e40af',
      accent_color: agency.accent_color || '#3b82f6',
      font_family: agency.font_family || 'Inter',
      system_id: agency.system_id,
    });
    setEditingId(agency.id);
    setIsCreating(true);
  }

  function handleCancel() {
    setFormData(initialFormData);
    setEditingId(null);
    setIsCreating(false);
  }

  async function handleLogoUpload(file: File) {
    try {
      let logoUrl: string | null = null;
      
      if (editingId) {
        logoUrl = await uploadAgencyLogo(file, editingId);
      } else {
        const tempId = crypto.randomUUID();
        logoUrl = await uploadAgencyLogo(file, tempId);
      }

      if (logoUrl) {
        setFormData(prev => ({ ...prev, logo_url: logoUrl }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error uploading logo');
    }
  }

  function handleAgencyClick(agencyId: string) {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.NAVIGATION,
      'Navigating to agency dashboard',
      { agencyId }
    );
    navigate(`/agencies/${agencyId}`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!systemId) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Access Error</h3>
            <div className="mt-2 text-sm text-yellow-700">
              You must be associated with a system to manage agencies.
            </div>
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
            Agencies
          </h2>
        </div>
        {!isCreating && (
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus className="h-5 w-5" />
              Add Agency
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

      {isCreating && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">
                  Agency Name
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder="Enter agency name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">
                  Logo
                </label>
                <div className="mt-2">
                  <LogoUpload
                    currentLogo={formData.logo_url}
                    onUpload={handleLogoUpload}
                    className="max-w-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="primary_color" className="block text-sm font-medium leading-6 text-gray-900">
                    Primary Color
                  </label>
                  <div className="mt-2">
                    <input
                      type="color"
                      name="primary_color"
                      id="primary_color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="secondary_color" className="block text-sm font-medium leading-6 text-gray-900">
                    Secondary Color
                  </label>
                  <div className="mt-2">
                    <input
                      type="color"
                      name="secondary_color"
                      id="secondary_color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="accent_color" className="block text-sm font-medium leading-6 text-gray-900">
                    Accent Color
                  </label>
                  <div className="mt-2">
                    <input
                      type="color"
                      name="accent_color"
                      id="accent_color"
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="font_family" className="block text-sm font-medium leading-6 text-gray-900">
                  Font Family
                </label>
                <div className="mt-2">
                  <select
                    id="font_family"
                    name="font_family"
                    value={formData.font_family}
                    onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Poppins">Poppins</option>
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
                Logo
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Colors
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
            {agencies.map((agency) => (
              <tr key={agency.id} className={agency.is_suspended ? 'bg-gray-50' : ''}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 cursor-pointer hover:text-blue-600" onClick={() => handleAgencyClick(agency.id)}>
                  <div className="flex items-center">
                    <span>{agency.name}</span>
                    <ArrowRight className="ml-2 h-4 w-4 text-gray-400" />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {agency.logo_url && (
                    <img
                      src={agency.logo_url}
                      alt={`${agency.name} logo`}
                      className="h-8 w-8 object-contain"
                    />
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div className="flex gap-2">
                    {agency.primary_color && (
                      <div
                        className="w-6 h-6 rounded border border-gray-200"
                        style={{ backgroundColor: agency.primary_color }}
                        title="Primary Color"
                      />
                    )}
                    {agency.secondary_color && (
                      <div
                        className="w-6 h-6 rounded border border-gray-200"
                        style={{ backgroundColor: agency.secondary_color }}
                        title="Secondary Color"
                      />
                    )}
                    {agency.accent_color && (
                      <div
                        className="w-6 h-6 rounded border border-gray-200"
                        style={{ backgroundColor: agency.accent_color }}
                        title="Accent Color"
                      />
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                      agency.is_suspended
                        ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                        : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                    }`}
                  >
                    {agency.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div className="flex justify-end gap-x-3">
                    <button
                      onClick={() => handleToggleSuspension(agency)}
                      className={`${
                        agency.is_suspended ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'
                      }`}
                      title={agency.is_suspended ? 'Activate Agency' : 'Suspend Agency'}
                    >
                      {agency.is_suspended ? <Play className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => handleEdit(agency)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Pencil className="h-5 w-5" />
                      <span className="sr-only">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(agency.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                      <span className="sr-only">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {agencies.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                  No agencies found. Click "Add Agency" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}