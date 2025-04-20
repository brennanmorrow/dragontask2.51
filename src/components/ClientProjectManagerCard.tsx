import React, { useState } from 'react';
import { format } from 'date-fns';
import { Mail, Phone, Calendar, Clock, Edit, User, Briefcase, AlertCircle, Check, X } from 'lucide-react';
import { ProjectManager, ClientProjectManager } from '../lib/types';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';
import { ProjectManagerSelector } from './ProjectManagerSelector';

interface ClientProjectManagerCardProps {
  clientId: string;
  clientName: string;
  projectManager?: ClientProjectManager;
  onAssignmentUpdated: () => void;
}

export function ClientProjectManagerCard({ 
  clientId, 
  clientName, 
  projectManager, 
  onAssignmentUpdated 
}: ClientProjectManagerCardProps) {
  const { role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  const canEditAssignment = ['system_admin', 'agency_admin'].includes(role);

  const handleAssignPM = async (pmId: string, notes: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Assigning project manager to client',
        { clientId, pmId, notes }
      );
      
      const { data, error } = await supabase.rpc(
        'assign_project_manager_to_client',
        {
          p_client_id: clientId,
          p_pm_id: pmId,
          p_notes: notes || null
        }
      );
      
      if (error) throw error;
      
      setSuccess('Project manager assigned successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      setIsEditing(false);
      onAssignmentUpdated();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Project manager assigned successfully',
        { clientId, pmId, assignmentId: data }
      );
    } catch (err) {
      console.error('Error assigning project manager:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error assigning project manager',
        { error: err, clientId, pmId }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'away':
        return 'bg-yellow-100 text-yellow-800';
      case 'busy':
        return 'bg-red-100 text-red-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload < 50) return 'bg-green-500';
    if (workload < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleEmailClick = (email: string) => {
    window.location.href = `mailto:${email}?subject=Regarding ${clientName}`;
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User clicked email project manager',
      { email, clientName }
    );
  };

  const handlePhoneClick = (phone: string) => {
    window.location.href = `tel:${phone}`;
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User clicked call project manager',
      { phone }
    );
  };

  if (isEditing) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Assign Project Manager</h3>
            <button
              onClick={() => setIsEditing(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}
          
          <ProjectManagerSelector 
            clientId={clientId}
            clientName={clientName}
            currentPmId={projectManager?.pm_id}
            onAssign={handleAssignPM}
            onCancel={() => setIsEditing(false)}
            isLoading={isLoading}
          />
        </div>
      </div>
    );
  }

  if (!projectManager?.project_manager) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Project Manager</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 text-center">
          {success && (
            <div className="mb-4 rounded-md bg-green-50 p-4">
              <div className="flex">
                <Check className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}
          
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Project Manager Assigned</h3>
          <p className="mt-1 text-sm text-gray-500">
            This client doesn't have a dedicated project manager yet.
          </p>
          
          {canEditAssignment && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <User className="h-4 w-4 mr-2" />
                Assign Project Manager
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const pm = projectManager.project_manager;
  const relationshipDuration = projectManager.relationship_duration_days || 0;
  
  // Format relationship duration
  let durationText = '';
  if (relationshipDuration < 1) {
    durationText = 'Less than a day';
  } else if (relationshipDuration === 1) {
    durationText = '1 day';
  } else if (relationshipDuration < 30) {
    durationText = `${relationshipDuration} days`;
  } else if (relationshipDuration < 365) {
    const months = Math.floor(relationshipDuration / 30);
    durationText = `${months} ${months === 1 ? 'month' : 'months'}`;
  } else {
    const years = Math.floor(relationshipDuration / 365);
    const remainingMonths = Math.floor((relationshipDuration % 365) / 30);
    durationText = `${years} ${years === 1 ? 'year' : 'years'}`;
    if (remainingMonths > 0) {
      durationText += ` ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;
    }
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Project Manager</h3>
          {canEditAssignment && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-gray-500"
              title="Change Project Manager"
            >
              <Edit className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      
      <div className="px-4 py-5 sm:p-6">
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <Check className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {pm.avatar_url ? (
              <img 
                src={pm.avatar_url} 
                alt={pm.full_name} 
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-500" />
              </div>
            )}
          </div>
          <div className="ml-4">
            <h4 className="text-lg font-medium text-gray-900">{pm.full_name}</h4>
            <p className="text-sm text-gray-500">{pm.title}</p>
            <div className="mt-1 flex items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pm.status)}`}>
                {pm.status.charAt(0).toUpperCase() + pm.status.slice(1)}
              </span>
              <div className="ml-4 flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getWorkloadColor(pm.workload)}`}
                    style={{ width: `${pm.workload}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-xs text-gray-500">{pm.workload}% workload</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h5 className="text-sm font-medium text-gray-500">Contact Information</h5>
            <div className="mt-2 space-y-2">
              <button 
                onClick={() => handleEmailClick(pm.email)}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <Mail className="h-4 w-4 mr-2" />
                {pm.email}
              </button>
              {pm.phone && (
                <button
                  onClick={() => handlePhoneClick(pm.phone)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {pm.phone}
                </button>
              )}
            </div>
          </div>
          
          <div>
            <h5 className="text-sm font-medium text-gray-500">Relationship</h5>
            <div className="mt-2 space-y-2">
              <div className="flex items-center text-sm text-gray-700">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                Assigned on {format(new Date(projectManager.assigned_date), 'MMM d, yyyy')}
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <Clock className="h-4 w-4 mr-2 text-gray-500" />
                Working together for {durationText}
              </div>
            </div>
          </div>
        </div>
        
        {pm.bio && (
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-500">About</h5>
            <p className="mt-2 text-sm text-gray-700">{pm.bio}</p>
          </div>
        )}
        
        {projectManager.notes && (
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-500">Notes</h5>
            <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-700">
              {projectManager.notes}
            </div>
          </div>
        )}
        
        <div className="mt-6">
          <button
            onClick={() => handleEmailClick(pm.email)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <Mail className="h-4 w-4 mr-2" />
            Contact Project Manager
          </button>
        </div>
      </div>
    </div>
  );
}