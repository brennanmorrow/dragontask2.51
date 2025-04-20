import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Check, Trash2 } from 'lucide-react';
import { BoardColumn } from '../lib/types';
import { supabase } from '../lib/supabase';

interface ColumnEditorModalProps {
  column?: BoardColumn;
  boardId: string;
  onClose: () => void;
  onSave: (column: Partial<BoardColumn>) => Promise<void>;
  onDelete?: (columnId: string) => Promise<void>;
}

export function ColumnEditorModal({ column, boardId, onClose, onSave, onDelete }: ColumnEditorModalProps) {
  const [formData, setFormData] = useState({
    name: column?.name || '',
    key: column?.key || '',
    color: column?.color || '#94A3B8',
    icon: column?.icon || '📋'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateColumnKey = async (key: string): Promise<boolean> => {
    // Skip validation if we're editing an existing column and the key hasn't changed
    if (column && column.key === key) {
      return true;
    }

    const { data, error } = await supabase
      .from('board_columns')
      .select('id')
      .eq('board_id', boardId)
      .eq('key', key);

    if (error) {
      throw new Error('Failed to validate column key');
    }

    // If data is null or empty array, the key is unique
    // If data contains any rows, the key already exists
    return !data || data.length === 0;
  };

  const generateUniqueKey = (baseName: string): string => {
    return baseName.toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_') // Replace any non-alphanumeric chars with underscore
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Generate a key if this is a new column
      const key = column?.key || generateUniqueKey(formData.name);
      
      // Validate the key is unique
      const isKeyValid = await validateColumnKey(key);
      if (!isKeyValid) {
        throw new Error('A column with this name already exists. Please choose a different name.');
      }

      const columnData = {
        ...formData,
        key,
        board_id: boardId
      };

      await onSave(columnData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!column || !onDelete) return;
    
    if (!confirm('Are you sure you want to delete this column? All tasks in this column will be moved to the inbox.')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onDelete(column.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm w-full bg-white rounded-xl shadow-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {column ? 'Edit Column' : 'New Column'}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Column Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="color" className="block text-sm font-medium text-gray-700">
                Column Color
              </label>
              <div className="mt-1 flex items-center gap-x-3">
                <input
                  type="color"
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-8 w-8 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-sm text-gray-500">
                  This color will appear at the top of the column
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="icon" className="block text-sm font-medium text-gray-700">
                Column Icon
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter an emoji (e.g., 📋, ✅, 🔨)"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Use any emoji as the column icon
                </p>
              </div>
            </div>

            <div className="flex justify-between gap-3 mt-6">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Check className="w-4 h-4 mr-2" />
                      {column ? 'Update Column' : 'Create Column'}
                    </span>
                  )}
                </button>
              </div>
              
              {column && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <span className="flex items-center">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </span>
                </button>
              )}
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}