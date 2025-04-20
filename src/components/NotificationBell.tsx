import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, Settings, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../lib/AppContext';
import { NotificationSettings } from './NotificationSettings';

interface Notification {
  id: string;
  type: string;
  content: string;
  data: any;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const channel = subscribeToNotifications();
      
      // Close dropdown when clicking outside
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      
      return () => {
        supabase.removeChannel(channel);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [user]);

  async function fetchNotifications() {
    try {
      const { data, error } = await supabase.rpc('get_user_notifications', {
        p_limit: 10,
        p_offset: 0,
        p_unread_only: false
      });

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }

  function subscribeToNotifications() {
    return supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          showNotificationBadge(payload.new as Notification);
        }
      )
      .subscribe();
  }

  function showNotificationBadge(notification: Notification) {
    // Check if browser notifications are supported and permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Notification', {
        body: notification.content,
        icon: '/dragon-icon.svg'
      });
    }
  }

  async function handleMarkAsRead(notificationId: string) {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }

  function handleNotificationClick(notification: Notification) {
    // Handle navigation based on notification type and data
    if (notification.type === 'mention' && notification.data.task_id) {
      window.location.href = `/tasks?taskId=${notification.data.task_id}`;
    } else if (notification.type === 'mention' && notification.data.sop_id) {
      window.location.href = `/sops/${notification.data.sop_id}`;
    } else if (notification.type === 'task_assigned' && notification.data.task_id) {
      window.location.href = `/tasks?taskId=${notification.data.task_id}`;
    } else if (notification.type === 'task_due_soon' && notification.data.task_id) {
      window.location.href = `/tasks?taskId=${notification.data.task_id}`;
    } else if (notification.type === 'sop_approved' && notification.data.sop_id) {
      window.location.href = `/sops/${notification.data.sop_id}`;
    }
    handleMarkAsRead(notification.id);
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'mention':
        return '@';
      case 'task_assigned':
        return '📋';
      case 'task_due_soon':
        return '⏰';
      case 'sop_approved':
        return '✅';
      default:
        return '📬';
    }
  }

  if (showSettings) {
    return (
      <NotificationSettings 
        onClose={() => setShowSettings(false)} 
      />
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
        aria-label={`${unreadCount} unread notifications`}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-6 w-6" style={{ color: primaryColor }} />
        ) : (
          <Bell className="h-6 w-6" />
        )}
        {unreadCount > 0 && (
          <span 
            className="absolute top-0 right-0 -mt-1 -mr-1 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white"
            style={{ backgroundColor: primaryColor }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <div className="flex space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                    style={{ color: primaryColor }}
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowSettings(true);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                  title="Notification Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No notifications
                </p>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      flex items-start space-x-3 p-3 rounded-lg cursor-pointer
                      ${notification.read ? 'bg-white' : 'bg-blue-50'}
                      hover:bg-gray-50 transition-colors
                    `}
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                      <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{notification.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                      {notification.type === 'mention' && notification.data.mentioned_by && (
                        <p className="text-xs text-gray-500 mt-1">
                          Mentioned by: {notification.data.mentioned_by}
                        </p>
                      )}
                      {notification.data && notification.data.should_email && (
                        <div className="flex items-center mt-1">
                          <Mail className="h-3 w-3 text-gray-400 mr-1" />
                          <span className="text-xs text-gray-500">Email notification sent</span>
                        </div>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 bg-blue-600 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}