import React, { useEffect, useState } from 'react';
import { useLoadingTimeout } from '../lib/errorHandlers';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface LoadingTimeoutProps {
  children: React.ReactNode;
  timeout?: number;
  message?: string;
  isLoading: boolean;
}

export function LoadingTimeout({ 
  children, 
  timeout = 30000, 
  message = "Loading is taking longer than expected...",
  isLoading 
}: LoadingTimeoutProps) {
  const [showTimeout, setShowTimeout] = useState(false);
  const { startLoadingTimeout } = useLoadingTimeout(timeout);
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  
  useEffect(() => {
    let timeoutCleanup: (() => void) | undefined;
    
    if (isLoading) {
      // Start a timer to show the timeout message
      const messageTimer = setTimeout(() => {
        setShowTimeout(true);
        
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.SYSTEM,
          'Loading is taking longer than expected',
          { timeout: `${timeout}ms` }
        );
      }, timeout / 2); // Show message halfway through timeout
      
      // Start the actual timeout that will log out the user
      timeoutCleanup = startLoadingTimeout();
      
      return () => {
        clearTimeout(messageTimer);
        if (timeoutCleanup) timeoutCleanup();
      };
    } else {
      // Reset the timeout message when loading completes
      setShowTimeout(false);
      
      // Clear any existing timeout
      if (timeoutCleanup) timeoutCleanup();
    }
    
    return () => {
      if (timeoutCleanup) timeoutCleanup();
    };
  }, [isLoading, timeout]);
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  const handleSignOut = () => {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User signed out from loading timeout',
      {}
    );
    
    logout();
    navigate('/');
  };
  
  return (
    <>
      {children}
      
      {showTimeout && isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-yellow-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Loading Timeout</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              {message} This could be due to a slow connection or a server issue.
            </p>
            
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleRefresh}
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Refresh Page
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}