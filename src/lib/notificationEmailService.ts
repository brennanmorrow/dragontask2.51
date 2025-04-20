import { supabase } from './supabase';
import { sendTemplateEmail } from './emailService';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';

// Process notifications that should trigger emails
export async function processNotificationEmails(): Promise<void> {
  try {
    // Get unprocessed notification emails
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .filter('data->should_email', 'eq', true)
      .limit(10); // Process in batches

    if (error) {
      throw error;
    }

    if (!notifications || notifications.length === 0) {
      return;
    }

    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'Processing notification emails',
      { count: notifications.length }
    );

    // Process each notification
    for (const notification of notifications) {
      try {
        await sendNotificationEmail(notification);
        
        // Mark notification as processed for email
        await supabase
          .from('notifications')
          .update({
            data: {
              ...notification.data,
              should_email: false,
              email_sent: true,
              email_sent_at: new Date().toISOString()
            }
          })
          .eq('id', notification.id);
          
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.API_CALL,
          'Notification email processed successfully',
          { notificationId: notification.id, type: notification.type }
        );
      } catch (err) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error processing notification email',
          { error: err, notification }
        );
        
        // Mark as failed but don't retry immediately
        await supabase
          .from('notifications')
          .update({
            data: {
              ...notification.data,
              should_email: false,
              email_failed: true,
              email_error: err instanceof Error ? err.message : 'Unknown error'
            }
          })
          .eq('id', notification.id);
      }
    }
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing notification emails',
      { error: err }
    );
  }
}

// Send email for a specific notification
async function sendNotificationEmail(notification: any): Promise<void> {
  // Get user email
  const { data: userData, error: userError } = await supabase
    .from('user_roles')
    .select('email')
    .eq('user_id', notification.user_id)
    .single();

  if (userError || !userData?.email) {
    throw new Error(`Could not find email for user ${notification.user_id}`);
  }

  const userEmail = userData.email;
  const userName = userEmail.split('@')[0]; // Use part before @ as name

  // Get company name from system settings
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('name')
    .single();
  
  const companyName = settingsData?.name || 'DragonTask';

  // Process based on notification type
  switch (notification.type) {
    case 'mention':
      await processMentionNotification(notification, userEmail, userName, companyName);
      break;
    case 'task_assigned':
      await processTaskAssignedNotification(notification, userEmail, userName, companyName);
      break;
    case 'task_due_soon':
      await processTaskDueSoonNotification(notification, userEmail, userName, companyName);
      break;
    case 'sop_approved':
      await processSopApprovedNotification(notification, userEmail, userName, companyName);
      break;
    case 'welcome':
      await processWelcomeNotification(notification, userEmail, userName, companyName);
      break;
    case 'password_reset':
      await processPasswordResetNotification(notification, userEmail, userName, companyName);
      break;
    default:
      // For other notification types, send a generic notification
      await processGenericNotification(notification, userEmail, userName, companyName);
      break;
  }
}

