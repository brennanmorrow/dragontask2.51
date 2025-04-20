import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { Task } from '../lib/types';
import { useAppContext } from '../lib/AppContext';

interface TaskFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filters: {
    priority: string[];
    assignee: string[];
    dueDate: string | null;
  };
  onFilterChange: (filters: {
    priority: string[];
    assignee: string[];
    dueDate: string | null;
  }) => void;
  users: { id: string; email: string }[];
  clearFilters: () => void;
}

export function TaskFilters({
  searchTerm,
  onSearchChange,
  filters,
  onFilterChange,
  users,
  clearFilters
}: TaskFiltersProps) {
  const { systemSettings } = useAppContext();
  const [openFilter, setOpenFilter] = useState<'priority' | 'assignee' | 'dueDate' | null>(null);
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  
  const priorities = ['low', 'medium', 'high'];
  const dueDateOptions = [
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Due Today' },
    { value: 'week', label: 'Due This Week' },
    { value: 'month', label: 'Due This Month' },
    { value: 'none', label: 'No Due Date' }
  ];

  const handlePriorityToggle = (priority: string) => {
    const newPriorities = filters.priority.includes(priority)
      ? filters.priority.filter(p => p !== priority)
      : [...filters.priority, priority];
    
    onFilterChange({ ...filters, priority: newPriorities });
  };

  const handleAssigneeToggle = (userId: string) => {
    const newAssignees = filters.assignee.includes(userId)
      ? filters.assignee.filter(a => a !== userId)
      : [...filters.assignee, userId];
    
    onFilterChange({ ...filters, assignee: newAssignees });
  };

  const handleDueDateChange = (value: string | null) => {
    onFilterChange({ ...filters, dueDate: value });
  };

  const hasActiveFilters = filters.priority.length > 0 || 
    filters.assignee.length > 0 || 
    filters.dueDate !== null ||
    searchTerm !== '';

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      setOpenFilter(null);
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Search and filter bar */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-grow max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            placeholder="Search tasks..."
          />
        </div>

        {/* Priority filter */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenFilter(openFilter === 'priority' ? null : 'priority');
            }}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <Filter className="-ml-0.5 h-5 w-5 text-gray-400" />
            Priority
            <ChevronDown className="h-4 w-4 ml-1" />
          </button>
          {openFilter === 'priority' && (
            <div className="absolute left-0 mt-2 w-40 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
              <div className="py-1">
                {priorities.map(priority => (
                  <label
                    key={priority}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={filters.priority.includes(priority)}
                      onChange={() => handlePriorityToggle(priority)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 mr-2"
                      style={{ color: primaryColor }}
                    />
                    <span className="capitalize">{priority}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assignee filter */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenFilter(openFilter === 'assignee' ? null : 'assignee');
            }}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <Filter className="-ml-0.5 h-5 w-5 text-gray-400" />
            Assignee
            <ChevronDown className="h-4 w-4 ml-1" />
          </button>
          {openFilter === 'assignee' && (
            <div className="absolute left-0 mt-2 w-64 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
              <div className="py-1 max-h-60 overflow-y-auto">
                {users.map(user => (
                  <label
                    key={user.id}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={filters.assignee.includes(user.id)}
                      onChange={() => handleAssigneeToggle(user.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 mr-2"
                      style={{ color: primaryColor }}
                    />
                    <span className="truncate">{user.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Due date filter */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenFilter(openFilter === 'dueDate' ? null : 'dueDate');
            }}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <Filter className="-ml-0.5 h-5 w-5 text-gray-400" />
            Due Date
            <ChevronDown className="h-4 w-4 ml-1" />
          </button>
          {openFilter === 'dueDate' && (
            <div className="absolute left-0 mt-2 w-40 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
              <div className="py-1">
                {dueDateOptions.map(option => (
                  <label
                    key={option.value}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <input
                      type="radio"
                      checked={filters.dueDate === option.value}
                      onChange={() => handleDueDateChange(option.value)}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600 mr-2"
                      style={{ color: primaryColor }}
                    />
                    {option.label}
                  </label>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <label
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <input
                      type="radio"
                      checked={filters.dueDate === null}
                      onChange={() => handleDueDateChange(null)}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600 mr-2"
                      style={{ color: primaryColor }}
                    />
                    All Dates
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200"
          >
            <X className="-ml-0.5 h-5 w-5" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchTerm && (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
              Search: {searchTerm}
              <button 
                onClick={() => onSearchChange('')}
                className="ml-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.priority.map(priority => (
            <span
              key={priority}
              className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
            >
              Priority: {priority}
              <button 
                onClick={() => handlePriorityToggle(priority)}
                className="ml-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filters.assignee.map(userId => {
            const user = users.find(u => u.id === userId);
            return (
              <span
                key={userId}
                className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
              >
                Assigned to: {user?.email}
                <button 
                  onClick={() => handleAssigneeToggle(userId)}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {filters.dueDate && (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
              Due: {dueDateOptions.find(o => o.value === filters.dueDate)?.label}
              <button 
                onClick={() => handleDueDateChange(null)}
                className="ml-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}