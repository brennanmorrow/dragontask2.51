import React, { useState, useEffect } from 'react';
import { SopAccessLevelChanger } from '../components/SopAccessLevelChanger';
import { SopAccessLevel } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

/**
 * Test component for SOP Access Level Changer
 * 
 * This component is used to test the SOP Access Level Changer functionality
 * in isolation from the rest of the application.
 * 
 * Test Steps:
 * 1. Log in as a user with permissions to modify SOP access levels
 * 2. Navigate to the SOP management section
 * 3. Select an existing SOP
 * 4. Click the "Change Access Level" button
 * 5. In the popup window, select a different access level
 * 6. Click "Save" or "Apply" to confirm the change
 * 
 * Expected Result:
 * - The Change Access Level popup window should automatically close
 * - The new access level should be reflected in the SOP details
 * - The main SOP management interface should be visible and accessible
 */
export function SopAccessLevelTest() {
  const { user, role } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testSopId, setTestSopId] = useState<string | null>(null);
  const [currentAccessLevel, setCurrentAccessLevel] = useState<SopAccessLevel>('client');
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch a test SOP to use for the test
  useEffect(() => {
    const fetchTestSop = async () => {
      try {
        setIsLoading(true);
        
        // Get a SOP that the current user has access to
        const { data, error } = await supabase
          .from('sops')
          .select('id, access_level, client_id, agency_id, system_id')
          .limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const sop = data[0];
          setTestSopId(sop.id);
          setCurrentAccessLevel(sop.access_level);
          
          // Set the current entity ID based on access level
          if (sop.access_level === 'client') {
            setCurrentEntityId(sop.client_id);
          } else if (sop.access_level === 'agency') {
            setCurrentEntityId(sop.agency_id);
          } else if (sop.access_level === 'system') {
            setCurrentEntityId(sop.system_id);
          }
          
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.SYSTEM,
            'Test SOP fetched successfully',
            { sopId: sop.id, accessLevel: sop.access_level }
          );
        } else {
          setTestResult({
            success: false,
            message: 'No SOPs found for testing. Please create a SOP first.'
          });
        }
      } catch (err) {
        console.error('Error fetching test SOP:', err);
        setTestResult({
          success: false,
          message: 'Error fetching test SOP',
          details: err
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchTestSop();
    }
  }, [user]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Test: Opening SOP Access Level Changer modal',
      { sopId: testSopId }
    );
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Test: Closing SOP Access Level Changer modal',
      { sopId: testSopId }
    );
    
    // Record test result for modal closing
    setTestResult({
      success: true,
      message: 'Modal closed successfully'
    });
  };

  const handleSuccess = () => {
    // This function is called when the access level is successfully changed
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.SYSTEM,
      'Test: SOP Access Level changed successfully',
      { sopId: testSopId }
    );
    
    // Verify that the modal is closed
    if (!isModalOpen) {
      setTestResult({
        success: true,
        message: 'Test passed: Modal closed automatically after successful access level change'
      });
    } else {
      setTestResult({
        success: false,
        message: 'Test failed: Modal did not close automatically after successful access level change'
      });
    }
    
    // Refresh the SOP data
    fetchUpdatedSop();
  };
  
  const fetchUpdatedSop = async () => {
    if (!testSopId) return;
    
    try {
      const { data, error } = await supabase
        .from('sops')
        .select('id, access_level, client_id, agency_id, system_id')
        .eq('id', testSopId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setCurrentAccessLevel(data.access_level);
        
        // Set the current entity ID based on access level
        if (data.access_level === 'client') {
          setCurrentEntityId(data.client_id);
        } else if (data.access_level === 'agency') {
          setCurrentEntityId(data.agency_id);
        } else if (data.access_level === 'system') {
          setCurrentEntityId(data.system_id);
        }
        
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.SYSTEM,
          'Test: Updated SOP fetched successfully',
          { 
            sopId: data.id, 
            accessLevel: data.access_level,
            clientId: data.client_id,
            agencyId: data.agency_id,
            systemId: data.system_id
          }
        );
      }
    } catch (err) {
      console.error('Error fetching updated SOP:', err);
      setTestResult({
        success: false,
        message: 'Error fetching updated SOP',
        details: err
      });
    }
  };

  if (!user) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg">
        <h2 className="text-lg font-medium text-yellow-800">Authentication Required</h2>
        <p className="mt-2 text-sm text-yellow-700">
          Please log in to run the SOP Access Level Change test.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!testSopId) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg">
        <h2 className="text-lg font-medium text-yellow-800">No Test SOP Available</h2>
        <p className="mt-2 text-sm text-yellow-700">
          {testResult?.message || 'No SOPs found for testing. Please create a SOP first.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900">SOP Access Level Change Test</h2>
        
        <div className="mt-4 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700">Test Environment</h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">User Role</p>
                <p className="text-sm font-medium text-gray-900">{role}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Test SOP ID</p>
                <p className="text-sm font-medium text-gray-900">{testSopId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Access Level</p>
                <p className="text-sm font-medium text-gray-900">{currentAccessLevel}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Entity ID</p>
                <p className="text-sm font-medium text-gray-900">{currentEntityId || 'None'}</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Open Access Level Changer
            </button>
            
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">Modal Status:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isModalOpen ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {isModalOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
          
          {testResult && (
            <div className={`p-4 rounded-lg ${
              testResult.success ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <h3 className={`text-sm font-medium ${
                testResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                Test Result
              </h3>
              <p className={`mt-2 text-sm ${
                testResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {testResult.message}
              </p>
              {testResult.details && (
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isModalOpen && testSopId && (
        <SopAccessLevelChanger
          sopId={testSopId}
          currentAccessLevel={currentAccessLevel}
          currentEntityId={currentEntityId}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}