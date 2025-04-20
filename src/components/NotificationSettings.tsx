import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Bell, Mail, Check, X, AlertCircle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { NotificationEmailPreview } from './NotificationEmailPreview';

interface NotificationSettingsProps {
  onClose?: () => void;
}

interface NotificationPreference {
  id?: string;
  user_id: string;
  email_mentions: boolean;
  email_task_assignments: boolean;
  email_task_due_soon: boolean;
  email_sop_approvals: boolean;
  created_at?: string;
  updated_at?: string;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { user } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [preferences, setPreferences] = useState<NotificationPreference>({
    user_id: user?.id || '',
    email_mentions: true,
    email_task_assignments: true,
    email_task_due_soon: true,
    email_sop_approvals: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "Results contain 0 rows"
        throw error;
      }
      
      if (data) {
        setPreferences(data);
      }
    } catch (err) {
      console.error('Error fetching notification preferences:', err);
      setError('Failed to load notification preferences');
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
      if (preferences.id) {
        // Update existing preferences
        const { error } = await supabase
          .from('user_notification_preferences')
          .update({
            email_mentions: preferences.email_mentions,
            email_task_assignments: preferences.email_task_assignments,
            email_task_due_soon: preferences.email_task_due_soon,
            email_sop_approvals: preferences.email_sop_approvals,
            updated_at: new Date().toISOString()
          })
          .eq('id', preferences.id);
        
        if (error) throw error;
      } else {
        // Create new preferences
        const { data, error } = await supabase
          .from('user_notification_preferences')
          .insert([{
            user_id: user?.id,
            email_mentions: preferences.email_mentions,
            email_task_assignments: preferences.email_task_assignments,
            email_task_due_soon: preferences.email_task_due_soon,
            email_sop_approvals: preferences.email_sop_approvals
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        if (data) {
          setPreferences(data);
        }
      }
      
      setSuccessMessage('Notification preferences saved successfully');
    } catch (err) {
      console.error('Error saving notification preferences:', err);
      setError('Failed to save notification preferences');
    } finally {
      setIsSaving(false);
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
        <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center">
          <Bell className="h-5 w-5 mr-2" />
          Notification Settings
        </h3>
        
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
              <Check className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-2 text-sm text-green-700">{successMessage}</div>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-4">Email Notifications</h4>
            <p className="text-sm text-gray-500 mb-4">
              Choose which notifications you'd like to receive via email. You'll still receive all notifications in the app.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="email_mentions"
                    name="email_mentions"
                    type="checkbox"
                    checked={preferences.email_mentions}
                    onChange={(e) => setPreferences({ ...preferences, email_mentions: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="email_mentions" className="font-medium text-gray-700">@Mentions</label>
                  <p className="text-gray-500">Receive an email when someone mentions you in a comment</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="email_task_assignments"
                    name="email_task_assignments"
                    type="checkbox"
                    checked={preferences.email_task_assignments}
                    onChange={(e) => setPreferences({ ...preferences, email_task_assignments: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="email_task_assignments" className="font-medium text-gray-700">Task Assignments</label>
                  <p className="text-gray-500">Receive an email when a task is assigned to you</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="email_task_due_soon"
                    name="email_task_due_soon"
                    type="checkbox"
                    checked={preferences.email_task_due_soon}
                    onChange={(e) => setPreferences({ ...preferences, email_task_due_soon: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="email_task_due_soon" className="font-medium text-gray-700">Task Due Soon</label>
                  <p className="text-gray-500">Receive an email when a task assigned to you is due soon</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="email_sop_approvals"
                    name="email_sop_approvals"
                    type="checkbox"
                    checked={preferences.email_sop_approvals}
                    onChange={(e) => setPreferences({ ...preferences, email_sop_approvals: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="email_sop_approvals" className="font-medium text-gray-700">SOP Approvals</label>
                  <p className="text-gray-500">Receive an email when a SOP is approved</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {showPreview ? 'Hide email preview' : 'Show email preview'}
            </button>
            
            {showPreview && (
              <div className="mt-4">
                <NotificationEmailPreview />
              </div>
            )}
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
                  <Check className="h-4 w-4 inline-block mr-1" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}