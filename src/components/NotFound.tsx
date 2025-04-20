import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home, LogOut } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';
import { useAppContext } from '../lib/AppContext';

export function NotFound() {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { systemSettings } = useAppContext();
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  
  useEffect(() => {
    // Log the 404 error
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.NAVIGATION,
      'Page not found (404)',
      { path: window.location.pathname, isAuthenticated: !!user }
    );
  }, []);
  
  const handleGoHome = () => {
    navigate('/');
  };
  
  const handleSignOut = () => {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User signed out from 404 page',
      {}
    );
    
    logout();
    navigate('/');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
          <FileQuestion className="h-12 w-12 text-gray-400" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Page Not Found
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          We couldn't find the page you're looking for.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleGoHome}
              className="flex w-full justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ 
                backgroundColor: primaryColor,
                '&:hover': { filter: 'brightness(90%)' }
              }}
            >
              <Home className="h-5 w-5 mr-2" />
              Go to Home
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
    </div>
  );
}