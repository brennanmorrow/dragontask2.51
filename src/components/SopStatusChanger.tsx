import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  FileText, Clock, CheckCircle, Archive, X, Check, 
  ChevronDown, AlertCircle
} from 'lucide-react';
import { SopStatus } from '../lib/types';
import { useAppContext } from '../lib/AppContext';

interface SopStatusChangerProps {
  currentStatus: SopStatus;
  onStatusChange: (newStatus: SopStatus, reason: string) => Promise<void>;
}

export function SopStatusChanger({ currentStatus, onStatusChange }: SopStatusChangerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<SopStatus | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { systemSettings } = useAppContext();

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const secondaryColor = systemSettings?.secondary_color || '#B91C1C';

  const statusOptions: { value: SopStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { 
      value: 'draft', 
      label: 'Draft', 
      icon: <FileText className="h-4 w-4" />, 
      color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' 
    },
    { 
      value: 'review', 
      label: 'Review', 
      icon: <Clock className="h-4 w-4" />, 
      color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
    },
    { 
      value: 'approved', 
      label: 'Approved', 
      icon: <CheckCircle className="h-4 w-4" />, 
      color: 'bg-green-100 text-green-800 hover:bg-green-200' 
    },
    { 
      value: 'archived', 
      label: 'Archived', 
      icon: <Archive className="h-4 w-4" />, 
      color: 'bg-red-100 text-red-800 hover:bg-red-200' 
    }
  ];

  const currentStatusOption = statusOptions.find(option => option.value === currentStatus);

  const handleSubmit = async () => {
    if (!selectedStatus) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onStatusChange(selectedStatus, reason);
      setIsOpen(false);
      setReason('');
      setSelectedStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while changing status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <div className="flex items-center">
            {currentStatusOption?.icon}
            <span className="ml-1 capitalize">{currentStatus}</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </div>
        </button>
      </div>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Change SOP Status
              </Dialog.Title>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Status
                </label>
                <div className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-sm font-medium capitalize ${currentStatusOption?.color}`}>
                  {currentStatusOption?.icon}
                  <span className="ml-1">{currentStatus}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {statusOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedStatus(option.value)}
                      className={`${option.color} ${
                        selectedStatus === option.value ? 'ring-2 ring-offset-2' : ''
                      } ${
                        option.value === currentStatus ? 'opacity-50 cursor-not-allowed' : ''
                      } inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md`}
                      style={selectedStatus === option.value ? { ringColor: primaryColor } : {}}
                      disabled={option.value === currentStatus}
                    >
                      {option.icon}
                      <span className="ml-1 capitalize">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="status-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for change (optional)
                </label>
                <textarea
                  id="status-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                  placeholder="Explain why you're changing the status..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedStatus || selectedStatus === currentStatus || isSubmitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: primaryColor, '&:hover': { backgroundColor: secondaryColor } }}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Update Status
                  </>
                )}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}