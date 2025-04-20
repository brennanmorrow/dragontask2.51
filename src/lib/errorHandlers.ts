import { useAuthStore } from './store';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';
import { useNavigate } from 'react-router-dom';

// Function to handle 404 errors and redirect to login
export function handle404Error() {
  const { logout } = useAuthStore.getState();
  
  logDebugEvent(
    DebugLevel.ERROR,
    DebugEventType.NAVIGATION,
    'Page not found (404)',
    { path: window.location.pathname }
  );
  
  logout();
  window.location.href = '/';
}

// Custom hook for handling loading timeouts
export function useLoadingTimeout(timeout = 30000) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  
  const startLoadingTimeout = (callback?: () => void) => {
    const timeoutId = setTimeout(() => {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Loading timeout exceeded',
        { path: window.location.pathname, timeout: `${timeout}ms` }
      );
      
      if (callback) {
        callback();
      } else {
        logout();
        navigate('/');
      }
    }, timeout);
    
    return () => clearTimeout(timeoutId);
  };
  
  return { startLoadingTimeout };
}

// Function to check if a response is a 404
export function is404Response(response: Response): boolean {
  return response.status === 404;
}

// Function to check if a fetch error is a network error
export function isNetworkError(error: any): boolean {
  return error instanceof TypeError && error.message === 'Failed to fetch';
}

// Function to handle API errors
export function handleApiError(error: any, path: string) {
  const { logout } = useAuthStore.getState();
  
  if (error.status === 401) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Unauthorized API call - logging out user',
      { path, error }
    );
    
    logout();
    window.location.href = '/';
    return;
  }
  
  logDebugEvent(
    DebugLevel.ERROR,
    DebugEventType.API_CALL,
    'API call failed',
    { path, error }
  );
}

// Function to handle database timeouts
export function handleDatabaseTimeout(error: any) {
  // Check if the error is a database timeout
  const isTimeout = error?.message?.includes('timeout') || 
                   error?.message?.includes('connection') ||
                   error?.code === 'ETIMEDOUT' ||
                   error?.code === 'ECONNABORTED';
  
  if (isTimeout) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Database connection timeout',
      { error }
    );
    
    // Return a user-friendly message
    return {
      isTimeout: true,
      message: 'The database connection timed out. Please try again in a moment.'
    };
  }
  
  return { isTimeout: false };
}

// Function to retry a failed database operation
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if it's a timeout error
      const { isTimeout } = handleDatabaseTimeout(error);
      
      if (!isTimeout) {
        // If it's not a timeout error, don't retry
        throw error;
      }
      
      // Log retry attempt
      logDebugEvent(
        DebugLevel.WARNING,
        DebugEventType.API_CALL,
        `Retrying operation after timeout (attempt ${attempt + 1}/${maxRetries})`,
        { error }
      );
      
      // Wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
}