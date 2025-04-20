import React, { useState, useEffect } from 'react';
import { Send, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { sendTemplateEmail } from '../lib/emailService';
import { getEmailTemplateByName } from '../lib/emailTemplates';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface EmailTemplateTestFormProps {
  templateName: string;
  defaultVariables: Record<string, string>;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function EmailTemplateTestForm({ 
  templateName, 
  defaultVariables, 
  onSuccess, 
  onError 
}: EmailTemplateTestFormProps) {
  const { systemSettings } = useAppContext();
  const [testEmail, setTestEmail] = useState('brennan@solatubebend.com');
  const [variables, setVariables] = useState<Record<string, string>>(defaultVariables);
  const [templateVariableNames, setTemplateVariableNames] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    // Fetch template to get variable names
    const fetchTemplate = async () => {
      try {
        const template = await getEmailTemplateByName(templateName);
        if (template) {
          setTemplateVariableNames(template.variables);
          
          // Initialize any missing variables
          const newVariables = { ...variables };
          template.variables.forEach(varName => {
            if (!newVariables[varName]) {
              newVariables[varName] = '';
            }
          });
          setVariables(newVariables);
        }
      } catch (err) {
        console.error(`Error fetching template ${templateName}:`, err);
        setError(`Failed to load template: ${err instanceof Error ? err.message : 'Unknown error'}`);
        if (onError) onError(`Failed to load template: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    
    fetchTemplate();
  }, [templateName]);

  const handleSendTest = async () => {
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
        `Sending test ${templateName} email`,
        { to: testEmail, variables }
      );
      
      // Add company name if not provided
      const allVariables = {
        ...variables,
        companyName: variables.companyName || systemSettings?.name || 'DragonTask'
      };
      
      const result = await sendTemplateEmail(
        templateName as any,
        testEmail,
        allVariables
      );
      
      if (result.success) {
        setSuccessMessage(`Test email sent to ${testEmail}`);
        if (onSuccess) onSuccess();
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.SYSTEM,
          `Test ${templateName} email sent successfully`,
          { to: testEmail }
        );
      } else {
        setError(result.message || 'Failed to send test email');
        if (onError) onError(result.message || 'Failed to send test email');
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.SYSTEM,
          `Error sending test ${templateName} email`,
          { error: result.message, to: testEmail }
        );
      }
    } catch (err) {
      console.error('Error sending test email:', err);
      setError('An error occurred while sending test email');
      if (onError) onError('An error occurred while sending test email');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        `Exception sending test ${templateName} email`,
        { error: err, to: testEmail }
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
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
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">{successMessage}</div>
            </div>
          </div>
        </div>
      )}
      
      <div>
        <label htmlFor={`${templateName}-test-email`} className="block text-sm font-medium text-gray-700">
          Test Email Address
        </label>
        <input
          type="email"
          id={`${templateName}-test-email`}
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Enter email address"
          required
        />
      </div>
      
      {templateVariableNames.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Template Variables</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {templateVariableNames.map(varName => (
              <div key={varName}>
                <label htmlFor={`var-${varName}`} className="block text-sm font-medium text-gray-700">
                  {varName}
                </label>
                <input
                  type="text"
                  id={`var-${varName}`}
                  value={variables[varName] || ''}
                  onChange={(e) => setVariables({
                    ...variables,
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
          onClick={handleSendTest}
          disabled={isSending || !testEmail}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
          style={{ 
            backgroundColor: primaryColor,
            opacity: isSending || !testEmail ? 0.5 : 1 
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
      </div>
    </div>
  );
}