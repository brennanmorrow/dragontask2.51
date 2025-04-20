import React from 'react';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { TaskActivityType } from '../lib/types';

interface TaskActivityProps {
  activities: TaskActivityType[];
}

export function TaskActivityList({ activities }: TaskActivityProps) {
  function formatActivityDetails(activity: TaskActivityType) {
    const { action, details } = activity;

    if (action === 'created') {
      return 'Created the task';
    }

    const changes: string[] = [];
    
    if (details.title) {
      changes.push(`Changed title from "${details.title.from}" to "${details.title.to}"`);
    }
    
    if (details.description) {
      changes.push('Updated description');
    }
    
    if (details.status) {
      changes.push(`Moved from ${details.status.from} to ${details.status.to}`);
    }
    
    if (details.priority) {
      changes.push(`Changed priority from ${details.priority.from} to ${details.priority.to}`);
    }
    
    if (details.assigned_to) {
      changes.push(`Updated assignment`);
    }
    
    if (details.due_date) {
      const fromDate = details.due_date.from ? format(new Date(details.due_date.from), 'MMM d, yyyy') : 'none';
      const toDate = details.due_date.to ? format(new Date(details.due_date.to), 'MMM d, yyyy') : 'none';
      changes.push(`Changed due date from ${fromDate} to ${toDate}`);
    }

    return changes.join(', ');
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Activity</h3>
      
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {activities.map((activity, activityIdx) => (
            <li key={activity.id}>
              <div className="relative pb-8">
                {activityIdx !== activities.length - 1 ? (
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
                        {formatActivityDetails(activity)}
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <div>{activity.user_email}</div>
                      <div>{format(new Date(activity.created_at), 'MMM d, h:mm a')}</div>
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