import React from 'react';
import { SopAccessLevelTestRunner } from '../tests/SopAccessLevelTestRunner';
import { useAuthStore } from '../lib/store';
import { AlertCircle } from 'lucide-react';

/**
 * Test Runner Page
 * 
 * This page provides access to various test runners for different components
 * and features of the application.
 */
export function TestRunner() {
  const { role } = useAuthStore();
  
  // Only system admins can access the test runner
  const canAccessTests = role === 'system_admin';
  
  if (!canAccessTests) {
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
                Only system administrators can access the test runner.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Test Runner
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Run tests to verify system functionality
          </p>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900">Available Tests</h3>
        
        <div className="mt-4 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-base font-medium text-gray-900">SOP Access Level Change Test</h4>
            <p className="mt-1 text-sm text-gray-500">
              Tests that the SOP Access Level Change popup window closes correctly after modifying an SOP's access level.
            </p>
            <div className="mt-4">
              <SopAccessLevelTestRunner />
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900">Test Environment Information</h3>
        
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700">Browser</h4>
            <p className="mt-1 text-sm text-gray-900">{navigator.userAgent}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700">Screen Resolution</h4>
            <p className="mt-1 text-sm text-gray-900">{window.innerWidth} x {window.innerHeight}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700">User Role</h4>
            <p className="mt-1 text-sm text-gray-900">{role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}