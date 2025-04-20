import React, { useState, useEffect } from 'react';
import { getEmailTemplateByName } from '../lib/emailTemplates';
import { useAppContext } from '../lib/AppContext';
import { AlertCircle } from 'lucide-react';

interface NotificationEmailPreviewProps {
  notificationType?: string;
  notificationTitle?: string;
  notificationContent?: string;
  userName?: string;
  mentionedBy?: string;
  clientName?: string;
}

export function NotificationEmailPreview({ 
  notificationType = 'Task Mention',
  notificationTitle = 'You were mentioned in a comment on task "Complete Project Proposal"',
  notificationContent = 'Hey @john.doe@example.com, could you please review this task when you get a chance?',
  userName = 'John Doe',
  mentionedBy = 'Jane Smith',
  clientName = 'ACME Corporation'
}: NotificationEmailPreviewProps) {
  const { systemSettings } = useAppContext();
  const [template, setTemplate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const logoUrl = systemSettings?.logo_url || '';
  const companyName = systemSettings?.name || 'DragonTask';

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setIsLoading(true);
        const emailTemplate = await getEmailTemplateByName('Notification');
        
        if (!emailTemplate) {
          throw new Error('Notification email template not found');
        }
        
        // Replace variables
        let html = emailTemplate.html;
        
        // Add logo if available
        if (logoUrl) {
          html = html.replace(
            /<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">/,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${logoUrl}" alt="${companyName}" style="max-width: 150px; max-height: 80px;">
              </div>`
          );
        }
        
        // Replace company name
        html = html.replace(/DragonTask/g, companyName);
        
        // Replace colors
        html = html.replace(/#3B82F6/g, primaryColor);
        
        // Replace variables
        html = html
          .replace(/\{\{userName\}\}/g, userName)
          .replace(/\{\{notificationType\}\}/g, notificationType)
          .replace(/\{\{notificationTitle\}\}/g, notificationTitle)
          .replace(/\{\{notificationContent\}\}/g, notificationContent)
          .replace(/\{\{actionUrl\}\}/g, 'https://example.com/tasks/123');
        
        // Handle conditional variables
        if (mentionedBy) {
          html = html.replace(/\{\{#if mentionedBy\}\}(.*?)\{\{\/if\}\}/s, `$1`);
          html = html.replace(/\{\{mentionedBy\}\}/g, mentionedBy);
        } else {
          html = html.replace(/\{\{#if mentionedBy\}\}(.*?)\{\{\/if\}\}/s, '');
        }
        
        if (clientName) {
          html = html.replace(/\{\{#if clientName\}\}(.*?)\{\{\/if\}\}/s, `$1`);
          html = html.replace(/\{\{clientName\}\}/g, clientName);
        } else {
          html = html.replace(/\{\{#if clientName\}\}(.*?)\{\{\/if\}\}/s, '');
        }
        
        setTemplate(html);
      } catch (err) {
        console.error('Error fetching notification email template:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTemplate();
  }, [logoUrl, companyName, primaryColor, userName, notificationType, notificationTitle, notificationContent, mentionedBy, clientName]);

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
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b">
        <h4 className="text-sm font-medium text-gray-700">Notification Email Preview</h4>
      </div>
      <div className="p-4 bg-white">
        <div className="mb-2">
          <span className="text-sm font-medium text-gray-700">Subject: </span>
          <span className="text-sm text-gray-900">{notificationType}: {notificationTitle}</span>
        </div>
        <div className="border rounded-md p-4">
          {template ? (
            <div dangerouslySetInnerHTML={{ __html: template }} />
          ) : (
            <p className="text-gray-500">No template available</p>
          )}
        </div>
      </div>
    </div>
  );
}