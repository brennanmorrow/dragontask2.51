import React, { useState, useEffect } from 'react';
import { Save, X, Send, Mail, Key, Globe, User, AlertCircle, CheckCircle } from 'lucide-react';
import { getEmailSettings, saveEmailSettings, sendTestEmail } from '../lib/emailService';
import { useAppContext } from '../lib/AppContext';

interface EmailSettingsProps {
  onClose?: () => void;
}

export function EmailSettings({ onClose }: EmailSettingsProps) {
  const { systemSettings } = useAppContext();
  const [formData, setFormData] = useState({
    apiKey: '',
    domain: 'dragontask.ai',
    fromEmail: 'postmaster@dragontask.ai',
    fromName: 'DragonTask'
  });
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    loadEmailSettings();
  }, []);

  const loadEmailSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const settings = await getEmailSettings();
      
      if (settings) {
        setFormData({
          apiKey: settings.apiKey || '',
          domain: settings.domain || 'dragontask.ai',
          fromEmail: settings.fromEmail || 'postmaster@dragontask.ai',
          fromName: settings.fromName || 'DragonTask'
        });
      }
    } catch (err) {
      setError('Failed to load email settings');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const success = await saveEmailSettings(formData);
      
      if (success) {
        setSuccessMessage('Email settings saved successfully');
      } else {
        setError('Failed to save email settings');
      }
    } catch (err) {
      setError('An error occurred while saving email settings');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setError('Please enter a test email address');
      return;
    }
    
    setIsSending(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await sendTestEmail(testEmail);
      
      if (result.success) {
        setSuccessMessage(`Test email sent to ${testEmail}`);
      } else {
        setError(result.message || 'Failed to send test email');
      }
    } catch (err) {
      setError('An error occurred while sending test email');
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Email Settings</h3>
        
        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}
        
        {successMessage && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-2 text-sm text-green-700">{successMessage}</div>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
              Mailgun API Key
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                id="apiKey"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Enter your Mailgun API key"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              You can find your API key in your Mailgun dashboard.
            </p>
          </div>
          
          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
              Domain
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="e.g., dragontask.ai"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700">
                From Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="fromEmail"
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., postmaster@dragontask.ai"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="fromName" className="block text-sm font-medium text-gray-700">
                From Name
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="fromName"
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., DragonTask"
                  required
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                <X className="h-4 w-4 inline-block mr-1" />
                Cancel
              </button>
            )}
            
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 inline-block mr-1" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-base font-medium text-gray-900">Test Email Configuration</h4>
          <p className="mt-1 text-sm text-gray-500">
            Send a test email to verify your configuration is working correctly.
          </p>
          
          <div className="mt-4 flex items-end space-x-4">
            <div className="flex-grow">
              <label htmlFor="testEmail" className="block text-sm font-medium text-gray-700">
                Test Email Address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  id="testEmail"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={isSending || !formData.apiKey}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
              style={{ 
                backgroundColor: primaryColor,
                opacity: isSending || !formData.apiKey ? 0.5 : 1 
              }}
            >
              {isSending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 inline-block mr-1" />
                  Send Test Email
                </>
              )}
            </button>
          </div>
          {!formData.apiKey && (
            <p className="mt-2 text-xs text-red-500">
              You must save your API key before sending a test email.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}