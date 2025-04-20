import { create } from 'zustand';
import { supabase } from './supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';
import { retryOperation } from './errorHandlers';

type UserRole = 'system_admin' | 'agency_admin' | 'client_admin' | 'client_user';

interface System {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Agency {
  id: string;
  system_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string;
  agency_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface NavigationState {
  currentSystem: { id: string; name: string } | null;
  currentAgency: { id: string; name: string } | null;
  currentClient: { id: string; name: string } | null;
  setCurrentSystem: (system: { id: string; name: string } | null) => void;
  setCurrentAgency: (agency: { id: string; name: string } | null) => void;
  setCurrentClient: (client: { id: string; name: string } | null) => void;
  clearNavigation: () => void;
}

interface AuthState {
  user: any | null;
  username: string | null;
  role: UserRole | null;
  systemId: string | null;
  agencyId: string | null;
  clientId: string | null;
  isLoading: boolean;
  error: string | null;
  navigation: NavigationState;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUserRole: (userId: string) => Promise<void>;
  setUser: (user: any) => void;

  // Data access functions
  getSystems: () => Promise<System[]>;
  getAgencies: () => Promise<Agency[]>;
  getClients: () => Promise<Client[]>;
  getManageableUsers: () => Promise<any[]>;
  
  // Navigation helpers
  getDefaultRedirectPath: () => Promise<string>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  username: null,
  role: null,
  systemId: null,
  agencyId: null,
  clientId: null,
  isLoading: false,
  error: null,
  navigation: {
    currentSystem: null,
    currentAgency: null,
    currentClient: null,
    setCurrentSystem: (system) => set((state) => ({
      navigation: { ...state.navigation, currentSystem: system }
    })),
    setCurrentAgency: (agency) => set((state) => ({
      navigation: { ...state.navigation, currentAgency: agency }
    })),
    setCurrentClient: (client) => set((state) => ({
      navigation: { ...state.navigation, currentClient: client }
    })),
    clearNavigation: () => set((state) => ({
      navigation: {
        ...state.navigation,
        currentSystem: null,
        currentAgency: null,
        currentClient: null
      }
    }))
  },

  setUser: (user) => set({ user }),

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'User login attempt',
        { email }
      );
      
