import { useAuthStore } from './store';
import { logPermission } from './debugSystem';

// Permission types
export enum PermissionType {
  VIEW_SYSTEM = 'view_system',
  MANAGE_SYSTEM = 'manage_system',
  VIEW_AGENCY = 'view_agency',
  MANAGE_AGENCY = 'manage_agency',
  VIEW_CLIENT = 'view_client',
  MANAGE_CLIENT = 'manage_client',
  VIEW_TASKS = 'view_tasks',
  MANAGE_TASKS = 'manage_tasks',
  VIEW_USERS = 'view_users',
  MANAGE_USERS = 'manage_users',
  VIEW_SOPS = 'view_sops',
  MANAGE_SOPS = 'manage_sops',
  VIEW_REPORTS = 'view_reports',
  MANAGE_SETTINGS = 'manage_settings'
}

// Permission checker function
export function checkPermission(
  permission: PermissionType,
  entityId?: string,
  entityType?: 'system' | 'agency' | 'client'
): boolean {
  const { role, systemId, agencyId, clientId } = useAuthStore.getState();
  
  // If no role, deny access
  if (!role) {
    logPermission('unknown', permission, false, { reason: 'No user role found' });
    return false;
  }
  
  let hasPermission = false;
  let details: any = { role, systemId, agencyId, clientId };
  
  // Check permission based on role and entity
  switch (role) {
    case 'system_admin':
      // System admins have access to everything in their system
      hasPermission = true;
      
      // If entity is specified, check if it belongs to the admin's system
      if (entityId && entityType) {
        if (entityType === 'system') {
          hasPermission = systemId === entityId;
          details.reason = hasPermission ? 'System admin has access to their system' : 'System admin does not have access to this system';
        }
        // For other entity types, we would need to check if they belong to the admin's system
        // This would require database queries, which we can't do here
        // So we'll assume access is granted and let the backend handle the check
      }
      break;
      
    case 'agency_admin':
      // Agency admins have access to their agency and its clients
      switch (permission) {
        case PermissionType.VIEW_SYSTEM:
        case PermissionType.MANAGE_SYSTEM:
          hasPermission = false;
          details.reason = 'Agency admins cannot manage systems';
          break;
          
        case PermissionType.VIEW_AGENCY:
        case PermissionType.MANAGE_AGENCY:
          hasPermission = true;
          
          // If entity is specified, check if it's the admin's agency
          if (entityId && entityType === 'agency') {
            hasPermission = agencyId === entityId;
            details.reason = hasPermission ? 'Agency admin has access to their agency' : 'Agency admin does not have access to this agency';
          }
          break;
          
        case PermissionType.VIEW_CLIENT:
        case PermissionType.MANAGE_CLIENT:
          hasPermission = true;
          
          // If entity is specified, check if it belongs to the admin's agency
          // This would require a database query, which we can't do here
          // So we'll assume access is granted and let the backend handle the check
          break;
          
        case PermissionType.VIEW_TASKS:
        case PermissionType.MANAGE_TASKS:
        case PermissionType.VIEW_USERS:
        case PermissionType.MANAGE_USERS:
        case PermissionType.VIEW_SOPS:
        case PermissionType.MANAGE_SOPS:
        case PermissionType.VIEW_REPORTS:
        case PermissionType.MANAGE_SETTINGS:
          hasPermission = true;
          break;
          
        default:
          hasPermission = false;
          details.reason = 'Unknown permission';
      }
      break;
      
    case 'client_admin':
      // Client admins have access to their client
      switch (permission) {
        case PermissionType.VIEW_SYSTEM:
        case PermissionType.MANAGE_SYSTEM:
        case PermissionType.VIEW_AGENCY:
        case PermissionType.MANAGE_AGENCY:
          hasPermission = false;
          details.reason = 'Client admins cannot manage systems or agencies';
          break;
          
        case PermissionType.VIEW_CLIENT:
        case PermissionType.MANAGE_CLIENT:
          hasPermission = true;
          
          // If entity is specified, check if it's the admin's client
          if (entityId && entityType === 'client') {
            hasPermission = clientId === entityId;
            details.reason = hasPermission ? 'Client admin has access to their client' : 'Client admin does not have access to this client';
          }
          break;
          
        case PermissionType.VIEW_TASKS:
        case PermissionType.MANAGE_TASKS:
        case PermissionType.VIEW_USERS:
        case PermissionType.MANAGE_USERS:
        case PermissionType.VIEW_SOPS:
        case PermissionType.VIEW_REPORTS:
        case PermissionType.MANAGE_SETTINGS:
          hasPermission = true;
          break;
          
        case PermissionType.MANAGE_SOPS:
          hasPermission = false;
          details.reason = 'Client admins cannot manage SOPs';
          break;
          
        default:
          hasPermission = false;
          details.reason = 'Unknown permission';
      }
      break;
      
    case 'client_user':
      // Client users have limited access
      switch (permission) {
        case PermissionType.VIEW_SYSTEM:
        case PermissionType.MANAGE_SYSTEM:
        case PermissionType.VIEW_AGENCY:
        case PermissionType.MANAGE_AGENCY:
        case PermissionType.MANAGE_CLIENT:
        case PermissionType.MANAGE_USERS:
        case PermissionType.MANAGE_SOPS:
        case PermissionType.MANAGE_SETTINGS:
          hasPermission = false;
          details.reason = 'Client users have limited access';
          break;
          
        case PermissionType.VIEW_CLIENT:
          hasPermission = true;
          
          // If entity is specified, check if it's the user's client
          if (entityId && entityType === 'client') {
            hasPermission = clientId === entityId;
            details.reason = hasPermission ? 'Client user has access to their client' : 'Client user does not have access to this client';
          }
          break;
          
        case PermissionType.VIEW_TASKS:
        case PermissionType.MANAGE_TASKS:
        case PermissionType.VIEW_SOPS:
        case PermissionType.VIEW_REPORTS:
          hasPermission = true;
          break;
          
        default:
          hasPermission = false;
          details.reason = 'Unknown permission';
      }
      break;
      
    default:
      hasPermission = false;
      details.reason = 'Unknown role';
  }
  
  // Log the permission check
  logPermission(
    entityType ? `${entityType}:${entityId || 'all'}` : 'application',
    permission,
    hasPermission,
    details
  );
  
  return hasPermission;
}

// React hook for permission checking
export function usePermission(
  permission: PermissionType,
  entityId?: string,
  entityType?: 'system' | 'agency' | 'client'
): boolean {
  return checkPermission(permission, entityId, entityType);
}

// Check if user has any of the specified permissions
export function hasAnyPermission(permissions: PermissionType[]): boolean {
  return permissions.some(permission => checkPermission(permission));
}

// Check if user has all of the specified permissions
export function hasAllPermissions(permissions: PermissionType[]): boolean {
  return permissions.every(permission => checkPermission(permission));
}