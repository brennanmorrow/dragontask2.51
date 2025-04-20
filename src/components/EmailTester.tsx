import React, { useState, useEffect } from 'react';
import { Mail, Send, Check, AlertCircle, RefreshCw, FileText, User, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../lib/AppContext';
import { sendTestEmail, getEmailSettings, sendTemplateEmail, processEmailNotifications } from '../lib/emailService';
import { getEmailTemplateByName, ensureDefaultEmailTemplates } from '../lib/emailTemplates';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  description: string;
  variables: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function EmailTester() {
  const { systemSettings } = useAppContext();
  const [testEmail, setTestEmail] = useState('brennan@solatubebend.com');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [emailSettings, setEmailSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Array<{
    template: string;
    timestamp: string;
    status: 'success' | 'error';
    message?: string;
  }>>([]);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Ensure default templates exist
      await ensureDefaultEmailTemplates();
      
      // Fetch email settings
      const settings = await getEmailSettings();
      setEmailSettings(settings);
      
      // Fetch email templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');
      
      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);
      
      // Fetch recent email logs
      const { data: logsData, error: logsError } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (logsError) throw logsError;
      setRecentLogs(logsData || []);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Email tester data loaded',
        { 
          hasSettings: !!settings,
          templateCount: templatesData?.length || 0,
          logCount: logsData?.length || 0
        }
      );
    } catch (err) {
      console.error('Error fetching email data:', err);
      setError('Failed to load email data');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error loading email tester data',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      setError('Please enter a test email address');
      return;
    }
    
    setIsSending(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Sending test email',
        { to: testEmail }
      );
      
      let result;
      
      if (selectedTemplate) {
        // Send template email
        const template = templates.find(t => t.id === selectedTemplate);
        if (!template) {
          throw new Error('Selected template not found');
        }
        
        // Prepare variables
        const variables: Record<string, string> = {
          ...templateVariables,
          userName: templateVariables.userName || testEmail.split('@')[0],
          userEmail: templateVariables.userEmail || testEmail,
        };
        
        // Add default values for missing variables
        template.variables.forEach(varName => {
          if (!variables[varName]) {
            variables[varName] = `[${varName}]`;
          }
        });
        
        result = await sendTemplateEmail(
          template.name as any,
          testEmail,
          variables
        );
        
        // Record test result
        setTestResults(prev => [
          {
            template: template.name,
            timestamp: new Date().toISOString(),
            status: result.success ? 'success' : 'error',
            message: result.success ? undefined : result.message
          },
          ...prev
        ]);
      } else {
        // Send simple test email
        result = await sendTestEmail(testEmail);
        
        // Record test result
        setTestResults(prev => [
          {
            template: 'Basic Test Email',
            timestamp: new Date().toISOString(),
            status: result.success ? 'success' : 'error',
            message: result.success ? undefined : result.message
          },
          ...prev
        ]);
      }
      
      if (result.success) {
        setSuccessMessage(`Test email sent to ${testEmail}`);
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.SYSTEM,
          'Test email sent successfully',
          { to: testEmail, template: selectedTemplate || 'basic' }
        );
        
        // Refresh logs
        await fetchData();
      } else {
        setError(result.message || 'Failed to send test email');
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.SYSTEM,
          'Error sending test email',
          { error: result.message, to: testEmail }
        );
      }
    } catch (err) {
      console.error('Error sending test email:', err);
      setError('An error occurred while sending test email');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Exception sending test email',
        { error: err, to: testEmail }
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleProcessNotifications = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Processing pending notification emails',
        {}
      );
      
      await processEmailNotifications();
      
      setSuccessMessage('Notification emails processed successfully');
      
      // Refresh logs
      await fetchData();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.SYSTEM,
        'Notification emails processed successfully',
        {}
      );
    } catch (err) {
      console.error('Error processing notification emails:', err);
      setError('An error occurred while processing notification emails');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error processing notification emails',
        { error: err }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Reset variables
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const newVariables: Record<string, string> = {};
      template.variables.forEach(varName => {
        // Keep existing values if they exist
        newVariables[varName] = templateVariables[varName] || '';
      });
      setTemplateVariables(newVariables);
    } else {
      setTemplateVariables({});
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" />
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
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
          <Mail className="h-5 w-5 mr-2" />
          Email System Tester
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
        
        <div className="mt-5 space-y-6">
          {/* Email Settings Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Email Settings Status</h4>
            <div className="flex items-center">
              <div className={`h-3 w-3 rounded-full mr-2 ${emailSettings?.apiKey ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-700">
                {emailSettings?.apiKey 
                  ? 'Email API key is configured' 
                  : 'Email API key is not configured'}
              </span>
            </div>
            <div className="flex items-center mt-2">
              <div className={`h-3 w-3 rounded-full mr-2 ${emailSettings?.domain ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-700">
                {emailSettings?.domain 
                  ? `Email domain is configured: ${emailSettings.domain}` 
                  : 'Email domain is not configured'}
              </span>
            </div>
            <div className="flex items-center mt-2">
              <div className={`h-3 w-3 rounded-full mr-2 ${emailSettings?.fromEmail ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-700">
                {emailSettings?.fromEmail 
                  ? `From email is configured: ${emailSettings.fromEmail}` 
                  : 'From email is not configured'}
              </span>
            </div>
            
            {!emailSettings?.apiKey && (
              <div className="mt-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 inline-block mr-1" />
                Please configure email settings in the Settings page before testing.
              </div>
            )}
          </div>
          
          {/* Test Email Form */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Send Test Email</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
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
              
              <div>
                <label htmlFor="template" className="block text-sm font-medium text-gray-700">
                  Email Template (Optional)
                </label>
                <select
                  id="template"
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Simple Test Email</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Template Variables */}
            {selectedTemplate && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Template Variables</h5>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.find(t => t.id === selectedTemplate)?.variables.map(varName => (
                    <div key={varName}>
                      <label htmlFor={`var-${varName}`} className="block text-sm font-medium text-gray-700">
                        {varName}
                      </label>
                      <input
                        type="text"
                        id={`var-${varName}`}
                        value={templateVariables[varName] || ''}
                        onChange={(e) => setTemplateVariables({
                          ...templateVariables,
                          [varName]: e.target.value
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder={`Enter ${varName}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-4 flex space-x-4">
              <button
                onClick={handleSendTestEmail}
                disabled={isSending || !testEmail || !emailSettings?.apiKey}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
                style={{ 
                  backgroundColor: primaryColor,
                  opacity: isSending || !testEmail || !emailSettings?.apiKey ? 0.5 : 1 
                }}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </button>
              
              <button
                onClick={handleProcessNotifications}
                disabled={isProcessing || !emailSettings?.apiKey}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Process Notification Emails
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Test Results */}
          {testResults.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Test Results</h4>
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Template</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Timestamp</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {testResults.map((result, index) => (
                      <tr key={index}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{result.template}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(result.timestamp).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {result.status === 'success' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Check className="h-3 w-3 mr-1" />
                              Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{result.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Recent Email Logs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Recent Email Logs</h4>
              <button
                onClick={fetchData}
                className="text-sm text-blue-600 hover:text-blue-500 flex items-center"
                style={{ color: primaryColor }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </button>
            </div>
            
            {recentLogs.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <Mail className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="mt-2 text-sm text-gray-500">No email logs found</p>
              </div>
            ) : (
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:pl-6">
                        Date
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        To
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.to_email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {log.subject}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getStatusBadge(log.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Email Templates */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Available Email Templates</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map(template => (
                <div key={template.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center mb-2">
                    <FileText className="h-4 w-4 text-gray-500 mr-2" />
                    <h5 className="text-sm font-medium text-gray-900">{template.name}</h5>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{template.description}</p>
                  <div className="text-xs text-gray-500">
                    <strong>Variables:</strong> {template.variables.join(', ')}
                  </div>
                  <button
                    onClick={() => handleTemplateChange(template.id)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-500"
                    style={{ color: primaryColor }}
                  >
                    Use this template
                  </button>
                </div>
              ))}
              
              {templates.length === 0 && (
                <div className="col-span-full p-4 text-center bg-gray-50 rounded-lg">
                  <FileText className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="mt-2 text-sm text-gray-500">No email templates found</p>
                  <button 
                    onClick={async () => {
                      await ensureDefaultEmailTemplates();
                      await fetchData();
                    }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500"
                    style={{ color: primaryColor }}
                  >
                    Create Default Templates
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Password Reset Test */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Test Password Reset Flow</h4>
            <p className="text-sm text-gray-500 mb-4">
              To test the password reset flow, use the "Forgot your password?" link on the login page.
              This will trigger the password reset email through Supabase Auth.
            </p>
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 pt-0.5">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> Password reset emails are sent directly by Supabase Auth, not through our custom email system.
                  However, we can customize the email template in the Supabase dashboard.
                </p>
              </div>
            </div>
          </div>
          
          {/* Welcome Email Test */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Test Welcome Email Flow</h4>
            <p className="text-sm text-gray-500 mb-4">
              To test the welcome email flow, create a new user in the Users section.
              This will trigger the welcome email through our custom email system.
            </p>
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 pt-0.5">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> Welcome emails are sent through our custom email system when a new user is created.
                  You can customize the template in the Email Templates section of the Settings page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}