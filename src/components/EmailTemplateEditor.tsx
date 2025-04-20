import React, { useState, useEffect } from 'react';
import { Save, X, RefreshCw, AlertCircle, CheckCircle, Mail, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../lib/AppContext';
import { RichTextEditor } from './RichTextEditor';
import { sendTemplateEmail } from '../lib/emailService';
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

interface EmailTemplateEditorProps {
  onClose?: () => void;
}

export function EmailTemplateEditor({ onClose }: EmailTemplateEditorProps) {
  const { systemSettings } = useAppContext();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedHtml, setEditedHtml] = useState('');
  const [editedText, setEditedText] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [testEmail, setTestEmail] = useState('brennan@solatubebend.com');
  const [showTestEmailForm, setShowTestEmailForm] = useState(false);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const logoUrl = systemSettings?.logo_url || '';

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      setEditedSubject(selectedTemplate.subject);
      setEditedHtml(selectedTemplate.html);
      setEditedText(selectedTemplate.text);
      
      // Initialize test variables
      const initialVariables: Record<string, string> = {};
      selectedTemplate.variables.forEach(variable => {
        // Set some default values for common variables
        if (variable === 'userName') initialVariables[variable] = 'John Doe';
        else if (variable === 'userEmail') initialVariables[variable] = 'john.doe@example.com';
        else if (variable === 'userRole') initialVariables[variable] = 'Client Admin';
        else if (variable === 'organization') initialVariables[variable] = 'ACME Corporation';
        else if (variable === 'taskTitle') initialVariables[variable] = 'Complete Project Proposal';
        else if (variable === 'sopTitle') initialVariables[variable] = 'Customer Onboarding Process';
        else initialVariables[variable] = `[${variable}]`;
      });
      setTestVariables(initialVariables);
    }
  }, [selectedTemplate]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      setTemplates(data || []);
      
      // Select the first template by default
      if (data && data.length > 0) {
        setSelectedTemplate(data[0]);
      }
    } catch (err) {
      console.error('Error fetching email templates:', err);
      setError('Failed to load email templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: editedSubject,
          html: editedHtml,
          text: editedText,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTemplate.id);
      
      if (error) throw error;
      
      setSuccessMessage('Template saved successfully');
      
      // Refresh the template list
      await fetchTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedTemplate) return;
    
    if (!confirm('Are you sure you want to reset this template to its default values? This cannot be undone.')) {
      return;
    }
    
    setIsResetting(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const { data, error } = await supabase
        .rpc('reset_email_template', {
          p_template_id: selectedTemplate.id
        });
      
      if (error) throw error;
      
      setSuccessMessage('Template reset to default values');
      
      // Refresh the template list
      await fetchTemplates();
    } catch (err) {
      console.error('Error resetting template:', err);
      setError('Failed to reset template');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!selectedTemplate || !testEmail || !systemSettings) return;
    
    setIsSendingTest(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'Sending test email for template',
        { templateName: selectedTemplate.name, to: testEmail }
      );
      
      // Send test email using the template
      const result = await sendTemplateEmail(
        selectedTemplate.name as any,
        testEmail,
        testVariables,
        systemSettings
      );
      
      if (result.success) {
        setSuccessMessage(`Test email sent successfully to ${testEmail}`);
        setShowTestEmailForm(false);
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.USER_ACTION,
          'Test email sent successfully',
          { templateName: selectedTemplate.name, to: testEmail, messageId: result.id }
        );
      } else {
        throw new Error(result.message || 'Failed to send test email');
      }
    } catch (err) {
      console.error('Error sending test email:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while sending test email');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error sending test email',
        { error: err, templateName: selectedTemplate.name, to: testEmail }
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  const renderVariableHelp = () => {
    if (!selectedTemplate) return null;
    
    return (
      <div className="bg-gray-50 p-4 rounded-md mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Available Variables</h4>
        <div className="grid grid-cols-2 gap-2">
          {selectedTemplate.variables.map(variable => (
            <div key={variable} className="text-xs bg-white p-2 rounded border border-gray-200">
              <code>{`{{${variable}}}`}</code>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Use these variables in your template. They will be replaced with actual values when the email is sent.
        </p>
      </div>
    );
  };

  const renderPreview = () => {
    if (!selectedTemplate) return null;
    
    // Replace variables with example values
    const previewData: Record<string, string> = {};
    selectedTemplate.variables.forEach(variable => {
      switch (variable) {
        case 'userName':
          previewData[variable] = 'John Doe';
          break;
        case 'userEmail':
          previewData[variable] = 'john.doe@example.com';
          break;
        case 'userRole':
          previewData[variable] = 'Client Admin';
          break;
        case 'organization':
          previewData[variable] = 'ACME Corporation';
          break;
        case 'taskTitle':
          previewData[variable] = 'Complete Project Proposal';
          break;
        case 'taskStatus':
          previewData[variable] = 'In Progress';
          break;
        case 'taskPriority':
          previewData[variable] = 'High';
          break;
        case 'taskDueDate':
          previewData[variable] = '2025-05-15';
          break;
        case 'taskDescription':
          previewData[variable] = 'This is a sample task description for the preview.';
          break;
        case 'assignedBy':
          previewData[variable] = 'Jane Smith';
          break;
        case 'sopTitle':
          previewData[variable] = 'Customer Onboarding Process';
          break;
        case 'sopVersion':
          previewData[variable] = '2.1';
          break;
        case 'approvedBy':
          previewData[variable] = 'Jane Smith';
          break;
        case 'approvalDate':
          previewData[variable] = '2025-05-10';
          break;
        default:
          previewData[variable] = `[${variable}]`;
      }
    });
    
    // Replace variables in the template
    let previewHtml = editedHtml;
    Object.entries(previewData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      previewHtml = previewHtml.replace(regex, value);
    });
    
    return (
      <div className="border rounded-md mt-4">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <h4 className="text-sm font-medium text-gray-700">Preview</h4>
        </div>
        <div className="p-4">
          <div className="mb-2">
            <span className="text-sm font-medium text-gray-700">Subject: </span>
            <span className="text-sm text-gray-900">{editedSubject}</span>
          </div>
          <div className="border rounded-md p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    );
  };

  const renderTestEmailForm = () => {
    if (!selectedTemplate) return null;
    
    return (
      <div className="border rounded-md mt-4 bg-gray-50">
        <div className="px-4 py-2 border-b flex justify-between items-center">
          <h4 className="text-sm font-medium text-gray-700">Send Test Email</h4>
          <button
            onClick={() => setShowTestEmailForm(false)}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <label htmlFor="test-email" className="block text-sm font-medium text-gray-700">
              Test Email Address
            </label>
            <input
              type="email"
              id="test-email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter email address"
              required
            />
          </div>
          
          {selectedTemplate.variables.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Template Variables</h5>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {selectedTemplate.variables.map(varName => (
                  <div key={varName}>
                    <label htmlFor={`var-${varName}`} className="block text-sm font-medium text-gray-700">
                      {varName}
                    </label>
                    <input
                      type="text"
                      id={`var-${varName}`}
                      value={testVariables[varName] || ''}
                      onChange={(e) => setTestVariables({
                        ...testVariables,
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
          
          <div className="flex justify-end">
            <button
              onClick={handleSendTestEmail}
              disabled={isSendingTest || !testEmail}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
              style={{ 
                backgroundColor: primaryColor,
                opacity: isSendingTest || !testEmail ? 0.5 : 1 
              }}
            >
              {isSendingTest ? (
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
          </div>
        </div>
      </div>
    );
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
          Email Templates
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
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-2 text-sm text-green-700">{successMessage}</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Template List */}
          <div className="lg:col-span-1">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Templates</h4>
            <div className="border rounded-md overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {templates.map(template => (
                  <li 
                    key={template.id}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedTemplate?.id === template.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-900">{template.name}</div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{template.description}</p>
                    </div>
                  </li>
                ))}
                {templates.length === 0 && (
                  <li className="px-4 py-3 text-sm text-gray-500">No templates found</li>
                )}
              </ul>
            </div>
          </div>
          
          {/* Template Editor */}
          <div className="lg:col-span-3">
            {selectedTemplate ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-700">{selectedTemplate.name}</h4>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode(!previewMode)}
                      className={`px-3 py-1 text-xs font-medium rounded-md ${
                        previewMode 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {previewMode ? 'Edit Mode' : 'Preview Mode'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTestEmailForm(!showTestEmailForm)}
                      className={`px-3 py-1 text-xs font-medium rounded-md ${
                        showTestEmailForm 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      <Send className="h-3 w-3 inline-block mr-1" />
                      Send Test
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isResetting}
                      className="px-3 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700 border border-gray-200"
                    >
                      {isResetting ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        'Reset to Default'
                      )}
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">{selectedTemplate.description}</p>
                
                {showTestEmailForm && renderTestEmailForm()}
                
                {previewMode ? (
                  renderPreview()
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                        Subject
                      </label>
                      <input
                        type="text"
                        id="subject"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Email subject"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="html" className="block text-sm font-medium text-gray-700">
                        HTML Content
                      </label>
                      <RichTextEditor
                        content={editedHtml}
                        onChange={setEditedHtml}
                        placeholder="HTML content of the email"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="text" className="block text-sm font-medium text-gray-700">
                        Plain Text Content
                      </label>
                      <textarea
                        id="text"
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        rows={6}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Plain text version of the email"
                      />
                    </div>
                    
                    {renderVariableHelp()}
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 mt-6">
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 inline-block mr-1" />
                      Close
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || previewMode}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
                    style={{ 
                      backgroundColor: primaryColor,
                      opacity: isSaving || previewMode ? 0.5 : 1 
                    }}
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
                        Save Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-md">
                <Mail className="h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Select a template to edit</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}