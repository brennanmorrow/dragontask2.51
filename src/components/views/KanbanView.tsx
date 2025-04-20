import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { TaskCard } from '../TaskCard';
import { ColumnEditorModal } from '../ColumnEditorModal';
import { supabase } from '../../lib/supabase';
import { Task, TaskStatus, BoardColumn } from '../../lib/types';
import { Settings, Plus, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { TaskFilters } from '../TaskFilters';
import { filterTasks } from '../../lib/filters';
import { useAppContext } from '../../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../../lib/debugSystem';
import { SortableTaskCard } from '../SortableTaskCard';

interface KanbanViewProps {
  clientId: string;
  boardId: string;
  tasks: Task[];
  columns: BoardColumn[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onColumnUpdate: (columnId: string, updates: Partial<BoardColumn>) => Promise<void>;
  onTaskClick: (taskId: string) => void;
}

export function KanbanView({ 
  clientId,
  boardId,
  tasks, 
  columns,
  onTaskUpdate,
  onColumnUpdate,
  onTaskClick 
}: KanbanViewProps) {
  const { systemSettings } = useAppContext();
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    priority: [] as string[],
    assignee: [] as string[],
    dueDate: null as string | null
  });
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get unique users for filtering
  const users = useMemo(() => {
    const userMap = new Map();
    tasks.forEach(task => {
      if (task.assigned_to && task.assigned_to_email) {
        userMap.set(task.assigned_to, {
          id: task.assigned_to,
          email: task.assigned_to_email
        });
      }
    });
    return Array.from(userMap.values());
  }, [tasks]);

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    return filterTasks(tasks, searchTerm, filters);
  }, [tasks, searchTerm, filters]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped = {} as Record<string, Task[]>;
    
    // Initialize with empty arrays for all columns
    columns.forEach(column => {
      grouped[column.key] = [];
    });
    
    // Add tasks to their respective columns
    filteredTasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        // If the column doesn't exist, add to the first column
        const firstColumnKey = columns[0]?.key;
        if (firstColumnKey) {
          grouped[firstColumnKey] = grouped[firstColumnKey] || [];
          grouped[firstColumnKey].push(task);
        }
      }
    });
    
    return grouped;
  }, [filteredTasks, columns]);

  // Scroll handlers for horizontal scrolling
  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
      setScrollPosition(scrollContainerRef.current.scrollLeft - 300);
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
      setScrollPosition(scrollContainerRef.current.scrollLeft + 300);
    }
  };

  // Update scroll position when scrolling
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setScrollPosition(scrollContainerRef.current.scrollLeft);
    }
  };

  // Add scroll event listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Find the task being dragged
    const task = tasks.find(t => t.id === active.id);
    if (task) {
      setActiveTask(task);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'User started dragging a task',
        { taskId: task.id, taskTitle: task.title }
      );
    }
  };

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    // Skip if no over element or same as active
    if (!over) return;
    
    // Find the task being dragged
    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;
    
    // Get the column ID from the over element
    // The over.id could be either a task ID or a column ID
    const overTask = tasks.find(t => t.id === over.id);
    const overColumnKey = overTask ? overTask.status : over.id as string;
    
    // Set the column being dragged over
    setDraggedOverColumn(overColumnKey);
    
    // Skip if the task is already in this column
    if (activeTask.status === overColumnKey) return;
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveTask(null);
    setDraggedOverColumn(null);
    
    if (!over) return;
    
    // If the task was dropped on another task or a column
    if (active.id !== over.id) {
      const activeTask = tasks.find(t => t.id === active.id);
      if (!activeTask) return;
      
      // Determine the target column
      const overTask = tasks.find(t => t.id === over.id);
      const overColumnKey = overTask ? overTask.status : over.id as string;
      
      // If the task is being moved to a different column
      if (activeTask.status !== overColumnKey) {
        try {
          setIsUpdating(true);
          
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.USER_ACTION,
            'User moved task to new column',
            { 
              taskId: activeTask.id, 
              fromStatus: activeTask.status, 
              toStatus: overColumnKey 
            }
          );
          
          // Update the task's status
          await onTaskUpdate(activeTask.id, { status: overColumnKey as TaskStatus });
          
          // If the task was dropped on another task, we might want to reorder
          if (overTask && overTask.status === overColumnKey) {
            // Get all tasks in this column
            const columnTasks = tasksByStatus[overColumnKey];
            
            // Find the indices
            const oldIndex = columnTasks.findIndex(t => t.id === active.id);
            const newIndex = columnTasks.findIndex(t => t.id === over.id);
            
            if (oldIndex !== -1 && newIndex !== -1) {
              // Reorder the tasks
              const newOrder = arrayMove(columnTasks, oldIndex, newIndex);
              
              // Update positions in the database
              await updateTaskPositions(newOrder);
            }
          }
        } catch (error) {
          console.error('Error updating task status:', error);
          
          logDebugEvent(
            DebugLevel.ERROR,
            DebugEventType.API_CALL,
            'Error updating task status during drag',
            { error, taskId: activeTask.id }
          );
        } finally {
          setIsUpdating(false);
        }
      } else if (overTask) {
        // If the task is being reordered within the same column
        const columnTasks = tasksByStatus[activeTask.status];
        
        // Find the indices
        const oldIndex = columnTasks.findIndex(t => t.id === active.id);
        const newIndex = columnTasks.findIndex(t => t.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Reorder the tasks
          const newOrder = arrayMove(columnTasks, oldIndex, newIndex);
          
          // Update positions in the database
          await updateTaskPositions(newOrder);
        }
      }
    }
  };

  // Update task positions in the database
  const updateTaskPositions = async (orderedTasks: Task[]) => {
    try {
      setIsUpdating(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Updating task positions',
        { taskCount: orderedTasks.length }
      );
      
      // Update each task's position
      for (let i = 0; i < orderedTasks.length; i++) {
        await onTaskUpdate(orderedTasks[i].id, { position: i });
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task positions updated successfully',
        { taskCount: orderedTasks.length }
      );
    } catch (error) {
      console.error('Error updating task positions:', error);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error updating task positions',
        { error }
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <TaskFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filters={filters}
            onFilterChange={setFilters}
            users={users}
            clearFilters={() => {
              setSearchTerm('');
              setFilters({
                priority: [],
                assignee: [],
                dueDate: null
              });
            }}
          />
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex-shrink-0 inline-flex items-center gap-x-2 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="h-5 w-5" />
          Add Column
        </button>
      </div>

      {/* Kanban Board with Horizontal Scroll Controls */}
      <div className="relative">
        {/* Left scroll button */}
        {scrollPosition > 10 && (
          <button
            onClick={handleScrollLeft}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md hover:bg-gray-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
        )}
        
        {/* Kanban columns container */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div 
            ref={scrollContainerRef}
            className="flex gap-6 p-6 overflow-x-auto min-h-[calc(100vh-16rem)] bg-gray-100 rounded-lg hide-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus[column.key] || []}
                onTaskClick={onTaskClick}
                onColumnUpdate={onColumnUpdate}
                isOver={draggedOverColumn === column.key}
              />
            ))}
            
            {/* Drag overlay */}
            <DragOverlay>
              {activeTask && (
                <div className="w-80 opacity-80">
                  <TaskCard task={activeTask} onClick={() => {}} />
                </div>
              )}
            </DragOverlay>
          </div>
        </DndContext>
        
        {/* Right scroll button */}
        <button
          onClick={handleScrollRight}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md hover:bg-gray-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Column Creation Modal */}
      {isCreating && (
        <ColumnEditorModal
          boardId={boardId}
          onClose={() => setIsCreating(false)}
          onSave={async (columnData) => {
            try {
              // Check if we've reached the maximum number of columns
              const { count } = await supabase
                .from('board_columns')
                .select('id', { count: 'exact' })
                .eq('board_id', boardId);

              if (count && count >= 10) {
                throw new Error('Maximum of 10 columns allowed per board');
              }

              const { data, error } = await supabase
                .from('board_columns')
                .insert([{
                  ...columnData,
                  board_id: boardId,
                  position: count || 0
                }])
                .select()
                .single();

              if (error) throw error;

              window.location.reload();
            } catch (err) {
              console.error('Error creating column:', err);
              throw err;
            }
          }}
        />
      )}

      {/* Custom CSS for hiding scrollbars */}
      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

