import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from '@/stores/notificationStore';
import type { Comment, Paginated, Post, PostVisibility } from '@/types';

type FeedKind = 'feed' | 'explore' | 'bookmarks';

export const postKeys = {
  feed: ['posts', 'feed'] as const,
  explore: ['posts', 'explore'] as const,
  bookmarks: ['posts', 'bookmarks'] as const,
  detail: (id: string) => ['posts', 'detail', id] as const,
  comments: (id: string) => ['posts', 'comments', id] as const,
  user: (id: string) => ['posts', 'user', id] as const,
  group: (id: string) => ['posts', 'group', id] as const,
};

function endpointFor(kind: FeedKind): string {
  if (kind === 'explore') return '/posts/explore';
  if (kind === 'bookmarks') return '/posts/bookmarks';
  return '/posts';
}

export function usePostFeed(kind: FeedKind = 'feed') {
  return useInfiniteQuery({
    queryKey: kind === 'explore' ? postKeys.explore : kind === 'bookmarks' ? postKeys.bookmarks : postKeys.feed,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await api.get<Paginated<Post>>(endpointFor(kind), {
        params: { limit: 10, cursor: pageParam },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: postKeys.detail(postId ?? ''),
    enabled: Boolean(postId),
    queryFn: async () => {
      const response = await api.get<{ post: Post }>(`/posts/${postId}`);
      return response.data.post;
    },
  });
}

type FeedData = InfiniteData<Paginated<Post>>;

/** Applies `updater` to a post wherever it appears in any cached list. */
function patchPostEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  updater: (post: Post) => Post,
): void {
  queryClient.setQueriesData<FeedData>({ queryKey: ['posts'] }, (data) => {
    if (!data?.pages) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((post) => (post.id === postId ? updater(post) : post)),
      })),
    };
  });

  // Plain (non-infinite) lists: profile timelines, group feeds, search results.
  queryClient.setQueriesData<Post[]>({ queryKey: ['posts'] }, (data) => {
    if (!Array.isArray(data)) return data;
    return data.map((post) => (post.id === postId ? updater(post) : post));
  });

  queryClient.setQueryData<Post>(postKeys.detail(postId), (post) => (post ? updater(post) : post));
}

/** Like/unlike with an instant optimistic count change and rollback on failure. */
export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ post }: { post: Post }) => {
      if (post.isLiked) {
        const response = await api.delete<{ liked: boolean; likesCount: number }>(`/posts/${post.id}/like`);
        return response.data;
      }
      const response = await api.post<{ liked: boolean; likesCount: number }>(`/posts/${post.id}/like`);
      return response.data;
    },
    onMutate: async ({ post }) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const nextLiked = !post.isLiked;
      patchPostEverywhere(queryClient, post.id, (current) => ({
        ...current,
        isLiked: nextLiked,
        likesCount: Math.max(0, current.likesCount + (nextLiked ? 1 : -1)),
      }));
      return { previousLiked: post.isLiked, previousCount: post.likesCount, postId: post.id };
    },
    onError: (error, _variables, context) => {
      if (context) {
        patchPostEverywhere(queryClient, context.postId, (current) => ({
          ...current,
          isLiked: context.previousLiked,
          likesCount: context.previousCount,
        }));
      }
      toast.error('Could not update like', apiErrorMessage(error));
    },
    onSuccess: (data, { post }) => {
      // Reconcile with the server's authoritative count.
      patchPostEverywhere(queryClient, post.id, (current) => ({
        ...current,
        isLiked: data.liked,
        likesCount: data.likesCount,
      }));
    },
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ post }: { post: Post }) => {
      const response = await api.post<{ bookmarked: boolean }>(`/posts/${post.id}/bookmark`);
      return response.data;
    },
    onMutate: async ({ post }) => {
      patchPostEverywhere(queryClient, post.id, (current) => ({
        ...current,
        isBookmarked: !current.isBookmarked,
      }));
      return { postId: post.id, previous: post.isBookmarked };
    },
    onError: (error, _variables, context) => {
      if (context) {
        patchPostEverywhere(queryClient, context.postId, (current) => ({
          ...current,
          isBookmarked: context.previous,
        }));
      }
      toast.error('Could not save post', apiErrorMessage(error));
    },
    onSuccess: (data) => {
      toast.success(data.bookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks');
      void queryClient.invalidateQueries({ queryKey: postKeys.bookmarks });
    },
  });
}

