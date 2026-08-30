import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from '@/stores/notificationStore';
import type { Group, GroupMember, Post } from '@/types';

export const groupKeys = {
  mine: ['groups', 'mine'] as const,
  discover: ['groups', 'discover'] as const,
  detail: (id: string) => ['groups', 'detail', id] as const,
  members: (id: string) => ['groups', 'members', id] as const,
  posts: (id: string) => ['posts', 'group', id] as const,
};

export function useMyGroups() {
  return useQuery({
    queryKey: groupKeys.mine,
    queryFn: async () => {
      const response = await api.get<{ items: Group[] }>('/groups');
      return response.data.items;
    },
  });
}

export function useDiscoverGroups() {
  return useQuery({
    queryKey: groupKeys.discover,
    queryFn: async () => {
      const response = await api.get<{ items: Group[] }>('/groups/discover');
      return response.data.items;
    },
  });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.detail(groupId ?? ''),
    enabled: Boolean(groupId),
    queryFn: async () => {
      const response = await api.get<{ group: Group }>(`/groups/${groupId}`);
      return response.data.group;
    },
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.members(groupId ?? ''),
    enabled: Boolean(groupId),
    queryFn: async () => {
      const response = await api.get<{ items: GroupMember[] }>(`/groups/${groupId}/members`);
      return response.data.items;
    },
  });
}

export function useGroupPosts(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.posts(groupId ?? ''),
    enabled: Boolean(groupId),
    queryFn: async () => {
      const response = await api.get<{ items: Post[]; nextCursor: string | null }>(`/groups/${groupId}/posts`);
      return response.data.items;
    },
  });
}

/** Resolves an invite code to a group so `/invite/:code` can render a preview before joining. */
export function useGroupByInvite(code: string | undefined) {
  return useQuery({
    queryKey: ['groups', 'invite', code ?? ''],
    enabled: Boolean(code),
    retry: false,
    queryFn: async () => {
      const response = await api.get<{ group: Group }>(`/groups/invite/${code}`);
      return response.data.group;
    },
  });
}

/** Promotes or demotes a member. Admin-only on the server. */
export function useUpdateGroupMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'member' | 'moderator' | 'admin' }) => {
      await api.put(`/groups/${groupId}/members/${userId}`, { role });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
      toast.success('Role updated');
    },
    onError: (error) => toast.error('Could not update role', apiErrorMessage(error)),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      privacy: 'public' | 'private';
      avatarUrl?: string;
      coverUrl?: string;
      memberIds?: string[];
    }) => {
      const response = await api.post<{ group: Group }>('/groups', input);
      return response.data.group;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group created', 'Invite people to get it going.');
    },
    onError: (error) => toast.error('Could not create group', apiErrorMessage(error)),
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Pick<Group, 'name' | 'description' | 'privacy' | 'avatarUrl' | 'coverUrl'>>) => {
      const response = await api.put<{ group: Group }>(`/groups/${groupId}`, input);
      return response.data.group;
    },
    onSuccess: (group) => {
      queryClient.setQueryData(groupKeys.detail(groupId), group);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group updated');
    },
    onError: (error) => toast.error('Could not update group', apiErrorMessage(error)),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, code }: { groupId: string; code?: string }) => {
      await api.post(`/groups/${groupId}/join`, { code });
      return groupId;
    },
    onSuccess: (groupId) => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Joined group', 'Say hello in the group chat.');
    },
    onError: (error) => toast.error('Could not join', apiErrorMessage(error)),
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      await api.post(`/groups/${groupId}/leave`);
      return groupId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Left group');
    },
    onError: (error) => toast.error('Could not leave group', apiErrorMessage(error)),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      await api.delete(`/groups/${groupId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group deleted');
    },
    onError: (error) => toast.error('Could not delete group', apiErrorMessage(error)),
  });
}

export function useAddGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role = 'member' }: { userId: string; role?: 'member' | 'moderator' | 'admin' }) => {
      await api.post(`/groups/${groupId}/members`, { userId, role });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      toast.success('Member added');
    },
    onError: (error) => toast.error('Could not add member', apiErrorMessage(error)),
  });
}

export function useRemoveGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/groups/${groupId}/members/${userId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      toast.success('Member removed');
    },
    onError: (error) => toast.error('Could not remove member', apiErrorMessage(error)),
  });
}
