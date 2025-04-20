import React, { createContext, useContext, useEffect } from 'react';
import { useAppContext } from '../lib/AppContext';

interface ThemeColorContextType {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  primaryColorLight: string;
  getButtonStyle: (variant: 'primary' | 'secondary' | 'outline') => React.CSSProperties;
  getBadgeStyle: (variant: 'primary' | 'secondary' | 'accent') => React.CSSProperties;
  getActiveNavStyle: (isActive: boolean) => React.CSSProperties;
}

const ThemeColorContext = createContext<ThemeColorContextType>({
  primaryColor: '#EF4444',
  secondaryColor: '#B91C1C',
  accentColor: '#FCA5A5',
  primaryColorLight: 'rgba(239, 68, 68, 0.1)',
  getButtonStyle: () => ({}),
  getBadgeStyle: () => ({}),
  getActiveNavStyle: () => ({}),
});

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const { systemSettings } = useAppContext();
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const secondaryColor = systemSettings?.secondary_color || '#B91C1C';
  const accentColor = systemSettings?.accent_color || '#FCA5A5';
  
  // Calculate derived colors
  const primaryColorLight = `rgba(${parseInt(primaryColor.slice(1, 3), 16)}, ${parseInt(primaryColor.slice(3, 5), 16)}, ${parseInt(primaryColor.slice(5, 7), 16)}, 0.1)`;
  
  // Helper functions for common component styles
  const getButtonStyle = (variant: 'primary' | 'secondary' | 'outline'): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: primaryColor,
          color: 'white',
          '&:hover': { backgroundColor: secondaryColor }
        };
      case 'secondary':
        return {
          backgroundColor: secondaryColor,
          color: 'white',
          '&:hover': { backgroundColor: primaryColor }
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: primaryColor,
          borderColor: primaryColor,
          '&:hover': { backgroundColor: primaryColorLight }
        };
      default:
        return {};
    }
  };
  
  const getBadgeStyle = (variant: 'primary' | 'secondary' | 'accent'): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: primaryColorLight,
          color: primaryColor
        };
      case 'secondary':
        return {
          backgroundColor: `rgba(${parseInt(secondaryColor.slice(1, 3), 16)}, ${parseInt(secondaryColor.slice(3, 5), 16)}, ${parseInt(secondaryColor.slice(5, 7), 16)}, 0.1)`,
          color: secondaryColor
        };
      case 'accent':
        return {
          backgroundColor: `rgba(${parseInt(accentColor.slice(1, 3), 16)}, ${parseInt(accentColor.slice(3, 5), 16)}, ${parseInt(accentColor.slice(5, 7), 16)}, 0.1)`,
          color: secondaryColor
        };
      default:
        return {};
    }
  };
  
  const getActiveNavStyle = (isActive: boolean): React.CSSProperties => {
    if (!isActive) return {};
    return {
      backgroundColor: primaryColorLight,
      color: primaryColor
    };
  };
  
  return (
    <ThemeColorContext.Provider 
      value={{ 
        primaryColor,
        secondaryColor,
        accentColor,
        primaryColorLight,
        getButtonStyle,
        getBadgeStyle,
        getActiveNavStyle
      }}
    >
      {children}
    </ThemeColorContext.Provider>
  );
}

export const useThemeColors = () => useContext(ThemeColorContext);