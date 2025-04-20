import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface BreadcrumbItem {
  name: string;
  href: string;
  current: boolean;
}

export function Breadcrumbs() {
  const location = useLocation();
  const { role, navigation, systemId, agencyId, clientId } = useAuthStore();
  const { currentSystem, currentAgency, currentClient } = navigation;
  const { systemSettings } = useAppContext();

  // Log component render for debugging
  useEffect(() => {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.COMPONENT_RENDER,
      'Breadcrumbs component rendered',
      { 
        path: location.pathname,
        role,
        systemId,
        agencyId,
        clientId,
        currentSystem,
        currentAgency,
        currentClient
      }
    );
  }, [location.pathname, role, systemId, agencyId, clientId, currentSystem, currentAgency, currentClient]);

  const breadcrumbs = React.useMemo(() => {
    const items: BreadcrumbItem[] = [];
    
    // Always start with Dashboard, but the link depends on the role
    if (role === 'system_admin') {
      items.push({ 
        name: 'System Dashboard', 
        href: '/system-dashboard', 
        current: location.pathname === '/system-dashboard' || location.pathname === '/' || location.pathname === '/dashboard'
      });
    } else if (role === 'agency_admin' && currentAgency) {
      items.push({ 
        name: 'Agency Dashboard', 
        href: `/agencies/${currentAgency.id}`, 
        current: location.pathname === `/agencies/${currentAgency.id}` || location.pathname === '/' || location.pathname === '/dashboard'
      });
    } else if ((role === 'client_admin' || role === 'client_user') && currentClient) {
      items.push({ 
        name: 'Client Dashboard', 
        href: `/clients/${currentClient.id}`, 
        current: location.pathname === `/clients/${currentClient.id}` || location.pathname === '/' || location.pathname === '/dashboard'
      });
    } else {
      items.push({ 
        name: 'Dashboard', 
        href: '/', 
        current: location.pathname === '/' || location.pathname === '/dashboard'
      });
    }

    // Add System level if we have a current system and we're not on the system dashboard
    if (currentSystem && 
        role === 'system_admin' && 
        !items[0].current) {
      items.push({
        name: currentSystem.name,
        href: '/systems',
        current: location.pathname === '/systems'
      });
    }

    // Add Agency level if we have a current agency
    if (currentAgency && 
        ['system_admin', 'agency_admin'].includes(role || '') && 
        !items.some(item => item.href === `/agencies/${currentAgency.id}`)) {
      items.push({
        name: currentAgency.name,
        href: `/agencies/${currentAgency.id}`,
        current: location.pathname === `/agencies/${currentAgency.id}`
      });
    }

    // Add Client level if we have a current client
    if (currentClient && 
        !items.some(item => item.href === `/clients/${currentClient.id}`)) {
      items.push({
        name: currentClient.name,
        href: `/clients/${currentClient.id}`,
        current: location.pathname === `/clients/${currentClient.id}`
      });
    }

    // Add current page if it's a special section
    const specialPages: Record<string, string> = {
      '/settings': 'Settings',
      '/users': 'Users',
      '/tasks': 'Tasks',
      '/sops': 'SOPs',
      '/reports': 'Reports'
    };

    // Check if we're on a special page
    for (const [path, name] of Object.entries(specialPages)) {
      if (location.pathname.startsWith(path) && !items.some(item => item.href === path)) {
        items.push({
          name,
          href: path,
          current: true
        });
        break;
      }
    }

    // Log the generated breadcrumbs
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.DATA_PROCESSING,
      'Generated breadcrumbs',
      { 
        items,
        path: location.pathname,
        role,
        currentSystem,
        currentAgency,
        currentClient
      }
    );

    return items;
  }, [location.pathname, role, currentSystem, currentAgency, currentClient]);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // If there's only one breadcrumb (Dashboard), don't show breadcrumbs
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-2 flex-wrap">
        {breadcrumbs.map((page, index) => (
          <li key={page.href} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400 mx-1" aria-hidden="true" />
            )}
            <Link
              to={page.href}
              className={`text-sm font-medium ${
                page.current
                  ? 'cursor-default'
                  : 'text-gray-500 hover:text-gray-700'
              } ${index === 0 ? 'flex items-center' : ''}`}
              style={page.current ? { color: primaryColor } : {}}
              aria-current={page.current ? 'page' : undefined}
              onClick={() => {
                logDebugEvent(
                  DebugLevel.INFO,
                  DebugEventType.USER_ACTION,
                  `User clicked breadcrumb: ${page.name}`,
                  { href: page.href, current: page.current }
                );
              }}
            >
              {index === 0 && (
                <Home className="h-4 w-4 flex-shrink-0 mr-1" aria-hidden="true" />
              )}
              <span className="truncate max-w-[120px] md:max-w-xs">{page.name}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}