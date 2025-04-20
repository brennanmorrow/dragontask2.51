import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { 
  Building2, Users, Briefcase, CheckSquare, LogOut, Settings, 
  Shield, Hexagon as Dragon, FileText, BarChart2, Menu, X, 
  ChevronRight, ChevronDown
} from 'lucide-react';
import { supabase } from './supabase';
import { NotificationBell } from '../components/NotificationBell';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useAppContext } from './AppContext';
import clsx from 'clsx';
import { PermissionGate } from '../components/PermissionGate';
import { PermissionType } from './permissionChecker';
import { logComponentRender, logNavigation, DebugLevel, DebugEventType, logDebugEvent } from './debugSystem';

interface Agency {
  id: string;
  name: string;
  logo_url: string | null;
}

const navigation = {
  system_admin: [
    { name: 'Dashboard', href: '/system-dashboard', icon: Briefcase, permission: PermissionType.VIEW_TASKS },
    { name: 'Systems', href: '/systems', icon: Building2, permission: PermissionType.VIEW_SYSTEM },
    { name: 'Agencies', href: '/agencies', icon: Briefcase, permission: PermissionType.VIEW_AGENCY },
    { name: 'Clients', href: '/clients', icon: Users, permission: PermissionType.VIEW_CLIENT },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare, permission: PermissionType.VIEW_TASKS },
    { name: 'SOPs', href: '/sops', icon: FileText, permission: PermissionType.VIEW_SOPS },
    { name: 'Reports', href: '/reports', icon: BarChart2, permission: PermissionType.VIEW_REPORTS },
    { name: 'Users', href: '/users', icon: Users, permission: PermissionType.VIEW_USERS },
    { name: 'Settings', href: '/settings', icon: Settings, permission: PermissionType.MANAGE_SETTINGS },
  ],
  agency_admin: [
    { name: 'Dashboard', href: '/', icon: Briefcase, permission: PermissionType.VIEW_TASKS },
    { name: 'Clients', href: '/clients', icon: Users, permission: PermissionType.VIEW_CLIENT },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare, permission: PermissionType.VIEW_TASKS },
    { name: 'SOPs', href: '/sops', icon: FileText, permission: PermissionType.VIEW_SOPS },
    { name: 'Reports', href: '/reports', icon: BarChart2, permission: PermissionType.VIEW_REPORTS },
    { name: 'Users', href: '/users', icon: Users, permission: PermissionType.VIEW_USERS },
  ],
  client_admin: [
    { name: 'Dashboard', href: '/', icon: Briefcase, permission: PermissionType.VIEW_TASKS },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare, permission: PermissionType.VIEW_TASKS },
    { name: 'SOPs', href: '/sops', icon: FileText, permission: PermissionType.VIEW_SOPS },
    { name: 'Reports', href: '/reports', icon: BarChart2, permission: PermissionType.VIEW_REPORTS },
    { name: 'Users', href: '/users', icon: Users, permission: PermissionType.VIEW_USERS },
  ],
  client_user: [
    { name: 'Dashboard', href: '/', icon: Briefcase, permission: PermissionType.VIEW_TASKS },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare, permission: PermissionType.VIEW_TASKS },
    { name: 'SOPs', href: '/sops', icon: FileText, permission: PermissionType.VIEW_SOPS },
    { name: 'Reports', href: '/reports', icon: BarChart2, permission: PermissionType.VIEW_REPORTS },
  ],
};

