import { supabase } from './supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';
import { getEmailTemplateByName, processTemplate } from './emailTemplates';

interface EmailSettings {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Blob;
    contentType?: string;
  }>;
}

export async function getEmailSettings(): Promise<EmailSettings | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('email_settings')
      .single();

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching email settings',
        { error }
      );
      return null;
    }

    return data?.email_settings as EmailSettings || null;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching email settings',
      { error: err }
    );
    return null;
  }
}

export async function saveEmailSettings(settings: EmailSettings): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .update({ email_settings: settings })
      .eq('id', (await supabase.from('system_settings').select('id').single()).data?.id);

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error saving email settings',
        { error }
      );
      return false;
    }

    return true;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception saving email settings',
      { error: err }
    );
    return false;
  }
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message?: string; id?: string }> {
  try {
    const settings = await getEmailSettings();
    
    if (!settings || !settings.apiKey || !settings.domain) {
      return { 
        success: false, 
        message: 'Email settings not configured. Please configure email settings in the system settings.' 
      };
    }

    // Log the email attempt
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Sending email',
      { 
        to: options.to, 
        subject: options.subject,
        hasHtml: !!options.html,
        hasText: !!options.text
      }
    );

    // Try to use the Edge Function first
    try {
      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Edge Function returned ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      
      // Log the email in the database
      await supabase.from('email_logs').insert({
        to_email: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        status: 'sent',
        response: result
      });
      
      logDebugEvent( 
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Email sent successfully via Edge Function',
        { result }
      );
      
      return { success: true, id: result.id };
    } catch (edgeError) {
      logDebugEvent(
        DebugLevel.WARNING,
        DebugEventType.API_CALL,
        'Edge Function error, falling back to direct API call',
        { error: edgeError }
      );

      // Create form data for the API request
      const formData = new FormData();
      formData.append('from', `${settings.fromName} <${settings.fromEmail}>`);
      
      // Handle multiple recipients
      if (Array.isArray(options.to)) {
        options.to.forEach(recipient => formData.append('to', recipient));
      } else {
        formData.append('to', options.to);
      }
      
      formData.append('subject', options.subject);
      
      // Add text or HTML content
      if (options.text) formData.append('text', options.text);
      if (options.html) formData.append('html', options.html);
      
      // Add CC recipients if provided
      if (options.cc) {
        if (Array.isArray(options.cc)) {
          options.cc.forEach(recipient => formData.append('cc', recipient));
        } else {
          formData.append('cc', options.cc);
        }
      }
      
      // Add BCC recipients if provided
      if (options.bcc) {
        if (Array.isArray(options.bcc)) {
          options.bcc.forEach(recipient => formData.append('bcc', recipient));
        } else {
          formData.append('bcc', options.bcc);
        }
      }
      
      // Add attachments if provided
      if (options.attachments) {
        options.attachments.forEach(attachment => {
          const blob = attachment.content instanceof Blob 
            ? attachment.content 
            : new Blob([attachment.content], { type: attachment.contentType || 'application/octet-stream' });
          
          formData.append('attachment', blob, attachment.filename);
        });
      }

      // Make the API request to Mailgun
      const mailgunUrl = `https://api.mailgun.net/v3/${settings.domain}/messages`;
      const response = await fetch(mailgunUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${settings.apiKey}`)}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        logDebugEvent(
          DebugLevel.ERROR, 
          DebugEventType.API_CALL,
          'Error sending email',
          { status: response.status, error: errorData }
        );
        
        // Log the failed email
        await supabase.from('email_logs').insert({
          to_email: Array.isArray(options.to) ? options.to.join(', ') : options.to,
          subject: options.subject,
          status: 'failed',
          response: errorData
        });
        
        return { success: false, message: `Failed to send email: ${errorData.message || response.statusText}` };
      }

      const result = await response.json();
      
      // Log the email in the database
      await supabase.from('email_logs').insert({
        to_email: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        status: 'sent',
        response: result
      });
      
      logDebugEvent( 
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Email sent successfully via direct API call',
        { result }
      );
      
      return { success: true, id: result.id };
    }
  } catch (err) {
    logDebugEvent( 
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception sending email',
      { error: err }
    );
    
    // Log the failed email with stringified error
    try {
      await supabase.from('email_logs').insert({
        to_email: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        status: 'failed',
        response: JSON.stringify(err instanceof Error ? 
          { 
            message: err.message, 
            stack: err.stack,
            name: err.name,
            cause: err.cause
          } : err)
      });
    } catch (logErr) {
      console.error('Failed to log email error:', logErr);
    }
    
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'An unknown error occurred while sending email' 
    };
  }
}

// Template-based email sending
export async function sendTemplateEmail(
  templateName: 'Welcome Email' | 'Password Reset' | 'Task Assignment' | 'Task Due Soon' | 'SOP Approval' | 'Notification',
  to: string | string[],
  data: Record<string, any>
): Promise<{ success: boolean; message?: string; id?: string }> {
  try {
    // Get template from database
    const template = await getEmailTemplateByName(templateName);
    
    if (!template) {
      throw new Error(`Email template "${templateName}" not found`);
    }
    
    // Process the template with variables
    const processedTemplate = processTemplate(template, data);
    
    // Send the email
    return await sendEmail({
      to,
      subject: processedTemplate.subject,
      html: processedTemplate.html,
      text: processedTemplate.text
    });
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception sending template email',
      { error: err, template: templateName }
    );
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'An unknown error occurred while sending template email' 
    };
  }
}

// Test email function
export async function sendTestEmail(to: string): Promise<{ success: boolean; message?: string; id?: string }> {
  return await sendEmail({
    to,
    subject: 'DragonTask Email Test',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">DragonTask Email Test</h2>
        <p>This is a test email from DragonTask.</p>
        <p>If you're receiving this email, your email configuration is working correctly.</p>
        <p>Thank you,<br>DragonTask Team</p>
      </div>
    `,
    text: `
      DragonTask Email Test
      
      This is a test email from DragonTask.
      
      If you're receiving this email, your email configuration is working correctly.
      
      Thank you,
      DragonTask Team
    `
  });
}

