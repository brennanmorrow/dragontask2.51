import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { MentionInput } from './MentionInput';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface TaskCommentFormProps {
  taskId: string;
  onCommentAdded: () => void;
}

export function TaskCommentForm({ taskId, onCommentAdded }: TaskCommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Adding task comment',
        { taskId, contentLength: content.length }
      );

      // Get user email from user_roles
      const { data: userData, error: userError } = await supabase
        .from('user_roles')
        .select('email')
        .eq('user_id', user.id)
        .single();

      if (userError) {
        throw new Error(`Error fetching user email: ${userError.message}`);
      }

      if (!userData?.email) {
        throw new Error('User email not found');
      }

      // Insert comment with user_email
      const { error: commentError } = await supabase
        .from('task_comments')
        .insert([
          {
            task_id: taskId,
            user_id: user.id,
            user_email: userData.email,
            content: content.trim()
          }
        ]);

      if (commentError) {
        throw commentError;
      }

      // Log if the comment contains mentions
      const mentions = content.match(/@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (mentions && mentions.length > 0) {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.USER_ACTION,
          'User added comment with mentions',
          { 
            mentions: mentions.map(m => m.substring(1)), // Remove @ symbol
            commentLength: content.length
          }
        );
      }

      setContent('');
      onCommentAdded();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Task comment added successfully',
        { taskId }
      );
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error adding task comment',
        { error: err, taskId }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
      
      <MentionInput
        value={content}
        onChange={setContent}
        onSubmit={handleSubmit}
        placeholder="Add a comment... Use @ to mention users"
      />
      
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </div>
  );
}