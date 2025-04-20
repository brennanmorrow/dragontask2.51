import React from 'react';
import { useAppContext } from '../lib/AppContext';
import { logComponentRender } from '../lib/debugSystem';

interface SopViewerProps {
  content: string;
}

export function SopViewer({ content }: SopViewerProps) {
  const { systemSettings } = useAppContext();
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  
  // Log component render
  logComponentRender('SopViewer', true, { contentLength: content?.length || 0 });
  
  if (!content) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-500">No content available for this SOP.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-1 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>
      <div 
        className="p-6 prose max-w-none overflow-auto max-h-[500px]"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <p>This is a read-only view of the SOP content.</p>
      </div>
    </div>
  );
}