      // Use retry operation for login to handle potential timeouts
      const { data, error } = await retryOperation(
        () => supabase.auth.signInWithPassword({
          email,
          password,
        }),
        3 // Max 3 retries
      );
      
      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.USER_ACTION,
          'Login failed',
          { error: error.message, email }
        );
        throw error;
      }

      if (data.user) {
        // Set the session in the store
        set({ user: data.user });

        // Set up session refresh listener
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            set({ user: session?.user || null });
            if (session?.user) {
              await get().fetchUserRole(session.user.id);
            }
          }
        });

        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.USER_ACTION,
          'Login successful',
          { userId: data.user.id, email: data.user.email }
        );
        
        await get().fetchUserRole(data.user.id);
      }
      
      set({ isLoading: false });
    } catch (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Login error',
        { error }
      );
      
      set({ 
        error: (error as Error).message,
        isLoading: false,
        user: null,
        username: null,
        role: null,
        systemId: null,
        agencyId: null,
        clientId: null,
        navigation: {
          ...get().navigation,
          currentSystem: null,
          currentAgency: null,
          currentClient: null
        }
      });
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'User logout attempt',
        { userId: get().user?.id }
      );
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear all auth state
      set({ 
        user: null,
        username: null,
        role: null,
        systemId: null,
        agencyId: null,
        clientId: null,
        isLoading: false,
        navigation: {
          ...get().navigation,
          currentSystem: null,
          currentAgency: null,
          currentClient: null
        }
      });
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.USER_ACTION,
        'Logout successful',
        {}
      );
    } catch (error) {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Logout error',
        { error }
      );
      
      set({ 
        error: (error as Error).message,
        isLoading: false 
      });
    }
  },

  fetchUserRole: async (userId: string) => {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching user role',
        { userId }
      );
      
      // Use retry operation for fetching user role
      const { data, error } = await retryOperation(
        () => supabase
          .from('user_roles')
          .select('role, username, system_id, agency_id, client_id')
          .eq('user_id', userId)
          .maybeSingle(),
        3 // Max 3 retries
      );

      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching user role',
          { error, userId }
        );
        throw error;
      }

      if (data) {
        // Fetch context data based on role
        let systemData = null;
        let agencyData = null;
        let clientData = null;

        if (data.system_id) {
          const { data: system, error: systemError } = await supabase
            .from('systems')
            .select('id, name')
            .eq('id', data.system_id)
            .single();
            
          if (systemError) {
            logDebugEvent(
              DebugLevel.WARNING,
              DebugEventType.API_CALL,
              'Error fetching system data',
              { error: systemError, systemId: data.system_id }
            );
          } else {
            systemData = system;
          }
        }

        if (data.agency_id) {
          const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('id, name')
            .eq('id', data.agency_id)
            .single();
            
          if (agencyError) {
            logDebugEvent(
              DebugLevel.WARNING,
              DebugEventType.API_CALL,
              'Error fetching agency data',
              { error: agencyError, agencyId: data.agency_id }
            );
          } else {
            agencyData = agency;
          }
        }

        if (data.client_id) {
          const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, name')
            .eq('id', data.client_id)
            .single();
            
          if (clientError) {
            logDebugEvent(
              DebugLevel.WARNING,
              DebugEventType.API_CALL,
              'Error fetching client data',
              { error: clientError, clientId: data.client_id }
            );
          } else {
            clientData = client;
          }
        }

        set({
          role: data.role as UserRole,
          username: data.username,
          systemId: data.system_id,
          agencyId: data.agency_id,
          clientId: data.client_id,
          error: null,
          navigation: {
            ...get().navigation,
            currentSystem: systemData,
            currentAgency: agencyData,
            currentClient: clientData
          }
        });
        
        logDebugEvent(
          DebugLevel.SUCCESS,
          DebugEventType.API_CALL,
          'User role fetched successfully',
          { 
            userId, 
            role: data.role, 
            username: data.username,
            systemId: data.system_id, 
            agencyId: data.agency_id, 
            clientId: data.client_id 
          }
        );
      } else {
        set({
          role: null,
          username: null,
          systemId: null,
          agencyId: null,
          clientId: null,
          error: 'No role found for user',
          navigation: {
            ...get().navigation,
            currentSystem: null,
            currentAgency: null,
            currentClient: null
          }
        });
        
        logDebugEvent(
          DebugLevel.WARNING,
          DebugEventType.API_CALL,
          'No role found for user',
          { userId }
        );
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      set({ 
        error: 'Failed to fetch user role',
        role: null,
        username: null,
        systemId: null,
        agencyId: null,
        clientId: null,
        navigation: {
          ...get().navigation,
          currentSystem: null,
          currentAgency: null,
          currentClient: null
        }
      });
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching user role',
        { error }
      );
    }
  },

  getSystems: async () => {
    const { role, systemId } = get();
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching systems',
        { role, systemId }
      );
      
      let query = supabase.from('systems').select('*');
      
      // System admins can see their system only
      if (role === 'system_admin' && systemId) {
        query = query.eq('id', systemId);
      } else if (role !== 'system_admin') {
        // Other roles can't access systems
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.PERMISSION,
          'User does not have permission to view systems',
          { role }
        );
        return [];
      }

      // Use retry operation for fetching systems
      const { data, error } = await retryOperation(
        () => query.order('name'),
        3 // Max 3 retries
      );
      
      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching systems',
          { error }
        );
        throw error;
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Systems fetched successfully',
        { count: data?.length }
      );
      
      return data || [];
    } catch (error) {
      console.error('Error fetching systems:', error);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching systems',
        { error }
      );
      
      return [];
    }
  },

  getAgencies: async () => {
    const { role, systemId, agencyId } = get();
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching agencies',
        { role, systemId, agencyId }
      );
      
      let query = supabase.from('agencies').select('*');
      
      if (role === 'system_admin' && systemId) {
        // System admins can see agencies in their system
        query = query.eq('system_id', systemId);
      } else if (role === 'agency_admin' && agencyId) {
        // Agency admins can see their agency only
        query = query.eq('id', agencyId);
      } else if (!['system_admin', 'agency_admin'].includes(role as string)) {
        // Other roles can't access agencies
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.PERMISSION,
          'User does not have permission to view agencies',
          { role }
        );
        return [];
      }

      // Use retry operation for fetching agencies
      const { data, error } = await retryOperation(
        () => query.order('name'),
        3 // Max 3 retries
      );
      
      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching agencies',
          { error }
        );
        throw error;
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Agencies fetched successfully',
        { count: data?.length }
      );
      
      return data || [];
    } catch (error) {
      console.error('Error fetching agencies:', error);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching agencies',
        { error }
      );
      
      return [];
    }
  },

  getClients: async () => {
    const { role, agencyId, clientId } = get();
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching clients',
        { role, agencyId, clientId }
      );
      
      let query = supabase.from('clients').select('*');

      if (role === 'agency_admin' && agencyId) {
        // Agency admins can see clients in their agency
        query = query.eq('agency_id', agencyId);
      } else if (['client_admin', 'client_user'].includes(role as string) && clientId) {
        // Client roles can see their client only
        // Add validation to ensure clientId is a valid UUID before querying
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
          logDebugEvent(
            DebugLevel.ERROR,
            DebugEventType.VALIDATION,
            'Invalid client ID format',
            { clientId }
          );
          return [];
        }
        query = query.eq('id', clientId);
      } else if (!['system_admin', 'agency_admin', 'client_admin', 'client_user'].includes(role as string)) {
        // Invalid role for client access
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.PERMISSION,
          'User does not have permission to view clients',
          { role }
        );
        return [];
      }

      // Use retry operation for fetching clients
      const { data, error } = await retryOperation(
        () => query.order('name'),
        3 // Max 3 retries
      );
      
      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching clients',
          { error }
        );
        throw error;
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Clients fetched successfully',
        { count: data?.length }
      );
      
      return data || [];
    } catch (error) {
      console.error('Error fetching clients:', error);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching clients',
        { error }
      );
      
      return [];
    }
  },

  getManageableUsers: async () => {
    const { role, systemId, agencyId, clientId } = get();
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching manageable users',
        { role, systemId, agencyId, clientId }
      );
      
      let query = supabase.from('user_roles').select(`
        id,
        user_id,
        role,
        username,
        email,
        system_id,
        agency_id,
        client_id,
        created_at
      `);
      
      if (role === 'system_admin' && systemId) {
        // System admins can manage users in their system
        query = query.eq('system_id', systemId);
      } else if (role === 'agency_admin' && agencyId) {
        // Agency admins can manage users in their agency
        query = query.eq('agency_id', agencyId);
      } else if (role === 'client_admin' && clientId) {
        // Client admins can manage users in their client
        query = query.eq('client_id', clientId);
      } else {
        // Other roles can't manage users
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.PERMISSION,
          'User does not have permission to manage users',
          { role }
        );
        return [];
      }

      // Use retry operation for fetching manageable users
      const { data, error } = await retryOperation(
        () => query.order('created_at'),
        3 // Max 3 retries
      );
      
      if (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching manageable users',
          { error }
        );
        throw error;
      }
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Manageable users fetched successfully',
        { count: data?.length }
      );
      
      return data || [];
    } catch (error) {
      console.error('Error fetching manageable users:', error);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching manageable users',
        { error }
      );
      
      return [];
    }
  },

  getDefaultRedirectPath: async () => {
    const { role, systemId, agencyId, clientId } = get();
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.NAVIGATION,
        'Determining default redirect path',
        { role, systemId, agencyId, clientId }
      );
      
      // Default path based on role
      if (role === 'system_admin') {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.NAVIGATION,
          'System admin redirected to system dashboard',
          { path: '/system-dashboard' }
        );
        return '/system-dashboard';
      }
      
      // Agency admin goes to agency page if they have an agency
      if (role === 'agency_admin' && agencyId) {
        // Check if the agency exists
        const { data: agency, error: agencyError } = await supabase
          .from('agencies')
          .select('id')
          .eq('id', agencyId)
          .single();

        if (agencyError) {
          logDebugEvent(
            DebugLevel.WARNING,
            DebugEventType.API_CALL,
            'Error fetching agency for redirect',
            { error: agencyError, agencyId }
          );
        }
          
        if (agency) {
          const path = `/agencies/${agencyId}`;
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Agency admin redirected to agency page',
            { path }
          );
          return path;
        }
        
        // If no specific agency, go to agencies list
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.NAVIGATION,
          'Agency admin redirected to agencies list',
          { path: '/agencies' }
        );
        return '/agencies';
      }
      
      // Client admin or user goes to client page if they have a client
      if ((role === 'client_admin' || role === 'client_user') && clientId) {
        // Check if the client exists
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('id', clientId)
          .single();
          
        if (clientError) {
          logDebugEvent(
            DebugLevel.WARNING,
            DebugEventType.API_CALL,
            'Error fetching client for redirect',
            { error: clientError, clientId }
          );
        }
          
        if (client) {
          const path = `/clients/${clientId}`;
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Client user redirected to client page',
            { path }
          );
          return path;
        }
      }
      
      // Default fallback
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.NAVIGATION,
        'User redirected to default dashboard',
        { path: '/dashboard' }
      );
      
      return '/dashboard';
    } catch (error) {
      console.error('Error determining default redirect path:', error);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.NAVIGATION,
        'Error determining default redirect path',
        { error }
      );
      
      return '/dashboard';
    }
  }
}));

// Permission check helpers
export const canManageSystems = (role: UserRole | null) => role === 'system_admin';

export const canManageAgencies = (role: UserRole | null) => 
  ['system_admin', 'agency_admin'].includes(role as string);

export const canManageClients = (role: UserRole | null) => 
  ['system_admin', 'agency_admin', 'client_admin'].includes(role as string);

export const canManageTasks = (role: UserRole | null) => role !== null;

export const canManageUsers = (role: UserRole | null) => 
  ['system_admin', 'agency_admin', 'client_admin'].includes(role as string);

export const canAssignTasks = (role: UserRole | null) =>
  ['system_admin', 'agency_admin', 'client_admin'].includes(role as string);

export const canUpdateTaskStatus = (role: UserRole | null) => role !== null;

export const canDeleteTasks = (role: UserRole | null) =>
  ['system_admin', 'agency_admin', 'client_admin'].includes(role as string);