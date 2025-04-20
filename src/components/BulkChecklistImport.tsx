import React, { useState } from 'react';
import { X, Check, List, AlertCircle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface BulkChecklistImportProps {
  onImport: (items: string[]) => Promise<void>;
  onCancel: () => void;
}

export function BulkChecklistImport({ onImport, onCancel }: BulkChecklistImportProps) {
  const { systemSettings } = useAppContext();
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<string[]>([]);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Parse input text into checklist items
  const parseItems = (text: string): string[] => {
    if (!text.trim()) return [];

    // Split by newlines
    const lines = text.split('\n');
    
    // Process each line
    return lines
      .map(line => {
        // Trim whitespace
        let trimmed = line.trim();
        if (!trimmed) return null;
        
        // Remove common list markers (bullets, numbers, dashes)
        trimmed = trimmed.replace(/^[\s•\-–—*]+/, ''); // Bullets and dashes
        trimmed = trimmed.replace(/^\d+[\.\)]\s*/, ''); // Numbers with period or parenthesis
        trimmed = trimmed.replace(/^\[\s*[xX\s]\s*\]\s*/, ''); // Checkbox format [x] or [ ]
        
        return trimmed.trim();
      })
      .filter((item): item is string => item !== null && item !== '');
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    
    // Parse and preview items
    const items = parseItems(text);
    setParsedItems(items);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (parsedItems.length === 0) {
      setError('No valid checklist items found. Please enter at least one item.');
      return;
    }
    
    if (parsedItems.length > 500) {
      setError('Too many items. Please limit to 500 items per import.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'Bulk importing checklist items',
        { itemCount: parsedItems.length }
      );
      
      await onImport(parsedItems);
    } catch (err) {
      console.error('Error importing checklist items:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while importing items');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error bulk importing checklist items',
        { error: err }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <List className="h-5 w-5 mr-2" />
          Bulk Import Checklist Items
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="bulk-items" className="block text-sm font-medium text-gray-700 mb-1">
            Paste your checklist items below (one per line)
          </label>
          <textarea
            id="bulk-items"
            rows={10}
            value={inputText}
            onChange={handleTextChange}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="- Item 1&#10;- Item 2&#10;- Item 3&#10;&#10;Or simply:&#10;Item 1&#10;Item 2&#10;Item 3"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports plain text, bullet points, numbered lists, and checkboxes. Empty lines will be ignored.
          </p>
        </div>
        
        {parsedItems.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Preview ({parsedItems.length} items)</h4>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 bg-gray-50">
              <ul className="space-y-1">
                {parsedItems.slice(0, 10).map((item, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center">
                    <div className="w-4 h-4 border border-gray-300 rounded mr-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
                {parsedItems.length > 10 && (
                  <li className="text-sm text-gray-500 italic">
                    ...and {parsedItems.length - 10} more items
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            <X className="h-4 w-4 inline-block mr-1" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || parsedItems.length === 0}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
            style={{ 
              backgroundColor: primaryColor,
              opacity: isSubmitting || parsedItems.length === 0 ? 0.5 : 1 
            }}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 inline-block mr-1" />
                Import {parsedItems.length} Items
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}