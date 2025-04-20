import { supabase } from '../supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from '../debugSystem';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  content: string;
  data: any;
  read: boolean;
  created_at: string;
}

/**
 * Fetch user notifications
 */
export async function fetchUserNotifications(
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<Notification[]> {
  try {
    const { limit = 10, offset = 0, unreadOnly = false } = options;
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching user notifications',
      { userId, limit, offset, unreadOnly }
    );
    
    const { data, error } = await supabase.rpc('get_user_notifications', {
      p_limit: limit,
      p_offset: offset,
      p_unread_only: unreadOnly
    });

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching user notifications',
        { error, userId }
      );
      throw error;
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching notifications:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching user notifications',
      { error: err, userId }
    );
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Marking notification as read',
      { notificationId }
    );
    
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId
    });

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error marking notification as read',
        { error, notificationId }
      );
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error marking notification as read:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception marking notification as read',
      { error: err, notificationId }
    );
    return false;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Marking all notifications as read',
      {}
    );
    
    const { error } = await supabase.rpc('mark_all_notifications_read');

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error marking all notifications as read',
        { error }
      );
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception marking all notifications as read',
      { error: err }
    );
    return false;
  }
}

/**
 * Create a notification
 */
export async function createNotification(
  userId: string,
  type: string,
  content: string,
  data: any = {}
): Promise<string | null> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Creating notification',
      { userId, type, content }
    );
    
    const { data: notificationData, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          type,
          content,
          data,
          read: false
        }
      ])
      .select()
      .single();

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error creating notification',
        { error, userId, type }
      );
      return null;
    }
    
    return notificationData.id;
  } catch (err) {
    console.error('Error creating notification:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception creating notification',
      { error: err, userId, type }
    );
    return null;
  }
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(userId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching user notification preferences',
      { userId }
    );
    
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching user notification preferences',
        { error, userId }
      );
      throw error;
    }
    
    return data;
  } catch (err) {
    console.error('Error fetching notification preferences:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching user notification preferences',
      { error: err, userId }
    );
    throw err;
  }
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: {
    email_mentions?: boolean;
    email_task_assignments?: boolean;
    email_task_due_soon?: boolean;
    email_sop_approvals?: boolean;
  }
): Promise<boolean> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Updating user notification preferences',
      { userId, preferences }
    );
    
    // Check if preferences exist
    const { data: existingPrefs, error: checkError } = await supabase
      .from('user_notification_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (checkError) throw checkError;
    
    if (existingPrefs) {
      // Update existing preferences
      const { error: updateError } = await supabase
        .from('user_notification_preferences')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
    } else {
      // Create new preferences
      const { error: insertError } = await supabase
        .from('user_notification_preferences')
        .insert([{
          user_id: userId,
          ...preferences
        }]);
      
      if (insertError) throw insertError;
    }
    
    return true;
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error updating user notification preferences',
      { error: err, userId }
    );
    return false;
  }
}