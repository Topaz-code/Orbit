import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { TOPICS, publish } from '../config/mqtt.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { forbidden, notFound } from '../utils/errors.js';
import { createNotification, notifyMentions } from '../services/notifications.service.js';
import type { createCommentSchema, updateCommentSchema } from '../validators/index.js';

const commentInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} as const;

interface CommentRecord {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
  user: { id: string; username: string; displayName: string; avatarUrl: string };
}

/** Matches the `Comment` DTO on the client. */
interface SerializedComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string };
  isOwn: boolean;
  replies: SerializedComment[];
}

function serializeComment(
  comment: CommentRecord,
  viewerId: string | null,
  replies: CommentRecord[] = [],
): SerializedComment {
  return {
    id: comment.id,
    postId: comment.postId,
    parentCommentId: comment.parentCommentId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: comment.user,
    isOwn: comment.user.id === viewerId,
    replies: replies.map((reply) => serializeComment(reply, viewerId)),
  };
}

/** GET /api/posts/:id/comments — threaded one level deep, oldest first. */
export async function listComments(req: Request, res: Response): Promise<void> {
  const viewerId = req.user?.id ?? null;
  const postId = req.params.id as string;

  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: commentInclude,
  });

  const roots = comments.filter((comment) => !comment.parentCommentId);
  const byParent = new Map<string, CommentRecord[]>();
  for (const comment of comments) {
    if (!comment.parentCommentId) continue;
    const list = byParent.get(comment.parentCommentId) ?? [];
    list.push(comment as CommentRecord);
    byParent.set(comment.parentCommentId, list);
  }

  res.json({
    items: roots.map((root) =>
      serializeComment(root as CommentRecord, viewerId, byParent.get(root.id) ?? []),
    ),
  });
}

export async function createComment(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof createCommentSchema>;
  const postId = req.params.id as string;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound('That post no longer exists');

  // Replies are capped at one level: replying to a reply attaches to its root.
  let parentCommentId = body.parentCommentId || null;
  if (parentCommentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentCommentId },
      select: { id: true, parentCommentId: true, userId: true },
    });
    if (!parent) throw notFound('That comment no longer exists');
    parentCommentId = parent.parentCommentId ?? parent.id;
  }

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { postId, userId: user.id, parentCommentId, content: body.content },
      include: commentInclude,
    }),
    prisma.post.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    }),
  ]);

  const serialized = serializeComment(comment as CommentRecord, user.id);

  publish(`orbit/post/${postId}/comments`, { event: 'comment_created', comment: serialized });

  await createNotification({
    userId: post.userId,
    actorId: user.id,
    type: 'post_comment',
    content: `${user.displayName} commented on your post`,
    referenceId: postId,
    referenceType: 'post',
  });

  if (parentCommentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentCommentId },
      select: { userId: true },
    });
    if (parent && parent.userId !== post.userId) {
      await createNotification({
        userId: parent.userId,
        actorId: user.id,
        type: 'comment_reply',
        content: `${user.displayName} replied to your comment`,
        referenceId: postId,
        referenceType: 'post',
      });
    }
  }

  await notifyMentions({
    text: body.content,
    actorId: user.id,
    actorName: user.displayName,
    referenceId: postId,
    referenceType: 'post',
    context: 'a comment',
  });

  res.status(201).json({ comment: serialized });
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof updateCommentSchema>;

  const existing = await prisma.comment.findUnique({ where: { id: req.params.id as string } });
  if (!existing) throw notFound('That comment no longer exists');
  if (existing.userId !== user.id) throw forbidden('You can only edit your own comments');

  const comment = await prisma.comment.update({
    where: { id: existing.id },
    data: { content: body.content },
    include: commentInclude,
  });

  res.json({ comment: serializeComment(comment as CommentRecord, user.id) });
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const existing = await prisma.comment.findUnique({
    where: { id: req.params.id as string },
    include: { post: { select: { userId: true } }, replies: { select: { id: true } } },
  });
  if (!existing) throw notFound('That comment no longer exists');

  const canDelete = existing.userId === user.id || existing.post.userId === user.id;
  if (!canDelete) throw forbidden('You cannot delete this comment');

  const removed = 1 + existing.replies.length;
  await prisma.$transaction([
    prisma.comment.delete({ where: { id: existing.id } }),
    prisma.post.update({
      where: { id: existing.postId },
      data: { commentsCount: { decrement: removed } },
    }),
  ]);

  publish(`orbit/post/${existing.postId}/comments`, {
    event: 'comment_deleted',
    commentId: existing.id,
  });

  res.json({ success: true });
}

export { TOPICS };
