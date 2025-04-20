import React, { useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Plus, Trash2, Link2 } from 'lucide-react';
import { SopReference } from '../lib/types';
import { useAuthStore } from '../lib/store';

interface SopReferencesProps {
  references: SopReference[];
  isEditing: boolean;
  onAddReference: (title: string, url: string) => Promise<void>;
  onDeleteReference: (referenceId: string) => Promise<void>;
}

export function SopReferences({ references, isEditing, onAddReference, onDeleteReference }: SopReferencesProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTitle.trim() || !newUrl.trim()) {
      setError('Title and URL are required');
      return;
    }
    
    // Basic URL validation
    try {
      new URL(newUrl);
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onAddReference(newTitle.trim(), newUrl.trim());
      setNewTitle('');
      setNewUrl('');
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* References list */}
      <div className="space-y-4">
        {references.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {references.map((reference) => (
              <li key={reference.id} className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Link2 className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{reference.title}</h4>
                      <a 
                        href={reference.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                      >
                        {reference.url.length > 50 ? `${reference.url.substring(0, 50)}...` : reference.url}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                      <p className="text-xs text-gray-500 mt-1">
                        Added by {reference.created_by_email} on {format(new Date(reference.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <button
                      onClick={() => onDeleteReference(reference.id)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <Link2 className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No references</h3>
            <p className="mt-1 text-sm text-gray-500">
              References are automatically extracted from links in the SOP content.
            </p>
          </div>
        )}
      </div>

      {/* Add reference form */}
      {isEditing && (
        <div>
          {isAdding ? (
            <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Reference title"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                  URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="https://example.com"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Reference'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Manual Reference
            </button>
          )}
        </div>
      )}
    </div>
  );
}