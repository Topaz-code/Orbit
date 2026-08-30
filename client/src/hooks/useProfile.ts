import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/notificationStore';
import type {
  CurrentUser,
  NotificationSettings,
  Post,
  PrivacySettings,
  ProfileUser,
  PublicUser,
  Theme,
} from '@/types';

export const profileKeys = {
  detail: (handle: string) => ['profile', handle] as const,
  posts: (handle: string) => ['posts', 'user', handle] as const,
  media: (handle: string) => ['profile', handle, 'media'] as const,
  friends: (handle: string) => ['profile', handle, 'friends'] as const,
  groups: (handle: string) => ['profile', handle, 'groups'] as const,
};

export interface ProfileMediaItem {
  postId: string;
  url: string;
  type: string;
  createdAt: string;
}

export interface ProfileGroup {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  coverUrl: string;
  privacy: 'public' | 'private';
  memberCount: number;
  role: string;
}

/** Accepts either a user id or a username (the API resolves both). */
export function useProfile(handle: string | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(handle ?? ''),
    enabled: Boolean(handle),
    queryFn: async () => {
      const response = await api.get<{ user: ProfileUser }>(`/users/${handle}`);
      return response.data.user;
    },
  });
}

export function useProfilePosts(handle: string | undefined) {
  return useQuery({
    queryKey: profileKeys.posts(handle ?? ''),
    enabled: Boolean(handle),
    queryFn: async () => {
      const response = await api.get<{ items: Post[] }>(`/users/${handle}/posts`);
      return response.data.items;
    },
  });
}

export function useProfileMedia(handle: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.media(handle ?? ''),
    enabled: Boolean(handle) && enabled,
    queryFn: async () => {
      const response = await api.get<{ items: ProfileMediaItem[] }>(`/users/${handle}/media`);
      return response.data.items;
    },
  });
}

export function useProfileFriends(handle: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.friends(handle ?? ''),
    enabled: Boolean(handle) && enabled,
    queryFn: async () => {
      const response = await api.get<{ items: PublicUser[] }>(`/users/${handle}/friends`);
      return response.data.items;
    },
  });
}

export function useProfileGroups(handle: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.groups(handle ?? ''),
    enabled: Boolean(handle) && enabled,
    queryFn: async () => {
      const response = await api.get<{ items: ProfileGroup[] }>(`/users/${handle}/groups`);
      return response.data.items;
    },
  });
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  coverUrl?: string;
  theme?: Theme;
  isOnboarded?: boolean;
  privacySettings?: Partial<PrivacySettings>;
  notificationSettings?: Partial<NotificationSettings>;
}

/** PUT /api/users/me — also refreshes the persisted auth user so the shell updates instantly. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const response = await api.put<{ user: CurrentUser }>('/users/me', input);
      return response.data.user;
    },
    onSuccess: (user) => {
      setUser(user);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => toast.error('Could not save changes', apiErrorMessage(error)),
  });
}
