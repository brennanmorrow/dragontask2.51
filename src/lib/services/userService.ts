import { supabase } from '../supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from '../debugSystem';

// User types
export interface User {
  id: string;
  email: string;
  username?: string;
  role: string;
  systemId?: string;
  agencyId?: string;
  clientId?: string;
}

export interface UserAssignments {
  systems: Array<{ id: string; name: string }>;
  agencies: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
}

export interface UserWithAssignments extends User {
  assignments: UserAssignments;
}

/**
 * Fetch a user by ID
 */
export async function fetchUserById(userId: string): Promise<User | null> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching user by ID',
      { userId }
    );
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, email, username, role, system_id, agency_id, client_id')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching user by ID',
        { error, userId }
      );
      return null;
    }
    
    return {
      id: data.user_id,
      email: data.email,
      username: data.username,
      role: data.role,
      systemId: data.system_id,
      agencyId: data.agency_id,
      clientId: data.client_id
    };
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching user by ID',
      { error: err, userId }
    );
    return null;
  }
}

/**
 * Fetch user assignments
 */
export async function fetchUserAssignments(userId: string): Promise<UserAssignments | null> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching user assignments',
      { userId }
    );
    
    const { data, error } = await supabase
      .rpc('get_user_assignments', { p_user_id: userId });
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching user assignments',
        { error, userId }
      );
      return null;
    }
    
    if (!data || data.length === 0) {
      return {
        systems: [],
        agencies: [],
        clients: []
      };
    }
    
    return {
      systems: data[0].systems || [],
      agencies: data[0].agencies || [],
      clients: data[0].clients || []
    };
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching user assignments',
      { error: err, userId }
    );
    return null;
  }
}

/**
 * Fetch user with assignments
 */
export async function fetchUserWithAssignments(userId: string): Promise<UserWithAssignments | null> {
  try {
    const user = await fetchUserById(userId);
    if (!user) return null;
    
    const assignments = await fetchUserAssignments(userId);
    if (!assignments) return null;
    
    return {
      ...user,
      assignments
    };
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching user with assignments',
      { error: err, userId }
    );
    return null;
  }
}

/**
 * Update user assignments
 */
export async function updateUserAssignments(
  userId: string,
  role: string,
  systemIds: string[] = [],
  agencyIds: string[] = [],
  clientIds: string[] = []
): Promise<boolean> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Updating user assignments',
      { userId, role, systemIds, agencyIds, clientIds }
    );
    
    const { error } = await supabase.rpc('assign_user_to_entity', {
      p_user_id: userId,
      p_role: role,
      p_system_ids: systemIds,
      p_agency_ids: agencyIds,
      p_client_ids: clientIds
    });
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error updating user assignments',
        { error, userId }
      );
      return false;
    }
    
    return true;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception updating user assignments',
      { error: err, userId }
    );
    return false;
  }
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  password: string,
  username: string,
  role: string,
  systemId?: string,
  agencyId?: string,
  clientId?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Creating new user',
      { email, username, role }
    );
    
    // Create user in auth.users
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          role,
          system_id: systemId,
          agency_id: agencyId,
          client_id: clientId
        }
      }
    });
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error creating user',
        { error, email }
      );
      return { success: false, error: error.message };
    }
    
    if (!data.user) {
      return { success: false, error: 'Failed to create user' };
    }
    
    return { success: true, userId: data.user.id };
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception creating user',
      { error: err, email }
    );
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Deleting user',
      { userId }
    );
    
    const { error } = await supabase.rpc('delete_user', { user_id: userId });
    
    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error deleting user',
        { error, userId }
      );
      return false;
    }
    
    return true;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception deleting user',
      { error: err, userId }
    );
    return false;
  }
}