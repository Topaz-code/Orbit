import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { TOPICS, publish } from '../config/mqtt.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { validated } from '../middleware/validation.middleware.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { extractFirstUrl, parseLimit } from '../utils/helpers.js';
import { fetchLinkPreview } from '../utils/linkPreview.js';
import { blockedIds, friendIds } from '../services/friends.service.js';
import { createNotification, notifyMentions } from '../services/notifications.service.js';
import { postInclude, serializePost, serializePosts, viewerPostState } from '../services/posts.service.js';
import type { createPostSchema, updatePostSchema } from '../validators/index.js';

/** Keyset pagination on createdAt — the feed is strictly chronological, never ranked. */
async function cursorFilter(cursor?: string) {
  if (!cursor) return {};
  const anchor = await prisma.post.findUnique({
    where: { id: cursor },
    select: { createdAt: true },
  });
  if (!anchor) return {};
  return { createdAt: { lt: anchor.createdAt } };
}

/**
 * GET /api/posts — the news feed.
 * Contains the author's own posts plus friends' posts, newest first. No ranking, no
 * recommendations, no engagement weighting. This is the core privacy promise.
 */
export async function listFeed(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const limit = parseLimit(req.query.limit, 20);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  const [friends, blocked] = await Promise.all([friendIds(user.id), blockedIds(user.id)]);
  const authorIds = [user.id, ...friends].filter((id) => !blocked.includes(id));

  const posts = await prisma.post.findMany({
    where: {
      groupId: null,
      userId: { in: authorIds },
      OR: [
        { userId: user.id },
        { visibility: 'public' },
        { visibility: 'friends', userId: { in: friends } },
      ],
      ...(await cursorFilter(cursor)),
    },
    include: postInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const items = await serializePosts(posts, user.id);
  res.json({
    items,
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id ?? null : null,
  });
}

/** GET /api/posts/explore — every public post on this instance, chronological. */
export async function listExplore(req: Request, res: Response): Promise<void> {
  const viewerId = req.user?.id ?? null;
  const limit = parseLimit(req.query.limit, 20);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  const blocked = viewerId ? await blockedIds(viewerId) : [];

  const posts = await prisma.post.findMany({
    where: {
      visibility: 'public',
      groupId: null,
      ...(blocked.length ? { userId: { notIn: blocked } } : {}),
      ...(await cursorFilter(cursor)),
    },
    include: postInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({
    items: await serializePosts(posts, viewerId),
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id ?? null : null,
  });
}

/** GET /api/posts/bookmarks — the viewer's saved posts. */
export async function listBookmarks(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { post: { include: postInclude } },
    take: 50,
  });
  const posts = bookmarks.map((bookmark) => bookmark.post).filter(Boolean);
  res.json({ items: await serializePosts(posts as never[], user.id), nextCursor: null });
}

export async function getPost(req: Request, res: Response): Promise<void> {
  const viewerId = req.user?.id ?? null;
  const post = await prisma.post.findUnique({
    where: { id: req.params.id as string },
    include: postInclude,
  });
  if (!post) throw notFound('That post no longer exists');

  if (post.visibility !== 'public' && post.userId !== viewerId) {
    const friends = viewerId ? await friendIds(viewerId) : [];
    const allowed = post.visibility === 'friends' && friends.includes(post.userId);
    if (!allowed) throw forbidden('This post is not shared with you');
  }

  const state = await viewerPostState(viewerId, [post.id]);
  res.json({ post: serializePost(post, viewerId, state.liked, state.bookmarked) });
}

export async function createPost(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof createPostSchema>;

  if (body.groupId) {
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: body.groupId, userId: user.id } },
    });
    if (!membership) throw forbidden('Join the group before posting in it');
  }

  const linkUrl = body.linkUrl || extractFirstUrl(body.contentText) || '';
  let linkPreview = '';
  if (linkUrl) {
    const preview = await fetchLinkPreview(linkUrl);
    if (preview) linkPreview = JSON.stringify(preview);
  }

  const post = await prisma.post.create({
    data: {
      userId: user.id,
      groupId: body.groupId ?? null,
      contentText: body.contentText,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      linkUrl,
      linkPreview,
      visibility: body.groupId ? 'friends' : body.visibility,
    },
    include: postInclude,
  });

  const serialized = serializePost(post, user.id, new Set(), new Set());

  publish(TOPICS.feedNew, { event: 'post_created', post: serialized, authorId: user.id });

  await notifyMentions({
    text: body.contentText,
    actorId: user.id,
    actorName: user.displayName,
    referenceId: post.id,
    referenceType: 'post',
    context: 'a post',
  });

  if (body.groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId: body.groupId, userId: { not: user.id } },
      select: { userId: true },
    });
    const group = await prisma.group.findUnique({
      where: { id: body.groupId },
      select: { name: true },
    });
    await Promise.all(
      members.map((member) =>
        createNotification({
          userId: member.userId,
          actorId: user.id,
          type: 'group_post',
          content: `${user.displayName} posted in ${group?.name ?? 'your group'}`,
          referenceId: body.groupId as string,
          referenceType: 'group',
        }),
      ),
    );
  }

  res.status(201).json({ post: serialized });
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof updatePostSchema>;

  const existing = await prisma.post.findUnique({ where: { id: req.params.id as string } });
  if (!existing) throw notFound('That post no longer exists');
  if (existing.userId !== user.id) throw forbidden('You can only edit your own posts');

  const post = await prisma.post.update({
    where: { id: existing.id },
    data: {
      ...(body.contentText !== undefined ? { contentText: body.contentText } : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
    },
    include: postInclude,
  });

  const state = await viewerPostState(user.id, [post.id]);
  res.json({ post: serializePost(post, user.id, state.liked, state.bookmarked) });
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const existing = await prisma.post.findUnique({
    where: { id: req.params.id as string },
    include: { group: { select: { createdBy: true } } },
  });
  if (!existing) throw notFound('That post no longer exists');

  const isGroupAdmin = existing.group?.createdBy === user.id;
  if (existing.userId !== user.id && !isGroupAdmin) {
    throw forbidden('You can only delete your own posts');
  }

  await prisma.post.delete({ where: { id: existing.id } });
  publish(TOPICS.feedNew, { event: 'post_deleted', postId: existing.id });
  res.json({ success: true });
}

