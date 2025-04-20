import React, { useState, useEffect } from 'react';
import { 
  fetchErrorLogs, 
  fetchEmailErrorLogs, 
  updateErrorLogStatus,
  checkAllErrors,
  fixAllErrors,
  ErrorLog
} from '../lib/errorLogChecker';
import { AlertCircle, CheckCircle, RefreshCw, Search, Filter, ChevronDown, ChevronUp, X, PenTool as Tool, Clock, Check, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { format } from 'date-fns';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface ErrorLogViewerProps {
  onClose?: () => void;
}

export function ErrorLogViewer({ onClose }: ErrorLogViewerProps) {
  const { systemSettings } = useAppContext();
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [emailErrorLogs, setEmailErrorLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [systemCheck, setSystemCheck] = useState<any | null>(null);
  const [fixResults, setFixResults] = useState<any | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      // Fetch error logs
      const logs = await fetchErrorLogs(100);
      setErrorLogs(logs);
      
      // Fetch email error logs
      const emailLogs = await fetchEmailErrorLogs(20);
      setEmailErrorLogs(emailLogs);
      
      // Check for system errors
      const checkResults = await checkAllErrors();
      setSystemCheck(checkResults);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Fetched error logs',
        { 
          errorCount: logs.length, 
          emailErrorCount: emailLogs.length,
          systemHasErrors: checkResults.hasErrors
        }
      );
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to load error logs');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error fetching error logs',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixAllErrors = async () => {
    try {
      setIsFixing(true);
      setError(null);
      setSuccessMessage(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Attempting to fix all errors',
        {}
      );
      
      const results = await fixAllErrors();
      setFixResults(results);
      
      if (results.success) {
        setSuccessMessage('All errors were successfully fixed');
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.SYSTEM,
          'Successfully fixed all errors',
          { results }
        );
      } else {
        setError('Some errors were fixed, but others require manual intervention');
        
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.SYSTEM,
          'Fixed some errors, but others require manual intervention',
          { results }
        );
      }
      
      // Refresh logs
      await fetchLogs();
    } catch (err) {
      console.error('Error fixing all errors:', err);
      setError('Failed to fix errors');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error fixing all errors',
        { error: err }
      );
    } finally {
      setIsFixing(false);
    }
  };

  const handleUpdateLogStatus = async (id: string, status: 'reviewed' | 'fixed' | 'ignored', notes?: string) => {
    try {
      const success = await updateErrorLogStatus(id, status, notes);
      
      if (success) {
        // Update local state
        setErrorLogs(prevLogs => 
          prevLogs.map(log => 
            log.id === id ? { ...log, status, notes } : log
          )
        );
        
        setSuccessMessage(`Log marked as ${status}`);
        
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.SYSTEM,
          `Error log marked as ${status}`,
          { id, notes }
        );
      } else {
        setError(`Failed to update log status to ${status}`);
      }
    } catch (err) {
      console.error('Error updating log status:', err);
      setError('Failed to update log status');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error updating log status',
        { error: err, id }
      );
    }
  };

  const filteredLogs = errorLogs.filter(log => {
    // Apply search filter
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Apply status filter
    const matchesStatus = statusFilter === null || log.status === statusFilter;
    
    // Apply type filter
    const matchesType = typeFilter === null || log.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            New
          </span>
        );
      case 'reviewed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Reviewed
          </span>
        );
      case 'fixed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" />
            Fixed
          </span>
        );
      case 'ignored':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <X className="h-3 w-3 mr-1" />
            Ignored
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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'API_CALL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            API Call
          </span>
        );
      case 'AUTH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Auth
          </span>
        );
      case 'NAVIGATION':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            Navigation
          </span>
        );
      case 'COMPONENT_RENDER':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
            Component
          </span>
        );
      case 'SYSTEM':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            System
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {type}
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
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            Error Log Viewer
          </h3>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchLogs}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        
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
        
        {/* System Check Results */}
        {systemCheck && (
          <div className={`mt-4 rounded-md p-4 ${systemCheck.hasErrors ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <div className="flex">
              {systemCheck.hasErrors ? (
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-400" />
              )}
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-800">System Check</h3>
                <div className="mt-2 text-sm whitespace-pre-line">
                  {systemCheck.errorSummary}
                </div>
                
                {systemCheck.hasErrors && (
                  <div className="mt-4">
                    <button
                      onClick={handleFixAllErrors}
                      disabled={isFixing}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isFixing ? (
                        <>
                          <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                          Fixing Errors...
                        </>
                      ) : (
                        <>
                          <Tool className="h-4 w-4 mr-2" />
                          Fix All Errors
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {fixResults && (
                  <div className="mt-4 text-sm">
                    <h4 className="font-medium">Fix Results:</h4>
                    <ul className="mt-2 list-disc list-inside">
                      {Object.entries(fixResults.details).map(([key, value]: [string, any]) => (
                        <li key={key} className={value.success ? 'text-green-700' : 'text-red-700'}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {value.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-md border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Search errors..."
              />
            </div>
            
            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="fixed">Fixed</option>
              <option value="ignored">Ignored</option>
            </select>
            
            <select
              value={typeFilter || ''}
              onChange={(e) => setTypeFilter(e.target.value || null)}
              className="rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Types</option>
              <option value="API_CALL">API Call</option>
              <option value="AUTH">Auth</option>
              <option value="NAVIGATION">Navigation</option>
              <option value="COMPONENT_RENDER">Component</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'error' : 'errors'}
            </span>
            
            {(searchTerm || statusFilter || typeFilter) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter(null);
                  setTypeFilter(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        
        {/* Error Logs */}
        <div className="mt-6 space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No error logs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter || typeFilter
                  ? 'Try adjusting your search filters'
                  : 'No errors have been logged in the system'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Error
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Time
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                          <div className="font-medium text-gray-900 max-w-xs truncate">
                            {log.message}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {getTypeBadge(log.type)}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {format(log.timestamp, 'MMM d, h:mm a')}
                        </td>
                        <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="text-blue-600 hover:text-blue-900"
                            style={{ color: primaryColor }}
                          >
                            {expandedLogId === log.id ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded details */}
                      {expandedLogId === log.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-900">Details</h4>
                                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                              
                              {log.notes && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900">Notes</h4>
                                  <p className="mt-1 text-sm text-gray-500">{log.notes}</p>
                                </div>
                              )}
                              
                              <div className="flex space-x-2">
                                {log.status === 'new' && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateLogStatus(log.id, 'reviewed', 'Reviewed by admin')}
                                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                      Mark as Reviewed
                                    </button>
                                    <button
                                      onClick={() => handleUpdateLogStatus(log.id, 'fixed', 'Fixed by admin')}
                                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      Mark as Fixed
                                    </button>
                                    <button
                                      onClick={() => handleUpdateLogStatus(log.id, 'ignored', 'Ignored by admin')}
                                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                      Ignore
                                    </button>
                                  </>
                                )}
                                
                                {log.status !== 'new' && (
                                  <button
                                    onClick={() => handleUpdateLogStatus(log.id, 'new', 'Reopened by admin')}
                                    className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                  >
                                    Reopen
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Email Error Logs */}
        {emailErrorLogs.length > 0 && (
          <div className="mt-8">
            <h4 className="text-base font-medium text-gray-900 mb-4">Email Error Logs</h4>
            
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      To
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Subject
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Error
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {emailErrorLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                        <div className="font-medium text-gray-900">
                          {log.to_email}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {log.subject}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        <div className="max-w-xs truncate">
                          {typeof log.response === 'string' 
                            ? log.response 
                            : JSON.stringify(log.response)}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}