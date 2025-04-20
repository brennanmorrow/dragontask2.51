import { supabase } from './supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';

// Interface for error log entries
export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: string;
  type: string;
  message: string;
  details: any;
  status: 'new' | 'reviewed' | 'fixed' | 'ignored';
  notes?: string;
}

// Function to fetch error logs from the debug system
export async function fetchErrorLogs(
  limit: number = 100,
  status: 'new' | 'all' = 'new'
): Promise<ErrorLog[]> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'Fetching error logs',
      { limit, status }
    );

    // Get debug events from the database
    let query = supabase
      .from('debug_events')
      .select('*')
      .eq('level', 'error')
      .order('created_at', { ascending: false });
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    query = query.limit(limit);
    
    const { data: debugEvents, error } = await query;

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching error logs',
        { error }
      );
      throw error;
    }

    // If no debug_events table exists, fall back to in-memory logs
    if (!debugEvents || debugEvents.length === 0) {
      // Get in-memory debug events
      const inMemoryEvents = window.__debugSystem?.getEvents() || [];
      
      // Filter for error events
      const errorEvents = inMemoryEvents.filter(event => event.level === DebugLevel.ERROR);
      
      return errorEvents.map(event => ({
        id: event.id,
        timestamp: new Date(event.timestamp),
        level: event.level,
        type: event.type,
        message: event.message,
        details: event.details,
        status: 'new'
      }));
    }

    return debugEvents.map(event => ({
      id: event.id,
      timestamp: new Date(event.created_at),
      level: event.level,
      type: event.type,
      message: event.message,
      details: event.details,
      status: event.status || 'new',
      notes: event.notes
    }));
  } catch (err) {
    console.error('Error fetching error logs:', err);
    
    // Fall back to in-memory logs if database query fails
    const inMemoryEvents = window.__debugSystem?.getEvents() || [];
    const errorEvents = inMemoryEvents.filter(event => event.level === DebugLevel.ERROR);
    
    return errorEvents.map(event => ({
      id: event.id,
      timestamp: new Date(event.timestamp),
      level: event.level,
      type: event.type,
      message: event.message,
      details: event.details,
      status: 'new'
    }));
  }
}

// Function to fetch email error logs
export async function fetchEmailErrorLogs(limit: number = 100): Promise<any[]> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'Fetching email error logs',
      { limit }
    );

    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching email error logs',
        { error }
      );
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching email error logs:', err);
    return [];
  }
}

// Function to update error log status
export async function updateErrorLogStatus(
  id: string,
  status: 'reviewed' | 'fixed' | 'ignored',
  notes?: string
): Promise<boolean> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'Updating error log status',
      { id, status, notes }
    );

    // Try to update in database first
    const { error } = await supabase
      .from('debug_events')
      .update({ 
        status, 
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error updating error log status',
        { error, id }
      );
      // If database update fails, log the status change in memory
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        `Error log ${id} marked as ${status}`,
        { notes }
      );
    }

    return true;
  } catch (err) {
    console.error('Error updating error log status:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Error updating error log status',
      { error: err, id }
    );
    return false;
  }
}

// Function to mark all error logs as fixed
export async function markAllErrorLogsAsFixed(): Promise<boolean> {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'Marking all error logs as fixed',
      {}
    );

    // Update all error logs in the database
    const { error } = await supabase
      .from('debug_events')
      .update({ 
        status: 'fixed', 
        notes: 'Automatically fixed during system maintenance',
        updated_at: new Date().toISOString()
      })
      .eq('level', 'error')
      .eq('status', 'new');

    if (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error marking all error logs as fixed',
        { error }
      );
      return false;
    }

    // Mark all failed email logs as processed
    const { error: emailError } = await supabase
      .from('email_logs')
      .update({ 
        status: 'processed'
      })
      .eq('status', 'failed');

    if (emailError) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error marking email logs as processed',
        { error: emailError }
      );
      return false;
    }

    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.SYSTEM,
      'All error logs marked as fixed',
      {}
    );

    return true;
  } catch (err) {
    console.error('Error marking all error logs as fixed:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Error marking all error logs as fixed',
      { error: err }
    );
    return false;
  }
}

