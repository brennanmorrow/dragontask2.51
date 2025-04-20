import React, { useMemo, useState } from 'react';
import { Task } from '../../lib/types';
import { format } from 'date-fns';
import { TaskFilters } from '../TaskFilters';
import { filterTasks } from '../../lib/filters';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { useAppContext } from '../../lib/AppContext';

interface ListViewProps {
  clientId: string;
  boardId: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onTaskClick: (taskId: string) => void;
}

export function ListView({ tasks, onTaskClick }: ListViewProps) {
  const { systemSettings } = useAppContext();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filters, setFilters] = React.useState({
    priority: [] as string[],
    assignee: [] as string[],
    dueDate: null as string | null
  });
  const [sortField, setSortField] = useState<'title' | 'status' | 'priority' | 'assigned_to' | 'finish_date'>('finish_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Get unique users from tasks
  const users = useMemo(() => {
    const userMap = new Map();
    tasks.forEach(task => {
      if (task.assigned_to && task.assigned_to_email) {
        userMap.set(task.assigned_to, {
          id: task.assigned_to,
          email: task.assigned_to_email
        });
      }
    });
    return Array.from(userMap.values());
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return filterTasks(tasks, searchTerm, filters);
  }, [tasks, searchTerm, filters]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortField) {
        case 'title':
          valueA = a.title.toLowerCase();
          valueB = b.title.toLowerCase();
          break;
        case 'status':
          valueA = a.status;
          valueB = b.status;
          break;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          valueA = priorityOrder[a.priority];
          valueB = priorityOrder[b.priority];
          break;
        case 'assigned_to':
          valueA = a.assigned_to_email || '';
          valueB = b.assigned_to_email || '';
          break;
        case 'finish_date':
          valueA = a.finish_date ? new Date(a.finish_date).getTime() : Number.MAX_SAFE_INTEGER;
          valueB = b.finish_date ? new Date(b.finish_date).getTime() : Number.MAX_SAFE_INTEGER;
          break;
        default:
          valueA = a.title.toLowerCase();
          valueB = b.title.toLowerCase();
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTasks, sortField, sortDirection]);

  // Toggle sort direction or change sort field
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Render sort indicator
  const renderSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 inline-block ml-1" /> : 
      <ChevronDown className="h-4 w-4 inline-block ml-1" />;
  };

  return (
    <div className="space-y-4">
      <TaskFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filters}
        onFilterChange={setFilters}
        users={users}
        clearFilters={() => {
          setSearchTerm('');
          setFilters({
            priority: [],
            assignee: [],
            dueDate: null
          });
        }}
      />

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-2 py-3"></th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('title')}
                >
                  <span className="flex items-center">
                    Title {renderSortIcon('title')}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <span className="flex items-center">
                    Status {renderSortIcon('status')}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('priority')}
                >
                  <span className="flex items-center">
                    Priority {renderSortIcon('priority')}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('assigned_to')}
                >
                  <span className="flex items-center">
                    Assigned To {renderSortIcon('assigned_to')}
                  </span>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('finish_date')}
                >
                  <span className="flex items-center">
                    Due Date {renderSortIcon('finish_date')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTasks.length > 0 ? (
                sortedTasks.map((task) => {
                  const isOverdue = task.finish_date && new Date(task.finish_date) < new Date() && task.status !== 'done';
                  const isExpanded = expandedRows.has(task.id);

                  return (
                    <React.Fragment key={task.id}>
                      <tr 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => onTaskClick(task.id)}
                      >
                        <td className="px-2 py-4 whitespace-nowrap">
                          <button 
                            onClick={(e) => toggleRowExpansion(task.id, e)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`} />
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${task.status === 'done' ? 'bg-green-100 text-green-800' :
                              task.status === 'doing' ? 'bg-yellow-100 text-yellow-800' :
                              task.status === 'todo' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'}`}
                          >
                            {task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'}`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 truncate max-w-[150px]">
                            {task.assigned_to_email || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                            {task.finish_date ? format(new Date(task.finish_date), 'MMM d, yyyy') : '-'}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="text-sm text-gray-700">
                              <div className="font-medium mb-2">Description:</div>
                              <p className="whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
                              
                              <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                  <div className="font-medium mb-1">Start Date:</div>
                                  <p>{task.start_date ? format(new Date(task.start_date), 'MMM d, yyyy') : 'Not set'}</p>
                                </div>
                                <div>
                                  <div className="font-medium mb-1">Estimated Hours:</div>
                                  <p>{task.estimated_hours ? `${task.estimated_hours} hours` : 'Not set'}</p>
                                </div>
                                <div>
                                  <div className="font-medium mb-1">Estimated Cost:</div>
                                  <p>{task.estimated_cost ? `$${task.estimated_cost.toFixed(2)}` : 'Not set'}</p>
                                </div>
                              </div>
                              
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTaskClick(task.id);
                                  }}
                                  className="px-3 py-1 text-sm text-white rounded-md"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No tasks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}