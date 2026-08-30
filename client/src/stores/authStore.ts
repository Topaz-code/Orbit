import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurrentUser } from '@/types';

interface AuthState {
  user: CurrentUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;

  setSession: (payload: { user: CurrentUser; accessToken: string; refreshToken: string }) => void;
  setTokens: (payload: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: CurrentUser) => void;
  patchUser: (patch: Partial<CurrentUser>) => void;
  clear: () => void;
  markHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,

      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      patchUser: (patch) =>
        set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
      markHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'orbit-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => state?.markHydrated(),
    },
  ),
);

export const selectIsAuthenticated = (state: AuthState): boolean =>
  Boolean(state.accessToken && state.user);
