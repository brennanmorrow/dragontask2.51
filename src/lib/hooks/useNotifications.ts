import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import { logDebugEvent, DebugLevel, DebugEventType } from '../debugSystem';
import { 
  fetchUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../services/notificationService';

export function useNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const notificationsData = await fetchUserNotifications(user.id, { limit: 10 });
      setNotifications(notificationsData);
      setUnreadCount(notificationsData.filter(n => !n.read).length);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error loading notifications',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      const success = await markNotificationAsRead(notificationId);
      
      if (success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error marking notification as read',
        { error: err, notificationId }
      );
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const success = await markAllNotificationsAsRead();
      
      if (success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error marking all notifications as read',
        { error: err }
      );
    }
  }, []);

  // Subscribe to new notifications
  useEffect(() => {
    if (!user) return;
    
    loadNotifications();
    
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as any, ...prev]);
          setUnreadCount(prev => prev + 1);
          showNotificationBadge(payload.new as any);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  // Show browser notification
  const showNotificationBadge = (notification: any) => {
    // Check if browser notifications are supported and permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Notification', {
        body: notification.content,
        icon: '/dragon-icon.svg'
      });
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead
  };
}