export function useSharePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await api.post<{ sharesCount: number }>(`/posts/${postId}/share`);
      return response.data;
    },
    onSuccess: (data, postId) => {
      patchPostEverywhere(queryClient, postId, (current) => ({ ...current, sharesCount: data.sharesCount }));
      void navigator.clipboard?.writeText(`${window.location.origin}/post/${postId}`).catch(() => undefined);
      toast.success('Link copied', 'Share it with anyone in your orbit.');
    },
    onError: (error) => toast.error('Could not share', apiErrorMessage(error)),
  });
}

export interface CreatePostInput {
  contentText: string;
  mediaUrl?: string;
  mediaType?: string;
  linkUrl?: string;
  visibility?: PostVisibility;
  groupId?: string;
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const endpoint = input.groupId ? `/groups/${input.groupId}/posts` : '/posts';
      const response = await api.post<{ post: Post }>(endpoint, input);
      return response.data.post;
    },
    onSuccess: (post, input) => {
      if (input.groupId) {
        void queryClient.invalidateQueries({ queryKey: postKeys.group(input.groupId) });
      } else {
        // Prepend immediately so the new post appears without a refetch round-trip.
        queryClient.setQueryData<FeedData>(postKeys.feed, (data) => {
          if (!data?.pages?.length) return data;
          const [first, ...rest] = data.pages;
          return { ...data, pages: [{ ...first!, items: [post, ...first!.items] }, ...rest] };
        });
        void queryClient.invalidateQueries({ queryKey: postKeys.feed });
        void queryClient.invalidateQueries({ queryKey: postKeys.explore });
      }
      void queryClient.invalidateQueries({ queryKey: postKeys.user(post.author.id) });
      toast.success('Posted', 'Your friends will see it in their feed.');
    },
    onError: (error) => toast.error('Could not post', apiErrorMessage(error)),
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; contentText?: string; visibility?: PostVisibility }) => {
      const response = await api.put<{ post: Post }>(`/posts/${id}`, body);
      return response.data.post;
    },
    onSuccess: (post) => {
      patchPostEverywhere(queryClient, post.id, () => post);
      toast.success('Post updated');
    },
    onError: (error) => toast.error('Could not update post', apiErrorMessage(error)),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      await api.delete(`/posts/${postId}`);
      return postId;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      // Optimistically remove from every cached list.
      queryClient.setQueriesData<FeedData>({ queryKey: ['posts'] }, (data) => {
        if (!data?.pages) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({ ...page, items: page.items.filter((post) => post.id !== postId) })),
        };
      });
      queryClient.setQueriesData<Post[]>({ queryKey: ['posts'] }, (data) =>
        Array.isArray(data) ? data.filter((post) => post.id !== postId) : data,
      );
    },
    onSuccess: () => toast.success('Post deleted'),
    onError: (error) => {
      toast.error('Could not delete post', apiErrorMessage(error));
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useComments(postId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: postKeys.comments(postId ?? ''),
    enabled: Boolean(postId) && enabled,
    queryFn: async () => {
      const response = await api.get<{ items: Comment[] }>(`/posts/${postId}/comments`);
      return response.data.items;
    },
  });
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, parentCommentId }: { content: string; parentCommentId?: string | null }) => {
      const response = await api.post<{ comment: Comment }>(`/posts/${postId}/comments`, {
        content,
        parentCommentId: parentCommentId ?? null,
      });
      return response.data.comment;
    },
    onSuccess: (comment) => {
      queryClient.setQueryData<Comment[]>(postKeys.comments(postId), (data) => {
        const list = data ?? [];
        if (!comment.parentCommentId) return [...list, comment];
        return list.map((root) =>
          root.id === comment.parentCommentId ? { ...root, replies: [...root.replies, comment] } : root,
        );
      });
      patchPostEverywhere(queryClient, postId, (post) => ({ ...post, commentsCount: post.commentsCount + 1 }));
    },
    onError: (error) => toast.error('Could not comment', apiErrorMessage(error)),
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/comments/${commentId}`);
      return commentId;
    },
    onSuccess: (commentId) => {
      queryClient.setQueryData<Comment[]>(postKeys.comments(postId), (data) => {
        if (!data) return data;
        return data
          .filter((comment) => comment.id !== commentId)
          .map((comment) => ({ ...comment, replies: comment.replies.filter((reply) => reply.id !== commentId) }));
      });
      void queryClient.invalidateQueries({ queryKey: postKeys.comments(postId) });
      patchPostEverywhere(queryClient, postId, (post) => ({
        ...post,
        commentsCount: Math.max(0, post.commentsCount - 1),
      }));
      toast.success('Comment deleted');
    },
    onError: (error) => toast.error('Could not delete comment', apiErrorMessage(error)),
  });
}

export { patchPostEverywhere };