// Function to process pending email notifications
export async function processEmailNotifications(): Promise<void> {
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
        
        // Get template name based on notification type
        let templateName: 'Welcome Email' | 'Password Reset' | 'Task Assignment' | 'Task Due Soon' | 'SOP Approval' | 'Notification';
        let templateData: Record<string, any> = {};
        
        switch (notification.type) {
          case 'welcome':
            templateName = 'Welcome Email';
            templateData = {
              userName: notification.data.user_name || userEmail.split('@')[0],
              userEmail,
              userRole: notification.data.user_role || 'User',
              organization: notification.data.organization || 'DragonTask'
            };
            break;
            
          case 'password_reset':
            templateName = 'Password Reset';
            templateData = {
              userName: notification.data.user_name || userEmail.split('@')[0],
              resetLink: notification.data.reset_link || `${window.location.origin}/reset-password`
            };
            break;
            
          case 'task_assigned':
            templateName = 'Task Assignment';
            templateData = {
              userName: userEmail.split('@')[0],
              taskTitle: notification.data.task_title,
              taskStatus: notification.data.task_status || 'New',
              taskPriority: notification.data.task_priority || 'Medium',
              taskDueDate: notification.data.task_due_date || 'Not set',
              taskDescription: notification.data.task_description || 'No description provided',
              assignedBy: notification.data.assigned_by_email || 'A team member',
              clientName: notification.data.client_name || 'Your organization',
              actionUrl: notification.data.action_url || `${window.location.origin}/tasks`
            };
            break;
            
          case 'task_due_soon':
            templateName = 'Task Due Soon';
            templateData = {
              userName: userEmail.split('@')[0],
              taskTitle: notification.data.task_title,
              taskStatus: notification.data.task_status || 'In Progress',
              taskPriority: notification.data.task_priority || 'Medium',
              taskDueDate: notification.data.task_due_date || 'Soon',
              taskDescription: notification.data.task_description || 'No description provided',
              clientName: notification.data.client_name || 'Your organization',
              actionUrl: notification.data.action_url || `${window.location.origin}/tasks`
            };
            break;
            
          case 'sop_approved':
            templateName = 'SOP Approval';
            templateData = {
              userName: userEmail.split('@')[0],
              sopTitle: notification.data.sop_title,
              sopVersion: notification.data.sop_version || '1.0',
              approvedBy: notification.data.approved_by_email || 'A team member',
              approvalDate: notification.data.approval_date || new Date().toLocaleDateString(),
              clientName: notification.data.client_name || 'Your organization',
              actionUrl: notification.data.action_url || `${window.location.origin}/sops`
            };
            break;
            
          default:
            templateName = 'Notification';
            templateData = {
              userName: userEmail.split('@')[0],
              notificationType: notification.type.charAt(0).toUpperCase() + notification.type.slice(1).replace('_', ' '),
              notificationTitle: notification.content,
              notificationContent: notification.data.details || 'No additional details provided.',
              actionUrl: notification.data.action_url || `${window.location.origin}/notifications`
            };
        }
        
        // Send the email
        const result = await sendTemplateEmail(templateName, userEmail, templateData);
        
        if (result.success) {
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
        } else {
          throw new Error(result.message);
        }
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