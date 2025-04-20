/*
  # Fix User Creation Process

  1. New Functions
    - Add a new function to ensure user roles are properly created
    - Add a function to manually create a user role if the trigger fails
  
  2. Changes
    - No changes to existing functions, only adding new ones
    - Ensures user creation is more reliable
*/

-- Function to manually create a user role if the trigger fails
CREATE OR REPLACE FUNCTION create_user_role(
  p_user_id UUID,
  p_email TEXT,
  p_username TEXT,
  p_role TEXT,
  p_system_id UUID DEFAULT NULL,
  p_agency_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_role_id UUID;
  v_existing_role_id UUID;
BEGIN
  -- Check if a role already exists for this user
  SELECT id INTO v_existing_role_id
  FROM user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If role exists, update it
  IF v_existing_role_id IS NOT NULL THEN
    UPDATE user_roles
    SET 
      role = p_role,
      system_id = p_system_id,
      agency_id = p_agency_id,
      client_id = p_client_id,
      updated_at = NOW()
    WHERE id = v_existing_role_id
    RETURNING id INTO v_role_id;
  ELSE
    -- Insert new role
    INSERT INTO user_roles (
      user_id,
      email,
      username,
      role,
      system_id,
      agency_id,
      client_id
    ) VALUES (
      p_user_id,
      p_email,
      p_username,
      p_role,
      p_system_id,
      p_agency_id,
      p_client_id
    )
    RETURNING id INTO v_role_id;
  END IF;
  
  -- Create appropriate assignments based on role
  IF p_role = 'system_admin' AND p_system_id IS NOT NULL THEN
    -- Delete any existing system assignments
    DELETE FROM user_system_assignments WHERE user_id = p_user_id;
    
    -- Create system assignment
    INSERT INTO user_system_assignments (user_id, system_id)
    VALUES (p_user_id, p_system_id)
    ON CONFLICT (user_id, system_id) DO NOTHING;
    
  ELSIF p_role = 'agency_admin' AND p_agency_id IS NOT NULL THEN
    -- Delete any existing agency assignments
    DELETE FROM user_agency_assignments WHERE user_id = p_user_id;
    
    -- Create agency assignment
    INSERT INTO user_agency_assignments (user_id, agency_id)
    VALUES (p_user_id, p_agency_id)
    ON CONFLICT (user_id, agency_id) DO NOTHING;
    
  ELSIF (p_role = 'client_admin' OR p_role = 'client_user') AND p_client_id IS NOT NULL THEN
    -- Delete any existing client assignments
    DELETE FROM user_client_assignments WHERE user_id = p_user_id;
    
    -- Create client assignment
    INSERT INTO user_client_assignments (user_id, client_id)
    VALUES (p_user_id, p_client_id)
    ON CONFLICT (user_id, client_id) DO NOTHING;
  END IF;
  
  -- Create user profile if it doesn't exist
  INSERT INTO user_profiles (user_id, email)
  VALUES (p_user_id, p_email)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create notification preferences if they don't exist
  INSERT INTO user_notification_preferences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify and fix user creation
CREATE OR REPLACE FUNCTION verify_user_creation(
  p_user_id UUID,
  p_email TEXT,
  p_username TEXT,
  p_role TEXT,
  p_system_id UUID DEFAULT NULL,
  p_agency_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role_exists BOOLEAN;
BEGIN
  -- Check if user role exists
  SELECT EXISTS(
    SELECT 1 FROM user_roles WHERE user_id = p_user_id
  ) INTO v_role_exists;
  
  -- If role doesn't exist, create it
  IF NOT v_role_exists THEN
    PERFORM create_user_role(
      p_user_id,
      p_email,
      p_username,
      p_role,
      p_system_id,
      p_agency_id,
      p_client_id
    );
    
    -- Log the manual creation
    INSERT INTO debug_events (
      level,
      type,
      message,
      details
    ) VALUES (
      'info',
      'USER_CREATION',
      'Manually created user role that was missing',
      jsonb_build_object(
        'user_id', p_user_id,
        'email', p_email,
        'role', p_role
      )
    );
    
    RETURN TRUE;
  END IF;
  
  RETURN v_role_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role details
CREATE OR REPLACE FUNCTION get_user_role_details(
  p_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  username TEXT,
  role TEXT,
  system_id UUID,
  agency_id UUID,
  client_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ur.user_id,
    ur.email,
    ur.username,
    ur.role,
    ur.system_id,
    ur.agency_id,
    ur.client_id,
    ur.created_at
  FROM user_roles ur
  WHERE ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;