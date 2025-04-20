import { supabase } from '../lib/supabase';
import { Task, Board, BoardColumn } from '../lib/types';
import { logDebugEvent, DebugLevel, DebugEventType, logApiCall } from '../lib/debugSystem';

export async function fetchBoards(clientId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching boards',
      { clientId }
    );
    
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at');

    if (error) {
      logApiCall('boards.select', false, { error });
      throw error;
    }
    
    logApiCall('boards.select', true, { count: data?.length });
    
    return data || [];
  } catch (err) {
    console.error('Error fetching boards:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching boards',
      { error: err, clientId }
    );
    throw err;
  }
}

export async function createDefaultBoard(clientId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Creating default board',
      { clientId }
    );
    
    const { data, error } = await supabase
      .from('boards')
      .insert([{
        client_id: clientId,
        name: 'Default Board',
        is_default: true
      }])
      .select()
      .single();

    if (error) {
      logApiCall('boards.insert', false, { error });
      throw error;
    }
    
    logApiCall('boards.insert', true, {});
    
    return data;
  } catch (err) {
    console.error('Error creating default board:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error creating default board',
      { error: err, clientId }
    );
    throw err;
  }
}

export async function fetchColumns(boardId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching board columns',
      { boardId }
    );
    
    const { data, error } = await supabase
      .from('board_columns')
      .select('*')
      .eq('board_id', boardId)
      .order('position');

    if (error) {
      logApiCall('board_columns.select', false, { error });
      throw error;
    }
    
    logApiCall('board_columns.select', true, { count: data?.length });
    
    return data || [];
  } catch (err) {
    console.error('Error fetching columns:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching board columns',
      { error: err, boardId }
    );
    throw err;
  }
}

export async function fetchTasks(boardId: string) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching tasks',
      { boardId }
    );
    
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('board_id', boardId)
      .order('position');

    if (tasksError) {
      logApiCall('tasks.select', false, { error: tasksError });
      throw tasksError;
    }
    
    logApiCall('tasks.select', true, { count: tasksData?.length });

    const assignedUserIds = tasksData
      .map(task => task.assigned_to)
      .filter(id => id != null);

    if (assignedUserIds.length > 0) {
      const { data: userData, error: userError } = await supabase
        .from('user_roles')
        .select('user_id, email')
        .in('user_id', assignedUserIds);

      if (userError) {
        logApiCall('user_roles.select', false, { error: userError });
        throw userError;
      }
      
      logApiCall('user_roles.select', true, { count: userData?.length });

      const userEmailMap = Object.fromEntries(
        userData.map(user => [user.user_id, user.email])
      );

      return tasksData.map(task => ({
        ...task,
        assigned_to_email: task.assigned_to ? userEmailMap[task.assigned_to] : null
      }));
    } else {
      return tasksData.map(task => ({ ...task, assigned_to_email: null }));
    }
  } catch (err) {
    console.error('Error fetching tasks:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching tasks',
      { error: err, boardId }
    );
    throw err;
  }
}

export async function updateTask(taskId: string, updates: Partial<Task>) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Updating task',
      { taskId, updates }
    );
    
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);

    if (error) {
      logApiCall('tasks.update', false, { error });
      throw error;
    }
    
    logApiCall('tasks.update', true, {});
    
    return true;
  } catch (err) {
    console.error('Error updating task:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error updating task',
      { error: err, taskId }
    );
    throw err;
  }
}

export async function updateColumn(columnId: string, updates: Partial<BoardColumn>) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Updating column',
      { columnId, updates }
    );
    
    const { error } = await supabase
      .from('board_columns')
      .update(updates)
      .eq('id', columnId);

    if (error) {
      logApiCall('board_columns.update', false, { error });
      throw error;
    }
    
    logApiCall('board_columns.update', true, {});
    
    return true;
  } catch (err) {
    console.error('Error updating column:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error updating column',
      { error: err, columnId }
    );
    throw err;
  }
}