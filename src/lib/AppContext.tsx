import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { checkAndProcessNotificationEmails, setupNotificationEmailProcessor } from './emailNotifications';
import { logDebugEvent, DebugLevel, DebugEventType } from './debugSystem';

interface SystemSettings {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
}

interface AppContextType {
  systemSettings: SystemSettings | null;
  isLoading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
  applyTheme: (settings: SystemSettings) => void;
}

const defaultSettings: SystemSettings = {
  id: '',
  name: 'DragonTask',
  logo_url: null,
  primary_color: '#EF4444',
  secondary_color: '#B91C1C',
  accent_color: '#FCA5A5',
};

const AppContext = createContext<AppContextType>({
  systemSettings: defaultSettings,
  isLoading: true,
  error: null,
  refreshSettings: async () => {},
  applyTheme: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyTheme = (settings: SystemSettings) => {
    // Apply theme colors to CSS variables
    document.documentElement.style.setProperty('--color-primary', settings.primary_color);
    document.documentElement.style.setProperty('--color-secondary', settings.secondary_color);
    document.documentElement.style.setProperty('--color-accent', settings.accent_color);
    
    // Apply theme colors to favicon
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "32");
      svg.setAttribute("height", "32");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", settings.primary_color);
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z");
      
      svg.appendChild(path);
      
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);
      
      favicon.href = url;
    }
  };

  const fetchSystemSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, use defaults
          setSystemSettings(defaultSettings);
          applyTheme(defaultSettings);
        } else {
          throw error;
        }
      } else {
        setSystemSettings(data);
        applyTheme(data);
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSystemSettings(defaultSettings);
      applyTheme(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemSettings();
    
    // Subscribe to changes in system_settings table
    const channel = supabase
      .channel('system_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings'
        },
        (payload) => {
          const newSettings = payload.new as SystemSettings;
          setSystemSettings(newSettings);
          applyTheme(newSettings);
        }
      )
      .subscribe();
      
    // Set up notification email processor
    const cleanupNotificationProcessor = setupNotificationEmailProcessor(5);
    
    // Check for pending notification emails on startup
    checkAndProcessNotificationEmails();
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.SYSTEM,
      'App initialized with notification email processor',
      {}
    );
      
    return () => {
      supabase.removeChannel(channel);
      cleanupNotificationProcessor();
    };
  }, []);

  return (
    <AppContext.Provider 
      value={{ 
        systemSettings, 
        isLoading, 
        error, 
        refreshSettings: fetchSystemSettings,
        applyTheme
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);