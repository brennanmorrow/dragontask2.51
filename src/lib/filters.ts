import { Task } from './types';
import { isAfter, isBefore, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export function filterTasks(
  tasks: Task[],
  searchTerm: string,
  filters: {
    priority: string[];
    assignee: string[];
    dueDate: string | null;
  }
): Task[] {
  return tasks.filter(task => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!task.title.toLowerCase().includes(searchLower) && 
          !task.description?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Priority filter
    if (filters.priority.length > 0 && !filters.priority.includes(task.priority)) {
      return false;
    }

    // Assignee filter
    if (filters.assignee.length > 0 && !filters.assignee.includes(task.assigned_to)) {
      return false;
    }

    // Due date filter
    if (filters.dueDate) {
      const now = new Date();
      const dueDate = task.finish_date ? new Date(task.finish_date) : null;

      switch (filters.dueDate) {
        case 'overdue':
          if (!dueDate || !isBefore(dueDate, startOfDay(now))) return false;
          break;
        case 'today':
          if (!dueDate || !isAfter(dueDate, startOfDay(now)) || !isBefore(dueDate, endOfDay(now))) return false;
          break;
        case 'week':
          if (!dueDate || !isAfter(dueDate, startOfWeek(now)) || !isBefore(dueDate, endOfWeek(now))) return false;
          break;
        case 'month':
          if (!dueDate || !isAfter(dueDate, startOfMonth(now)) || !isBefore(dueDate, endOfMonth(now))) return false;
          break;
        case 'none':
          if (dueDate) return false;
          break;
      }
    }

    return true;
  });
}