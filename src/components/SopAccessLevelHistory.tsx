import React from 'react';
import { format } from 'date-fns';
import { History, Building2, Briefcase, Users } from 'lucide-react';
import { SopAccessLevel } from '../lib/types';

interface AccessLevelChange {
  id: string;
  sop_id: string;
  old_access_level: SopAccessLevel | null;
  new_access_level: SopAccessLevel;
  old_entity_name: string | null;
  new_entity_name: string | null;
  changed_by: string;
  changed_by_email: string;
  reason: string | null;
  created_at: string;
}

interface SopAccessLevelHistoryProps {
  history: AccessLevelChange[];
}

export function SopAccessLevelHistory({ history }: SopAccessLevelHistoryProps) {
  const getAccessLevelIcon = (level: SopAccessLevel | null) => {
    if (!level) return null;
    
    switch (level) {
      case 'system':
        return <Building2 className="h-5 w-5 text-purple-500" />;
      case 'agency':
        return <Briefcase className="h-5 w-5 text-blue-500" />;
      case 'client':
        return <Users className="h-5 w-5 text-indigo-500" />;
      default:
        return null;
    }
  };

  const getAccessLevelColor = (level: SopAccessLevel | null) => {
    if (!level) return 'text-gray-500';
    
    switch (level) {
      case 'system':
        return 'text-purple-700';
      case 'agency':
        return 'text-blue-700';
      case 'client':
        return 'text-indigo-700';
      default:
        return 'text-gray-700';
    }
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-6 bg-gray-50 rounded-lg">
        <History className="h-12 w-12 text-gray-400 mx-auto" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No access level changes</h3>
        <p className="mt-1 text-sm text-gray-500">
          This SOP's access level has not been changed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {history.map((change, index) => (
            <li key={change.id}>
              <div className="relative pb-8">
                {index !== history.length - 1 ? (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center ring-8 ring-white">
                      <History className="h-5 w-5 text-white" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-500">
                        Access level changed from{' '}
                        <span className={`font-medium capitalize ${getAccessLevelColor(change.old_access_level)}`}>
                          {change.old_access_level || 'none'}
                          {change.old_entity_name && ` (${change.old_entity_name})`}
                        </span>{' '}
                        to{' '}
                        <span className={`font-medium capitalize ${getAccessLevelColor(change.new_access_level)}`}>
                          {change.new_access_level}
                          {change.new_entity_name && ` (${change.new_entity_name})`}
                        </span>
                        {change.reason && (
                          <>
                            <br />
                            <span className="text-xs italic">Reason: {change.reason}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <div>{change.changed_by_email}</div>
                      <div>{format(new Date(change.created_at), 'MMM d, h:mm a')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}