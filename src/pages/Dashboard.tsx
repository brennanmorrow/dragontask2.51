import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Building2, Users, Briefcase, ArrowRight, CheckSquare, FileText, BarChart2 } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { PermissionGate } from '../components/PermissionGate';
import { PermissionType } from '../lib/permissionChecker';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';
import { UpcomingTasksCalendar } from '../components/UpcomingTasksCalendar';
import { SystemDashboard } from './SystemDashboard';
import { AgencyDashboard } from './AgencyDashboard';
import { ClientDashboard } from './ClientDashboard';

export function Dashboard() {
  const navigate = useNavigate();
  const { role, user, systemId, agencyId, clientId, navigation } = useAuthStore();
  const { currentSystem, currentAgency, currentClient } = navigation;
  const { systemSettings } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const primaryColorLight = `rgba(${parseInt(primaryColor.slice(1, 3), 16)}, ${parseInt(primaryColor.slice(3, 5), 16)}, ${parseInt(primaryColor.slice(5, 7), 16)}, 0.1)`;

  useEffect(() => {
    if (!user || !role) {
      return;
    }

    // Log component render
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.COMPONENT_RENDER,
      'Dashboard component rendered',
      { role, systemId, agencyId, clientId }
    );

    // Determine which dashboard to show based on role and context
    const redirectToDashboard = async () => {
      try {
        setIsLoading(true);
        setRedirecting(false);

        // System admin with system context goes to system dashboard
        if (role === 'system_admin') {
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Rendering system dashboard for system admin',
            { systemId }
          );
          setIsLoading(false);
          return;
        }
        
        // Agency admin with agency context goes to agency dashboard
        if (role === 'agency_admin' && agencyId) {
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Redirecting agency admin to agency dashboard',
            { agencyId }
          );
          navigate(`/agencies/${agencyId}`);
          return;
        }
        
        // Client admin or user with client context goes to client dashboard
        if ((role === 'client_admin' || role === 'client_user') && clientId) {
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Redirecting client user to client dashboard',
            { clientId }
          );
          navigate(`/clients/${clientId}`);
          return;
        }

        // If we have a current agency in navigation context, go there
        if (currentAgency && ['system_admin', 'agency_admin'].includes(role)) {
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Redirecting to current agency dashboard from navigation context',
            { agencyId: currentAgency.id }
          );
          navigate(`/agencies/${currentAgency.id}`);
          return;
        }

        // If we have a current client in navigation context, go there
        if (currentClient) {
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Redirecting to current client dashboard from navigation context',
            { clientId: currentClient.id }
          );
          navigate(`/clients/${currentClient.id}`);
          return;
        }

        // If no specific context, show the generic dashboard
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.NAVIGATION,
          'Showing generic dashboard',
          { role }
        );
        setIsLoading(false);
      } catch (err) {
        console.error('Error redirecting to dashboard:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.NAVIGATION,
          'Error redirecting to dashboard',
          { error: err }
        );
      }
    };

    redirectToDashboard();
  }, [user, role, systemId, agencyId, clientId, navigate]);

  if (!user || !role) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Please log in to access the dashboard</h2>
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

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // For system admins, show the system dashboard
  if (role === 'system_admin') {
    return <SystemDashboard />;
  }

  // Generic dashboard for when no specific context is available
  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Welcome to Your Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Here's an overview of your workspace and recent activity
          </p>
        </div>
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tasks Tile - Visible to all roles */}
        <PermissionGate permission={PermissionType.VIEW_TASKS}>
          <div 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/tasks')}
            style={{ borderTop: `4px solid ${primaryColor}` }}
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                  <CheckSquare className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500">Tasks</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">View</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <button 
                  onClick={() => navigate('/tasks')}
                  className="font-medium flex items-center"
                  style={{ color: primaryColor }}
                >
                  View all tasks
                  <span className="ml-2" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </PermissionGate>

        {/* SOPs Tile - Visible to all roles */}
        <PermissionGate permission={PermissionType.VIEW_SOPS}>
          <div 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/sops')}
            style={{ borderTop: `4px solid ${primaryColor}` }}
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                  <FileText className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500">SOPs</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">View</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <button 
                  onClick={() => navigate('/sops')}
                  className="font-medium flex items-center"
                  style={{ color: primaryColor }}
                >
                  View all SOPs
                  <span className="ml-2" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </PermissionGate>

        {/* Clients Tile - Only visible to system_admin and agency_admin */}
        <PermissionGate permission={PermissionType.VIEW_CLIENT}>
          <div 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/clients')}
            style={{ borderTop: `4px solid ${primaryColor}` }}
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                  <Briefcase className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500">Clients</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">View</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <button 
                  onClick={() => navigate('/clients')}
                  className="font-medium flex items-center"
                  style={{ color: primaryColor }}
                >
                  Manage clients
                  <span className="ml-2" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </PermissionGate>

        {/* Users Tile - Only visible to system_admin, agency_admin, client_admin */}
        <PermissionGate permission={PermissionType.VIEW_USERS}>
          <div 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/users')}
            style={{ borderTop: `4px solid ${primaryColor}` }}
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                  <Users className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500">Users</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">View</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <button 
                  onClick={() => navigate('/users')}
                  className="font-medium flex items-center"
                  style={{ color: primaryColor }}
                >
                  Manage users
                  <span className="ml-2" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </PermissionGate>

        {/* Systems Tile - Only for system_admin */}
        <PermissionGate permission={PermissionType.VIEW_SYSTEM}>
          <div 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/systems')}
            style={{ borderTop: `4px solid ${primaryColor}` }}
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                  <Building2 className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500">Systems</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">View</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <button 
                  onClick={() => navigate('/systems')}
                  className="font-medium flex items-center"
                  style={{ color: primaryColor }}
                >
                  Manage systems
                  <span className="ml-2" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </PermissionGate>
        
        {/* Reports Tile - Visible to all roles */}
        <PermissionGate permission={PermissionType.VIEW_REPORTS}>
          <div 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/reports')}
            style={{ borderTop: `4px solid ${primaryColor}` }}
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-md p-3" style={{ backgroundColor: primaryColorLight }}>
                  <BarChart2 className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500">Reports</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">View</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <button 
                  onClick={() => navigate('/reports')}
                  className="font-medium flex items-center"
                  style={{ color: primaryColor }}
                >
                  View reports
                  <span className="ml-2" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </PermissionGate>
      </div>

      {/* Calendar View - Upcoming Tasks */}
      <PermissionGate permission={PermissionType.VIEW_TASKS}>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Tasks</h3>
            <button 
              onClick={() => navigate('/reports')}
              className="inline-flex items-center text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: primaryColor }}
            >
              View Reports
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
          <UpcomingTasksCalendar />
        </div>
      </PermissionGate>
    </div>
  );
}