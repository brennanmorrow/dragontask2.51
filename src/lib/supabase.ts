import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { useAuthStore } from './store';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Token refresh lock mechanism
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;
const refreshQueue: Array<{
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: any) => void;
}> = [];

// Process queued refresh requests
const processQueue = (error?: any) => {
  refreshQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve();
    }
  });
  refreshQueue.length = 0;
};

// Helper function to clear auth state and redirect
const handleAuthError = () => {
  try {
    // Clear all Supabase-related items from localStorage
    const storageKeyPrefix = `sb-${supabaseUrl.split('//')[1].split('.')[0]}`;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(storageKeyPrefix)) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear auth state
    useAuthStore.getState().logout();
    
    // Redirect to home/login page
    window.location.href = '/';
  } catch (error) {
    console.error('Error handling auth error:', error);
    // Ensure redirect happens even if other cleanup fails
    window.location.href = '/';
  }
};

// Initialize the Supabase client with enhanced session handling
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`,
    flowType: 'pkce',
    // Extend session expiration to 12 hours (43200 seconds)
    sessionTimeout: 43200,
    // Add debug logging for auth events
    debug: import.meta.env.DEV,
    // Add storage options with error handling
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.error('Storage getItem error:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('Storage setItem error:', error);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Storage removeItem error:', error);
        }
      }
    }
  }
});

// Enhanced auth initialization with error handling and refresh queue
export const initializeAuth = async () => {
  try {
    // Get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth session error:', error.message);
      
      // Handle session-related errors
      if (error.message.includes('refresh_token_not_found') || 
          error.message.includes('Invalid Refresh Token') ||
          error.message.includes('invalid refresh token') ||
          error.message.includes('Session Expired')) {
        console.warn('Invalid or expired session detected, redirecting to login');
        handleAuthError();
        return null;
      }
      
      throw error;
    }
    
    if (session?.user) {
      // Set up session refresh listener
      setupSessionRefresh();
      
      // Fetch user role and return user
      const { user } = session;
      await useAuthStore.getState().fetchUserRole(user.id);
      return user;
    }

    // No valid session found
    return null;
  } catch (error) {
    console.error('Error initializing auth:', error);
    handleAuthError();
    return null;
  }
};

// Set up session refresh handling with improved error handling and queue
const setupSessionRefresh = () => {
  let checkInterval: number;

  // Listen for auth state changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('Auth state changed:', event);
      
      switch (event) {
        case 'TOKEN_REFRESHED':
          console.log('Token refreshed successfully');
          isRefreshing = false;
          processQueue();
          break;
        case 'SIGNED_OUT':
          console.log('User signed out');
          clearInterval(checkInterval);
          handleAuthError();
          break;
        case 'USER_UPDATED':
          if (session) {
            console.log('User updated');
            useAuthStore.getState().setUser(session.user);
          }
          break;
        case 'SIGNED_IN':
          console.log('User signed in');
          break;
      }
    }
  );

  // Set up periodic session check with improved error handling and queue
  checkInterval = window.setInterval(async () => {
    if (isRefreshing) {
      console.log('Token refresh already in progress, queueing request');
      if (refreshPromise) {
        await refreshPromise;
        return;
      }
    }
    
    try {
      isRefreshing = true;
      refreshPromise = new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        if (error.message.includes('Session Expired') ||
            error.message.includes('Invalid Refresh Token')) {
          throw error;
        }
      }
      
      if (!session) {
        console.warn('No valid session found, attempting refresh');
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          if (refreshError.message.includes('Session Expired') ||
              refreshError.message.includes('Invalid Refresh Token')) {
            throw refreshError;
          }
        }
      }
      
      processQueue();
    } catch (error) {
      console.error('Session refresh failed:', error);
      processQueue(error);
      clearInterval(checkInterval);
      handleAuthError();
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  // Clean up on unmount
  return () => {
    subscription.unsubscribe();
    clearInterval(checkInterval);
  };
};

export async function uploadAgencyLogo(file: File, agencyId: string): Promise<string | null> {
  const { role } = useAuthStore.getState();
  
  if (role !== 'system_admin' && role !== 'agency_admin') {
    throw new Error('Insufficient permissions to upload agency logo');
  }

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${agencyId}-${Date.now()}.${fileExt}`;
    const filePath = `agency-logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('agency-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('agency-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading logo:', error);
    throw error;
  }
}

export async function uploadTaskAttachment(file: File, taskId: string): Promise<string | null> {
  const { role } = useAuthStore.getState();
  
  if (!['system_admin', 'agency_admin', 'client_admin', 'client_user'].includes(role)) {
    throw new Error('Insufficient permissions to upload task attachments');
  }

  try {
    // Generate a safe filename
    const fileExt = file.name.split('.').pop() || '';
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${taskId}-${Date.now()}-${safeFileName}`;
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('task-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('task-attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading attachment:', error);
    throw error;
  }
}

export async function uploadSopAttachment(file: File, sopId: string): Promise<string | null> {
  const { role } = useAuthStore.getState();
  
  if (!['system_admin', 'agency_admin', 'client_admin', 'client_user'].includes(role)) {
    throw new Error('Insufficient permissions to upload SOP attachments');
  }

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${sopId}-${Date.now()}.${fileExt}`;
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sop-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('sop-attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading SOP attachment:', error);
    throw error;
  }
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function extractLinksFromHtml(html: string): { url: string; title: string }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));
  
  return links.map(link => ({
    url: link.href,
    title: link.textContent || link.href
  }));
}

export function stripHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

export function getFileTypeInfo(fileName: string, mimeType: string): { 
  icon: string; 
  color: string;
  category: string;
} {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Document types
  if (['pdf'].includes(extension)) return { icon: 'file-pdf', color: '#F40F02', category: 'Document' };
  if (['doc', 'docx'].includes(extension || '')) return { icon: 'file-word', color: '#2B579A', category: 'Document' };
  if (['xls', 'xlsx', 'csv'].includes(extension || '')) return { icon: 'file-spreadsheet', color: '#217346', category: 'Spreadsheet' };
  if (['ppt', 'pptx'].includes(extension || '')) return { icon: 'file-presentation', color: '#D24726', category: 'Presentation' };
  if (['txt', 'rtf'].includes(extension || '')) return { icon: 'file-text', color: '#6B7280', category: 'Text' };
  
  // Image types
  if (mimeType.startsWith('image/')) return { icon: 'image', color: '#8B5CF6', category: 'Image' };
  
  // Video types
  if (mimeType.startsWith('video/')) return { icon: 'film', color: '#EC4899', category: 'Video' };
  
  // Audio types
  if (mimeType.startsWith('audio/')) return { icon: 'music', color: '#F59E0B', category: 'Audio' };
  
  // Archive types
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) || 
      mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive')) {
    return { icon: 'archive', color: '#6B7280', category: 'Archive' };
  }
  
  // Code types
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'c', 'cpp', 'php'].includes(extension) ||
      mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || 
      mimeType.includes('css') || mimeType.includes('json') || mimeType.includes('xml')) {
    return { icon: 'code', color: '#3B82F6', category: 'Code' };
  }
  
  // Database types
  if (['sql', 'db', 'sqlite'].includes(extension) || mimeType.includes('sql') || mimeType.includes('database')) {
    return { icon: 'database', color: '#1E40AF', category: 'Database' };
  }
  
  // Default
  return { icon: 'file', color: '#6B7280', category: 'File' };
}