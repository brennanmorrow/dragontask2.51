import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logNavigation, DebugLevel, DebugEventType, logDebugEvent } from './debugSystem';
import { useAuthStore } from './store';
import { checkPermission, PermissionType } from './permissionChecker';
import { handle404Error } from './errorHandlers';

// Map of routes to required permissions
const routePermissions: Record<string, { 
  permission: PermissionType, 
  entityParam?: string,
  entityType?: 'system' | 'agency' | 'client'
}> = {
  '/': { permission: PermissionType.VIEW_TASKS },
  '/dashboard': { permission: PermissionType.VIEW_TASKS },
  '/systems': { permission: PermissionType.VIEW_SYSTEM },
  '/agencies': { permission: PermissionType.VIEW_AGENCY },
  '/clients': { permission: PermissionType.VIEW_CLIENT },
  '/users': { permission: PermissionType.VIEW_USERS },
  '/tasks': { permission: PermissionType.VIEW_TASKS },
  '/settings': { permission: PermissionType.MANAGE_SETTINGS },
  '/sops': { permission: PermissionType.VIEW_SOPS },
  '/reports': { permission: PermissionType.VIEW_REPORTS }
};

// Dynamic route patterns
const dynamicRoutePatterns = [
  { pattern: /^\/agencies\/([^\/]+)$/, permission: PermissionType.VIEW_AGENCY, entityType: 'agency' as const },
  { pattern: /^\/clients\/([^\/]+)$/, permission: PermissionType.VIEW_CLIENT, entityType: 'client' as const },
  { pattern: /^\/systems\/([^\/]+)$/, permission: PermissionType.VIEW_SYSTEM, entityType: 'system' as const },
  { pattern: /^\/sops\/([^\/]+)$/, permission: PermissionType.VIEW_SOPS },
  { pattern: /^\/sops\/new$/, permission: PermissionType.MANAGE_SOPS }
];

export function DebugRouter({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  
  useEffect(() => {
    // Skip if user is not logged in (will be handled by auth system)
    if (!user) return;
    
    const path = location.pathname;
    
    // Log navigation attempt
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.NAVIGATION,
      `Navigation attempt to ${path}`,
      { user: user.id, role }
    );
    
    // Check for exact route match
    const exactRoutePermission = routePermissions[path];
    
    if (exactRoutePermission) {
      const hasPermission = checkPermission(
        exactRoutePermission.permission,
        exactRoutePermission.entityParam,
        exactRoutePermission.entityType
      );
      
      if (!hasPermission) {
        logNavigation(path, false, { 
          reason: `User does not have ${exactRoutePermission.permission} permission`,
          role
        });
        
        // Redirect to default page based on role
        navigate('/dashboard');
        return;
      }
      
      logNavigation(path, true, { role });
      return;
    }
    
    // Check for dynamic route match
    for (const { pattern, permission, entityType } of dynamicRoutePatterns) {
      const match = path.match(pattern);
      
      if (match) {
        const entityId = match[1];
        const hasPermission = checkPermission(permission, entityId, entityType);
        
        if (!hasPermission) {
          logNavigation(path, false, { 
            reason: `User does not have ${permission} permission for ${entityType} ${entityId}`,
            role
          });
          
          // Redirect to default page based on role
          navigate('/dashboard');
          return;
        }
        
        logNavigation(path, true, { role, entityId, entityType });
        return;
      }
    }
    
    // If no match found, it's a 404
    if (!path.startsWith('/reset-password') && !path.startsWith('/profile')) {
      logDebugEvent(
        DebugLevel.WARNING,
        DebugEventType.NAVIGATION,
        `Page not found: ${path}`,
        { user: user.id, role }
      );
      
      // Redirect to 404 page which will handle logout
      handle404Error();
    }
    
  }, [location.pathname, user, role]);
  
  return <>{children}</>;
}