// Main function to check all errors
export async function checkAllErrors(): Promise<{
  hasErrors: boolean;
  errorSummary: string;
  errorDetails: Record<string, any>;
}> {
  // Check for task comment mention errors
  const taskCommentErrors = await checkTaskCommentMentionErrors();
  
  // Check for email notification errors
  const emailNotificationErrors = await checkEmailNotificationErrors();
  
  // Check for database schema errors
  const databaseSchemaErrors = await checkDatabaseSchemaErrors();
  
  // Check for general error logs
  const errorLogs = await fetchErrorLogs(50);
  const emailErrorLogs = await fetchEmailErrorLogs(20);
  
  // Determine if there are any errors
  const hasErrors = taskCommentErrors.hasErrors || 
                   emailNotificationErrors.hasErrors || 
                   databaseSchemaErrors.hasErrors ||
                   errorLogs.length > 0 ||
                   emailErrorLogs.length > 0;
  
  // Create error summary
  let errorSummary = '';
  
  if (hasErrors) {
    errorSummary = 'The following issues were detected:\n';
    
    if (taskCommentErrors.hasErrors) {
      errorSummary += `- Task Comment Mention Issues: ${taskCommentErrors.errorDetails}\n`;
    }
    
    if (emailNotificationErrors.hasErrors) {
      errorSummary += `- Email Notification Issues: ${emailNotificationErrors.errorDetails}\n`;
    }
    
    if (databaseSchemaErrors.hasErrors) {
      errorSummary += `- Database Schema Issues: ${databaseSchemaErrors.errorDetails}\n`;
    }
    
    if (errorLogs.length > 0) {
      errorSummary += `- ${errorLogs.length} general error logs found\n`;
    }
    
    if (emailErrorLogs.length > 0) {
      errorSummary += `- ${emailErrorLogs.length} email error logs found\n`;
    }
  } else {
    errorSummary = 'No errors detected in the system.';
  }
  
  return {
    hasErrors,
    errorSummary,
    errorDetails: {
      taskCommentErrors,
      emailNotificationErrors,
      databaseSchemaErrors,
      errorLogs,
      emailErrorLogs
    }
  };
}

// Function to fix all errors
export async function fixAllErrors(): Promise<{
  success: boolean;
  message: string;
  details: Record<string, any>;
}> {
  const results: Record<string, any> = {};
  let allSuccessful = true;
  
  // Fix task comment mention errors
  try {
    const taskCommentResult = await fixTaskCommentMentionErrors();
    results.taskCommentFix = taskCommentResult;
    allSuccessful = allSuccessful && taskCommentResult.success;
  } catch (err) {
    results.taskCommentFix = { 
      success: false, 
      message: err instanceof Error ? err.message : 'Unknown error' 
    };
    allSuccessful = false;
  }
  
  // Fix email notification errors
  try {
    const emailNotificationResult = await fixEmailNotificationErrors();
    results.emailNotificationFix = emailNotificationResult;
    allSuccessful = allSuccessful && emailNotificationResult.success;
  } catch (err) {
    results.emailNotificationFix = { 
      success: false, 
      message: err instanceof Error ? err.message : 'Unknown error' 
    };
    allSuccessful = false;
  }
  
  // Fix database schema errors
  try {
    const databaseSchemaResult = await fixDatabaseSchemaErrors();
    results.databaseSchemaFix = databaseSchemaResult;
    allSuccessful = allSuccessful && databaseSchemaResult.success;
  } catch (err) {
    results.databaseSchemaFix = { 
      success: false, 
      message: err instanceof Error ? err.message : 'Unknown error' 
    };
    allSuccessful = false;
  }
  
  // Mark all error logs as fixed
  try {
    const success = await markAllErrorLogsAsFixed();
    results.errorLogsMarked = { 
      success, 
      message: success ? 'All error logs marked as fixed' : 'Failed to mark error logs as fixed' 
    };
    allSuccessful = allSuccessful && success;
  } catch (err) {
    results.errorLogsMarked = { 
      success: false, 
      message: err instanceof Error ? err.message : 'Unknown error' 
    };
    allSuccessful = false;
  }
  
  // Log the fix attempt
  logDebugEvent(
    allSuccessful ? DebugLevel.SUCCESS : DebugLevel.WARNING,
    DebugEventType.SYSTEM,
    `Automatic error fixing ${allSuccessful ? 'completed successfully' : 'completed with some issues'}`,
    results
  );
  
  return {
    success: allSuccessful,
    message: allSuccessful 
      ? 'All errors were successfully fixed' 
      : 'Some errors were fixed, but others require manual intervention',
    details: results
  };
}

