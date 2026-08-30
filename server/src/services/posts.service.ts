import { prisma } from '../config/database.js';
import { safeJsonParse } from '../utils/helpers.js';

export const postInclude = {
  user: {
    select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true },
  },
  group: { select: { id: true, name: true, avatarUrl: true } },
} as const;

interface PostRecord {
  id: string;
  userId: string;
  groupId: string | null;
  contentText: string;
  mediaUrl: string;
  mediaType: string;
  linkUrl: string;
  linkPreview: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    isOnline?: boolean;
  };
  group?: { id: string; name: string; avatarUrl: string } | null;
}

export interface SerializedPost {
  id: string;
  contentText: string;
  media: Array<{ url: string; type: string }>;
  mediaUrl: string;
  mediaType: string;
  linkUrl: string;
  linkPreview: unknown;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  author: PostRecord['user'];
  group: PostRecord['group'];
  isLiked: boolean;
  isBookmarked: boolean;
  isOwn: boolean;
}

/**
 * mediaUrl stores a comma-separated list so a post can carry a gallery without a second table
 * (the spec's schema keeps a single column). This expands it into a structured array.
 */
export function parseMedia(mediaUrl: string, mediaType: string): Array<{ url: string; type: string }> {
  if (!mediaUrl) return [];
  const urls = mediaUrl.split(',').map((url) => url.trim()).filter(Boolean);
  const types = mediaType.split(',').map((type) => type.trim());
  return urls.map((url, index) => ({
    url,
    type: types[index] ?? types[0] ?? (/\.(mp4|webm|ogv|mov)$/i.test(url) ? 'video' : 'image'),
  }));
}

export function serializePost(
  post: PostRecord,
  viewerId: string | null,
  likedIds: Set<string>,
  bookmarkedIds: Set<string>,
): SerializedPost {
  return {
    id: post.id,
    contentText: post.contentText,
    media: parseMedia(post.mediaUrl, post.mediaType),
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    linkUrl: post.linkUrl,
    linkPreview: safeJsonParse<unknown>(post.linkPreview, null),
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    sharesCount: post.sharesCount,
    visibility: post.visibility,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.user,
    group: post.group ?? null,
    isLiked: likedIds.has(post.id),
    isBookmarked: bookmarkedIds.has(post.id),
    isOwn: viewerId === post.userId,
  };
}

/** Batch-loads the viewer's like/bookmark state so feeds avoid N+1 queries. */
export async function viewerPostState(
  viewerId: string | null,
  postIds: string[],
): Promise<{ liked: Set<string>; bookmarked: Set<string> }> {
  if (!viewerId || postIds.length === 0) {
    return { liked: new Set(), bookmarked: new Set() };
  }
  const [likes, bookmarks] = await Promise.all([
    prisma.like.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true },
    }),
    prisma.bookmark.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true },
    }),
  ]);
  return {
    liked: new Set(likes.map((like) => like.postId)),
    bookmarked: new Set(bookmarks.map((bookmark) => bookmark.postId)),
  };
}

export async function serializePosts(
  posts: PostRecord[],
  viewerId: string | null,
): Promise<SerializedPost[]> {
  const state = await viewerPostState(
    viewerId,
    posts.map((post) => post.id),
  );
  return posts.map((post) => serializePost(post, viewerId, state.liked, state.bookmarked));
}

/** Cursor pagination helper — returns the next cursor for keyset pagination on createdAt+id. */
export function nextCursor<T extends { id: string }>(items: T[], limit: number): string | null {
  return items.length === limit ? (items[items.length - 1]?.id ?? null) : null;
}
