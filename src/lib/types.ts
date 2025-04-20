import { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'done';
export type SopStatus = 'draft' | 'review' | 'approved' | 'archived';
export type SopAccessLevel = 'system' | 'agency' | 'client';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigned_to: string;
  assigned_to_email?: string;
  start_date: string | null;
  finish_date: string | null;
  priority: 'low' | 'medium' | 'high';
  board_id: string;
  position: number;
  estimated_hours: number | null;
  estimated_cost: number | null;
  created_at: string;
  updated_at: string;
  tags?: TaskTag[];
  dependencies?: TaskDependency[];
}

export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

export interface TaskDependency {
  task_id: string;
  title: string;
  status: string;
  type: 'blocks' | 'blocked_by';
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string;
  name: string;
  size: number;
  type: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface TaskActivityType {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string;
  action: string;
  details: {
    title?: { from: string; to: string };
    description?: { from: string; to: string };
    status?: { from: string; to: string };
    priority?: { from: string; to: string };
    assigned_to?: { from: string; to: string };
    start_date?: { from: string; to: string };
    finish_date?: { from: string; to: string };
    estimated_hours?: { from: number; to: number };
    estimated_cost?: { from: number; to: number };
    tags?: { from: string[]; to: string[] };
  };
  created_at: string;
}

export interface Board {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  key: string;
  color: string;
  icon: string;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface DraggableTaskCardProps {
  task: Task;
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap;
  style?: React.CSSProperties;
  isDragging?: boolean;
  onClick: () => void;
}

export type TaskBoardView = 'kanban' | 'calendar' | 'gantt' | 'list' | 'reports';

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string;
  start_time: string;
  end_time: string | null;
  duration: string;
  description: string | null;
  is_billable: boolean;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
}

// SOP Types
export interface SOP {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  agency_id: string | null;
  system_id: string | null;
  access_level: SopAccessLevel;
  status: SopStatus;
  created_by: string;
  created_by_email?: string;
  created_at: string;
  updated_at: string;
  tags?: SopTag[];
  current_version?: SopVersion;
}

export interface SopVersion {
  id: string;
  sop_id: string;
  version_number: number;
  content: string;
  created_by: string;
  created_by_email?: string;
  created_at: string;
}

export interface SopTag {
  id: string;
  name: string;
  color: string;
  client_id?: string;
  agency_id?: string;
  system_id?: string;
  access_level?: SopAccessLevel;
}

export interface SopComment {
  id: string;
  sop_id: string;
  user_id: string;
  user_email: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  replies?: SopComment[];
}

export interface SopReference {
  id: string;
  sop_id: string;
  title: string;
  url: string;
  created_by: string;
  created_by_email?: string;
  created_at: string;
}

export interface SopStatusHistory {
  id: string;
  sop_id: string;
  old_status: SopStatus | null;
  new_status: SopStatus;
  changed_by: string;
  changed_by_email?: string;
  reason: string | null;
  created_at: string;
}

// Client Budget Types
export interface ClientBudget {
  id: string;
  client_id: string;
  month: string; // YYYY-MM format
  hours_budget: number;
  cost_budget: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetReport {
  month: string;
  hours_budget: number;
  hours_used: number;
  hours_remaining: number;
  hours_percentage: number;
  cost_budget: number;
  cost_used: number;
  cost_remaining: number;
  cost_percentage: number;
  estimated_hours?: number;
  estimated_hours_percentage?: number;
}

// Project Manager Types
export interface ProjectManager {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  title: string;
  bio: string;
  avatar_url: string | null;
  status: 'active' | 'away' | 'busy' | 'offline';
  workload: number; // 0-100 percentage
  created_at: string;
  updated_at: string;
}

export interface ClientProjectManager {
  id: string;
  client_id: string;
  pm_id: string;
  assigned_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  relationship_duration_days?: number;
  project_manager?: ProjectManager;
}