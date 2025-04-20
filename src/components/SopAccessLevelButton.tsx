import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { SopAccessLevel } from '../lib/types';
import { SopAccessLevelChanger } from './SopAccessLevelChanger';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface SopAccessLevelButtonProps {
  sopId: string;
  currentAccessLevel: SopAccessLevel;
  currentEntityId: string | null;
  onAccessLevelChanged: () => void;
}

export function SopAccessLevelButton({
  sopId,
  currentAccessLevel,
  currentEntityId,
  onAccessLevelChanged
}: SopAccessLevelButtonProps) {
  const { systemSettings } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  const handleOpenModal = () => {
    setIsModalOpen(true);
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User opened SOP access level changer',
      { sopId, currentAccessLevel }
    );
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User closed SOP access level changer',
      { sopId }
    );
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    onAccessLevelChanged();
    
    logDebugEvent(
      DebugLevel.SUCCESS,
      DebugEventType.USER_ACTION,
      'SOP access level changed successfully',
      { sopId }
    );
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
        style={{ backgroundColor: primaryColor }}
        title="Change Access Level"
      >
        <Shield className="h-4 w-4 mr-1" />
        Change Access Level
      </button>

      {isModalOpen && (
        <SopAccessLevelChanger
          sopId={sopId}
          currentAccessLevel={currentAccessLevel}
          currentEntityId={currentEntityId}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}