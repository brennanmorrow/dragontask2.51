import React, { useState, useEffect } from 'react';
import { EmailTester } from '../components/EmailTester';
import { useAuthStore } from '../lib/store';
import { AlertCircle, Mail, FileText, CheckCircle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { EmailTemplateTestPanel } from '../components/EmailTemplateTestPanel';
import { EmailLogs } from '../components/EmailLogs';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

export function EmailTesting() {
  const { role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [activeTab, setActiveTab] = useState<'tester' | 'templates' | 'logs'>('tester');
  const [testResults, setTestResults] = useState<Array<{
    template: string;
    timestamp: string;
    status: 'success' | 'error';
    message?: string;
  }>>([]);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    // Log page view
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.COMPONENT_RENDER,
      'Email Testing page loaded',
      { role }
    );
  }, []);

  // Only system admins can access this page
  if (role !== 'system_admin') {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Access Restricted</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Only system administrators can access the email testing page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleTestSuccess = (template: string) => {
    setTestResults(prev => [
      {
        template,
        timestamp: new Date().toISOString(),
        status: 'success'
      },
      ...prev
    ]);
  };

  const handleTestError = (template: string, message: string) => {
    setTestResults(prev => [
      {
        template,
        timestamp: new Date().toISOString(),
        status: 'error',
        message
      },
      ...prev
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Email System Testing
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Test and debug the email system functionality
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tester')}
            className={`${
              activeTab === 'tester'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'tester' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Tester
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`${
              activeTab === 'templates'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'templates' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <FileText className="h-4 w-4 mr-2" />
            Template Testing
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`${
              activeTab === 'logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'logs' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <FileText className="h-4 w-4 mr-2" />
            Email Logs
          </button>
        </nav>
      </div>

      {activeTab === 'tester' && <EmailTester />}
      
      {activeTab === 'templates' && (
        <div className="space-y-8">
          <EmailTemplateTestPanel />
          
          {testResults.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Test Results</h3>
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
                              <CheckCircle className="h-3 w-3 mr-1" />
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
        </div>
      )}
      
      {activeTab === 'logs' && <EmailLogs />}
    </div>
  );
}