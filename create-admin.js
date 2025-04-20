// Script to create or update a system admin user
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createOrUpdateSystemAdmin() {
  try {
    console.log('Starting system admin creation/update process...');
    
    const email = 'brennan@solatubebend.com';
    const password = 'B123456'; // You should change this to a secure password in production
    
    // Check if user exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('email', email);
      
    if (checkError) {
      throw new Error(`Error checking for existing user: ${checkError.message}`);
    }
    
    if (existingUsers && existingUsers.length > 0) {
      console.log('User already exists, updating to system admin role...');
      
      // Get the first system
      const { data: systems, error: systemError } = await supabase
        .from('systems')
        .select('id')
        .limit(1);
        
      if (systemError) {
        throw new Error(`Error fetching systems: ${systemError.message}`);
      }
      
      if (!systems || systems.length === 0) {
        throw new Error('No systems found. Please create a system first.');
      }
      
      const systemId = systems[0].id;
      
      // Update user role to system_admin
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ 
          role: 'system_admin',
          system_id: systemId,
          agency_id: null,
          client_id: null
        })
        .eq('email', email);
        
      if (updateError) {
        throw new Error(`Error updating user role: ${updateError.message}`);
      }
      
      // Update user assignments
      const userId = existingUsers[0].user_id;
      
      // Clear existing assignments
      await supabase.from('user_system_assignments').delete().eq('user_id', userId);
      await supabase.from('user_agency_assignments').delete().eq('user_id', userId);
      await supabase.from('user_client_assignments').delete().eq('user_id', userId);
      
      // Add system assignment
      const { error: assignError } = await supabase
        .from('user_system_assignments')
        .insert([{ user_id: userId, system_id: systemId }]);
        
      if (assignError) {
        throw new Error(`Error creating system assignment: ${assignError.message}`);
      }
      
      console.log(`User ${email} successfully updated to system admin role.`);
      
    } else {
      console.log('User does not exist, creating new system admin user...');
      
      // Get the first system
      const { data: systems, error: systemError } = await supabase
        .from('systems')
        .select('id')
        .limit(1);
        
      if (systemError) {
        throw new Error(`Error fetching systems: ${systemError.message}`);
      }
      
      let systemId;
      
      if (!systems || systems.length === 0) {
        // Create a new system
        console.log('No systems found, creating a new system...');
        const { data: newSystem, error: createSystemError } = await supabase
          .from('systems')
          .insert([{ name: 'Main System' }])
          .select();
          
        if (createSystemError) {
          throw new Error(`Error creating system: ${createSystemError.message}`);
        }
        
        systemId = newSystem[0].id;
      } else {
        systemId = systems[0].id;
      }
      
      // Create the user in auth.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'system_admin',
            system_id: systemId
          }
        }
      });
      
      if (authError) {
        throw new Error(`Error creating user in auth: ${authError.message}`);
      }
      
      if (!authData.user) {
        throw new Error('Failed to create user');
      }
      
      console.log(`User ${email} successfully created as system admin.`);
      console.log('Note: In a production environment, you should use a secure password and enable email confirmation.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the function
createOrUpdateSystemAdmin();