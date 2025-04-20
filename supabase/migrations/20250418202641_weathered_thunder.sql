/*
  # Add actual cost tracking to time entries

  1. New Fields
    - Add `actual_cost` column to `task_time_entries` table to track direct expenses
  
  2. Changes
    - Modify the time tracking system to properly separate time from monetary costs
    - This allows tracking both hours spent and actual dollars spent separately
*/

-- Add actual_cost column to task_time_entries if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_time_entries' AND column_name = 'actual_cost'
  ) THEN
    ALTER TABLE task_time_entries ADD COLUMN actual_cost NUMERIC(10,2);
  END IF;
END $$;

-- Create or replace function to calculate time entry cost
CREATE OR REPLACE FUNCTION calculate_time_entry_cost()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if actual_cost is NULL and end_time is not NULL
  IF NEW.actual_cost IS NULL AND NEW.end_time IS NOT NULL THEN
    -- Default hourly rate of $50 if not specified
    NEW.actual_cost := (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600) * 50;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate cost when time entry is completed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'calculate_time_entry_cost_trigger'
  ) THEN
    CREATE TRIGGER calculate_time_entry_cost_trigger
    BEFORE INSERT OR UPDATE OF end_time
    ON task_time_entries
    FOR EACH ROW
    EXECUTE FUNCTION calculate_time_entry_cost();
  END IF;
END $$;