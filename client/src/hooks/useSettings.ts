import { useMutation } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { useUpdateProfile } from './useProfile';
import type { NotificationSettings, PrivacySettings } from '@/types';

/**
 * Settings live on the user record, so they are read straight from the auth store and written
 * through `PUT /api/users/me`. Updates are applied to the store optimistically and rolled back
 * if the request fails.
 */
export function usePrivacySettings() {
  const privacySettings = useAuthStore((state) => state.user?.privacySettings);
  const patchUser = useAuthStore((state) => state.patchUser);
  const updateProfile = useUpdateProfile();

  const update = async (patch: Partial<PrivacySettings>) => {
    const previous = useAuthStore.getState().user?.privacySettings;
    if (previous) patchUser({ privacySettings: { ...previous, ...patch } });
    try {
      await updateProfile.mutateAsync({ privacySettings: patch });
    } catch {
      if (previous) patchUser({ privacySettings: previous });
    }
  };

  return { privacySettings, update, saving: updateProfile.isPending };
}

export function useNotificationSettings() {
  const notificationSettings = useAuthStore((state) => state.user?.notificationSettings);
  const patchUser = useAuthStore((state) => state.patchUser);
  const updateProfile = useUpdateProfile();

  const update = async (patch: Partial<NotificationSettings>) => {
    const previous = useAuthStore.getState().user?.notificationSettings;
    if (previous) patchUser({ notificationSettings: { ...previous, ...patch } });
    try {
      await updateProfile.mutateAsync({ notificationSettings: patch });
    } catch {
      if (previous) patchUser({ notificationSettings: previous });
    }
  };

  return { notificationSettings, update, saving: updateProfile.isPending };
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      await api.post('/users/me/password', input);
    },
    onSuccess: () => toast.success('Password changed', 'Use the new one next time you sign in.'),
    onError: (error) => toast.error('Could not change password', apiErrorMessage(error)),
  });
}

/** Downloads everything Orbit stores about the account as a JSON file. */
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get('/users/me/export', { responseType: 'blob' });
      return response.data as Blob;
    },
    onSuccess: (blob) => {
      const username = useAuthStore.getState().user?.username ?? 'account';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orbit-${username}-export.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded', 'Your data never left this machine.');
    },
    onError: (error) => toast.error('Export failed', apiErrorMessage(error)),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await api.delete('/users/me');
    },
    onError: (error) => toast.error('Could not delete account', apiErrorMessage(error)),
  });
}
