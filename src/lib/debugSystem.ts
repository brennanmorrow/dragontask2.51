import { useAuthStore } from './store';

// Debug levels
export enum DebugLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

// Debug event types
export enum DebugEventType {
  NAVIGATION = 'navigation',
  PERMISSION = 'permission',
  COMPONENT_RENDER = 'component_render',
  API_CALL = 'api_call',
  USER_ACTION = 'user_action',
  DATA_PROCESSING = 'data_processing',
  SYSTEM = 'system'
}

// Debug event interface
export interface DebugEvent {
  id: string;
  timestamp: Date;
  level: DebugLevel;
  type: DebugEventType;
  message: string;
  details?: any;
  userId?: string;
  userRole?: string;
  path?: string;
}

// In-memory storage for debug events
let debugEvents: DebugEvent[] = [];
let isDebugEnabled = false;
const MAX_EVENTS = 1000;

// Initialize debug system
export function initDebugSystem(enabled: boolean = false): void {
  isDebugEnabled = enabled;
  debugEvents = [];
  
  if (enabled && typeof window !== 'undefined') {
    (window as any).__debugSystem = {
      getEvents: getDebugEvents,
      clearEvents: clearDebugEvents,
      enable: enableDebug,
      disable: disableDebug,
      isEnabled: isDebugEnabled
    };
  }
}

export const enableDebug = () => isDebugEnabled = true;
export const disableDebug = () => isDebugEnabled = false;
export const isDebugModeEnabled = () => isDebugEnabled;

// Log a debug event
export function logDebugEvent(
  level: DebugLevel,
  type: DebugEventType,
  message: string,
  details?: any
): void {
  if (!isDebugEnabled) return;
  
  try {
    const { user, role } = useAuthStore.getState();
    
    const event: DebugEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      type,
      message,
      details,
      userId: user?.id,
      userRole: role || 'unknown',
      path: typeof window !== 'undefined' ? window.location.pathname : undefined
    };
    
    // Add to in-memory storage
    debugEvents = [event, ...debugEvents].slice(0, MAX_EVENTS);
  } catch (error) {
    // Fail silently to prevent app crashes
    console.error('Error in debug system:', error);
  }
}

// Get all debug events
export function getDebugEvents(): DebugEvent[] {
  return [...debugEvents];
}

// Clear all debug events
export function clearDebugEvents(): void {
  debugEvents = [];
}

// Helper functions for common logging patterns
export function logNavigation(path: string, success: boolean, details?: any): void {
  logDebugEvent(
    success ? DebugLevel.SUCCESS : DebugLevel.ERROR,
    DebugEventType.NAVIGATION,
    `Navigation to ${path} ${success ? 'succeeded' : 'failed'}`,
    details
  );
}

export function logPermission(resource: string, action: string, granted: boolean, details?: any): void {
  logDebugEvent(
    granted ? DebugLevel.INFO : DebugLevel.WARNING,
    DebugEventType.PERMISSION,
    `Permission ${granted ? 'granted' : 'denied'} for ${action} on ${resource}`,
    details
  );
}

export function logComponentRender(componentName: string, success: boolean, details?: any): void {
  logDebugEvent(
    success ? DebugLevel.INFO : DebugLevel.ERROR,
    DebugEventType.COMPONENT_RENDER,
    `Component ${componentName} ${success ? 'rendered' : 'failed to render'}`,
    details
  );
}

export function logApiCall(endpoint: string, success: boolean, details?: any): void {
  logDebugEvent(
    success ? DebugLevel.SUCCESS : DebugLevel.ERROR,
    DebugEventType.API_CALL,
    `API call to ${endpoint} ${success ? 'succeeded' : 'failed'}`,
    details
  );
}

export function logUserAction(action: string, success: boolean, details?: any): void {
  logDebugEvent(
    success ? DebugLevel.SUCCESS : DebugLevel.WARNING,
    DebugEventType.USER_ACTION,
    `User action ${action} ${success ? 'succeeded' : 'failed'}`,
    details
  );
}