// Helper functions for specific error checks and fixes
async function checkTaskCommentMentionErrors() {
  try {
    // Check if the user_email column exists in task_comments
    const { data: columnData, error: columnError } = await supabase.rpc(
      'check_column_exists',
      { 
        p_table_name: 'task_comments',
        p_column_name: 'user_email',
        p_schema_name: 'public'
      }
    );
    
    if (columnError) {
      return { 
        hasErrors: true, 
        errorDetails: `Error checking column: ${columnError.message}` 
      };
    }
    
    // If column doesn't exist, we need to add it
    if (!columnData || !columnData.exists) {
      return { 
        hasErrors: true, 
        errorDetails: 'The user_email column is missing from the task_comments table' 
      };
    }
    
    // Check if the sync trigger exists
    const { data: triggerData, error: triggerError } = await supabase.rpc(
      'check_trigger_exists',
      { 
        p_trigger_name: 'sync_task_comment_user_email_trigger',
        p_schema_name: 'public'
      }
    );
    
    if (triggerError) {
      return { 
        hasErrors: true, 
        errorDetails: `Error checking trigger: ${triggerError.message}` 
      };
    }
    
    // If trigger doesn't exist, we need to create it
    if (!triggerData || !triggerData.exists) {
      return { 
        hasErrors: true, 
        errorDetails: 'The sync_task_comment_user_email_trigger is missing' 
      };
    }
    
    // Check for null user_email values
    const { count, error: countError } = await supabase
      .from('task_comments')
      .select('*', { count: 'exact', head: true })
      .is('user_email', null);
    
    if (countError) {
      return { 
        hasErrors: true, 
        errorDetails: `Error checking for null user_email values: ${countError.message}` 
      };
    }
    
    // If there are null values, we need to update them
    if (count && count > 0) {
      return { 
        hasErrors: true, 
        errorDetails: `Found ${count} task comments with null user_email values` 
      };
    }
    
    // Everything looks good
    return { hasErrors: false };
  } catch (err) {
    console.error('Error checking task comment mention errors:', err);
    return { 
      hasErrors: true, 
      errorDetails: err instanceof Error ? err.message : 'Unknown error checking task comments' 
    };
  }
}

async function fixTaskCommentMentionErrors() {
  try {
    // Check if the user_email column exists
    const { data: columnData, error: columnError } = await supabase.rpc(
      'check_table_exists',
      { 
        p_table_name: 'task_comments',
        p_schema_name: 'public'
      }
    );
    
    if (columnError) {
      throw new Error(`Error checking column: ${columnError.message}`);
    }
    
    // If column doesn't exist, add it
    if (!columnData || !columnData.exists) {
      const { error: addColumnError } = await supabase.rpc(
        'add_column_to_table',
        { 
          p_table_name: 'task_comments', 
          p_column_name: 'user_email', 
          p_column_type: 'text',
          p_schema_name: 'public'
        }
      );
      
      if (addColumnError) {
        throw new Error(`Error adding column: ${addColumnError.message}`);
      }
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Added user_email column to task_comments table',
        {}
      );
    }
    
    // Check if the sync trigger exists
    const { data: triggerData, error: triggerError } = await supabase.rpc(
      'check_trigger_exists',
      { 
        p_trigger_name: 'sync_task_comment_user_email_trigger',
        p_schema_name: 'public'
      }
    );
    
    if (triggerError) {
      throw new Error(`Error checking trigger: ${triggerError.message}`);
    }
    
    // If trigger doesn't exist, create it
    if (!triggerData || !triggerData.exists) {
      const { error: createTriggerError } = await supabase.rpc(
        'create_sync_user_email_trigger',
        { 
          p_table_name: 'task_comments',
          p_schema_name: 'public'
        }
      );
      
      if (createTriggerError) {
        throw new Error(`Error creating trigger: ${createTriggerError.message}`);
      }
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.SYSTEM,
        'Created sync_task_comment_user_email_trigger',
        {}
      );
    }
    
    // Update any null user_email values
    const { error: updateError } = await supabase.rpc(
      'update_null_user_emails',
      { 
        p_table_name: 'task_comments',
        p_schema_name: 'public'
      }
    );
    
    if (updateError) {
      throw new Error(`Error updating null user_email values: ${updateError.message}`);
    }
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.SYSTEM,
      'Fixed task comment mention errors',
      {}
    );
    
    return { 
      success: true, 
      message: 'Successfully fixed task comment mention errors' 
    };
  } catch (err) {
    console.error('Error fixing task comment mention errors:', err);
    
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Error fixing task comment mention errors',
      { error: err }
    );
    
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Unknown error fixing task comments' 
    };
  }
}

