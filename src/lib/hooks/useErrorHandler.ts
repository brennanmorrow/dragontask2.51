import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { logDebugEvent, DebugLevel, DebugEventType } from '../debugSystem';
import { handleDatabaseTimeout, retryOperation } from '../errorHandlers';

export function useErrorHandler() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleError = useCallback((err: unknown, context?: string) => {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    setError(errorMessage);
    
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      `Error in ${context || 'application'}`,
      { error: err }
    );
    
    // Check for database timeout errors
    const { isTimeout, message } = handleDatabaseTimeout(err);
    if (isTimeout) {
      return message || errorMessage;
    }
    
    // Check for authentication errors
    if (
      err instanceof Error && 
      (
        errorMessage.includes('JWT expired') || 
        errorMessage.includes('Invalid JWT') || 
        errorMessage.includes('not authenticated') ||
        errorMessage.includes('session expired')
      )
    ) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.AUTH,
        'Authentication error detected, logging out user',
        { error: err }
      );
      
      logout();
      navigate('/');
    }
    
    return errorMessage;
  }, [navigate, logout]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Function to retry a database operation with exponential backoff
  const retryWithBackoff = useCallback(async <T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3
  ): Promise<T> => {
    return retryOperation(operation, maxRetries);
  }, []);

  return { error, setError, handleError, clearError, retryWithBackoff };
}

export function useLoadingTimeout(timeout = 30000) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  
  const startLoadingTimeout = (callback?: () => void) => {
    const timeoutId = setTimeout(() => {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Loading timeout exceeded',
        { timeout: `${timeout}ms` }
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