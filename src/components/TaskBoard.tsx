import React, { useState, useEffect } from 'react';
import { TaskBoardHeader } from './TaskBoardHeader';
import { KanbanView } from './views/KanbanView';
import { CalendarView } from './views/CalendarView';
import { GanttView } from './views/GanttView';
import { ListView } from './views/ListView';
import { ReportsView } from './views/ReportsView';
import { TaskDetailsModal } from './TaskDetailsModal';
import { supabase } from '../lib/supabase';
import { Task, TaskBoardView, Board, BoardColumn } from '../lib/types';
import { useAppContext } from '../lib/AppContext';

interface TaskBoardProps {
  clientId: string;
  agencyId: string;
}

export function TaskBoard({ clientId, agencyId }: TaskBoardProps) {
  const [view, setView] = useState<TaskBoardView>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { systemSettings } = useAppContext();

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchBoards();
  }, [clientId]);

  useEffect(() => {
    if (selectedBoard) {
      fetchTasks();
      fetchColumns();
    }
  }, [selectedBoard]);

  async function fetchBoards() {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at');

      if (error) throw error;

      setBoards(data);
      
      // Set default board
      const defaultBoard = data.find(board => board.is_default);
      if (defaultBoard) {
        setSelectedBoard(defaultBoard.id);
      } else if (data.length > 0) {
        setSelectedBoard(data[0].id);
      } else {
        // Create a default board if none exists
        const { data: newBoard, error: createError } = await supabase
          .from('boards')
          .insert([{
            client_id: clientId,
            name: 'Default Board',
            is_default: true
          }])
          .select()
          .single();

        if (createError) throw createError;
        setBoards([newBoard]);
        setSelectedBoard(newBoard.id);
      }
    } catch (err) {
      console.error('Error fetching boards:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchColumns() {
    if (!selectedBoard) return;

    try {
      const { data, error } = await supabase
        .from('board_columns')
        .select('*')
        .eq('board_id', selectedBoard)
        .order('position');

      if (error) throw error;
      setColumns(data);
    } catch (err) {
      console.error('Error fetching columns:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchTasks() {
    if (!selectedBoard) return;

    try {
      setIsLoading(true);
      
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('board_id', selectedBoard)
        .order('position');

      if (tasksError) throw tasksError;

      const assignedUserIds = tasksData
        .map(task => task.assigned_to)
        .filter(id => id != null);

      if (assignedUserIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from('user_roles')
          .select('user_id, email')
          .in('user_id', assignedUserIds);

        if (userError) throw userError;

        const userEmailMap = Object.fromEntries(
          userData.map(user => [user.user_id, user.email])
        );

        const tasksWithEmails = tasksData.map(task => ({
          ...task,
          assigned_to_email: task.assigned_to ? userEmailMap[task.assigned_to] : null
        }));

        setTasks(tasksWithEmails);
      } else {
        setTasks(tasksData.map(task => ({ ...task, assigned_to_email: null })));
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTaskUpdate(taskId: string, updates: Partial<Task>) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      ));
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleColumnUpdate(columnId: string, updates: Partial<BoardColumn>) {
    try {
      const { error } = await supabase
        .from('board_columns')
        .update(updates)
        .eq('id', columnId);

      if (error) throw error;

      setColumns(columns.map(column =>
        column.id === columnId ? { ...column, ...updates } : column
      ));
    } catch (err) {
      console.error('Error updating column:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  const handleTaskClick = (taskId: string) => {
    setSelectedTask(taskId);
    setIsModalOpen(true);
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    if (!selectedBoard) return null;

    const viewProps = {
      clientId,
      boardId: selectedBoard,
      tasks,
      columns,
      onTaskUpdate: handleTaskUpdate,
      onColumnUpdate: handleColumnUpdate,
      onTaskClick: handleTaskClick
    };

    switch (view) {
      case 'kanban':
        return <KanbanView {...viewProps} />;
      case 'calendar':
        return <CalendarView {...viewProps} />;
      case 'gantt':
        return <GanttView {...viewProps} />;
      case 'list':
        return <ListView {...viewProps} />;
      case 'reports':
        return <ReportsView {...viewProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <TaskBoardHeader
        view={view}
        onViewChange={setView}
        onNewTask={handleNewTask}
      />

      {selectedBoard && renderView()}

      {isModalOpen && (
        <TaskDetailsModal
          taskId={selectedTask}
          boardId={selectedBoard!}
          clientId={clientId}
          agencyId={agencyId}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={fetchTasks}
        />
      )}
    </div>
  );
}