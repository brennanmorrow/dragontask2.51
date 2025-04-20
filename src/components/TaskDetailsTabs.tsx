import React from 'react';
import { CheckSquare, FileText, Link2, Clock, Tag, DollarSign } from 'lucide-react';

interface TaskDetailsTabsProps {
  activeTab: 'details' | 'comments' | 'attachments' | 'time' | 'sops' | 'checklist';
  setActiveTab: (tab: 'details' | 'comments' | 'attachments' | 'time' | 'sops' | 'checklist') => void;
}

export function TaskDetailsTabs({ activeTab, setActiveTab }: TaskDetailsTabsProps) {
  return (
    <div className="w-48 flex-shrink-0">
      <div className="flex flex-col space-y-1">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            activeTab === 'details'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <CheckSquare className="h-5 w-5 mr-2" />
          Details
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            activeTab === 'checklist'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <CheckSquare className="h-5 w-5 mr-2" />
          Checklist
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            activeTab === 'comments'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="h-5 w-5 mr-2" />
          Comments
        </button>
        <button
          onClick={() => setActiveTab('attachments')}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            activeTab === 'attachments'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Link2 className="h-5 w-5 mr-2" />
          Attachments
        </button>
        <button
          onClick={() => setActiveTab('time')}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            activeTab === 'time'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <DollarSign className="h-5 w-5 mr-2" />
          Time & Cost
        </button>
        <button
          onClick={() => setActiveTab('sops')}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            activeTab === 'sops'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Tag className="h-5 w-5 mr-2" />
          SOPs
        </button>
      </div>
    </div>
  );
}