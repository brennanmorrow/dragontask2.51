import { supabase } from './supabase';

export async function createAdminUser() {
  try {
    // Sign up the admin user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'brennan@solatubebend.com',
      password: 'B123456',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) throw authError;

    // First create a system
    const { data: systemData, error: systemError } = await supabase
      .from('systems')
      .insert([
        { name: 'Main System' }
      ])
      .select()
      .single();

    if (systemError) throw systemError;

    // Create system admin role for the user
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([
        {
          user_id: authData.user?.id,
          role: 'system_admin',
          system_id: systemData.id,
        }
      ]);

    if (roleError) throw roleError;

    return { success: true };
  } catch (error) {
    console.error('Error creating admin user:', error);
    return { success: false, error };
  }
}