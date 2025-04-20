import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Save, Trash2 } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { Task } from '../lib/types';
import { format } from 'date-fns';
import { TaskComments } from './TaskComments';
import { TaskAttachments } from './TaskAttachments';
import { TaskTimer } from './TaskTimer';
import { TaskSopSelector } from './TaskSopSelector';
import { TaskChecklist } from './TaskChecklist';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';
import { 
  fetchTask, 
  fetchAssignedUserEmail, 
  fetchComments, 
  fetchAttachments, 
  fetchUsers,
  createOrUpdateTask,
  deleteTask,
  addComment,
  deleteComment,
  addAttachment,
  deleteAttachment
} from './TaskDetailsService';
import { TaskDetailsForm } from './TaskDetailsForm';
import { TaskDetailsTabs } from './TaskDetailsTabs';

interface TaskDetailsContainerProps {
  taskId: string | null;
  boardId: string;
  clientId: string;
  agencyId: string;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export function TaskDetailsContainer({
  taskId,
  boardId,
  clientId,
  agencyId,
  onClose,
  onTaskUpdated
}: TaskDetailsContainerProps) {
  const { user, role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [task, setTask] = useState<Task | null>(null);
  const [assignedUserEmail, setAssignedUserEmail] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
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
      loadTaskDetails();
    } else {
      setIsLoading(false);
    }
    loadUsers();
  }, [taskId]);

  async function loadTaskDetails() {
    try {
      setIsLoading(true);
      
      // Fetch task details
      const taskData = await fetchTask(taskId!);
      setTask(taskData);
      
      // Set form data
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
      
      // If task has an assigned user, fetch their email
      if (taskData.assigned_to) {
        const email = await fetchAssignedUserEmail(taskData.assigned_to);
        setAssignedUserEmail(email);
      }
      
      // Fetch comments and attachments
      const [commentsData, attachmentsData] = await Promise.all([
        fetchComments(taskId!),
        fetchAttachments(taskId!)
      ]);
      
      setComments(commentsData);
      setAttachments(attachmentsData);
    } catch (err) {
      console.error('Error loading task details:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const usersData = await fetchUsers();
      setUsers(usersData);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
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

      await createOrUpdateTask(taskId, taskData);
      onTaskUpdated();
      onClose();
    } catch (err) {
      console.error('Error saving task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
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
      await deleteTask(taskId);
      onTaskUpdated();
      onClose();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting the task');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAddComment(content: string) {
    if (!taskId || !user) return;

    try {
      await addComment(taskId, user.id, content);
      await loadTaskDetails();
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteComment(commentId);
      await loadTaskDetails();
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleAddAttachment(file: File) {
    if (!taskId || !user) return;

    try {
      await addAttachment(taskId, user.id, file);
      await loadTaskDetails();
    } catch (err) {
      console.error('Error adding attachment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    try {
      await deleteAttachment(attachmentId);
      await loadTaskDetails();
    } catch (err) {
      console.error('Error deleting attachment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  // Check if user has permission to edit
  const canEdit = ['system_admin', 'agency_admin', 'client_admin'].includes(role) || 
                 (task?.assigned_to === user?.id);

  return (
    <Transition appear show={true} as={React.Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
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
              as={React.Fragment}
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
                  <TaskDetailsTabs 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                  />

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto max-h-[70vh]">
                    {activeTab === 'details' && (
                      <TaskDetailsForm
                        formData={formData}
                        setFormData={setFormData}
                        users={users}
                        onSubmit={handleSubmit}
                        onDelete={handleDeleteTask}
                        isSaving={isSaving}
                        isDeleting={isDeleting}
                        canEdit={canEdit}
                        onCancel={onClose}
                        taskId={taskId}
                        primaryColor={primaryColor}
                      />
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
                        onTimeEntryAdded={loadTaskDetails}
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