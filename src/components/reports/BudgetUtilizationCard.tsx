import React from 'react';
import clsx from 'clsx';

interface BudgetUtilizationProps {
  total_hours_estimated: number;
  budget_hours_available: number;
  budget_hours_utilization: number;
}

export function BudgetUtilizationCard({ 
  total_hours_estimated, 
  budget_hours_available, 
  budget_hours_utilization 
}: BudgetUtilizationProps) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
      <dt className="truncate text-sm font-medium text-gray-500">Budget Hours Utilization</dt>
      <dd className="mt-1 flex items-baseline justify-between">
        <div className="flex items-baseline text-2xl font-semibold text-gray-900">
          {total_hours_estimated.toFixed(1)}h
          <span className="ml-2 text-sm text-gray-500">
            of {budget_hours_available.toFixed(1)}h available
          </span>
        </div>
        <div className={clsx(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          budget_hours_utilization >= 100 
            ? "bg-red-100 text-red-800" 
            : budget_hours_utilization >= 75 
              ? "bg-yellow-100 text-yellow-800" 
              : "bg-green-100 text-green-800"
        )}>
          {budget_hours_utilization.toFixed(0)}%
        </div>
      </dd>
      <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className={clsx(
            "h-2.5 rounded-full",
            budget_hours_utilization >= 100 
              ? "bg-red-600" 
              : budget_hours_utilization >= 75 
                ? "bg-yellow-500" 
                : "bg-green-500"
          )}
          style={{ width: `${Math.min(100, budget_hours_utilization)}%` }}
        ></div>
      </div>
    </div>
  );
}