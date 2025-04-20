import React, { useState, useEffect } from 'react';
import { 
  Bug, X, RefreshCw, Download, Filter, Search, 
  Info, AlertTriangle, AlertCircle, CheckCircle, 
  ChevronDown, ChevronUp, Eye, EyeOff
} from 'lucide-react';
import { 
  getDebugEvents, 
  clearDebugEvents, 
  DebugEvent, 
  DebugLevel, 
  DebugEventType,
  enableDebug,
  disableDebug,
  isDebugModeEnabled
} from '../lib/debugSystem';
import { useAuthStore } from '../lib/store';
import { useAppContext } from '../lib/AppContext';

interface DebugPanelProps {
  onClose: () => void;
}

export function DebugPanel({ onClose }: DebugPanelProps) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<DebugEvent[]>([]);
  const [filters, setFilters] = useState({
    level: [] as DebugLevel[],
    type: [] as DebugEventType[],
    search: ''
  });
  const [isDebugEnabled, setIsDebugEnabled] = useState(isDebugModeEnabled());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { systemSettings } = useAppContext();
  const { role } = useAuthStore();

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  // Only system admins and agency admins can see the debug panel
  const canAccessDebugPanel = ['system_admin', 'agency_admin'].includes(role || '');

  useEffect(() => {
    if (!canAccessDebugPanel) return;
    
    // Initial load
    refreshEvents();
    
    // Set up auto-refresh
    let interval: NodeJS.Timeout | null = null;
    
    if (autoRefresh) {
      interval = setInterval(refreshEvents, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, canAccessDebugPanel]);

  // Apply filters whenever events or filters change
  useEffect(() => {
    applyFilters();
  }, [events, filters]);

  const refreshEvents = () => {
    setEvents(getDebugEvents());
  };

  const applyFilters = () => {
    let filtered = [...events];
    
    // Apply level filter
    if (filters.level.length > 0) {
      filtered = filtered.filter(event => filters.level.includes(event.level));
    }
    
    // Apply type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter(event => filters.type.includes(event.type));
    }
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(event => 
        event.message.toLowerCase().includes(searchLower) ||
        (event.details && JSON.stringify(event.details).toLowerCase().includes(searchLower)) ||
        (event.userId && event.userId.toLowerCase().includes(searchLower)) ||
        (event.userRole && event.userRole.toLowerCase().includes(searchLower)) ||
        (event.path && event.path.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredEvents(filtered);
  };

  const handleLevelFilter = (level: DebugLevel) => {
    setFilters(prev => {
      const newLevels = prev.level.includes(level)
        ? prev.level.filter(l => l !== level)
        : [...prev.level, level];
      
      return { ...prev, level: newLevels };
    });
  };

  const handleTypeFilter = (type: DebugEventType) => {
    setFilters(prev => {
      const newTypes = prev.type.includes(type)
        ? prev.type.filter(t => t !== type)
        : [...prev.type, type];
      
      return { ...prev, type: newTypes };
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handleClearFilters = () => {
    setFilters({
      level: [],
      type: [],
      search: ''
    });
  };

  const handleClearEvents = () => {
    clearDebugEvents();
    refreshEvents();
  };

  const handleDownloadEvents = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `debug-events-${new Date().toISOString()}.json`);
    linkElement.click();
  };

  const toggleDebugMode = () => {
    if (isDebugEnabled) {
      disableDebug();
    } else {
      enableDebug();
    }
    setIsDebugEnabled(!isDebugEnabled);
  };

  const getLevelIcon = (level: DebugLevel) => {
    switch (level) {
      case DebugLevel.INFO:
        return <Info className="h-4 w-4 text-blue-500" />;
      case DebugLevel.WARNING:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case DebugLevel.ERROR:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case DebugLevel.SUCCESS:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: DebugLevel) => {
    switch (level) {
      case DebugLevel.INFO:
        return 'bg-blue-100 text-blue-800';
      case DebugLevel.WARNING:
        return 'bg-yellow-100 text-yellow-800';
      case DebugLevel.ERROR:
        return 'bg-red-100 text-red-800';
      case DebugLevel.SUCCESS:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canAccessDebugPanel) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
      <div 
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-4xl h-[80vh] flex flex-col"
        style={{ borderColor: primaryColor }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <Bug className="h-5 w-5 mr-2" style={{ color: primaryColor }} />
            <h2 className="text-lg font-semibold">Debug Panel</h2>
            <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
              {events.length} events
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleDebugMode}
              className={`flex items-center px-2 py-1 rounded text-xs font-medium ${
                isDebugEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
              title={isDebugEnabled ? 'Disable Debug Mode' : 'Enable Debug Mode'}
            >
              {isDebugEnabled ? (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Enabled
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Disabled
                </>
              )}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center px-2 py-1 rounded text-xs font-medium ${
                autoRefresh ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}
              title={autoRefresh ? 'Disable Auto-refresh' : 'Enable Auto-refresh'}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </button>
            <button
              onClick={refreshEvents}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleClearEvents}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Clear Events"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={handleDownloadEvents}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Download Events"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {/* Search */}
            <div className="relative flex-grow max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.search}
                onChange={handleSearchChange}
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                placeholder="Search events..."
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
            </div>

            {/* Level filters */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <Filter className="-ml-0.5 h-4 w-4 text-gray-400" />
                Level
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>
              <div className="absolute left-0 mt-2 w-40 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                <div className="py-1">
                  {Object.values(DebugLevel).map(level => (
                    <label
                      key={level}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={filters.level.includes(level)}
                        onChange={() => handleLevelFilter(level)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 mr-2"
                        style={{ color: primaryColor }}
                      />
                      <span className="capitalize flex items-center">
                        {getLevelIcon(level)}
                        <span className="ml-2">{level}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Type filters */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <Filter className="-ml-0.5 h-4 w-4 text-gray-400" />
                Type
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>
              <div className="absolute left-0 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                <div className="py-1">
                  {Object.values(DebugEventType).map(type => (
                    <label
                      key={type}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={filters.type.includes(type)}
                        onChange={() => handleTypeFilter(type)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 mr-2"
                        style={{ color: primaryColor }}
                      />
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Clear filters */}
            {(filters.level.length > 0 || filters.type.length > 0 || filters.search) && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-200"
              >
                <X className="-ml-0.5 h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>

          {/* Active filters */}
          {(filters.level.length > 0 || filters.type.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {filters.level.map(level => (
                <span
                  key={level}
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getLevelColor(level)}`}
                >
                  Level: {level}
                  <button 
                    onClick={() => handleLevelFilter(level)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {filters.type.map(type => (
                <span
                  key={type}
                  className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
                >
                  Type: {type.replace('_', ' ')}
                  <button 
                    onClick={() => handleTypeFilter(type)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Events list */}
        <div className="flex-1 overflow-y-auto">
          {filteredEvents.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredEvents.map(event => (
                <DebugEventItem key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bug className="h-12 w-12 mb-2" />
              <p>No debug events found</p>
              {filters.level.length > 0 || filters.type.length > 0 || filters.search ? (
                <button
                  onClick={handleClearFilters}
                  className="mt-2 text-blue-500 hover:text-blue-700"
                  style={{ color: primaryColor }}
                >
                  Clear filters
                </button>
              ) : (
                <p className="text-sm mt-2">
                  {isDebugEnabled ? 
                    'Debug mode is enabled. Events will appear here as they occur.' : 
                    'Debug mode is disabled. Enable it to start logging events.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-gray-200 text-xs text-gray-500 text-center">
          Debug panel is only visible to system and agency admins
        </div>
      </div>
    </div>
  );
}

// Individual debug event component
function DebugEventItem({ event }: { event: DebugEvent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getLevelColor = (level: DebugLevel) => {
    switch (level) {
      case DebugLevel.INFO:
        return 'bg-blue-100 text-blue-800';
      case DebugLevel.WARNING:
        return 'bg-yellow-100 text-yellow-800';
      case DebugLevel.ERROR:
        return 'bg-red-100 text-red-800';
      case DebugLevel.SUCCESS:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getLevelIcon = (level: DebugLevel) => {
    switch (level) {
      case DebugLevel.INFO:
        return <Info className="h-4 w-4 text-blue-500" />;
      case DebugLevel.WARNING:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case DebugLevel.ERROR:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case DebugLevel.SUCCESS:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };
  
  return (
    <div className="p-3 hover:bg-gray-50">
      <div className="flex items-start justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getLevelIcon(event.level)}
          </div>
          <div>
            <div className="flex items-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(event.level)}`}>
                {event.level}
              </span>
              <span className="mx-1 text-gray-500">•</span>
              <span className="text-xs text-gray-500">{event.type ? event.type.replace('_', ' ') : 'Unknown Type'}</span>
              <span className="mx-1 text-gray-500">•</span>
              <span className="text-xs text-gray-500">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-900">{event.message}</p>
          </div>
        </div>
        <button className="flex-shrink-0 text-gray-400">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-2 ml-7 pl-3 border-l-2 border-gray-200">
          {event.path && (
            <div className="mt-1">
              <span className="text-xs font-medium text-gray-500">Path:</span>
              <span className="ml-1 text-xs text-gray-900">{event.path}</span>
            </div>
          )}
          
          {event.userRole && (
            <div className="mt-1">
              <span className="text-xs font-medium text-gray-500">User Role:</span>
              <span className="ml-1 text-xs text-gray-900">{event.userRole}</span>
            </div>
          )}
          
          {event.details && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-500">Details:</span>
              <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-40">
                {typeof event.details === 'object' 
                  ? JSON.stringify(event.details, null, 2)
                  : String(event.details)
                }
              </pre>
            </div>
          )}
          
          <div className="mt-2 text-xs text-gray-500">
            Event ID: {event.id}
          </div>
        </div>
      )}
    </div>
  );
}