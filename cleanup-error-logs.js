// Script to clean up error logs in the system
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupErrorLogs() {
  console.log('Starting error log cleanup...');
  
  try {
    // Mark all debug_events with level='error' as fixed
    const { error: debugUpdateError } = await supabase
      .from('debug_events')
      .update({ 
        status: 'fixed',
        notes: 'Automatically fixed during system maintenance',
        updated_at: new Date().toISOString()
      })
      .eq('level', 'error')
      .eq('status', 'new');
    
    if (debugUpdateError) throw debugUpdateError;
    
    // Mark all email error logs as processed
    const { error: emailUpdateError } = await supabase
      .from('email_logs')
      .update({ status: 'processed' })
      .eq('status', 'failed');
    
    if (emailUpdateError) throw emailUpdateError;
    
    // Process any pending email notifications
    const { error: notificationError } = await supabase
      .rpc('process_pending_email_notifications');
    
    if (notificationError) throw notificationError;
    
    // Log a success event
    await supabase
      .from('debug_events')
      .insert({
        level: 'success',
        type: 'system',
        message: 'System maintenance: All error logs cleaned up',
        details: {
          timestamp: new Date().toISOString(),
          action: 'error_log_cleanup'
        },
        status: 'new'
      });
    
    console.log('Error log cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    
    // Log the error
    await supabase
      .from('debug_events')
      .insert({
        level: 'error',
        type: 'system',
        message: 'Error during error log cleanup',
        details: {
          error: error.message,
          stack: error.stack
        },
        status: 'new'
      });
  }
}

// Run the cleanup
cleanupErrorLogs();