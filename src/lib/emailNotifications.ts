import { supabase } from './supabase';
import { sendTemplateEmail } from './emailService';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';
import { processNotificationEmails } from './notificationEmailService';

// Function to check if Supabase is properly configured
function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Supabase configuration missing',
      { 
        hasUrl: !!url,
        hasKey: !!key
      }
    );
    return false;
  }
  
  try {
    // Validate URL format
    new URL(url);
    return true;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Invalid Supabase URL format',
      { url }
    );
    return false;
  }
}

// Function to process email notifications from the notification queue
export async function processEmailNotifications(): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    // Process notification emails (mentions, task assignments, etc.)
    await processNotificationEmails();
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing email notifications',
      { error: err }
    );
  }
}

// Function to send welcome email to new users
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  userRole: string,
  organization: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    await sendTemplateEmail(
      'Welcome Email',
      userEmail,
      {
        userName,
        userEmail,
        userRole: userRole.replace('_', ' '),
        organization
      }
    );
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.API_CALL,
      'Welcome email sent successfully',
      { userEmail, userRole }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error sending welcome email',
      { error: err, userEmail }
    );
  }
}

// Function to send password reset email
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  resetLink: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    await sendTemplateEmail(
      'Password Reset',
      userEmail,
      {
        userName,
        resetLink
      }
    );
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.API_CALL,
      'Password reset email sent successfully',
      { userEmail }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error sending password reset email',
      { error: err, userEmail }
    );
  }
}

// Function to send notification email for @mentions
export async function sendMentionEmail(
  userEmail: string,
  userName: string,
  mentionType: 'task' | 'sop',
  itemTitle: string,
  commentContent: string,
  mentionedBy: string,
  itemId: string,
  commentId: string,
  clientName?: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const actionUrl = mentionType === 'task' 
      ? `${window.location.origin}/tasks?taskId=${itemId}`
      : `${window.location.origin}/sops/${itemId}`;
    
    await sendTemplateEmail(
      'Notification',
      userEmail,
      {
        userName,
        notificationType: `${mentionType === 'task' ? 'Task' : 'SOP'} Mention`,
        notificationTitle: `You were mentioned in a comment on ${mentionType} "${itemTitle}"`,
        notificationContent: commentContent,
        mentionedBy,
        clientName: clientName || 'Unknown Client',
        actionUrl
      }
    );
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.API_CALL,
      'Mention notification email sent successfully',
      { userEmail, mentionType, itemId }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error sending mention notification email',
      { error: err, userEmail, mentionType, itemId }
    );
  }
}

// Function to check for and process pending notification emails
export async function checkAndProcessNotificationEmails(): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    // Get count of pending notification emails
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
      .filter('data->should_email', 'eq', true);
    
    if (error) {
      throw error;
    }
    
    if (count && count > 0) {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Found pending notification emails to process',
        { count }
      );
      
      // Process notifications
      await processEmailNotifications();
      
      // Also try to manually process any stuck notifications
      const { data: processedNotifications, error: processError } = await supabase
        .rpc('process_pending_email_notifications');
        
      if (processError) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error manually processing pending notifications',
          { error: processError }
        );
      } else {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.SYSTEM,
          'Manually processed pending notifications',
          { count: processedNotifications?.length || 0 }
        );
      }
    }
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Error checking for pending notification emails',
      { error: err }
    );
  }
}

// Set up a periodic check for notification emails
export function setupNotificationEmailProcessor(intervalMinutes: number = 5): () => void {
  // Only set up the processor if Supabase is configured
  if (!isSupabaseConfigured()) {
    logDebugEvent(
      DebugLevel.WARN,
      DebugEventType.SYSTEM,
      'Notification email processor not started - Supabase not configured'
    );
    return () => {};
  }

  // Initial check
  checkAndProcessNotificationEmails();
  
  // Set up interval
  const intervalId = setInterval(() => {
    checkAndProcessNotificationEmails();
  }, intervalMinutes * 60 * 1000);
  
  // Return function to clear interval
  return () => clearInterval(intervalId);
}