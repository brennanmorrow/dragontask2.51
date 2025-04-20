import React, { useState } from 'react';
import { SopAccessLevelTest } from './SopAccessLevelTest';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

/**
 * Test Runner for SOP Access Level Change Tests
 * 
 * This component provides a UI for running the SOP Access Level Change tests
 * and viewing the results.
 */
export function SopAccessLevelTestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'pending';
    message?: string;
    timestamp: Date;
  }>>([]);

  const runTests = () => {
    setIsRunning(true);
    
    // Log test start
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'Starting SOP Access Level Change tests',
      {}
    );
    
    // Add initial test result
    setTestResults([
      {
        id: 'test-modal-close',
        name: 'Modal Close After Save',
        status: 'pending',
        timestamp: new Date()
      }
    ]);
  };

  const handleTestComplete = (testId: string, passed: boolean, message?: string) => {
    setTestResults(prev => 
      prev.map(test => 
        test.id === testId 
          ? { 
              ...test, 
              status: passed ? 'passed' : 'failed',
              message
            } 
          : test
      )
    );
    
    // Log test completion
    logDebugEvent(
      passed ? DebugLevel.SUCCESS : DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      `Test ${testId} ${passed ? 'passed' : 'failed'}`,
      { message }
    );
    
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900">SOP Access Level Change Test Runner</h2>
        
        <div className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <button
              onClick={runTests}
              disabled={isRunning}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </button>
            
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">Status:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isRunning ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {isRunning ? 'Running' : 'Ready'}
              </span>
            </div>
          </div>
          
          {testResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700">Test Results</h3>
              <div className="mt-2 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Test Name</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Message</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {testResults.map((result) => (
                      <tr key={result.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{result.name}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            result.status === 'passed' ? 'bg-green-100 text-green-800' :
                            result.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {result.status === 'passed' ? 'Passed' :
                             result.status === 'failed' ? 'Failed' :
                             'Pending'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{result.message || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {result.timestamp.toLocaleTimeString()}
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
      
      {isRunning && (
        <SopAccessLevelTest />
      )}
    </div>
  );
}