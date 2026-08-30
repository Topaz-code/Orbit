import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from '@/stores/notificationStore';
import type { Story, StoryGroup, StoryOverlay } from '@/types';

export const storyKeys = { list: ['stories'] as const };

export function useStories() {
  return useQuery({
    queryKey: storyKeys.list,
    queryFn: async () => {
      const response = await api.get<{ items: StoryGroup[] }>('/stories');
      return response.data.items;
    },
    // Stories expire; keep them reasonably fresh.
    staleTime: 60_000,
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      mediaUrl: string;
      mediaType: 'image' | 'video';
      caption?: string;
      overlay?: StoryOverlay;
    }) => {
      const response = await api.post<{ story: Story }>('/stories', input);
      return response.data.story;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.list });
      toast.success('Story posted', 'It disappears in 24 hours.');
    },
    onError: (error) => toast.error('Could not post story', apiErrorMessage(error)),
  });
}

export function useViewStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      const response = await api.post<{ success: boolean; viewCount: number }>(`/stories/${storyId}/view`);
      return response.data;
    },
    onSuccess: (_data, storyId) => {
      queryClient.setQueryData<StoryGroup[]>(storyKeys.list, (groups) =>
        groups?.map((group) => ({
          ...group,
          stories: group.stories.map((story) =>
            story.id === storyId ? { ...story, hasViewed: true } : story,
          ),
          hasUnseen: group.stories.some((story) => story.id !== storyId && !story.hasViewed),
        })),
      );
    },
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      await api.delete(`/stories/${storyId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.list });
      toast.success('Story deleted');
    },
    onError: (error) => toast.error('Could not delete story', apiErrorMessage(error)),
  });
}

export function useReplyToStory() {
  return useMutation({
    mutationFn: async ({ storyId, content }: { storyId: string; content: string }) => {
      const response = await api.post<{ success: boolean; conversationId: string }>(
        `/stories/${storyId}/reply`,
        { content },
      );
      return response.data;
    },
    onSuccess: () => toast.success('Reply sent', 'It landed in your DMs.'),
    onError: (error) => toast.error('Could not send reply', apiErrorMessage(error)),
  });
}
