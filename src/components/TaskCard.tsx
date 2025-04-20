import React, { useState } from 'react';
import { format, isAfter } from 'date-fns';
import { 
  Clock, 
  User, 
  ExternalLink, 
  CheckSquare, 
  Tag, 
  Calendar, 
  MoreHorizontal,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from 'lucide-react';
import clsx from 'clsx';
import { Task } from '../lib/types';
import { useAppContext } from '../lib/AppContext';

interface TaskCardProps {
  task: Task;
  onClick: (taskId: string) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { systemSettings } = useAppContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const isOverdue = task.finish_date && isAfter(new Date(), new Date(task.finish_date)) && task.status !== 'done';

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const secondaryColor = systemSettings?.secondary_color || '#B91C1C';
  const accentColor = systemSettings?.accent_color || '#FCA5A5';

  // Custom priority colors based on theme
  const priorityColors = {
    low: { bg: '#D1FAE5', text: '#065F46', icon: '#10B981' },
    medium: { bg: '#FEF3C7', text: '#92400E', icon: '#F59E0B' },
    high: { bg: `rgba(${parseInt(primaryColor.slice(1, 3), 16)}, ${parseInt(primaryColor.slice(3, 5), 16)}, ${parseInt(primaryColor.slice(5, 7), 16)}, 0.1)`, text: primaryColor, icon: primaryColor }
  };

  // Status colors
  const statusColors = {
    inbox: { bg: '#F3F4F6', text: '#4B5563', icon: '#9CA3AF' },
    todo: { bg: '#DBEAFE', text: '#1E40AF', icon: '#3B82F6' },
    doing: { bg: '#FEF3C7', text: '#92400E', icon: '#F59E0B' },
    done: { bg: '#D1FAE5', text: '#065F46', icon: '#10B981' }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(task.id);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Calculate completion percentage for checklist if available
  const checklistItems = task.checklistItems || [];
  const completedItems = checklistItems.filter(item => item.is_completed).length;
  const totalItems = checklistItems.length;
  const checklistProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200',
        'hover:shadow-md hover:border-gray-300',
        isExpanded ? 'shadow-md' : '',
        task.status === 'done' && 'opacity-80'
      )}
    >
      {/* Card Header - Status and Priority */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div 
          className="flex items-center space-x-2"
          style={{ color: statusColors[task.status].icon }}
        >
          <span 
            className={clsx(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            )}
            style={{ 
              backgroundColor: statusColors[task.status].bg,
              color: statusColors[task.status].text
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: statusColors[task.status].icon }}></span>
            <span className="capitalize">{task.status}</span>
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span 
            className={clsx(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            )}
            style={{ 
              backgroundColor: priorityColors[task.priority].bg,
              color: priorityColors[task.priority].text
            }}
          >
            <span className="capitalize">{task.priority}</span>
          </span>
          <button
            onClick={toggleExpand}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3">
        {/* Title */}
        <h3 
          className="text-base font-medium text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 cursor-pointer"
          onClick={handleClick}
        >
          {task.title}
        </h3>

        {/* Quick Info Row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
          {/* Due Date */}
          {task.finish_date && (
            <div 
              className={clsx(
                "flex items-center",
                isOverdue && "text-red-600 font-medium"
              )}
              title={`Due ${format(new Date(task.finish_date), 'MMM d, yyyy')}${isOverdue ? ' (Overdue)' : ''}`}
            >
              {isOverdue ? (
                <AlertCircle className="h-3.5 w-3.5 mr-1" style={{ color: primaryColor }} />
              ) : (
                <Calendar className="h-3.5 w-3.5 mr-1" />
              )}
              <span>
                {format(new Date(task.finish_date), 'MMM d')}
              </span>
            </div>
          )}

          {/* Assignee */}
          {task.assigned_to_email && (
            <div className="flex items-center overflow-hidden" title={`Assigned to ${task.assigned_to_email}`}>
              <User className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              <span className="truncate max-w-[100px]">{task.assigned_to_email}</span>
            </div>
          )}

          {/* Estimated Hours */}
          {task.estimated_hours && (
            <div className="flex items-center" title={`Estimated: ${task.estimated_hours} hours`}>
              <Clock className="h-3.5 w-3.5 mr-1" />
              <span>{task.estimated_hours}h</span>
            </div>
          )}

          {/* Comments Count (if available) */}
          {task.comments_count && (
            <div className="flex items-center" title={`${task.comments_count} comments`}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              <span>{task.comments_count}</span>
            </div>
          )}
        </div>

        {/* Checklist Progress */}
        {totalItems > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center text-gray-600">
                <CheckSquare className="h-3.5 w-3.5 mr-1" />
                <span>Checklist</span>
              </div>
              <span className="text-gray-500">{completedItems}/{totalItems}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="h-1.5 rounded-full" 
                style={{ 
                  width: `${checklistProgress}%`,
                  backgroundColor: checklistProgress === 100 ? '#10B981' : primaryColor
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.map(tag => (
              <span 
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {/* Description */}
            {task.description && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-700 mb-1">Description</h4>
                <p className="text-sm text-gray-600 whitespace-pre-line">{task.description}</p>
              </div>
            )}

            {/* Checklist Items */}
            {totalItems > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-700 mb-1">Checklist Items</h4>
                <ul className="space-y-1">
                  {checklistItems.slice(0, 3).map(item => (
                    <li key={item.id} className="flex items-center text-sm">
                      <div className={`flex-shrink-0 h-4 w-4 rounded border mr-2 flex items-center justify-center ${
                        item.is_completed ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                      }`}
                      style={item.is_completed ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {item.is_completed && <CheckSquare className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`${item.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                  {totalItems > 3 && (
                    <li className="text-xs text-gray-500 italic pl-6">
                      +{totalItems - 3} more items
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Time and Cost */}
            <div className="flex justify-between text-xs text-gray-500">
              {task.estimated_cost && (
                <span>Est. Cost: ${task.estimated_cost.toFixed(2)}</span>
              )}
              {task.start_date && (
                <span>Started: {format(new Date(task.start_date), 'MMM d')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="bg-gray-50 px-3 py-2 flex justify-between items-center border-t border-gray-100">
        <button
          onClick={handleClick}
          className="text-xs font-medium flex items-center"
          style={{ color: primaryColor }}
        >
          View Details
          <ExternalLink className="ml-1 h-3 w-3" />
        </button>
        
        <div className="flex items-center">
          <button
            onClick={handleClick}
            className="p-1 rounded hover:bg-gray-200"
            title="More options"
          >
            <MoreHorizontal className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}