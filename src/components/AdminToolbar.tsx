import React, { useState } from 'react';
import { PenTool as Tool, AlertCircle, X, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { ErrorLogViewer } from './ErrorLogViewer';
import { checkAllErrors, fixAllErrors, markAllErrorLogsAsFixed } from '../lib/errorLogChecker';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

export function AdminToolbar() {
  const { role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState<number | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Only system admins can see the admin toolbar
  if (role !== 'system_admin') {
    return null;
  }

  const handleCheckErrors = async () => {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Checking for system errors',
        {}
      );
      
      const checkResults = await checkAllErrors();
      
      if (checkResults.hasErrors) {
        // Count the total number of errors
        let count = 0;
        
        if (checkResults.errorDetails.errorLogs) {
          count += checkResults.errorDetails.errorLogs.length;
        }
        
        if (checkResults.errorDetails.emailErrorLogs) {
          count += checkResults.errorDetails.emailErrorLogs.length;
        }
        
        if (checkResults.errorDetails.taskCommentErrors.hasErrors) {
          count += 1;
        }
        
        if (checkResults.errorDetails.emailNotificationErrors.hasErrors) {
          count += 1;
        }
        
        if (checkResults.errorDetails.databaseSchemaErrors.hasErrors) {
          count += 1;
        }
        
        setErrorCount(count);
        
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.SYSTEM,
          'System errors detected',
          { errorCount: count, details: checkResults.errorSummary }
        );
      } else {
        setErrorCount(0);
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.SYSTEM,
          'No system errors detected',
          {}
        );
      }
    } catch (err) {
      console.error('Error checking for errors:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error checking for system errors',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFix = async () => {
    try {
      setIsFixing(true);
      setSuccessMessage(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Attempting quick fix of system errors',
        {}
      );
      
      const results = await fixAllErrors();
      
      if (results.success) {
        setErrorCount(0);
        setSuccessMessage('All errors were successfully fixed');
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.SYSTEM,
          'Successfully fixed all errors',
          { results }
        );
      } else {
        // Recheck errors
        await handleCheckErrors();
        
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.SYSTEM,
          'Some errors were fixed, but others require manual intervention',
          { results }
        );
      }
    } catch (err) {
      console.error('Error fixing errors:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error fixing system errors',
        { error: err }
      );
    } finally {
      setIsFixing(false);
    }
  };

  const handleCleanupAllErrors = async () => {
    try {
      setIsFixing(true);
      setSuccessMessage(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Cleaning up all error logs',
        {}
      );
      
      // Mark all error logs as fixed
      const success = await markAllErrorLogsAsFixed();
      
      if (success) {
        setErrorCount(0);
        setSuccessMessage('All error logs have been cleaned up successfully');
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.SYSTEM,
          'Successfully cleaned up all error logs',
          {}
        );
      } else {
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.SYSTEM,
          'Some error logs could not be cleaned up',
          {}
        );
      }
      
      // Recheck errors
      await handleCheckErrors();
      
    } catch (err) {
      console.error('Error cleaning up errors:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Error cleaning up error logs',
        { error: err }
      );
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => {
            if (!isOpen) {
              handleCheckErrors();
            }
            setIsOpen(!isOpen);
          }}
          className="p-3 rounded-full shadow-lg text-white relative"
          style={{ backgroundColor: primaryColor }}
          title="Admin Tools"
        >
          <Tool className="h-5 w-5" />
          
          {errorCount !== null && errorCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {errorCount > 9 ? '9+' : errorCount}
            </span>
          )}
        </button>
      </div>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                        <Tool className="h-5 w-5 mr-2" />
                        Admin Tools
                      </h3>
                      <button
                        onClick={() => setIsOpen(false)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <button
                            onClick={handleCheckErrors}
                            disabled={isLoading}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            {isLoading ? (
                              <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Check for Errors
                          </button>
                          
                          {errorCount !== null && errorCount > 0 && (
                            <>
                              <button
                                onClick={handleQuickFix}
                                disabled={isFixing}
                                className="ml-2 inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white"
                                style={{ backgroundColor: primaryColor }}
                              >
                                {isFixing ? (
                                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                                ) : (
                                  <Tool className="h-4 w-4 mr-2" />
                                )}
                                Quick Fix
                              </button>
                              
                              <button
                                onClick={handleCleanupAllErrors}
                                disabled={isFixing}
                                className="ml-2 inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                              >
                                {isFixing ? (
                                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                                ) : (
                                  <X className="h-4 w-4 mr-2" />
                                )}
                                Clean Up All Errors
                              </button>
                            </>
                          )}
                        </div>
                        
                        {errorCount !== null && (
                          <div className="flex items-center">
                            {errorCount > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {errorCount} {errorCount === 1 ? 'error' : 'errors'} found
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                No errors found
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {successMessage && (
                        <div className="mb-4 rounded-md bg-green-50 p-4">
                          <div className="flex">
                            <div className="ml-3">
                              <p className="text-sm font-medium text-green-800">
                                {successMessage}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <ErrorLogViewer />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}