import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Save, Trash2, Clock, Calendar, User, Tag, FileText, Link2, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Task, TaskComment, TaskAttachment } from '../lib/types';
import { format } from 'date-fns';
import { TaskComments } from './TaskComments';
import { TaskAttachments } from './TaskAttachments';
import { TaskTimer } from './TaskTimer';
import { TaskSopSelector } from './TaskSopSelector';
import { TaskChecklist } from './TaskChecklist';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface TaskDetailsModalProps {
  taskId: string | null;
  boardId: string;
  clientId: string;
  agencyId: string;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export function TaskDetailsModal({
  taskId,
  boardId,
  clientId,
  agencyId,
  onClose,
  onTaskUpdated
}: TaskDetailsModalProps) {
  const { user, role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [task, setTask] = useState<Task | null>(null);
  const [assignedUserEmail, setAssignedUserEmail] = useState<string | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'inbox',
    priority: 'medium',
    assigned_to: '',
    start_date: '',
    finish_date: '',
    estimated_hours: '',
    estimated_cost: ''
  });
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'attachments' | 'time' | 'sops' | 'checklist'>('details');
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    if (taskId) {
      fetchTask();
      fetchComments();
      fetchAttachments();
    } else {
      setIsLoading(false);
    }
    fetchUsers();
  }, [taskId]);

  async function fetchTask() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching task details',
        { taskId }
      );
      
      // First fetch the task
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (taskError) throw taskError;

      if (!taskData) {
        throw new Error('Task not found');
      }

      // If task has an assigned user, fetch their email
      if (taskData.assigned_to) {
        const { data: userData, error: userError } = await supabase
          .from('user_roles')
          .select('email')
          .eq('user_id', taskData.assigned_to)
          .maybeSingle();

        if (userError) throw userError;
        setAssignedUserEmail(userData?.email || null);
      }

      setTask(taskData);
      setFormData({
        title: taskData.title || '',
        description: taskData.description || '',
        status: taskData.status || 'inbox',
        priority: taskData.priority || 'medium',
        assigned_to: taskData.assigned_to || '',
        start_date: taskData.start_date ? format(new Date(taskData.start_date), 'yyyy-MM-dd') : '',
        finish_date: taskData.finish_date ? format(new Date(taskData.finish_date), 'yyyy-MM-dd') : '',
        estimated_hours: taskData.estimated_hours?.toString() || '',
        estimated_cost: taskData.estimated_cost?.toString() || ''
      });
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task details fetched successfully',
        { taskId }
      );
    } catch (err) {
      console.error('Error fetching task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching task details',
        { error: err, taskId }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchComments() {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  }

  async function fetchAttachments() {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (err) {
      console.error('Error fetching attachments:', err);
    }
  }

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, email')
        .order('email');

      if (error) throw error;
      setUsers(data.map(user => ({ id: user.user_id, email: user.email })) || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        taskId ? 'Updating task' : 'Creating task',
        { taskId, formData }
      );
      
      const taskData = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        start_date: formData.start_date || null,
        finish_date: formData.finish_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        board_id: boardId,
        client_id: clientId,
        agency_id: agencyId
      };

      if (taskId) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', taskId);

        if (error) throw error;
      } else {
        // Create new task
        const { error } = await supabase
          .from('tasks')
          .insert([taskData]);

        if (error) throw error;
      }

      onTaskUpdated();
      onClose();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        taskId ? 'Task updated successfully' : 'Task created successfully',
        { taskId }
      );
    } catch (err) {
      console.error('Error saving task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error saving task',
        { error: err, taskId }
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTask() {
    if (!taskId || !confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      
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

      if (error) throw error;

      onTaskUpdated();
      onClose();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task deleted successfully',
        { taskId }
      );
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error deleting task',
        { error: err, taskId }
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAddComment(content: string) {
    if (!taskId || !user) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert([{
          task_id: taskId,
          user_id: user.id,
          content
        }]);

      if (error) throw error;
      await fetchComments();
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      await fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleAddAttachment(file: File) {
    if (!taskId || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}-${Date.now()}.${fileExt}`;
      const filePath = `files/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert([{
          task_id: taskId,
          user_id: user.id,
          name: file.name,
          size: file.size,
          type: file.type,
          url: publicUrl
        }]);

      if (dbError) throw dbError;
      await fetchAttachments();
    } catch (err) {
      console.error('Error adding attachment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    try {
      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
      await fetchAttachments();
    } catch (err) {
      console.error('Error deleting attachment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  // Check if user has permission to edit
  const canEdit = ['system_admin', 'agency_admin', 'client_admin'].includes(role) || 
                 (task?.assigned_to === user?.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {taskId ? 'Edit Task' : 'Create Task'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                )}

                <div className="flex space-x-4">
                  {/* Tabs */}
                  <div className="w-48 flex-shrink-0">
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => setActiveTab('details')}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          activeTab === 'details'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={activeTab === 'details' ? { backgroundColor: `${primaryColor}10`, color: primaryColor } : {}}
                      >
                        <CheckSquare className="h-5 w-5 mr-2" />
                        Details
                      </button>
                      <button
                        onClick={() => setActiveTab('checklist')}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          activeTab === 'checklist'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={activeTab === 'checklist' ? { backgroundColor: `${primaryColor}10`, color: primaryColor } : {}}
                      >
                        <CheckSquare className="h-5 w-5 mr-2" />
                        Checklist
                      </button>
                      <button
                        onClick={() => setActiveTab('comments')}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          activeTab === 'comments'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={activeTab === 'comments' ? { backgroundColor: `${primaryColor}10`, color: primaryColor } : {}}
                      >
                        <FileText className="h-5 w-5 mr-2" />
                        Comments
                      </button>
                      <button
                        onClick={() => setActiveTab('attachments')}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          activeTab === 'attachments'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={activeTab === 'attachments' ? { backgroundColor: `${primaryColor}10`, color: primaryColor } : {}}
                      >
                        <Link2 className="h-5 w-5 mr-2" />
                        Attachments
                      </button>
                      <button
                        onClick={() => setActiveTab('time')}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          activeTab === 'time'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={activeTab === 'time' ? { backgroundColor: `${primaryColor}10`, color: primaryColor } : {}}
                      >
                        <Clock className="h-5 w-5 mr-2" />
                        Time Tracking
                      </button>
                      <button
                        onClick={() => setActiveTab('sops')}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          activeTab === 'sops'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={activeTab === 'sops' ? { backgroundColor: `${primaryColor}10`, color: primaryColor } : {}}
                      >
                        <Tag className="h-5 w-5 mr-2" />
                        SOPs
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto max-h-[70vh]">
                    {activeTab === 'details' && (
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                            Title
                          </label>
                          <input
                            type="text"
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            Description
                          </label>
                          <textarea
                            id="description"
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                              Status
                            </label>
                            <select
                              id="status"
                              value={formData.status}
                              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="inbox">Inbox</option>
                              <option value="todo">To Do</option>
                              <option value="doing">Doing</option>
                              <option value="done">Done</option>
                            </select>
                          </div>

                          <div>
                            <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                              Priority
                            </label>
                            <select
                              id="priority"
                              value={formData.priority}
                              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700">
                            Assigned To
                          </label>
                          <select
                            id="assigned_to"
                            value={formData.assigned_to}
                            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="">Unassigned</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.email}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                              Start Date
                            </label>
                            <input
                              type="date"
                              id="start_date"
                              value={formData.start_date}
                              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>

                          <div>
                            <label htmlFor="finish_date" className="block text-sm font-medium text-gray-700">
                              Due Date
                            </label>
                            <input
                              type="date"
                              id="finish_date"
                              value={formData.finish_date}
                              onChange={(e) => setFormData({ ...formData, finish_date: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="estimated_hours" className="block text-sm font-medium text-gray-700">
                              Estimated Hours
                            </label>
                            <input
                              type="number"
                              id="estimated_hours"
                              min="0"
                              step="0.5"
                              value={formData.estimated_hours}
                              onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>

                          <div>
                            <label htmlFor="estimated_cost" className="block text-sm font-medium text-gray-700">
                              Estimated Cost
                            </label>
                            <input
                              type="number"
                              id="estimated_cost"
                              min="0"
                              step="0.01"
                              value={formData.estimated_cost}
                              onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between pt-4">
                          <div>
                            {taskId && (
                              <button
                                type="button"
                                onClick={handleDeleteTask}
                                disabled={isDeleting}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                              >
                                {isDeleting ? 'Deleting...' : 'Delete Task'}
                              </button>
                            )}
                          </div>
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={onClose}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSaving || !canEdit}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                              style={{ backgroundColor: primaryColor }}
                            >
                              {isSaving ? 'Saving...' : 'Save Task'}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {activeTab === 'checklist' && taskId && (
                      <TaskChecklist taskId={taskId} />
                    )}

                    {activeTab === 'comments' && taskId && (
                      <TaskComments
                        comments={comments}
                        onAddComment={handleAddComment}
                        onDeleteComment={handleDeleteComment}
                      />
                    )}

                    {activeTab === 'attachments' && taskId && (
                      <TaskAttachments
                        attachments={attachments}
                        onAddAttachment={handleAddAttachment}
                        onDeleteAttachment={handleDeleteAttachment}
                      />
                    )}

                    {activeTab === 'time' && taskId && task && (
                      <TaskTimer
                        taskId={taskId}
                        taskTitle={task.title}
                        onTimeEntryAdded={fetchTask}
                      />
                    )}

                    {activeTab === 'sops' && taskId && (
                      <TaskSopSelector
                        taskId={taskId}
                        clientId={clientId}
                        onClose={() => setActiveTab('details')}
                      />
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}