export function Layout() {
  const { user, role, logout } = useAuthStore();
  const { navigation: { currentSystem, currentAgency, currentClient, setCurrentSystem, setCurrentAgency, setCurrentClient } } = useAuthStore();
  const { systemSettings } = useAppContext();
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contextSelectorOpen, setContextSelectorOpen] = useState(false);
  const [availableSystems, setAvailableSystems] = useState<{id: string, name: string}[]>([]);
  const [availableAgencies, setAvailableAgencies] = useState<{id: string, name: string}[]>([]);
  const [availableClients, setAvailableClients] = useState<{id: string, name: string}[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const currentNavigation = role ? navigation[role] : [];

  useEffect(() => {
    // Log component render for debugging
    logComponentRender('Layout', true, { 
      role, 
      path: location.pathname,
      currentSystem,
      currentAgency,
      currentClient
    });
    
    // Close mobile menu when location changes
    setMobileMenuOpen(false);
    
    // Check screen size for initial sidebar state
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [location.pathname]);

  // Fetch available context options for system admins
  useEffect(() => {
    if (role === 'system_admin') {
      fetchAvailableContextOptions();
    }
  }, [role]);

  const fetchAvailableContextOptions = async () => {
    try {
      setIsLoadingContext(true);
      
      // Fetch available systems
      const { data: systemsData, error: systemsError } = await supabase
        .from('systems')
        .select('id, name')
        .order('name');
        
      if (systemsError) throw systemsError;
      setAvailableSystems(systemsData || []);
      
      // Fetch available agencies
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');
        
      if (agenciesError) throw agenciesError;
      setAvailableAgencies(agenciesData || []);
      
      // Fetch available clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
        
      if (clientsError) throw clientsError;
      setAvailableClients(clientsData || []);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.DATA_PROCESSING,
        'Fetched available context options for system admin',
        { 
          systemsCount: systemsData?.length || 0,
          agenciesCount: agenciesData?.length || 0,
          clientsCount: clientsData?.length || 0
        }
      );
    } catch (err) {
      console.error('Error fetching context options:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching context options',
        { error: err }
      );
    } finally {
      setIsLoadingContext(false);
    }
  };

  useEffect(() => {
    async function updateNavigationContext() {
      try {
        // Reset context when navigating to root paths
        if (location.pathname === '/' || location.pathname === '/dashboard') {
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.NAVIGATION,
            'Resetting navigation context for root path',
            { path: location.pathname }
          );
          
          setCurrentSystem(null);
          setCurrentAgency(null);
          setCurrentClient(null);
          return;
        }

        // Update system context
        if (location.pathname.startsWith('/systems')) {
          const systemId = params.id;
          if (systemId) {
            logDebugEvent(
              DebugLevel.INFO,
              DebugEventType.API_CALL,
              'Fetching system for navigation context',
              { systemId }
            );
            
            const { data: system, error } = await supabase
              .from('systems')
              .select('id, name')
              .eq('id', systemId)
              .single();

            if (error) {
              logDebugEvent(
                DebugLevel.ERROR,
                DebugEventType.API_CALL,
                'Error fetching system for navigation context',
                { error, systemId }
              );
            } else if (system) {
              setCurrentSystem(system);
              setCurrentAgency(null);
              setCurrentClient(null);
              
              logDebugEvent(
                DebugLevel.SUCCESS,
                DebugEventType.NAVIGATION,
                `Updated system context to ${system.name}`,
                { systemId: system.id }
              );
            }
          } else {
            // Just viewing the systems list, clear other contexts
            setCurrentAgency(null);
            setCurrentClient(null);
            
            logDebugEvent(
              DebugLevel.INFO,
              DebugEventType.NAVIGATION,
              'Viewing systems list, cleared agency and client context',
              {}
            );
          }
          return;
        }

        // Update agency context
        if (location.pathname.startsWith('/agencies')) {
          const agencyId = params.id;
          if (agencyId) {
            logDebugEvent(
              DebugLevel.INFO,
              DebugEventType.API_CALL,
              'Fetching agency for navigation context',
              { agencyId }
            );
            
            const { data: agency, error } = await supabase
              .from('agencies')
              .select('id, name, system:systems(id, name)')
              .eq('id', agencyId)
              .single();

            if (error) {
              logDebugEvent(
                DebugLevel.ERROR,
                DebugEventType.API_CALL,
                'Error fetching agency for navigation context',
                { error, agencyId }
              );
            } else if (agency) {
              setCurrentSystem(agency.system);
              setCurrentAgency({ id: agency.id, name: agency.name });
              setCurrentClient(null);
              
              logDebugEvent(
                DebugLevel.SUCCESS,
                DebugEventType.NAVIGATION,
                `Updated agency context to ${agency.name}`,
                { agencyId: agency.id, systemId: agency.system?.id }
              );
            }
          } else {
            // Just viewing the agencies list, clear client context
            setCurrentClient(null);
            
            logDebugEvent(
              DebugLevel.INFO,
              DebugEventType.NAVIGATION,
              'Viewing agencies list, cleared client context',
              {}
            );
          }
          return;
        }

        // Update client context
        if (location.pathname.startsWith('/clients')) {
          const clientId = params.id;
          if (clientId) {
            logDebugEvent(
              DebugLevel.INFO,
              DebugEventType.API_CALL,
              'Fetching client for navigation context',
              { clientId }
            );
            
            const { data: client, error } = await supabase
              .from('clients')
              .select(`
                id, 
                name,
                agency:agencies(
                  id,
                  name,
                  system:systems(id, name)
                )
              `)
              .eq('id', clientId)
              .single();

            if (error) {
              logDebugEvent(
                DebugLevel.ERROR,
                DebugEventType.API_CALL,
                'Error fetching client for navigation context',
                { error, clientId }
              );
            } else if (client) {
              setCurrentSystem(client.agency.system);
              setCurrentAgency({ id: client.agency.id, name: client.agency.name });
              setCurrentClient({ id: client.id, name: client.name });
              
              logDebugEvent(
                DebugLevel.SUCCESS,
                DebugEventType.NAVIGATION,
                `Updated client context to ${client.name}`,
                { 
                  clientId: client.id, 
                  agencyId: client.agency?.id,
                  systemId: client.agency?.system?.id
                }
              );
            }
          }
          return;
        }

        // For other pages, keep the current context but log it
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.NAVIGATION,
          'Keeping current navigation context for non-entity page',
          { 
            path: location.pathname,
            currentSystem,
            currentAgency,
            currentClient
          }
        );
      } catch (err) {
        console.error('Error updating navigation context:', err);
        
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.NAVIGATION,
          'Error updating navigation context',
          { error: err, path: location.pathname }
        );
      }
    }

    updateNavigationContext();
  }, [location.pathname, params.id]);

  // Get theme colors from system settings
  const themeColors = {
    primary: systemSettings?.primary_color || '#EF4444',
    secondary: systemSettings?.secondary_color || '#B91C1C',
    accent: systemSettings?.accent_color || '#FCA5A5',
  };

  // Create dynamic styles for active navigation items
  const activeNavBg = `rgba(${parseInt(themeColors.primary.slice(1, 3), 16)}, ${parseInt(themeColors.primary.slice(3, 5), 16)}, ${parseInt(themeColors.primary.slice(5, 7), 16)}, 0.1)`;
  const activeNavText = themeColors.primary;
  const activeIconColor = themeColors.primary;

  // Function to render context selector
  const renderContextSelector = () => {
    if (!role || role === 'client_user') return null;
    
    return (
      <div className="relative">
        <button
          onClick={() => setContextSelectorOpen(!contextSelectorOpen)}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 w-full"
        >
          <span className="flex-1 text-left truncate">
            {currentClient ? currentClient.name : 
             currentAgency ? currentAgency.name : 
             currentSystem ? currentSystem.name : 'Select Context'}
          </span>
          {contextSelectorOpen ? (
            <ChevronDown className="h-4 w-4 ml-2" />
          ) : (
            <ChevronRight className="h-4 w-4 ml-2" />
          )}
        </button>
        
        {contextSelectorOpen && (
          <div className="absolute left-0 mt-2 w-full bg-white rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            <PermissionGate permission={PermissionType.VIEW_SYSTEM}>
              <div className="p-2 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Systems</h3>
                <div className="mt-1 space-y-1">
                  {role === 'system_admin' && availableSystems.length > 0 && (
                    <div className="max-h-40 overflow-y-auto">
                      {availableSystems.map(system => (
                        <button
                          key={system.id}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                          onClick={() => {
                            setCurrentSystem({ id: system.id, name: system.name });
                            setContextSelectorOpen(false);
                            
                            logDebugEvent(
                              DebugLevel.INFO,
                              DebugEventType.USER_ACTION,
                              'User selected system from context selector',
                              { systemId: system.id, systemName: system.name }
                            );
                          }}
                        >
                          {system.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                    onClick={() => {
                      navigate('/systems');
                      setContextSelectorOpen(false);
                      
                      logDebugEvent(
                        DebugLevel.INFO,
                        DebugEventType.USER_ACTION,
                        'User navigated to systems from context selector',
                        {}
                      );
                    }}
                  >
                    Manage Systems
                  </button>
                </div>
              </div>
            </PermissionGate>
            
            <PermissionGate permission={PermissionType.VIEW_AGENCY}>
              <div className="p-2 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agencies</h3>
                <div className="mt-1 space-y-1">
                  {role === 'system_admin' && availableAgencies.length > 0 && (
                    <div className="max-h-40 overflow-y-auto">
                      {availableAgencies.map(agency => (
                        <button
                          key={agency.id}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                          onClick={() => {
                            setCurrentAgency({ id: agency.id, name: agency.name });
                            setContextSelectorOpen(false);
                            navigate(`/agencies/${agency.id}`);
                            
                            logDebugEvent(
                              DebugLevel.INFO,
                              DebugEventType.USER_ACTION,
                              'User selected agency from context selector',
                              { agencyId: agency.id, agencyName: agency.name }
                            );
                          }}
                        >
                          {agency.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                    onClick={() => {
                      navigate('/agencies');
                      setContextSelectorOpen(false);
                      
                      logDebugEvent(
                        DebugLevel.INFO,
                        DebugEventType.USER_ACTION,
                        'User navigated to agencies from context selector',
                        {}
                      );
                    }}
                  >
                    Manage Agencies
                  </button>
                </div>
              </div>
            </PermissionGate>
            
            <PermissionGate permission={PermissionType.VIEW_CLIENT}>
              <div className="p-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Clients</h3>
                <div className="mt-1 space-y-1">
                  {role === 'system_admin' && availableClients.length > 0 && (
                    <div className="max-h-40 overflow-y-auto">
                      {availableClients.map(client => (
                        <button
                          key={client.id}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                          onClick={() => {
                            setCurrentClient({ id: client.id, name: client.name });
                            setContextSelectorOpen(false);
                            navigate(`/clients/${client.id}`);
                            
                            logDebugEvent(
                              DebugLevel.INFO,
                              DebugEventType.USER_ACTION,
                              'User selected client from context selector',
                              { clientId: client.id, clientName: client.name }
                            );
                          }}
                        >
                          {client.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                    onClick={() => {
                      navigate('/clients');
                      setContextSelectorOpen(false);
                      
                      logDebugEvent(
                        DebugLevel.INFO,
                        DebugEventType.USER_ACTION,
                        'User navigated to clients from context selector',
                        {}
                      );
                    }}
                  >
                    Manage Clients
                  </button>
                </div>
              </div>
            </PermissionGate>
          </div>
        )}
      </div>
    );
  };

  // Safe navigation handler to prevent crashes
  const handleNavigation = (href: string, itemName: string, permission: PermissionType) => {
    try {
      // Log navigation attempt
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        `User clicked on menu item: ${itemName}`,
        { href, permission }
      );
      
      // Navigate to the page
      navigate(href);
      
      // Log successful navigation
      logNavigation(
        href, 
        true, 
        { 
          menuItem: itemName,
          permission: permission
        }
      );
    } catch (error) {
      // Log error
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.NAVIGATION,
        `Navigation error for ${itemName}`,
        { error, href }
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile menu button */}
      <div className="fixed top-0 left-0 z-40 md:hidden p-4">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="text-gray-500 hover:text-gray-600 focus:outline-none"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={clsx(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-16" : "w-64",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo and collapse button */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200 justify-between">
            <Link to="/" className="flex items-center space-x-2 overflow-hidden">
              {systemSettings?.logo_url ? (
                <img 
                  src={systemSettings.logo_url} 
                  alt="System Logo" 
                  className="w-8 h-8 object-contain"
                />
              ) : (
                <Dragon className="w-8 h-8" style={{ color: themeColors.primary }} />
              )}
              {!sidebarCollapsed && (
                <span className="text-xl font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                  {systemSettings?.name || 'DragonTask'}
                </span>
              )}
            </Link>
            
            {/* Mobile close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-gray-500 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
            
            {/* Desktop collapse button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:block text-gray-500 hover:text-gray-600"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Context selector (only visible when sidebar is expanded) */}
          {!sidebarCollapsed && (
            <div className="px-4 py-3 border-b border-gray-200">
              {renderContextSelector()}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {currentNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              
              return (
                <PermissionGate key={item.name} permission={item.permission}>
                  <button
                    onClick={() => handleNavigation(item.href, item.name, item.permission)}
                    className={clsx(
                      "w-full flex items-center py-2 text-sm font-medium rounded-md group transition-colors",
                      sidebarCollapsed ? "justify-center px-2" : "px-3 text-left",
                      isActive
                        ? "text-primary"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                    style={isActive ? { backgroundColor: activeNavBg, color: activeNavText } : {}}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <item.icon
                      className={clsx(
                        "flex-shrink-0 h-5 w-5",
                        isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-500"
                      )}
                      style={isActive ? { color: activeIconColor } : {}}
                    />
                    {!sidebarCollapsed && (
                      <span className="ml-3">{item.name}</span>
                    )}
                  </button>
                </PermissionGate>
              );
            })}
          </nav>

          {/* User section */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200">
            <div className={clsx("flex items-center", sidebarCollapsed ? "justify-center" : "")}>
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {user?.email?.[0].toUpperCase()}
                  </span>
                </div>
              </div>
              {!sidebarCollapsed && (
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 truncate">{user?.email}</p>
                  <p className="text-xs font-medium text-gray-500 capitalize truncate">{role?.replace('_', ' ')}</p>
                </div>
              )}
              <div className={clsx("flex items-center space-x-2", sidebarCollapsed ? "ml-0" : "ml-auto")}>
                {!sidebarCollapsed && <NotificationBell />}
                <button
                  onClick={() => {
                    // Log logout action
                    logDebugEvent(
                      DebugLevel.INFO,
                      DebugEventType.USER_ACTION,
                      'User logged out',
                      { userId: user?.id }
                    );
                    logout();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-500"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={clsx(
        "flex-1 transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "md:ml-16" : "md:ml-64"
      )}>
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between h-16 px-4 md:px-6">
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="text-gray-500 hover:text-gray-600 focus:outline-none"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 md:flex-initial">
              <Breadcrumbs />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:block">
                <NotificationBell />
              </div>
              <div className="md:hidden">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {user?.email?.[0].toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="py-6">
          <div className="px-4 md:px-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

// ChevronLeft component (since it's not imported from lucide-react)
function ChevronLeft(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}