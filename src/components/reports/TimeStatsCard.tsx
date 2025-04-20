import React from 'react';
import clsx from 'clsx';

interface TimeStatsProps {
  hours_completed: number;
  hours_estimated: number;
  cost_actual: number;
  cost_estimated: number;
  completion_percentage: number;
  cost_efficiency_percentage: number;
}

export function TimeStatsCard({ 
  hours_completed, 
  hours_estimated, 
  cost_actual, 
  cost_estimated, 
  completion_percentage, 
  cost_efficiency_percentage 
}: TimeStatsProps) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
      <dt className="truncate text-sm font-medium text-gray-500">Hours Completed</dt>
      <dd className="mt-1 flex items-baseline justify-between">
        <div className="flex items-baseline text-2xl font-semibold text-gray-900">
          {hours_completed.toFixed(1)}h
          <span className="ml-2 text-sm text-gray-500">
            of {hours_estimated.toFixed(1)}h estimated
          </span>
        </div>
        <div className={clsx(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          completion_percentage >= 100 
            ? "bg-red-100 text-red-800" 
            : completion_percentage >= 75 
              ? "bg-yellow-100 text-yellow-800" 
              : "bg-green-100 text-green-800"
        )}>
          {completion_percentage.toFixed(0)}%
        </div>
      </dd>
      <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className={clsx(
            "h-2.5 rounded-full",
            completion_percentage >= 100 
              ? "bg-red-600" 
              : completion_percentage >= 75 
                ? "bg-yellow-500" 
                : "bg-green-500"
          )}
          style={{ width: `${Math.min(100, completion_percentage)}%` }}
        ></div>
      </div>
    </div>
  );
}