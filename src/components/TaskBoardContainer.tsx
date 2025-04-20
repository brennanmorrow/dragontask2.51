import React, { useState, useEffect } from 'react';
import { TaskBoardHeader } from './TaskBoardHeader';
import { TaskDetailsModal } from './TaskDetailsModal';
import { Task, TaskBoardView, Board, BoardColumn } from '../lib/types';
import { useAppContext } from '../lib/AppContext';
import { 
  fetchBoards, 
  createDefaultBoard, 
  fetchColumns, 
  fetchTasks,
  updateTask,
  updateColumn
} from './TaskBoardService';
import { KanbanView } from './views/KanbanView';
import { CalendarView } from './views/CalendarView';
import { GanttView } from './views/GanttView';
import { ListView } from './views/ListView';
import { ReportsView } from './views/ReportsView';

interface TaskBoardContainerProps {
  clientId: string;
  agencyId: string;
}

export function TaskBoardContainer({ clientId, agencyId }: TaskBoardContainerProps) {
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
    loadBoards();
  }, [clientId]);

  useEffect(() => {
    if (selectedBoard) {
      loadTasksAndColumns();
    }
  }, [selectedBoard]);

  async function loadBoards() {
    try {
      setIsLoading(true);
      
      // Fetch boards
      const boardsData = await fetchBoards(clientId);
      setBoards(boardsData);
      
      // Set default board
      const defaultBoard = boardsData.find(board => board.is_default);
      if (defaultBoard) {
        setSelectedBoard(defaultBoard.id);
      } else if (boardsData.length > 0) {
        setSelectedBoard(boardsData[0].id);
      } else {
        // Create a default board if none exists
        const newBoard = await createDefaultBoard(clientId);
        setBoards([newBoard]);
        setSelectedBoard(newBoard.id);
      }
    } catch (err) {
      console.error('Error loading boards:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTasksAndColumns() {
    if (!selectedBoard) return;
    
    try {
      setIsLoading(true);
      
      // Fetch columns and tasks in parallel
      const [columnsData, tasksData] = await Promise.all([
        fetchColumns(selectedBoard),
        fetchTasks(selectedBoard)
      ]);
      
      setColumns(columnsData);
      setTasks(tasksData);
    } catch (err) {
      console.error('Error loading tasks and columns:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTaskUpdate(taskId: string, updates: Partial<Task>) {
    try {
      await updateTask(taskId, updates);
      
      // Update local state
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
      await updateColumn(columnId, updates);
      
      // Update local state
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
          onTaskUpdated={() => loadTasksAndColumns()}
        />
      )}
    </div>
  );
}