import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { disconnectMqtt } from '@/lib/mqtt';
import { toast } from '@/stores/notificationStore';
import type { AuthResponse, CurrentUser } from '@/types';

export interface RegisterPayload {
  username: string;
  displayName: string;
  phone: string;
  email: string;
  password: string;
  securityQuestion?: string;
  securityAnswer?: string;
}

export function useAuth() {
  const { user, accessToken, setSession, clear, patchUser } = useAuthStore();
  const queryClient = useQueryClient();

  const login = useCallback(
    async (identifier: string, password: string, rememberMe = false) => {
      const response = await api.post<AuthResponse>('/auth/login', { identifier, password, rememberMe });
      setSession(response.data);
      return response.data.user;
    },
    [setSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const response = await api.post<AuthResponse>('/auth/register', payload);
      setSession(response.data);
      return response.data.user;
    },
    [setSession],
  );

  const logout = useCallback(
    async (allDevices = false) => {
      const refreshToken = useAuthStore.getState().refreshToken;
      try {
        await api.post('/auth/logout', { refreshToken, allDevices });
      } catch {
        /* signing out locally regardless */
      }
      disconnectMqtt();
      clear();
      queryClient.clear();
      toast.info(allDevices ? 'Signed out everywhere' : 'Signed out', 'See you soon.');
    },
    [clear, queryClient],
  );

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get<{ user: CurrentUser }>('/auth/me');
      patchUser(response.data.user);
      return response.data.user;
    } catch (error) {
      throw new Error(apiErrorMessage(error));
    }
  }, [patchUser]);

  return {
    user,
    isAuthenticated: Boolean(accessToken && user),
    login,
    register,
    logout,
    refreshUser,
  };
}
