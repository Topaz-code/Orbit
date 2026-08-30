import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'info';
  avatarUrl?: string;
  href?: string;
  duration?: number;
}

interface NotificationState {
  unreadCount: number;
  toasts: ToastMessage[];
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  toasts: [],
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` }].slice(-4),
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useNotificationStore.getState().pushToast({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useNotificationStore.getState().pushToast({ title, description, variant: 'error' }),
  info: (title: string, description?: string) =>
    useNotificationStore.getState().pushToast({ title, description, variant: 'info' }),
  message: (payload: Omit<ToastMessage, 'id'>) => useNotificationStore.getState().pushToast(payload),
};