interface KanbanColumnProps {
  column: BoardColumn;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onColumnUpdate?: (columnId: string, updates: Partial<BoardColumn>) => Promise<void>;
  isOver?: boolean;
}

function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onColumnUpdate,
  isOver = false
}: KanbanColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { systemSettings } = useAppContext();

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Memoize sortable items
  const sortableItems = useMemo(() => tasks.map(t => t.id), [tasks]);

  // Memoize column settings click handler
  const handleColumnSettings = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  // Memoize column update handler
  const handleColumnUpdate = useCallback(async (updates: Partial<BoardColumn>) => {
    if (onColumnUpdate) {
      await onColumnUpdate(column.id, updates);
    }
  }, [column.id, onColumnUpdate]);

  return (
    <div className="flex-shrink-0 w-80">
      <div 
        className={`bg-white rounded-lg shadow-sm overflow-hidden flex flex-col h-full ${
          isOver ? 'ring-2 ring-blue-500' : ''
        }`}
        style={{
          borderTopWidth: '4px',
          borderTopColor: column.color || '#94A3B8',
          borderTopStyle: 'solid'
        }}
        data-column-id={column.key}
      >
        {/* Column Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white">
          <div className="flex items-center space-x-2">
            <span className="text-xl select-none">{column.icon}</span>
            <div>
              <h3 className="font-medium text-gray-900">{column.name}</h3>
              <p className="text-xs text-gray-500">{tasks.length} tasks</p>
            </div>
          </div>
          {onColumnUpdate && (
            <button
              onClick={handleColumnSettings}
              className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tasks Container */}
        <div
          className={`p-4 space-y-3 bg-gray-50 flex-grow overflow-y-auto max-h-[calc(100vh-20rem)] transition-colors ${
            isOver ? 'bg-blue-50' : ''
          }`}
        >
          <SortableContext
            items={sortableItems}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
              />
            ))}
            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
                <p>No tasks</p>
                <p className="text-xs">Drag tasks here or add a new one</p>
              </div>
            )}
          </SortableContext>
        </div>
      </div>

      {/* Column Editor Modal */}
      {isEditing && onColumnUpdate && (
        <ColumnEditorModal
          column={column}
          boardId={column.board_id}
          onClose={() => setIsEditing(false)}
          onSave={handleColumnUpdate}
          onDelete={async (columnId) => {
            try {
              const { error: taskError } = await supabase
                .from('tasks')
                .update({ status: 'inbox' as TaskStatus })
                .eq('board_id', column.board_id)
                .eq('status', column.key);

              if (taskError) throw taskError;

              const { error } = await supabase
                .from('board_columns')
                .delete()
                .eq('id', columnId);

              if (error) throw error;

              window.location.reload();
            } catch (err) {
              console.error('Error deleting column:', err);
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}