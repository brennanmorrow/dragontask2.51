import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Bug, AlertCircle, CheckCircle, Info, 
  ChevronRight, ChevronDown, X
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { logComponentRender, DebugLevel, DebugEventType, logDebugEvent } from '../lib/debugSystem';
import { checkPermission, PermissionType } from '../lib/permissionChecker';
import { useAppContext } from '../lib/AppContext';

// Menu item structure for debugging
interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  requiredPermission: PermissionType;
  children?: MenuItem[];
}

// Navigation structure for all possible menu items
const allNavigation: MenuItem[] = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_TASKS 
  },
  { 
    name: 'Systems', 
    href: '/systems', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_SYSTEM 
  },
  { 
    name: 'Agencies', 
    href: '/agencies', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_AGENCY 
  },
  { 
    name: 'Clients', 
    href: '/clients', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_CLIENT 
  },
  { 
    name: 'Users', 
    href: '/users', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_USERS 
  },
  { 
    name: 'Tasks', 
    href: '/tasks', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_TASKS 
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Info, 
    requiredPermission: PermissionType.MANAGE_SETTINGS 
  },
  { 
    name: 'SOPs', 
    href: '/sops', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_SOPS 
  },
  { 
    name: 'Reports', 
    href: '/reports', 
    icon: Info, 
    requiredPermission: PermissionType.VIEW_REPORTS 
  }
];

export function MenuDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const { role, systemId, agencyId, clientId } = useAuthStore();
  const location = useLocation();
  const { systemSettings } = useAppContext();
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  
  // Only system admins and agency admins can see the menu debugger
  const canAccessDebugger = ['system_admin', 'agency_admin'].includes(role || '');
  
  useEffect(() => {
    if (canAccessDebugger) {
      logComponentRender('MenuDebugger', true, { role });
    }
  }, [canAccessDebugger, role]);
  
  if (!canAccessDebugger) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-full shadow-lg text-white"
        style={{ backgroundColor: primaryColor }}
        title="Menu Debugger"
      >
        <Bug className="h-5 w-5" />
      </button>
      
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-white rounded-lg shadow-xl border border-gray-200 w-96 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center">
              <Bug className="h-5 w-5 mr-2" style={{ color: primaryColor }} />
              <h2 className="text-lg font-semibold">Menu Debugger</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700">Current User Context</h3>
              <div className="mt-2 text-sm">
                <div className="flex items-center">
                  <span className="font-medium w-20">Role:</span>
                  <span className="capitalize">{role || 'None'}</span>
                </div>
                <div className="flex items-center mt-1">
                  <span className="font-medium w-20">System ID:</span>
                  <span className="truncate">{systemId || 'None'}</span>
                </div>
                <div className="flex items-center mt-1">
                  <span className="font-medium w-20">Agency ID:</span>
                  <span className="truncate">{agencyId || 'None'}</span>
                </div>
                <div className="flex items-center mt-1">
                  <span className="font-medium w-20">Client ID:</span>
                  <span className="truncate">{clientId || 'None'}</span>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700">Current Path</h3>
              <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                {location.pathname}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700">Menu Items Visibility</h3>
              <div className="mt-2 space-y-2">
                {allNavigation.map(item => {
                  const hasPermission = checkPermission(item.requiredPermission);
                  
                  return (
                    <div 
                      key={item.href}
                      className="border rounded-md overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-3 bg-gray-50">
                        <div className="flex items-center">
                          <item.icon className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center">
                          {hasPermission ? (
                            <span className="flex items-center text-green-600 text-sm">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Visible
                            </span>
                          ) : (
                            <span className="flex items-center text-red-600 text-sm">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Hidden
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-3 text-sm">
                        <div className="flex items-center">
                          <span className="font-medium w-24">Permission:</span>
                          <span>{item.requiredPermission}</span>
                        </div>
                        <div className="flex items-center mt-1">
                          <span className="font-medium w-24">Path:</span>
                          <span>{item.href}</span>
                        </div>
                        <div className="flex items-center mt-1">
                          <span className="font-medium w-24">Active:</span>
                          <span>{location.pathname === item.href ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}