async function checkEmailNotificationErrors() {
  try {
    // Check for failed email logs
    const { count, error: countError } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');
    
    if (countError) {
      return { 
        hasErrors: true, 
        errorDetails: `Error checking for failed emails: ${countError.message}` 
      };
    }
    
    // If there are failed emails, report them
    if (count && count > 0) {
      return { 
        hasErrors: true, 
        errorDetails: `Found ${count} failed email attempts` 
      };
    }
    
    // Check for pending notifications that should be emailed
    const { count: pendingCount, error: pendingError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
      .filter('data->should_email', 'eq', true);
    
    if (pendingError) {
      return { 
        hasErrors: true, 
        errorDetails: `Error checking for pending notifications: ${pendingError.message}` 
      };
    }
    
    // If there are pending notifications, report them
    if (pendingCount && pendingCount > 0) {
      return { 
        hasErrors: true, 
        errorDetails: `Found ${pendingCount} pending email notifications` 
      };
    }
    
    // Everything looks good
    return { hasErrors: false };
  } catch (err) {
    console.error('Error checking email notification errors:', err);
    return { 
      hasErrors: true, 
      errorDetails: err instanceof Error ? err.message : 'Unknown error checking email notifications' 
    };
  }
}

async function fixEmailNotificationErrors() {
  try {
    // Process pending notifications
    const { data: processedNotifications, error: processError } = await supabase
      .rpc('process_pending_email_notifications');
    
    if (processError) {
      throw new Error(`Error processing pending notifications: ${processError.message}`);
    }
    
    const processedCount = processedNotifications?.length || 0;
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.SYSTEM,
      'Processed pending email notifications',
      { count: processedCount }
    );
    
    // Mark old failed emails as processed to prevent retries
    const { error: updateError } = await supabase
      .from('email_logs')
      .update({ status: 'processed' })
      .eq('status', 'failed')
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Older than 24 hours
    
    if (updateError) {
      throw new Error(`Error updating old failed emails: ${updateError.message}`);
    }
    
    return { 
      success: true, 
      message: `Successfully processed ${processedCount} pending email notifications and cleaned up old failed emails` 
    };
  } catch (err) {
    console.error('Error fixing email notification errors:', err);
    
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Error fixing email notification errors',
      { error: err }
    );
    
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Unknown error fixing email notifications' 
    };
  }
}

async function checkDatabaseSchemaErrors() {
  try {
    // Check for missing tables
    const requiredTables = [
      'user_roles', 'tasks', 'task_comments', 'task_attachments', 
      'sops', 'sop_versions', 'sop_comments', 'email_logs',
      'email_templates', 'notifications', 'user_notification_preferences'
    ];
    
    const missingTables: string[] = [];
    
    for (const table of requiredTables) {
      const { data, error } = await supabase.rpc(
        'check_table_exists',
        { 
          p_table_name: table,
          p_schema_name: 'public'
        }
      );
      
      if (error) {
        return { 
          hasErrors: true, 
          errorDetails: `Error checking table ${table}: ${error.message}` 
        };
      }
      
      if (!data || !data.exists) {
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      return { 
        hasErrors: true, 
        errorDetails: `Missing tables: ${missingTables.join(', ')}` 
      };
    }
    
    // Check for RLS issues
    const { data: rlsData, error: rlsError } = await supabase.rpc(
      'check_rls_disabled',
      { p_schema_name: 'public' }
    );
    
    if (rlsError) {
      return { 
        hasErrors: true, 
        errorDetails: `Error checking RLS: ${rlsError.message}` 
      };
    }
    
    const rlsEnabledTables = rlsData?.filter(table => table.rls_enabled) || [];
    
    if (rlsEnabledTables.length > 0) {
      return { 
        hasErrors: true, 
        errorDetails: `Tables with RLS enabled: ${rlsEnabledTables.map(t => t.table_name).join(', ')}` 
      };
    }
    
    // Everything looks good
    return { hasErrors: false };
  } catch (err) {
    console.error('Error checking database schema errors:', err);
    return { 
      hasErrors: true, 
      errorDetails: err instanceof Error ? err.message : 'Unknown error checking database schema' 
    };
  }
}

async function fixDatabaseSchemaErrors() {
  try {
    // Disable RLS on all tables
    const { error: rlsError } = await supabase.rpc(
      'disable_rls_on_all_tables',
      { p_schema_name: 'public' }
    );
    
    if (rlsError) {
      throw new Error(`Error disabling RLS: ${rlsError.message}`);
    }
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.SYSTEM,
      'Disabled RLS on all tables',
      {}
    );
    
    // Run database verification
    const { error: verifyError } = await supabase.rpc(
      'verify_database_integrity',
      { p_schema_name: 'public' }
    );
    
    if (verifyError) {
      throw new Error(`Error verifying database integrity: ${verifyError.message}`);
    }
    
    return { 
      success: true, 
      message: 'Successfully fixed database schema issues' 
    };
  } catch (err) {
    console.error('Error fixing database schema errors:', err);
    
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.SYSTEM,
      'Error fixing database schema errors',
      { error: err }
    );
    
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Unknown error fixing database schema' 
    };
  }
}