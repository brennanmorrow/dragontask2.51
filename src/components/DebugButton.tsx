import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { DebugPanel } from './DebugPanel';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';

export function DebugButton() {
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const { role } = useAuthStore();
  const { systemSettings } = useAppContext();
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  
  // Only system admins and agency admins can see the debug button
  const canAccessDebugPanel = ['system_admin', 'agency_admin'].includes(role || '');
  
  if (!canAccessDebugPanel) {
    return null;
  }
  
  return (
    <>
      <button
        onClick={() => setIsDebugPanelOpen(true)}
        className="fixed bottom-4 right-4 p-3 rounded-full shadow-lg z-50 text-white"
        style={{ backgroundColor: primaryColor }}
        title="Debug Panel"
      >
        <Bug className="h-5 w-5" />
      </button>
      
      {isDebugPanelOpen && <DebugPanel onClose={() => setIsDebugPanelOpen(false)} />}
    </>
  );
}