export async function likePost(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const postId = req.params.id as string;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound('That post no longer exists');

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });
  if (existing) {
    res.json({ liked: true, likesCount: post.likesCount });
    return;
  }

  const [, updated] = await prisma.$transaction([
    prisma.like.create({ data: { userId: user.id, postId } }),
    prisma.post.update({
      where: { id: postId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    }),
  ]);

  await createNotification({
    userId: post.userId,
    actorId: user.id,
    type: 'post_like',
    content: `${user.displayName} liked your post`,
    referenceId: postId,
    referenceType: 'post',
  });

  res.json({ liked: true, likesCount: updated.likesCount });
}

export async function unlikePost(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const postId = req.params.id as string;

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });
  if (!existing) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { likesCount: true },
    });
    res.json({ liked: false, likesCount: post?.likesCount ?? 0 });
    return;
  }

  const [, updated] = await prisma.$transaction([
    prisma.like.delete({ where: { id: existing.id } }),
    prisma.post.update({
      where: { id: postId },
      data: { likesCount: { decrement: 1 } },
      select: { likesCount: true },
    }),
  ]);

  res.json({ liked: false, likesCount: Math.max(0, updated.likesCount) });
}

export async function toggleBookmark(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const postId = req.params.id as string;

  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    res.json({ bookmarked: false });
    return;
  }
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw notFound('That post no longer exists');

  await prisma.bookmark.create({ data: { userId: user.id, postId } });
  res.json({ bookmarked: true });
}

export async function sharePost(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const postId = req.params.id as string;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound('That post no longer exists');

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { sharesCount: { increment: 1 } },
    select: { sharesCount: true },
  });

  await createNotification({
    userId: post.userId,
    actorId: user.id,
    type: 'post_share',
    content: `${user.displayName} shared your post`,
    referenceId: postId,
    referenceType: 'post',
  });

  res.json({ sharesCount: updated.sharesCount });
}

/** GET /api/posts/:id/likes — who liked this post. */
export async function listLikes(req: Request, res: Response): Promise<void> {
  const likes = await prisma.like.findMany({
    where: { postId: req.params.id as string },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  res.json({ items: likes.map((like) => like.user) });
}

/** POST /api/posts/link-preview — used by the composer to preview a pasted URL. */
export async function previewLink(req: Request, res: Response): Promise<void> {
  const { url } = req.body as { url: string };
  const preview = await fetchLinkPreview(url);
  if (!preview) throw badRequest('That URL could not be read');
  res.json({ preview });
}

export { validated };