// Process mention notification
async function processMentionNotification(
  notification: any, 
  userEmail: string, 
  userName: string,
  companyName: string
): Promise<void> {
  try {
    // Determine if this is a task or SOP mention
    const isSopMention = notification.data.sop_id !== undefined;
    const isTaskMention = notification.data.task_id !== undefined;
    
    if (isSopMention) {
      // Get SOP details
      const { data: sopData } = await supabase
        .from('sops')
        .select('title, client_id')
        .eq('id', notification.data.sop_id)
        .single();
      
      // Get comment details
      const { data: commentData } = await supabase
        .from('sop_comments')
        .select('content, user_email')
        .eq('id', notification.data.comment_id)
        .single();
      
      if (!sopData || !commentData) {
        throw new Error('Could not find SOP or comment data');
      }
      
      // Get client name
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', sopData.client_id)
        .single();
      
      // Send email
      await sendTemplateEmail(
        'Notification',
        userEmail,
        {
          userName,
          notificationType: 'SOP Mention',
          notificationTitle: `You were mentioned in a comment on SOP "${sopData.title}"`,
          notificationContent: commentData.content,
          mentionedBy: commentData.user_email,
          clientName: clientData?.name || 'Unknown Client',
          actionUrl: `${window.location.origin}/sops/${notification.data.sop_id}`,
          companyName
        }
      );
    } else if (isTaskMention) {
      // Get task details
      const { data: taskData } = await supabase
        .from('tasks')
        .select('title, client_id')
        .eq('id', notification.data.task_id)
        .single();
      
      // Get comment details
      const { data: commentData } = await supabase
        .from('task_comments')
        .select('content, user_email')
        .eq('id', notification.data.comment_id)
        .single();
      
      if (!taskData || !commentData) {
        throw new Error('Could not find task or comment data');
      }
      
      // Get client name
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', taskData.client_id)
        .single();
      
      // Send email
      await sendTemplateEmail(
        'Notification',
        userEmail,
        {
          userName,
          notificationType: 'Task Mention',
          notificationTitle: `You were mentioned in a comment on task "${taskData.title}"`,
          notificationContent: commentData.content,
          mentionedBy: commentData.user_email,
          clientName: clientData?.name || 'Unknown Client',
          actionUrl: `${window.location.origin}/tasks?taskId=${notification.data.task_id}`,
          companyName
        }
      );
    } else {
      // Generic mention
      await sendTemplateEmail(
        'Notification',
        userEmail,
        {
          userName,
          notificationType: 'Mention',
          notificationTitle: 'You were mentioned in a comment',
          notificationContent: notification.content,
          mentionedBy: notification.data.mentioned_by || 'A team member',
          actionUrl: `${window.location.origin}/notifications`,
          companyName
        }
      );
    }
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing mention notification email',
      { error: err, notificationId: notification.id }
    );
    throw err;
  }
}

// Process task assigned notification
async function processTaskAssignedNotification(
  notification: any, 
  userEmail: string, 
  userName: string,
  companyName: string
): Promise<void> {
  try {
    // Get task details
    const { data: taskData } = await supabase
      .from('tasks')
      .select('title, description, status, priority, finish_date, client_id')
      .eq('id', notification.data.task_id)
      .single();
    
    if (!taskData) {
      throw new Error('Could not find task data');
    }
    
    // Get client name
    const { data: clientData } = await supabase
      .from('clients')
      .select('name')
      .eq('id', taskData.client_id)
      .single();
    
    // Get assigner details
    const { data: assignerData } = await supabase
      .from('user_roles')
      .select('email')
      .eq('user_id', notification.data.assigned_by)
      .single();
    
    // Send email
    await sendTemplateEmail(
      'Task Assignment',
      userEmail,
      {
        userName,
        taskTitle: taskData.title,
        taskStatus: taskData.status,
        taskPriority: taskData.priority,
        taskDueDate: taskData.finish_date ? new Date(taskData.finish_date).toLocaleDateString() : 'Not set',
        taskDescription: taskData.description || 'No description provided',
        assignedBy: assignerData?.email || 'A team member',
        clientName: clientData?.name || 'Unknown Client',
        actionUrl: `${window.location.origin}/tasks?taskId=${notification.data.task_id}`,
        companyName
      }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing task assignment notification email',
      { error: err, notificationId: notification.id }
    );
    throw err;
  }
}

