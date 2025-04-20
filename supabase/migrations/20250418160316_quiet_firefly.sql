/*
  # Update time entry cost tracking

  1. New Functions
    - Update the `add_manual_time_entry` function to accept an actual_cost parameter
    - Create a new function to calculate budget utilization metrics
  
  2. Changes
    - Modify the existing time entry cost calculation to be more flexible
    - Add support for manual cost entry
*/

-- Update the add_manual_time_entry function to accept an actual_cost parameter
CREATE OR REPLACE FUNCTION add_manual_time_entry(
  p_task_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_description TEXT DEFAULT NULL,
  p_is_billable BOOLEAN DEFAULT TRUE,
  p_actual_cost NUMERIC(10,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- Insert the time entry
  INSERT INTO task_time_entries (
    task_id,
    user_id,
    start_time,
    end_time,
    description,
    is_billable,
    is_running,
    actual_cost
  ) VALUES (
    p_task_id,
    v_user_id,
    p_start_time,
    p_end_time,
    p_description,
    p_is_billable,
    FALSE,
    p_actual_cost
  )
  RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to calculate budget utilization metrics for a client
CREATE OR REPLACE FUNCTION get_client_budget_utilization(
  p_client_id UUID,
  p_month TEXT
)
RETURNS TABLE (
  hours_budget NUMERIC(10,2),
  hours_used NUMERIC(10,2),
  hours_remaining NUMERIC(10,2),
  hours_percentage NUMERIC(10,2),
  cost_budget NUMERIC(10,2),
  cost_used NUMERIC(10,2),
  cost_remaining NUMERIC(10,2),
  cost_percentage NUMERIC(10,2),
  estimated_hours NUMERIC(10,2),
  estimated_cost NUMERIC(10,2),
  estimated_hours_percentage NUMERIC(10,2),
  estimated_cost_percentage NUMERIC(10,2)
) AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_budget_record RECORD;
  v_hours_used NUMERIC(10,2) := 0;
  v_cost_used NUMERIC(10,2) := 0;
  v_estimated_hours NUMERIC(10,2) := 0;
  v_estimated_cost NUMERIC(10,2) := 0;
BEGIN
  -- Parse the month string to get start and end dates
  v_start_date := (p_month || '-01')::DATE;
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE + INTERVAL '1 day' - INTERVAL '1 second';
  
  -- Get budget for the month
  SELECT hours_budget, cost_budget INTO v_budget_record
  FROM client_budgets
  WHERE client_id = p_client_id AND month = p_month
  LIMIT 1;
  
  -- If no budget record exists, set defaults
  IF v_budget_record IS NULL THEN
    v_budget_record.hours_budget := 0;
    v_budget_record.cost_budget := 0;
  END IF;
  
  -- Calculate hours used from time entries
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (tte.end_time - tte.start_time)) / 3600
  ), 0) INTO v_hours_used
  FROM task_time_entries tte
  JOIN tasks t ON tte.task_id = t.id
  WHERE t.client_id = p_client_id
    AND tte.start_time >= v_start_date
    AND tte.start_time <= v_end_date
    AND tte.end_time IS NOT NULL;
  
  -- Calculate cost used from time entries
  SELECT COALESCE(SUM(tte.actual_cost), 0) INTO v_cost_used
  FROM task_time_entries tte
  JOIN tasks t ON tte.task_id = t.id
  WHERE t.client_id = p_client_id
    AND tte.start_time >= v_start_date
    AND tte.start_time <= v_end_date
    AND tte.end_time IS NOT NULL;
  
  -- Calculate estimated hours and cost for tasks due in this month
  SELECT 
    COALESCE(SUM(estimated_hours), 0),
    COALESCE(SUM(estimated_cost), 0)
  INTO v_estimated_hours, v_estimated_cost
  FROM tasks
  WHERE client_id = p_client_id
    AND finish_date >= v_start_date
    AND finish_date <= v_end_date;
  
  -- Return the results
  RETURN QUERY SELECT
    v_budget_record.hours_budget,
    v_hours_used,
    GREATEST(0, v_budget_record.hours_budget - v_hours_used),
    CASE WHEN v_budget_record.hours_budget > 0 THEN
      (v_hours_used / v_budget_record.hours_budget) * 100
    ELSE 0 END,
    v_budget_record.cost_budget,
    v_cost_used,
    GREATEST(0, v_budget_record.cost_budget - v_cost_used),
    CASE WHEN v_budget_record.cost_budget > 0 THEN
      (v_cost_used / v_budget_record.cost_budget) * 100
    ELSE 0 END,
    v_estimated_hours,
    v_estimated_cost,
    CASE WHEN v_budget_record.hours_budget > 0 THEN
      (v_estimated_hours / v_budget_record.hours_budget) * 100
    ELSE 0 END,
    CASE WHEN v_budget_record.cost_budget > 0 THEN
      (v_estimated_cost / v_budget_record.cost_budget) * 100
    ELSE 0 END;
END;
$$ LANGUAGE plpgsql;