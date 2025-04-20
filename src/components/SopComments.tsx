import React, { useState } from 'react';
import { format } from 'date-fns';
import { Reply, Trash2 } from 'lucide-react';
import { SopComment } from '../lib/types';
import { useAuthStore } from '../lib/store';
import { MentionInput } from './MentionInput';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface SopCommentsProps {
  comments: SopComment[];
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

export function SopComments({ comments, onAddComment, onDeleteComment }: SopCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
      
      // Log if the comment contains mentions
      const mentions = newComment.match(/@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (mentions && mentions.length > 0) {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.USER_ACTION,
          'User added SOP comment with mentions',
          { 
            mentions: mentions.map(m => m.substring(1)), // Remove @ symbol
            commentLength: newComment.length
          }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(replyContent.trim(), parentId);
      setReplyContent('');
      setReplyingTo(null);
      
      // Log if the reply contains mentions
      const mentions = replyContent.match(/@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (mentions && mentions.length > 0) {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.USER_ACTION,
          'User added SOP reply with mentions',
          { 
            mentions: mentions.map(m => m.substring(1)), // Remove @ symbol
            commentLength: replyContent.length,
            parentId
          }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to highlight @mentions in comment text
  function renderCommentText(text: string) {
    const parts = text.split(/(@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-blue-600 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  }

  // Recursive function to render comments and their replies
  const renderComment = (comment: SopComment, level = 0) => {
    return (
      <div key={comment.id} className={`${level > 0 ? 'ml-8 mt-4' : 'mt-6'}`}>
        <div className="flex space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {comment.user_email[0].toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex-grow">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">{comment.user_email}</span>
                <span className="text-sm text-gray-500 ml-2">
                  {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {user?.id === comment.user_id && (
                <button
                  onClick={() => onDeleteComment(comment.id)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
              {renderCommentText(comment.content)}
            </div>
            <div className="mt-2">
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                <Reply className="h-3 w-3 inline-block mr-1" />
                Reply
              </button>
            </div>
            
            {replyingTo === comment.id && (
              <div className="mt-3">
                <MentionInput
                  value={replyContent}
                  onChange={setReplyContent}
                  onSubmit={() => handleReply(comment.id)}
                  placeholder="Write a reply..."
                  className="text-sm"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="mr-2 px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReply(comment.id)}
                    disabled={!replyContent.trim() || isSubmitting}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Posting...' : 'Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Render replies */}
        {comment.replies && comment.replies.map(reply => renderComment(reply, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Comment form */}
      <div className="space-y-2">
        <MentionInput
          value={newComment}
          onChange={setNewComment}
          onSubmit={handleSubmit}
          placeholder="Add a comment... Use @ to mention users"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !newComment.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map(comment => renderComment(comment))
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}