// Process task due soon notification
async function processTaskDueSoonNotification(
  notification: any, 
  userEmail: string, 
  userName: string,
  companyName: string
): Promise<void> {
  try {
    // Get task details
    const { data: taskData } = await supabase
      .from('tasks')
      .select('title, description, status, priority, finish_date, client_id')
      .eq('id', notification.data.task_id)
      .single();
    
    if (!taskData) {
      throw new Error('Could not find task data');
    }
    
    // Get client name
    const { data: clientData } = await supabase
      .from('clients')
      .select('name')
      .eq('id', taskData.client_id)
      .single();
    
    // Send email
    await sendTemplateEmail(
      'Task Due Soon',
      userEmail,
      {
        userName,
        taskTitle: taskData.title,
        taskStatus: taskData.status,
        taskPriority: taskData.priority,
        taskDueDate: taskData.finish_date ? new Date(taskData.finish_date).toLocaleDateString() : 'Not set',
        taskDescription: taskData.description || 'No description provided',
        clientName: clientData?.name || 'Unknown Client',
        actionUrl: `${window.location.origin}/tasks?taskId=${notification.data.task_id}`,
        companyName
      }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing task due soon notification email',
      { error: err, notificationId: notification.id }
    );
    throw err;
  }
}

// Process SOP approved notification
async function processSopApprovedNotification(
  notification: any, 
  userEmail: string, 
  userName: string,
  companyName: string
): Promise<void> {
  try {
    // Get SOP details
    const { data: sopData } = await supabase
      .from('sops')
      .select('title, client_id, updated_at')
      .eq('id', notification.data.sop_id)
      .single();
    
    if (!sopData) {
      throw new Error('Could not find SOP data');
    }
    
    // Get client name
    const { data: clientData } = await supabase
      .from('clients')
      .select('name')
      .eq('id', sopData.client_id)
      .single();
    
    // Get latest version
    const { data: versionData } = await supabase
      .from('sop_versions')
      .select('version_number')
      .eq('sop_id', notification.data.sop_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    
    // Get approver details
    const { data: approverData } = await supabase
      .from('user_roles')
      .select('email')
      .eq('user_id', notification.data.approved_by)
      .single();
    
    // Send email
    await sendTemplateEmail(
      'SOP Approval',
      userEmail,
      {
        userName,
        sopTitle: sopData.title,
        sopVersion: versionData?.version_number || '1',
        approvedBy: approverData?.email || 'A team member',
        approvalDate: new Date(sopData.updated_at).toLocaleDateString(),
        clientName: clientData?.name || 'Unknown Client',
        actionUrl: `${window.location.origin}/sops/${notification.data.sop_id}`,
        companyName
      }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing SOP approval notification email',
      { error: err, notificationId: notification.id }
    );
    throw err;
  }
}

// Process welcome notification
async function processWelcomeNotification(
  notification: any, 
  userEmail: string, 
  userName: string,
  companyName: string
): Promise<void> {
  try {
    // Send welcome email
    await sendTemplateEmail(
      'Welcome Email',
      userEmail,
      {
        userName,
        userEmail,
        userRole: notification.data.user_role || 'User',
        organization: notification.data.organization || companyName,
        companyName
      }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing welcome notification email',
      { error: err, notificationId: notification.id }
    );
    throw err;
  }
}

// Process password reset notification
async function processPasswordResetNotification(
  notification: any, 
  userEmail: string, 
  userName: string,
  companyName: string
): Promise<void> {
  try {
    // Send password reset email
    await sendTemplateEmail(
      'Password Reset',
      userEmail,
      {
        userName: notification.data.user_name || userName,
        resetLink: notification.data.reset_link || `${window.location.origin}/reset-password`,
        companyName: notification.data.company_name || companyName
      }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing password reset notification email',
      { error: err, notificationId: notification.id }
    );
    throw err;
  }
}

// Process generic notification
async function processGenericNotification(
  notification: any, 
  userEmail: string, 
  userName: string,
  companyName: string
): Promise<void> {
  try {
    // Send generic notification email
    await sendTemplateEmail(
      'Notification',
      userEmail,
      {
        userName,
        notificationType: notification.type.charAt(0).toUpperCase() + notification.type.slice(1).replace('_', ' '),
        notificationTitle: notification.content,
        notificationContent: notification.data.details || 'No additional details provided.',
        actionUrl: `${window.location.origin}/notifications`,
        companyName
      }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error processing generic notification email',
      { error: err, notificationId: notification.id }
    );
    throw err;
  }
}