import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import { logDebugEvent, DebugLevel, DebugEventType } from '../debugSystem';
import { fetchUserById } from '../services/userService';

export function useAuth() {
  const { user, setUser, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount
    const checkSession = async () => {
      try {
        setIsLoading(true);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session?.user) {
          setUser(session.user);
          
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.AUTH,
            'User session restored',
            { userId: session.user.id, email: session.user.email }
          );
        }
      } catch (err) {
        console.error('Error checking session:', err);
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.AUTH,
          'Error checking session',
          { error: err }
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.AUTH,
            'User signed in',
            { userId: session.user.id, email: session.user.email }
          );
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.AUTH,
            'User signed out',
            {}
          );
        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
          
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.AUTH,
            'User updated',
            { userId: session.user.id, email: session.user.email }
          );
        } else if (event === 'PASSWORD_RECOVERY' && session?.user) {
          // Handle password recovery
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.AUTH,
            'Password recovery initiated',
            { userId: session.user.id, email: session.user.email }
          );
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, isLoading, logout };
}