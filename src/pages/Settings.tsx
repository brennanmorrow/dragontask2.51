import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Check, X, Upload, Hexagon as Dragon, Mail, BarChart, FileText, ExternalLink } from 'lucide-react';
import { LogoUpload } from '../components/LogoUpload';
import { useAppContext } from '../lib/AppContext';
import { EmailSettings } from '../components/EmailSettings';
import { EmailLogs } from '../components/EmailLogs';
import { EmailTemplateEditor } from '../components/EmailTemplateEditor';
import { EmailTester } from '../components/EmailTester';

interface SystemSettings {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  created_at: string;
  updated_at: string;
  email_settings?: {
    apiKey: string;
    domain: string;
    fromEmail: string;
    fromName: string;
  };
}

export function Settings() {
  const { role, systemId } = useAuthStore();
  const { systemSettings: contextSettings, refreshSettings, applyTheme } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    primary_color: '#EF4444', // Default red for DragonTask
    secondary_color: '#B91C1C',
    accent_color: '#FCA5A5',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [previewTheme, setPreviewTheme] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'email-logs' | 'email-templates' | 'email-testing'>('general');

  useEffect(() => {
    if (role === 'system_admin') {
      fetchSystemSettings();
    }
  }, [role, systemId]);

  // Update form data when context settings change
  useEffect(() => {
    if (contextSettings && !isEditing) {
      setFormData({
        name: contextSettings.name || 'DragonTask',
        logo_url: contextSettings.logo_url || '',
        primary_color: contextSettings.primary_color || '#EF4444',
        secondary_color: contextSettings.secondary_color || '#B91C1C',
        accent_color: contextSettings.accent_color || '#FCA5A5',
      });
    }
  }, [contextSettings, isEditing]);

  // Preview theme changes
  useEffect(() => {
    if (previewTheme && isEditing) {
      applyTheme({
        id: systemSettings?.id || '',
        name: formData.name,
        logo_url: formData.logo_url || null,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        accent_color: formData.accent_color,
      });
    } else if (!previewTheme && contextSettings) {
      applyTheme(contextSettings);
    }
  }, [previewTheme, formData, isEditing]);

  async function fetchSystemSettings() {
    try {
      setIsLoading(true);
      
      // First check if we have system settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        // PGRST116 is "Results contain 0 rows" - not an error in this case
        throw settingsError;
      }

      if (settingsData) {
        setSystemSettings(settingsData);
        setFormData({
          name: settingsData.name || 'DragonTask',
          logo_url: settingsData.logo_url || '',
          primary_color: settingsData.primary_color || '#EF4444',
          secondary_color: settingsData.secondary_color || '#B91C1C',
          accent_color: settingsData.accent_color || '#FCA5A5',
        });
      } else {
        // If no settings exist, create default settings
        const { data: systemData } = await supabase
          .from('systems')
          .select('id, name')
          .eq('id', systemId)
          .single();

        const defaultSettings = {
          system_id: systemId,
          name: systemData?.name || 'DragonTask',
          logo_url: null,
          primary_color: '#EF4444',
          secondary_color: '#B91C1C',
          accent_color: '#FCA5A5',
          email_settings: {
            apiKey: '',
            domain: 'dragontask.ai',
            fromEmail: 'postmaster@dragontask.ai',
            fromName: 'DragonTask'
          }
        };

        const { data: newSettings, error: createError } = await supabase
          .from('system_settings')
          .insert([defaultSettings])
          .select()
          .single();

        if (createError) throw createError;

        setSystemSettings(newSettings);
        setFormData({
          name: newSettings.name,
          logo_url: newSettings.logo_url || '',
          primary_color: newSettings.primary_color,
          secondary_color: newSettings.secondary_color,
          accent_color: newSettings.accent_color,
        });
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          name: formData.name,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          accent_color: formData.accent_color,
        })
        .eq('id', systemSettings?.id);

      if (error) throw error;

      setIsEditing(false);
      setPreviewTheme(false);
      await fetchSystemSettings();
      await refreshSettings();
    } catch (err) {
      console.error('Error updating system settings:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleLogoUpload(file: File) {
    if (role !== 'system_admin') {
      setError('Only system administrators can upload system logos');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `system-logo-${Date.now()}.${fileExt}`;
      const filePath = `system-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('agency-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agency-assets')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
    } catch (err) {
      console.error('Error uploading logo:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while uploading the logo');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: contextSettings?.primary_color || '#EF4444' }}></div>
      </div>
    );
  }

  if (role !== 'system_admin') {
    return (
      <div className="space-y-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Settings
            </h2>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-700">
            User settings will be available here in a future update. Currently, only system administrators can modify settings.
          </p>
        </div>
      </div>
    );
  }

  // Get theme colors for buttons and UI elements
  const primaryColor = contextSettings?.primary_color || '#EF4444';
  const secondaryColor = contextSettings?.secondary_color || '#B91C1C';
  const accentColor = contextSettings?.accent_color || '#FCA5A5';

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            System Settings
          </h2>
        </div>
        {!isEditing && activeTab === 'general' && (
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-x-2 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: primaryColor, '&:hover': { backgroundColor: secondaryColor } }}
            >
              Edit Settings
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`${
              activeTab === 'general'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            style={activeTab === 'general' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`${
              activeTab === 'email'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'email' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Settings
          </button>
          <button
            onClick={() => setActiveTab('email-templates')}
            className={`${
              activeTab === 'email-templates'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'email-templates' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <FileText className="h-4 w-4 mr-2" />
            Email Templates
          </button>
          <button
            onClick={() => setActiveTab('email-logs')}
            className={`${
              activeTab === 'email-logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'email-logs' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <BarChart className="h-4 w-4 mr-2" />
            Email Logs
          </button>
          <button
            onClick={() => setActiveTab('email-testing')}
            className={`${
              activeTab === 'email-testing'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'email-testing' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Email Testing
          </button>
        </nav>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  System Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-offset-2 sm:text-sm"
                  style={{ 
                    '&:focus': { 
                      borderColor: primaryColor,
                      '--tw-ring-color': primaryColor
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  System Logo
                </label>
                <div className="mt-2">
                  <LogoUpload
                    currentLogo={formData.logo_url}
                    onUpload={handleLogoUpload}
                    className="max-w-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700">
                    Primary Color
                  </label>
                  <div className="mt-2 flex items-center">
                    <input
                      type="color"
                      id="primary_color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="h-10 w-10 rounded border border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-500">{formData.primary_color}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Used for primary buttons, active states, and links</p>
                </div>

                <div>
                  <label htmlFor="secondary_color" className="block text-sm font-medium text-gray-700">
                    Secondary Color
                  </label>
                  <div className="mt-2 flex items-center">
                    <input
                      type="color"
                      id="secondary_color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="h-10 w-10 rounded border border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-500">{formData.secondary_color}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Used for hover states and secondary elements</p>
                </div>

                <div>
                  <label htmlFor="accent_color" className="block text-sm font-medium text-gray-700">
                    Accent Color
                  </label>
                  <div className="mt-2 flex items-center">
                    <input
                      type="color"
                      id="accent_color"
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      className="h-10 w-10 rounded border border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-500">{formData.accent_color}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Used for highlights, backgrounds, and tertiary elements</p>
                </div>
              </div>

              <div className="flex items-center mt-4">
                <input
                  id="preview-theme"
                  type="checkbox"
                  checked={previewTheme}
                  onChange={(e) => setPreviewTheme(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="preview-theme" className="ml-2 block text-sm text-gray-900">
                  Preview theme changes
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setPreviewTheme(false);
                    setFormData({
                      name: systemSettings?.name || 'DragonTask',
                      logo_url: systemSettings?.logo_url || '',
                      primary_color: systemSettings?.primary_color || '#EF4444',
                      secondary_color: systemSettings?.secondary_color || '#B91C1C',
                      accent_color: systemSettings?.accent_color || '#FCA5A5',
                    });
                    // Restore original theme
                    if (contextSettings) {
                      applyTheme(contextSettings);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ '&:focus': { '--tw-ring-color': primaryColor } }}
                >
                  <X className="h-4 w-4 inline mr-2" />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ 
                    backgroundColor: primaryColor,
                    '&:hover': { backgroundColor: secondaryColor },
                    '&:focus': { '--tw-ring-color': primaryColor }
                  }}
                >
                  <Check className="h-4 w-4 inline mr-2" />
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6 space-y-6">
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  {systemSettings?.logo_url ? (
                    <img
                      src={systemSettings.logo_url}
                      alt="System Logo"
                      className="h-24 w-24 object-contain"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-lg flex items-center justify-center" 
                         style={{ backgroundColor: `rgba(${parseInt(primaryColor.slice(1, 3), 16)}, ${parseInt(primaryColor.slice(3, 5), 16)}, ${parseInt(primaryColor.slice(5, 7), 16)}, 0.1)` }}>
                      <Dragon className="h-12 w-12" style={{ color: primaryColor }} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{systemSettings?.name || 'DragonTask'}</h3>
                  <p className="text-sm text-gray-500">System Administration</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-900">Brand Colors</h4>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center">
                      <div 
                        className="h-8 w-8 rounded-full mr-2" 
                        style={{ backgroundColor: systemSettings?.primary_color || '#EF4444' }}
                      ></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Primary Color</p>
                        <p className="text-xs text-gray-500">{systemSettings?.primary_color || '#EF4444'}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center">
                      <div 
                        className="h-8 w-8 rounded-full mr-2" 
                        style={{ backgroundColor: systemSettings?.secondary_color || '#B91C1C' }}
                      ></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Secondary Color</p>
                        <p className="text-xs text-gray-500">{systemSettings?.secondary_color || '#B91C1C'}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center">
                      <div 
                        className="h-8 w-8 rounded-full mr-2" 
                        style={{ backgroundColor: systemSettings?.accent_color || '#FCA5A5' }}
                      ></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Accent Color</p>
                        <p className="text-xs text-gray-500">{systemSettings?.accent_color || '#FCA5A5'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-900">Theme Preview</h4>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="p-4 border border-gray-200 rounded-md">
                    <h5 className="font-medium mb-2">Buttons</h5>
                    <div className="flex space-x-2">
                      <button 
                        className="px-3 py-1 rounded-md text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Primary
                      </button>
                      <button 
                        className="px-3 py-1 rounded-md text-white"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        Secondary
                      </button>
                      <button 
                        className="px-3 py-1 rounded-md border"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        Outline
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-md">
                    <h5 className="font-medium mb-2">Text & Links</h5>
                    <p>Regular text with <a href="#" style={{ color: primaryColor }}>colored links</a> and <span style={{ color: secondaryColor }}>highlighted text</span>.</p>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-md">
                    <h5 className="font-medium mb-2">Badges</h5>
                    <div className="flex space-x-2">
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: `rgba(${parseInt(primaryColor.slice(1, 3), 16)}, ${parseInt(primaryColor.slice(3, 5), 16)}, ${parseInt(primaryColor.slice(5, 7), 16)}, 0.1)`,
                          color: primaryColor
                        }}
                      >
                        Primary
                      </span>
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: `rgba(${parseInt(secondaryColor.slice(1, 3), 16)}, ${parseInt(secondaryColor.slice(3, 5), 16)}, ${parseInt(secondaryColor.slice(5, 7), 16)}, 0.1)`,
                          color: secondaryColor
                        }}
                      >
                        Secondary
                      </span>
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: `rgba(${parseInt(accentColor.slice(1, 3), 16)}, ${parseInt(accentColor.slice(3, 5), 16)}, ${parseInt(accentColor.slice(5, 7), 16)}, 0.1)`,
                          color: secondaryColor
                        }}
                      >
                        Accent
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-md">
                    <h5 className="font-medium mb-2">Form Elements</h5>
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        placeholder="Input field"
                        style={{ 
                          '&:focus': { 
                            borderColor: primaryColor,
                            '--tw-ring-color': primaryColor
                          }
                        }}
                      />
                      <div className="flex items-center">
                        <input 
                          id="checkbox-example" 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          style={{ 
                            '&:checked': { backgroundColor: primaryColor, borderColor: primaryColor },
                            '&:focus': { '--tw-ring-color': primaryColor }
                          }}
                        />
                        <label htmlFor="checkbox-example" className="ml-2 block text-sm text-gray-900">
                          Checkbox
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Settings */}
      {activeTab === 'email' && (
        <EmailSettings />
      )}

      {/* Email Templates */}
      {activeTab === 'email-templates' && (
        <EmailTemplateEditor />
      )}

      {/* Email Logs */}
      {activeTab === 'email-logs' && (
        <EmailLogs />
      )}

      {/* Email Testing */}
      {activeTab === 'email-testing' && (
        <EmailTester />
      )}
    </div>
  );
}