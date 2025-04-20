import React from 'react';
import { PermissionType, checkPermission } from '../lib/permissionChecker';
import { logComponentRender } from '../lib/debugSystem';

interface PermissionGateProps {
  permission: PermissionType;
  entityId?: string;
  entityType?: 'system' | 'agency' | 'client';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ 
  permission, 
  entityId, 
  entityType, 
  fallback = null, 
  children 
}: PermissionGateProps) {
  const hasPermission = checkPermission(permission, entityId, entityType);
  
  // Log component render for debugging
  logComponentRender(
    'PermissionGate', 
    true, 
    { 
      permission, 
      entityId, 
      entityType, 
      hasPermission 
    }
  );
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// Multiple permissions version - requires all permissions
interface AllPermissionsGateProps {
  permissions: PermissionType[];
  entityId?: string;
  entityType?: 'system' | 'agency' | 'client';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AllPermissionsGate({ 
  permissions, 
  entityId, 
  entityType, 
  fallback = null, 
  children 
}: AllPermissionsGateProps) {
  const hasAllPermissions = permissions.every(permission => 
    checkPermission(permission, entityId, entityType)
  );
  
  // Log component render for debugging
  logComponentRender(
    'AllPermissionsGate', 
    true, 
    { 
      permissions, 
      entityId, 
      entityType, 
      hasAllPermissions 
    }
  );
  
  return hasAllPermissions ? <>{children}</> : <>{fallback}</>;
}

// Any permissions version - requires at least one permission
interface AnyPermissionGateProps {
  permissions: PermissionType[];
  entityId?: string;
  entityType?: 'system' | 'agency' | 'client';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AnyPermissionGate({ 
  permissions, 
  entityId, 
  entityType, 
  fallback = null, 
  children 
}: AnyPermissionGateProps) {
  const hasAnyPermission = permissions.some(permission => 
    checkPermission(permission, entityId, entityType)
  );
  
  // Log component render for debugging
  logComponentRender(
    'AnyPermissionGate', 
    true, 
    { 
      permissions, 
      entityId, 
      entityType, 
      hasAnyPermission 
    }
  );
  
  return hasAnyPermission ? <>{children}</> : <>{fallback}</>;
}