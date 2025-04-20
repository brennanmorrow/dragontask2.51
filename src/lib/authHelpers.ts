import { supabase } from './supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';

// Function to handle user creation and role assignment
export async function createUser(
  username: string,
  email: string,
  password: string,
  role: string,
  systemId?: string,
  agencyId?: string,
  clientId?: string,
  fullName?: string,
  phone?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Creating new user',
      { username, role }
    );
    
    // Validate username
    if (!username || username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format' };
    }

    // Validate password strength
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' };
    }
    
    // Validate role
    if (!['system_admin', 'agency_admin', 'client_admin', 'client_user'].includes(role)) {
      return { success: false, error: 'Invalid role' };
    }

    // Validate entity IDs based on role
    if (role === 'system_admin' && !systemId) {
      return { success: false, error: 'System ID is required for system admin role' };
    }
    if (role === 'agency_admin' && !agencyId) {
      return { success: false, error: 'Agency ID is required for agency admin role' };
    }
    if (['client_admin', 'client_user'].includes(role) && !clientId) {
      return { success: false, error: 'Client ID is required for client roles' };
    }
    
    // Check if username already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('username', username);
      
    if (checkError) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error checking for existing username',
        { error: checkError }
      );
      return { success: false, error: `Database error: ${checkError.message}` };
    }
    
    if (existingUsers && existingUsers.length > 0) {
      return { success: false, error: 'Username is already taken' };
    }
    
    // Create the user in auth.users with metadata for the trigger
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          role,
          system_id: systemId,
          agency_id: agencyId,
          client_id: clientId,
          full_name: fullName
        }
      }
    });

    if (authError) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error creating user in auth',
        { error: authError }
      );
      
      // Handle specific auth errors
      if (authError.message.includes('already registered')) {
        return { success: false, error: 'Email is already registered' };
      }
      
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    // Verify user creation and fix if necessary
    const { error: verifyError } = await supabase.rpc(
      'verify_user_creation',
      {
        p_user_id: authData.user.id,
        p_email: email,
        p_username: username,
        p_role: role,
        p_system_id: systemId || null,
        p_agency_id: agencyId || null,
        p_client_id: clientId || null
      }
    );

    if (verifyError) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error verifying user creation',
        { error: verifyError, userId: authData.user.id }
      );
      return { success: false, error: `Error verifying user creation: ${verifyError.message}` };
    }

    // Create or update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: authData.user.id,
        email,
        full_name: fullName,
        phone
      });

    if (profileError) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error creating user profile',
        { error: profileError, userId: authData.user.id }
      );
      // Don't return error here, continue with the process
    }

    // Create notification preferences
    const { error: notifError } = await supabase
      .from('user_notification_preferences')
      .insert({
        user_id: authData.user.id,
        email_mentions: true,
        email_task_assignments: true,
        email_task_due_soon: true,
        email_sop_approvals: true
      })
      .onConflict('user_id')
      .ignore();

    if (notifError) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error creating notification preferences',
        { error: notifError, userId: authData.user.id }
      );
      // Don't return error here, continue with the process
    }

    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.API_CALL,
      'User created successfully',
      { userId: authData.user.id, username, role }
    );

    return { success: true, userId: authData.user.id };
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Unexpected error creating user',
      { error: err }
    );
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'An unknown error occurred while creating the user'
    };
  }
}

// Function to handle password reset
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