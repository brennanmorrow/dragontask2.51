import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Check, Plus, Trash2, ChevronRight, ChevronDown, Grip, List, CheckSquare } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';
import { BulkChecklistImport } from './BulkChecklistImport';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ChecklistItem {
  id: string;
  task_id: string;
  text: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  children?: ChecklistItem[];
}

interface TaskChecklistProps {
  taskId: string;
}

export function TaskChecklist({ taskId }: TaskChecklistProps) {
  const { user } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isAddingSubItem, setIsAddingSubItem] = useState<string | null>(null);
  const [newSubItemText, setNewSubItemText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ChecklistItem | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Set up DnD sensors
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

  useEffect(() => {
    fetchChecklistItems();
  }, [taskId]);

  const fetchChecklistItems = async () => {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching task checklist items',
        { taskId }
      );
      
      // Fetch all items in a single query
      const { data, error } = await supabase
        .from('task_checklist_items')
        .select('*')
        .eq('task_id', taskId)
        .order('position');
        
      if (error) throw error;

      // Build tree structure using a more efficient approach
      const itemsMap = new Map<string, ChecklistItem>();
      const rootItems: ChecklistItem[] = [];

      // First pass: Create all items without children
      data?.forEach(item => {
        itemsMap.set(item.id, { ...item, children: [] });
      });

      // Second pass: Build relationships
      data?.forEach(item => {
        const currentItem = itemsMap.get(item.id);
        if (!currentItem) return;

        if (item.parent_id === null) {
          rootItems.push(currentItem);
        } else {
          const parent = itemsMap.get(item.parent_id);
          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(currentItem);
          } else {
            // If parent is not found, treat as root item
            rootItems.push(currentItem);
          }
        }
      });

      // Sort root items by position
      rootItems.sort((a, b) => a.position - b.position);

      // Sort children by position
      const sortChildren = (items: ChecklistItem[]) => {
        items.forEach(item => {
          if (item.children && item.children.length > 0) {
            item.children.sort((a, b) => a.position - b.position);
            sortChildren(item.children);
          }
        });
      };
      sortChildren(rootItems);
      
      setItems(rootItems);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task checklist items fetched successfully',
        { taskId, itemCount: data?.length || 0 }
      );
    } catch (err) {
      console.error('Error fetching checklist items:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching task checklist items',
        { error: err, taskId }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Adding task checklist item',
        { taskId, text: newItemText }
      );
      
      // Get the highest position among root items
      const maxPosition = items.reduce((max, item) => Math.max(max, item.position), -1);
      
      const { data, error } = await supabase
        .from('task_checklist_items')
        .insert([
          {
            task_id: taskId,
            text: newItemText.trim(),
            is_completed: false,
            position: maxPosition + 1,
            parent_id: null
          }
        ])
        .select();
        
      if (error) throw error;
      
      setNewItemText('');
      await fetchChecklistItems();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task checklist item added successfully',
        { taskId, itemId: data?.[0]?.id }
      );
    } catch (err) {
      console.error('Error adding checklist item:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error adding task checklist item',
        { error: err, taskId }
      );
    }
  };

  const handleAddSubItem = async (parentId: string) => {
    if (!newSubItemText.trim()) return;
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Adding task checklist sub-item',
        { taskId, parentId, text: newSubItemText }
      );
      
      // Find parent and get max position of its children
      const parent = findItemById(items, parentId);
      if (!parent) throw new Error('Parent item not found');
      
      const maxPosition = parent.children 
        ? parent.children.reduce((max, item) => Math.max(max, item.position), -1)
        : -1;
      
      const { data, error } = await supabase
        .from('task_checklist_items')
        .insert([
          {
            task_id: taskId,
            text: newSubItemText.trim(),
            is_completed: false,
            position: maxPosition + 1,
            parent_id: parentId
          }
        ])
        .select();
        
      if (error) throw error;
      
      setNewSubItemText('');
      setIsAddingSubItem(null);
      await fetchChecklistItems();
      
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        newSet.add(parentId);
        return newSet;
      });
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task checklist sub-item added successfully',
        { taskId, parentId, itemId: data?.[0]?.id }
      );
    } catch (err) {
      console.error('Error adding checklist sub-item:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error adding task checklist sub-item',
        { error: err, taskId, parentId }
      );
    }
  };

  const handleToggleItem = async (id: string, isCompleted: boolean) => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Toggling task checklist item',
        { taskId, itemId: id, isCompleted }
      );
      
      const { error } = await supabase
        .from('task_checklist_items')
        .update({ is_completed: isCompleted })
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state efficiently
      setItems(prevItems => updateItemInTree(prevItems, id, { is_completed: isCompleted }));
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task checklist item toggled successfully',
        { taskId, itemId: id, isCompleted }
      );
    } catch (err) {
      console.error('Error toggling checklist item:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error toggling task checklist item',
        { error: err, taskId, itemId: id }
      );
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Deleting task checklist item',
        { taskId, itemId: id }
      );
      
      const { error } = await supabase
        .from('task_checklist_items')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      await fetchChecklistItems();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task checklist item deleted successfully',
        { taskId, itemId: id }
      );
    } catch (err) {
      console.error('Error deleting checklist item:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error deleting task checklist item',
        { error: err, taskId, itemId: id }
      );
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleBulkImport = async (itemTexts: string[]) => {
    if (itemTexts.length === 0) return;
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Bulk importing checklist items',
        { taskId, itemCount: itemTexts.length }
      );
      
      // Get the highest position from existing items
      let maxPosition = 0;
      if (items.length > 0) {
        maxPosition = Math.max(...items.map(item => item.position));
      }
      
      // Prepare items for insertion
      const itemsToInsert = itemTexts.map((text, index) => ({
        task_id: taskId,
        text: text.trim(),
        is_completed: false,
        position: maxPosition + 1 + index,
        parent_id: null
      }));
      
      // Insert items in batches of 50
      const batchSize = 50;
      for (let i = 0; i < itemsToInsert.length; i += batchSize) {
        const batch = itemsToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('task_checklist_items')
          .insert(batch);
          
        if (error) throw error;
      }
      
      await fetchChecklistItems();
      setShowBulkImport(false);
      
      setSuccessMessage(`Successfully imported ${itemTexts.length} checklist items`);
      setTimeout(() => setSuccessMessage(null), 5000);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Bulk imported checklist items successfully',
        { taskId, itemCount: itemTexts.length }
      );
    } catch (err) {
      console.error('Error bulk importing checklist items:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error bulk importing checklist items',
        { error: err, taskId }
      );
    }
  };

  // Helper function to find an item by ID in the tree
  const findItemById = (items: ChecklistItem[], id: string): ChecklistItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children && item.children.length > 0) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper function to update an item in the tree
  const updateItemInTree = (items: ChecklistItem[], id: string, updates: Partial<ChecklistItem>): ChecklistItem[] => {
    return items.map(item => {
      if (item.id === id) {
        return { ...item, ...updates };
      }
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: updateItemInTree(item.children, id, updates)
        };
      }
      return item;
    });
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    const item = findItemById(items, active.id as string);
    if (item) {
      setActiveItem(item);
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const activeItem = findItemById(items, active.id as string);
      const overItem = findItemById(items, over.id as string);
      
      if (!activeItem || !overItem) return;
      
      // Only allow reordering at the same level
      if (activeItem.parent_id !== overItem.parent_id) return;
      
      let sameLevel: ChecklistItem[] = [];
      
      if (activeItem.parent_id) {
        const parent = findItemById(items, activeItem.parent_id);
        if (parent && parent.children) {
          sameLevel = [...parent.children];
        }
      } else {
        sameLevel = [...items];
      }
      
      const oldIndex = sameLevel.findIndex(item => item.id === active.id);
      const newIndex = sameLevel.findIndex(item => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        try {
          setIsLoading(true);
          
          const newOrder = arrayMove(sameLevel, oldIndex, newIndex);
          
          // Update positions in batches
          const updates = newOrder.map((item, index) => ({
            id: item.id,
            position: index
          }));
          
          // Update in batches of 10 to reduce database load
          const batchSize = 10;
          for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            await Promise.all(
              batch.map(update =>
                supabase
                  .from('task_checklist_items')
                  .update({ position: update.position })
                  .eq('id', update.id)
              )
            );
          }
          
          await fetchChecklistItems();
          
          logDebugEvent(
            DebugLevel.SUCCESS,
            DebugEventType.USER_ACTION,
            'Reordered checklist items',
            { taskId, movedItemId: active.id }
          );
        } catch (err) {
          console.error('Error reordering checklist items:', err);
          setError(err instanceof Error ? err.message : 'An error occurred');
          
          logDebugEvent(
            DebugLevel.ERROR,
            DebugEventType.API_CALL,
            'Error reordering checklist items',
            { error: err, taskId }
          );
        } finally {
          setIsLoading(false);
        }
      }
    }
    
    setActiveId(null);
    setActiveItem(null);
  };

  // Sortable checklist item component
  const SortableChecklistItem = ({ item, level = 0 }: { item: ChecklistItem; level?: number }) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({ id: item.id });
    
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 10 : 1,
    };
    
    return (
      <div ref={setNodeRef} style={style} className="mb-2">
        <div className={`flex items-center group ${isDragging ? 'bg-gray-100 rounded' : ''}`}>
          <div 
            className="pl-2" 
            style={{ marginLeft: `${level * 24}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => handleToggleExpand(item.id)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6"></div>
            )}
          </div>
          
          <div className="flex-1 flex items-center">
            <button
              onClick={() => handleToggleItem(item.id, !item.is_completed)}
              className={`flex-shrink-0 h-5 w-5 rounded border ${
                item.is_completed 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : 'border-gray-300 bg-white'
              } mr-2 flex items-center justify-center`}
              style={item.is_completed ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
            >
              {item.is_completed && <Check className="h-3 w-3 text-white" />}
            </button>
            
            <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-700'}`}>
              {item.text}
            </span>
          </div>
          
          <div className="flex items-center">
            <div 
              {...attributes} 
              {...listeners} 
              className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-manipulation"
              title="Drag to reorder"
            >
              <Grip className="h-4 w-4" />
            </div>
            
            <button
              onClick={() => setIsAddingSubItem(item.id)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Add sub-item"
            >
              <Plus className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => handleDeleteItem(item.id)}
              className="p-1 text-gray-400 hover:text-red-600"
              title="Delete item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {isAddingSubItem === item.id && (
          <div className="flex items-center mt-2" style={{ marginLeft: `${(level + 1) * 24 + 24}px` }}>
            <input
              type="text"
              value={newSubItemText}
              onChange={(e) => setNewSubItemText(e.target.value)}
              placeholder="Add sub-item..."
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddSubItem(item.id);
                } else if (e.key === 'Escape') {
                  setIsAddingSubItem(null);
                  setNewSubItemText('');
                }
              }}
              autoFocus
            />
            <button
              onClick={() => handleAddSubItem(item.id)}
              className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAddingSubItem(null);
                setNewSubItemText('');
              }}
              className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
        
        {isExpanded && hasChildren && (
          <div className="mt-1">
            <SortableChildItems items={item.children || []} level={level + 1} />
          </div>
        )}
      </div>
    );
  };

  // Sortable context for child items
  const SortableChildItems = ({ items, level }: { items: ChecklistItem[]; level: number }) => {
    return (
      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        {items.map(item => (
          <SortableChecklistItem key={item.id} item={item} level={level} />
        ))}
      </SortableContext>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (showBulkImport) {
    return (
      <BulkChecklistImport 
        onImport={handleBulkImport}
        onCancel={() => setShowBulkImport(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Checklist</h3>
        <button
          onClick={() => setShowBulkImport(true)}
          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
          title="Bulk import items"
        >
          <List className="h-4 w-4 mr-1" />
          Bulk Import
        </button>
      </div>
      
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
      
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckSquare className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <div className="text-sm text-green-700">{successMessage}</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Add a new item..."
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddItem();
            }
          }}
        />
        <button
          onClick={handleAddItem}
          className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </button>
      </div>
      
      <div className="mt-4 space-y-1">
        {items.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
              {items.map(item => (
                <SortableChecklistItem key={item.id} item={item} />
              ))}
            </SortableContext>
            
            <DragOverlay>
              {activeItem ? (
                <div className="bg-white shadow-md rounded p-2 border border-gray-200">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-5 w-5 rounded border ${
                      activeItem.is_completed 
                        ? 'bg-blue-500 border-blue-500 text-white' 
                        : 'border-gray-300 bg-white'
                      } mr-2 flex items-center justify-center`}
                      style={activeItem.is_completed ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                    >
                      {activeItem.is_completed && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm ${activeItem.is_completed ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                      {activeItem.text}
                    </span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No checklist items yet. Add some items to track your progress.
          </p>
        )}
      </div>
    </div>
  );
}