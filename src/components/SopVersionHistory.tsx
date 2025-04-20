import React from 'react';
import { format } from 'date-fns';
import { History, RotateCcw, Eye, FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { SopVersion, SopStatusHistory } from '../lib/types';
import { useAuthStore } from '../lib/store';

interface SopVersionHistoryProps {
  versions: SopVersion[];
  statusHistory: SopStatusHistory[];
  onViewVersion: (versionId: string) => void;
  onRestoreVersion: (versionId: string) => void;
}

export function SopVersionHistory({ 
  versions, 
  statusHistory, 
  onViewVersion, 
  onRestoreVersion 
}: SopVersionHistoryProps) {
  const { role } = useAuthStore();
  
  // Combine versions and status changes into a single timeline
  const timelineItems = [
    ...versions.map(v => ({
      id: v.id,
      type: 'version' as const,
      version_number: v.version_number,
      created_by: v.created_by_email,
      created_at: v.created_at,
      data: v
    })),
    ...statusHistory.map(s => ({
      id: s.id,
      type: 'status' as const,
      old_status: s.old_status,
      new_status: s.new_status,
      changed_by: s.changed_by_email,
      created_at: s.created_at,
      reason: s.reason,
      data: s
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const canRestoreVersion = ['system_admin', 'agency_admin', 'client_admin'].includes(role);

  function getStatusIcon(status: string) {
    switch (status) {
      case 'draft':
        return <FileText className="h-5 w-5 text-gray-500" />;
      case 'review':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'archived':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {timelineItems.map((item, itemIdx) => (
            <li key={item.id}>
              <div className="relative pb-8">
                {itemIdx !== timelineItems.length - 1 ? (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center ring-8 ring-white">
                      {item.type === 'version' ? (
                        <History className="h-5 w-5 text-white" />
                      ) : (
                        getStatusIcon(item.new_status)
                      )}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      {item.type === 'version' ? (
                        <p className="text-sm text-gray-500">
                          <span className="font-medium text-gray-900">Version {item.version_number}</span> created
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Status changed from <span className="font-medium capitalize">{item.old_status || 'none'}</span> to{' '}
                          <span className="font-medium capitalize">{item.new_status}</span>
                          {item.reason && (
                            <>
                              <br />
                              <span className="text-xs italic">Reason: {item.reason}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <div>{item.type === 'version' ? item.created_by : item.changed_by}</div>
                      <div>{format(new Date(item.created_at), 'MMM d, h:mm a')}</div>
                    </div>
                  </div>
                  
                  {item.type === 'version' && (
                    <div className="flex-shrink-0 self-center flex">
                      <button
                        onClick={() => onViewVersion(item.id)}
                        className="text-gray-400 hover:text-gray-500 mr-2"
                        title="View this version"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      
                      {canRestoreVersion && item.version_number !== versions[0]?.version_number && (
                        <button
                          onClick={() => onRestoreVersion(item.id)}
                          className="text-gray-400 hover:text-gray-500"
                          title="Restore this version"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      
      {timelineItems.length === 0 && (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <History className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No history</h3>
          <p className="mt-1 text-sm text-gray-500">
            This SOP doesn't have any version or status history yet.
          </p>
        </div>
      )}
    </div>
  );
}