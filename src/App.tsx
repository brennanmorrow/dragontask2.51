import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LoginForm } from './components/LoginForm';
import { Layout } from './lib/Layout';
import { useAuthStore } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { SystemDashboard } from './pages/SystemDashboard';
import { Systems } from './pages/Systems';
import { Agencies } from './pages/Agencies';
import { AgencyDashboard } from './pages/AgencyDashboard';
import { Clients } from './pages/Clients';
import { ClientDashboard } from './pages/ClientDashboard';
import { Users } from './pages/Users';
import { Tasks } from './pages/Tasks';
import { Settings } from './pages/Settings';
import { SOPs } from './pages/SOPs';
import { SopDetails } from './pages/SopDetails';
import { SopCreate } from './pages/SopCreate';
import { Reports } from './pages/Reports';
import { useAppContext } from './lib/AppContext';
import { DebugRouter } from './lib/debugRouter';
import { DebugButton } from './components/DebugButton';
import { MenuDebugger } from './components/MenuDebugger';
import { initDebugSystem, enableDebug, logDebugEvent, DebugLevel, DebugEventType } from './lib/debugSystem';
import { ResetPassword } from './pages/ResetPassword';
import { UserProfile } from './pages/UserProfile';
import { AdminToolbar } from './components/AdminToolbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFound } from './components/NotFound';
import { LoadingTimeout } from './components/LoadingTimeout';
import { EmailTesting } from './pages/EmailTesting';
import { ProjectManagers } from './pages/ProjectManagers';
import { TestRunner } from './pages/TestRunner';

// Redirect component that determines where to send the user based on their role
function RoleBasedRedirect() {
  const navigate = useNavigate();
  const { getDefaultRedirectPath, role, systemId, agencyId, clientId, navigation } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(true);
  
  useEffect(() => {
    const redirectUser = async () => {
      try {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.NAVIGATION,
          'Starting user redirection based on role',
          { 
            role, 
            systemId, 
            agencyId, 
            clientId,
            currentSystem: navigation.currentSystem?.name,
            currentAgency: navigation.currentAgency?.name,
            currentClient: navigation.currentClient?.name
          }
        );
        
        const path = await getDefaultRedirectPath();
        
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.NAVIGATION,
          'Calculated redirect path',
          { path, role }
        );
        
        navigate(path);
      } catch (error) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.NAVIGATION,
          'Error redirecting user based on role',
          { 
            error,
            role,
            systemId,
            agencyId,
            clientId,
            currentSystem: navigation.currentSystem?.name,
            currentAgency: navigation.currentAgency?.name,
            currentClient: navigation.currentClient?.name
          }
        );
        
        // If there's an error, redirect to login
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };
    
    redirectUser();
  }, [navigate, getDefaultRedirectPath, role, systemId, agencyId, clientId, navigation]);
  
  return (
    <LoadingTimeout isLoading={isLoading}>
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </LoadingTimeout>
  );
}

function App() {
  const { user, role } = useAuthStore();
  
  // Initialize debug system
  useEffect(() => {
    initDebugSystem(true); // Enable debug system in development
    enableDebug();
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.COMPONENT_RENDER,
      'App component initialized',
      { user: user?.id }
    );
    
    // Log app initialization
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.COMPONENT_RENDER,
      'Application initialized',
      { 
        environment: import.meta.env.MODE,
        version: '1.0.0',
        userLoggedIn: !!user
      }
    );
    
    // Add global error handler for uncaught exceptions
    const handleGlobalError = (event: ErrorEvent) => {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Uncaught error',
        { 
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      );
    };
    
    // Add global unhandled rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.SYSTEM,
        'Unhandled promise rejection',
        { 
          reason: event.reason,
          stack: event.reason?.stack
        }
      );
    };
    
    // Add global fetch error handler
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      try {
        const response = await originalFetch(input, init);
        
        // Check for 404 or 401 responses
        if (response.status === 404 || response.status === 401) {
          logDebugEvent(
            DebugLevel.ERROR,
            DebugEventType.API_CALL,
            `Fetch error: ${response.status}`,
            { 
              url: typeof input === 'string' ? input : input.url,
              status: response.status,
              statusText: response.statusText
            }
          );
          
          // If it's a 401, log the user out
          if (response.status === 401 && user) {
            useAuthStore.getState().logout();
            window.location.href = '/';
          }
        }
        
        return response;
      } catch (error) {
        // Log network errors
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Fetch network error',
          { 
            url: typeof input === 'string' ? input : input.url,
            error
          }
        );
        throw error;
      }
    };
    
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.fetch = originalFetch;
    };
  }, []);

  if (!user) {
    return (
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/" element={<LoginForm />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <DebugRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="system-dashboard" element={<SystemDashboard />} />
              <Route path="systems" element={<Systems />} />
              <Route path="agencies" element={<Agencies />} />
              <Route path="agencies/:id" element={<AgencyDashboard />} />
              <Route path="clients" element={<Clients />} />
              <Route path="clients/:id" element={<ClientDashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="project-managers" element={<ProjectManagers />} />
              <Route path="settings" element={
                role === 'system_admin' ? <Settings /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="sops" element={<SOPs />} />
              <Route path="sops/new" element={<SopCreate />} />
              <Route path="sops/:id" element={<SopDetails />} />
              <Route path="reports" element={<Reports />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="email-testing" element={<EmailTesting />} />
              <Route path="test-runner" element={<TestRunner />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DebugRouter>
        
        <DebugButton />
        <MenuDebugger />
        <AdminToolbar />
      </Router>
    </ErrorBoundary>
  );
}

export default App;