import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore, toast } from '@/stores/notificationStore';
import { topics } from '@/lib/mqtt';
import { useMqttSubscription } from './useMQTT';
import type { AppNotification } from '@/types';

export const notificationKeys = {
  list: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
};

export function useNotifications() {
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);

  const query = useQuery({
    queryKey: notificationKeys.list,
    queryFn: async () => {
      const response = await api.get<{ items: AppNotification[]; unreadCount: number }>('/notifications', {
        params: { limit: 40 },
      });
      return response.data;
    },
  });

  useEffect(() => {
    if (query.data) setUnreadCount(query.data.unreadCount);
  }, [query.data, setUnreadCount]);

  return query;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put<{ success: boolean; unreadCount: number }>(`/notifications/${id}/read`);
      return response.data;
    },
    onMutate: async (id) => {
      queryClient.setQueryData<{ items: AppNotification[]; unreadCount: number }>(
        notificationKeys.list,
        (data) =>
          data
            ? {
                items: data.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
                unreadCount: Math.max(0, data.unreadCount - 1),
              }
            : data,
      );
    },
    onSuccess: (data) => setUnreadCount(data.unreadCount),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);

  return useMutation({
    mutationFn: async () => {
      await api.put('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.setQueryData<{ items: AppNotification[]; unreadCount: number }>(
        notificationKeys.list,
        (data) => (data ? { items: data.items.map((item) => ({ ...item, isRead: true })), unreadCount: 0 } : data),
      );
      setUnreadCount(0);
      toast.success('All caught up');
    },
    onError: (error) => toast.error('Could not update notifications', apiErrorMessage(error)),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/${id}`);
      return id;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
  });
}

export function useClearNotifications() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  return useMutation({
    mutationFn: async () => {
      await api.delete('/notifications/clear');
    },
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.list, { items: [], unreadCount: 0 });
      setUnreadCount(0);
    },
  });
}

/** Turns a notification into the route it should open. */
export function notificationHref(notification: AppNotification): string {
  switch (notification.referenceType) {
    case 'conversation':
      return `/messages/${notification.referenceId}`;
    case 'group':
      return `/groups/${notification.referenceId}`;
    case 'user':
      return `/profile/${notification.referenceId}`;
    case 'friendship':
      return '/notifications';
    case 'call':
      return '/calls';
    case 'post':
    default:
      return notification.referenceId ? `/post/${notification.referenceId}` : '/notifications';
  }
}

/** Subscribes to live notification pushes and raises toasts. */
export function useLiveNotifications(): void {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);

  useMqttSubscription(
    userId ? topics.userNotifications(userId) : null,
    (payload: { event: string; notification: AppNotification; unreadCount: number }) => {
      if (payload?.event !== 'notification') return;
      setUnreadCount(payload.unreadCount);

      queryClient.setQueryData<{ items: AppNotification[]; unreadCount: number }>(
        notificationKeys.list,
        (data) =>
          data
            ? { items: [payload.notification, ...data.items].slice(0, 60), unreadCount: payload.unreadCount }
            : data,
      );

      toast.message({
        title: payload.notification.actor?.displayName ?? 'Orbit',
        description: payload.notification.content,
        avatarUrl: payload.notification.actor?.avatarUrl,
        href: notificationHref(payload.notification),
      });
    },
    Boolean(userId),
  );
}
