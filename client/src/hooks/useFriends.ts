import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from '@/stores/notificationStore';
import type { FriendRequest, PublicUser, RelationshipStatus } from '@/types';

export const friendKeys = {
  list: ['friends'] as const,
  requests: ['friends', 'requests'] as const,
  blocked: ['friends', 'blocked'] as const,
  suggestions: ['friends', 'suggestions'] as const,
};

export function useFriends() {
  return useQuery({
    queryKey: friendKeys.list,
    queryFn: async () => {
      const response = await api.get<{ items: PublicUser[] }>('/friends');
      return response.data.items;
    },
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: friendKeys.requests,
    queryFn: async () => {
      const response = await api.get<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>('/friends/requests');
      return response.data;
    },
  });
}

export function useSuggestions() {
  return useQuery({
    queryKey: friendKeys.suggestions,
    queryFn: async () => {
      const response = await api.get<{ items: PublicUser[] }>('/users/suggestions');
      return response.data.items;
    },
  });
}

export interface BlockedEntry {
  friendshipId: string;
  user: PublicUser;
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: friendKeys.blocked,
    queryFn: async () => {
      const response = await api.get<{ items: BlockedEntry[] }>('/friends/blocked');
      return response.data.items;
    },
  });
}

/** Relationship between the viewer and one other user, used by profile action buttons. */
export function useRelationship(userId: string | undefined) {
  return useQuery({
    queryKey: ['friends', 'status', userId ?? ''],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await api.get<{ status: RelationshipStatus; friendshipId: string | null }>(
        `/friends/status/${userId}`,
      );
      return response.data;
    },
  });
}

function useFriendMutation<TVariables>(
  request: (variables: TVariables) => Promise<unknown>,
  successMessage?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      if (successMessage) toast.success(successMessage);
    },
    onError: (error) => toast.error('Something went wrong', apiErrorMessage(error)),
  });
}

export const useSendFriendRequest = () =>
  useFriendMutation<string>((userId) => api.post(`/friends/request/${userId}`), 'Friend request sent');

export const useAcceptFriendRequest = () =>
  useFriendMutation<string>((requestId) => api.post(`/friends/accept/${requestId}`), 'You are now friends');

export const useRejectFriendRequest = () =>
  useFriendMutation<string>((requestId) => api.post(`/friends/reject/${requestId}`));

export const useRemoveFriend = () =>
  useFriendMutation<string>((friendshipId) => api.delete(`/friends/${friendshipId}`), 'Friend removed');

export const useBlockUser = () =>
  useFriendMutation<string>((userId) => api.post(`/friends/block/${userId}`), 'User blocked');

export const useUnblockUser = () =>
  useFriendMutation<string>((userId) => api.post(`/friends/unblock/${userId}`), 'User unblocked');
