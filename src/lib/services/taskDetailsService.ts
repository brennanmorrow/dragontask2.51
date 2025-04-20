import { supabase } from '../supabase';
import { Task, TaskComment, TaskAttachment } from '../types';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../debugSystem';

/**
 * Fetch a task by ID
 */
export async function fetchTask(taskId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching task details',
      { taskId }
    );
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      logApiCall('tasks.select', false, { error });
      throw error;
    }
    
    logApiCall('tasks.select', true, {});
    
    return data;
  } catch (err) {
    console.error('Error fetching task:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching task details',
      { error: err, taskId }
    );
    throw err;
  }
}

/**
 * Fetch the email of a user assigned to a task
 */
export async function fetchAssignedUserEmail(userId: string) {
  try {
    if (!userId) return null;
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching assigned user email',
      { userId }
    );
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('email')
      .eq('user_id', userId)
      .single();

    if (error) {
      logApiCall('user_roles.select', false, { error });
      throw error;
    }
    
    logApiCall('user_roles.select', true, {});
    
    return data.email;
  } catch (err) {
    console.error('Error fetching assigned user email:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching assigned user email',
      { error: err, userId }
    );
    throw err;
  }
}

/**
 * Fetch comments for a task
 */
export async function fetchComments(taskId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching task comments',
      { taskId }
    );
    
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      logApiCall('task_comments.select', false, { error });
      throw error;
    }
    
    logApiCall('task_comments.select', true, { count: data?.length });
    
    return data || [];
  } catch (err) {
    console.error('Error fetching comments:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching task comments',
      { error: err, taskId }
    );
    throw err;
  }
}

/**
 * Fetch attachments for a task
 */
export async function fetchAttachments(taskId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching task attachments',
      { taskId }
    );
    
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      logApiCall('task_attachments.select', false, { error });
      throw error;
    }
    
    logApiCall('task_attachments.select', true, { count: data?.length });
    
    return data || [];
  } catch (err) {
    console.error('Error fetching attachments:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching task attachments',
      { error: err, taskId }
    );
    throw err;
  }
}

/**
 * Fetch users for task assignment
 */
export async function fetchUsers() {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching users for task assignment',
      {}
    );
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, email')
      .order('email');

    if (error) {
      logApiCall('user_roles.select', false, { error });
      throw error;
    }
    
    logApiCall('user_roles.select', true, { count: data?.length });
    
    return data.map(user => ({ id: user.user_id, email: user.email })) || [];
  } catch (err) {
    console.error('Error fetching users:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching users for task assignment',
      { error: err }
    );
    throw err;
  }
}

/**
 * Create or update a task
 */
export async function createOrUpdateTask(taskId: string | null, taskData: Partial<Task>) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      taskId ? 'Updating task' : 'Creating task',
      { taskId, taskData }
    );
    
    if (taskId) {
      // Update existing task
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId);

      if (error) {
        logApiCall('tasks.update', false, { error });
        throw error;
      }
      
      logApiCall('tasks.update', true, {});
    } else {
      // Create new task
      const { error } = await supabase
        .from('tasks')
        .insert([taskData]);

      if (error) {
        logApiCall('tasks.insert', false, { error });
        throw error;
      }
      
      logApiCall('tasks.insert', true, {});
    }
    
    return true;
  } catch (err) {
    console.error('Error saving task:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error saving task',
      { error: err, taskId }
    );
    throw err;
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Deleting task',
      { taskId }
    );
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      logApiCall('tasks.delete', false, { error });
      throw error;
    }
    
    logApiCall('tasks.delete', true, {});
    
    return true;
  } catch (err) {
    console.error('Error deleting task:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error deleting task',
      { error: err, taskId }
    );
    throw err;
  }
}

/**
 * Add a comment to a task
 */
export async function addComment(taskId: string, userId: string, content: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Adding task comment',
      { taskId, userId, contentLength: content.length }
    );
    
    const { error } = await supabase
      .from('task_comments')
      .insert([{
        task_id: taskId,
        user_id: userId,
        content
      }]);

    if (error) {
      logApiCall('task_comments.insert', false, { error });
      throw error;
    }
    
    logApiCall('task_comments.insert', true, {});
    
    return true;
  } catch (err) {
    console.error('Error adding comment:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error adding task comment',
      { error: err, taskId }
    );
    throw err;
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Deleting task comment',
      { commentId }
    );
    
    const { error } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      logApiCall('task_comments.delete', false, { error });
      throw error;
    }
    
    logApiCall('task_comments.delete', true, {});
    
    return true;
  } catch (err) {
    console.error('Error deleting comment:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error deleting task comment',
      { error: err, commentId }
    );
    throw err;
  }
}

/**
 * Add an attachment to a task
 */
export async function addAttachment(taskId: string, userId: string, file: File) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Adding task attachment',
      { taskId, userId, fileName: file.name, fileSize: file.size }
    );
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${taskId}-${Date.now()}.${fileExt}`;
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('task-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logApiCall('storage.upload', false, { error: uploadError });
      throw uploadError;
    }
    
    logApiCall('storage.upload', true, {});

    const { data: { publicUrl } } = supabase.storage
      .from('task-attachments')
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('task_attachments')
      .insert([{
        task_id: taskId,
        user_id: userId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: publicUrl
      }]);

    if (dbError) {
      logApiCall('task_attachments.insert', false, { error: dbError });
      throw dbError;
    }
    
    logApiCall('task_attachments.insert', true, {});
    
    return true;
  } catch (err) {
    console.error('Error adding attachment:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error adding task attachment',
      { error: err, taskId }
    );
    throw err;
  }
}

/**
 * Delete an attachment
 */
export async function deleteAttachment(attachmentId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Deleting task attachment',
      { attachmentId }
    );
    
    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      logApiCall('task_attachments.delete', false, { error });
      throw error;
    }
    
    logApiCall('task_attachments.delete', true, {});
    
    return true;
  } catch (err) {
    console.error('Error deleting attachment:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error deleting task attachment',
      { error: err, attachmentId }
    );
    throw err;
  }
}