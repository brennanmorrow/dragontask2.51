import { supabase } from '../supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from '../debugSystem';
import { retryOperation } from '../errorHandlers';

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User login attempt',
      { email }
    );
    
    // Use retry operation for login to handle potential timeouts
    const { data, error } = await retryOperation(
      () => supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          // Set a long session duration (10 hours)
          expiresIn: 36000
        }
      }),
      3 // Max 3 retries
    );
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Login failed',
        { error: error.message, email }
      );
      throw error;
    }

    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.USER_ACTION,
      'Login successful',
      { userId: data.user?.id, email: data.user?.email }
    );
    
    return { user: data.user, session: data.session };
  } catch (error) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.USER_ACTION,
      'Login error',
      { error }
    );
    
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User logout attempt',
      {}
    );
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Logout error',
        { error }
      );
      throw error;
    }
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.USER_ACTION,
      'Logout successful',
      {}
    );
    
    return true;
  } catch (error) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.USER_ACTION,
      'Logout error',
      { error }
    );
    
    throw error;
  }
}

/**
 * Get the current session
 */
export async function getCurrentSession() {
  try {
    // Use retry operation for getting session to handle potential timeouts
    const { data, error } = await retryOperation(
      () => supabase.auth.getSession(),
      3 // Max 3 retries
    );
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.AUTH,
        'Error getting session',
        { error }
      );
      throw error;
    }
    
    return data.session;
  } catch (error) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.AUTH,
      'Exception getting session',
      { error }
    );
    
    throw error;
  }
}

/**
 * Reset password
 */
export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Requesting password reset',
      { email }
    );
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error requesting password reset',
        { error }
      );
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Unexpected error requesting password reset',
      { error: err }
    );
    return { success: false, error: err instanceof Error ? err.message : 'An unknown error occurred' };
  }
}

/**
 * Update user password
 */
export async function updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Updating user password',
      {}
    );
    
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error updating password',
        { error }
      );
      return { success: false, error: error.message };
    }
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.API_CALL,
      'Password updated successfully',
      {}
    );
    
    return { success: true };
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception updating password',
      { error: err }
    );
    return { success: false, error: err instanceof Error ? err.message : 'An unknown error occurred' };
  }
}