import { supabase } from './supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';
import { useAppContext } from './AppContext';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  description: string;
  variables: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Get all email templates
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name');

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching email templates',
        { error }
      );
      throw error;
    }

    return data || [];
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching email templates',
      { error: err }
    );
    return [];
  }
}

// Get a specific email template by name
export async function getEmailTemplateByName(name: string): Promise<EmailTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching email template by name',
        { error, name }
      );
      return null;
    }

    return data;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception fetching email template by name',
      { error: err, name }
    );
    return null;
  }
}

// Update an email template
export async function updateEmailTemplate(
  id: string,
  updates: { subject?: string; html?: string; text?: string }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('email_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error updating email template',
        { error, id }
      );
      return false;
    }

    return true;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception updating email template',
      { error: err, id }
    );
    return false;
  }
}

// Reset an email template to its default values
export async function resetEmailTemplate(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('reset_email_template', {
        p_template_id: id
      });

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error resetting email template',
        { error, id }
      );
      return false;
    }

    return data || false;
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Exception resetting email template',
      { error: err, id }
    );
    return false;
  }
}

// Process a template with variables
export function processTemplate(
  template: EmailTemplate,
  variables: Record<string, any>
): { subject: string; html: string; text: string } {
  // Replace variables in the template
  const replacePlaceholders = (content: string): string => {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  };

  // Get system settings for branding
  const { systemSettings } = useAppContext.getState();
  const logoUrl = systemSettings?.logo_url || '';
  const primaryColor = systemSettings?.primary_color || '#3B82F6';
  const companyName = systemSettings?.name || 'DragonTask';

  // Add logo to HTML if available
  let processedHtml = template.html;
  if (logoUrl) {
    // Add logo at the top of the email
    processedHtml = processedHtml.replace(
      /<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">/,
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${logoUrl}" alt="${companyName}" style="max-width: 150px; max-height: 80px;">
        </div>`
    );
  }

  // Replace company name in signature
  processedHtml = processedHtml.replace(/DragonTask Team/g, `${companyName} Team`);
  let processedText = template.text.replace(/DragonTask Team/g, `${companyName} Team`);

  // Update colors in HTML
  processedHtml = processedHtml.replace(/#3B82F6/g, primaryColor);

  // Process conditional blocks
  // Format: {{#if variable}}content{{/if}}
  processedHtml = processedHtml.replace(/\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, variable, content) => {
    return variables[variable] ? content : '';
  });
  
  processedText = processedText.replace(/\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, variable, content) => {
    return variables[variable] ? content : '';
  });

  // Replace variables
  return {
    subject: replacePlaceholders(template.subject),
    html: replacePlaceholders(processedHtml),
    text: replacePlaceholders(processedText)
  };
}

// Create default email templates if they don't exist
export async function ensureDefaultEmailTemplates(): Promise<void> {
  try {
    const templates = await getEmailTemplates();
    
    // If we already have templates, don't create defaults
    if (templates.length > 0) {
      return;
    }
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'No email templates found, creating defaults',
      {}
    );
    
    // Create default templates
    const defaultTemplates = [
      {
        name: 'Welcome Email',
        subject: 'Welcome to {{companyName}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Welcome to DragonTask!</h2>
            <p>Hello {{userName}},</p>
            <p>Welcome to DragonTask! Your account has been created with the following details:</p>
            <ul>
              <li><strong>Email:</strong> {{userEmail}}</li>
              <li><strong>Role:</strong> {{userRole}}</li>
              <li><strong>Organization:</strong> {{organization}}</li>
            </ul>
            <p>You can now log in to your account and start using the system.</p>
            <p>If you have any questions, please don't hesitate to contact your administrator.</p>
            <p>Thank you,<br>DragonTask Team</p>
          </div>
        `,
        text: `
          Welcome to DragonTask!
          
          Hello {{userName}},
          
          Welcome to DragonTask! Your account has been created with the following details:
          
          Email: {{userEmail}}
          Role: {{userRole}}
          Organization: {{organization}}
          
          You can now log in to your account and start using the system.
          
          If you have any questions, please don't hesitate to contact your administrator.
          
          Thank you,
          DragonTask Team
        `,
        description: 'Sent to new users when their account is created',
        variables: ['userName', 'userEmail', 'userRole', 'organization', 'companyName'],
        is_default: true
      },
      {
        name: 'Password Reset',
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Password Reset Request</h2>
            <p>Hello {{userName}},</p>
            <p>We received a request to reset your password. Click the link below to reset your password:</p>
            <p style="text-align: center;">
              <a href="{{resetLink}}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
            </p>
            <p>If you didn't request a password reset, you can ignore this email.</p>
            <p>Thank you,<br>DragonTask Team</p>
          </div>
        `,
        text: `
          Password Reset Request
          
          Hello {{userName}},
          
          We received a request to reset your password. Please visit the following link to reset your password:
          
          {{resetLink}}
          
          If you didn't request a password reset, you can ignore this email.
          
          Thank you,
          DragonTask Team
        `,
        description: 'Sent when a user requests a password reset',
        variables: ['userName', 'resetLink', 'companyName'],
        is_default: true
      },
      {
        name: 'Task Assignment',
        subject: 'Task Assignment: {{taskTitle}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Task Assignment</h2>
            <p>Hello {{userName}},</p>
            <p>You have been assigned to the following task:</p>
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #111827;">{{taskTitle}}</h3>
              <p style="margin-bottom: 8px;"><strong>Status:</strong> {{taskStatus}}</p>
              <p style="margin-bottom: 8px;"><strong>Priority:</strong> {{taskPriority}}</p>
              <p style="margin-bottom: 8px;"><strong>Due Date:</strong> {{taskDueDate}}</p>
              <p style="margin-bottom: 0;"><strong>Description:</strong> {{taskDescription}}</p>
            </div>
            <p>{{#if assignedBy}}This task was assigned to you by {{assignedBy}}.{{/if}}</p>
            <p>{{#if clientName}}This task is for client: {{clientName}}{{/if}}</p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="{{actionUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 4px;">View Task</a>
            </p>
            <p>Thank you,<br>DragonTask Team</p>
          </div>
        `,
        text: `
          Task Assignment: {{taskTitle}}
          
          Hello {{userName}},
          
          You have been assigned to the following task:
          
          Title: {{taskTitle}}
          Status: {{taskStatus}}
          Priority: {{taskPriority}}
          Due Date: {{taskDueDate}}
          Description: {{taskDescription}}
          
          {{#if assignedBy}}This task was assigned to you by {{assignedBy}}.{{/if}}
          {{#if clientName}}This task is for client: {{clientName}}{{/if}}
          
          View the task here: {{actionUrl}}
          
          Thank you,
          DragonTask Team
        `,
        description: 'Sent when a user is assigned to a task',
        variables: ['userName', 'taskTitle', 'taskStatus', 'taskPriority', 'taskDueDate', 'taskDescription', 'assignedBy', 'clientName', 'actionUrl', 'companyName'],
        is_default: true
      },
      {
        name: 'Task Due Soon',
        subject: 'Task Due Soon: {{taskTitle}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Task Due Soon</h2>
            <p>Hello {{userName}},</p>
            <p>The following task is due soon:</p>
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #111827;">{{taskTitle}}</h3>
              <p style="margin-bottom: 8px;"><strong>Status:</strong> {{taskStatus}}</p>
              <p style="margin-bottom: 8px;"><strong>Priority:</strong> {{taskPriority}}</p>
              <p style="margin-bottom: 8px;"><strong>Due Date:</strong> {{taskDueDate}}</p>
              <p style="margin-bottom: 0;"><strong>Description:</strong> {{taskDescription}}</p>
            </div>
            <p>{{#if clientName}}This task is for client: {{clientName}}{{/if}}</p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="{{actionUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 4px;">View Task</a>
            </p>
            <p>Thank you,<br>DragonTask Team</p>
          </div>
        `,
        text: `
          Task Due Soon: {{taskTitle}}
          
          Hello {{userName}},
          
          The following task is due soon:
          
          Title: {{taskTitle}}
          Status: {{taskStatus}}
          Priority: {{taskPriority}}
          Due Date: {{taskDueDate}}
          Description: {{taskDescription}}
          
          {{#if clientName}}This task is for client: {{clientName}}{{/if}}
          
          View the task here: {{actionUrl}}
          
          Thank you,
          DragonTask Team
        `,
        description: 'Sent when a task is due soon',
        variables: ['userName', 'taskTitle', 'taskStatus', 'taskPriority', 'taskDueDate', 'taskDescription', 'clientName', 'actionUrl', 'companyName'],
        is_default: true
      },
      {
        name: 'SOP Approval',
        subject: 'SOP Approved: {{sopTitle}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">SOP Approved</h2>
            <p>Hello {{userName}},</p>
            <p>The following Standard Operating Procedure (SOP) has been approved:</p>
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #111827;">{{sopTitle}}</h3>
              <p style="margin-bottom: 8px;"><strong>Version:</strong> {{sopVersion}}</p>
              <p style="margin-bottom: 8px;"><strong>Approved By:</strong> {{approvedBy}}</p>
              <p style="margin-bottom: 0;"><strong>Approval Date:</strong> {{approvalDate}}</p>
            </div>
            <p>{{#if clientName}}This SOP is for client: {{clientName}}{{/if}}</p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="{{actionUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 4px;">View SOP</a>
            </p>
            <p>Thank you,<br>DragonTask Team</p>
          </div>
        `,
        text: `
          SOP Approved: {{sopTitle}}
          
          Hello {{userName}},
          
          The following Standard Operating Procedure (SOP) has been approved:
          
          Title: {{sopTitle}}
          Version: {{sopVersion}}
          Approved By: {{approvedBy}}
          Approval Date: {{approvalDate}}
          
          {{#if clientName}}This SOP is for client: {{clientName}}{{/if}}
          
          View the SOP here: {{actionUrl}}
          
          Thank you,
          DragonTask Team
        `,
        description: 'Sent when a SOP is approved',
        variables: ['userName', 'sopTitle', 'sopVersion', 'approvedBy', 'approvalDate', 'clientName', 'actionUrl', 'companyName'],
        is_default: true
      },
      {
        name: 'Notification',
        subject: '{{notificationType}}: {{notificationTitle}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">{{notificationType}}</h2>
            <p>Hello {{userName}},</p>
            <p>{{notificationTitle}}</p>
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0;">{{notificationContent}}</p>
            </div>
            <p>{{#if mentionedBy}}You were mentioned by {{mentionedBy}}.{{/if}}</p>
            <p>{{#if clientName}}This notification is related to client: {{clientName}}{{/if}}</p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="{{actionUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 4px;">View Details</a>
            </p>
            <p>Thank you,<br>DragonTask Team</p>
          </div>
        `,
        text: `
          {{notificationType}}: {{notificationTitle}}
          
          Hello {{userName}},
          
          {{notificationTitle}}
          
          {{notificationContent}}
          
          {{#if mentionedBy}}You were mentioned by {{mentionedBy}}.{{/if}}
          {{#if clientName}}This notification is related to client: {{clientName}}{{/if}}
          
          View details here: {{actionUrl}}
          
          Thank you,
          DragonTask Team
        `,
        description: 'Generic notification email template',
        variables: ['userName', 'notificationType', 'notificationTitle', 'notificationContent', 'mentionedBy', 'clientName', 'actionUrl', 'companyName'],
        is_default: true
      }
    ];
    
    // Insert default templates
    for (const template of defaultTemplates) {
      const { error } = await supabase.from('email_templates').insert([template]);
      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.SYSTEM,
          'Error creating default email template',
          { error, templateName: template.name }
        );
      }
    }
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'Created default email templates',
      { count: defaultTemplates.length }
    );
  } catch (err) {
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Error creating default email templates',
      { error: err }
    );
  }
}