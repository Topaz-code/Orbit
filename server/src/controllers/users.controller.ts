import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { parseLimit } from '../utils/helpers.js';
import { hashPassword, verifyPassword } from '../config/auth.js';
import { badRequest } from '../utils/errors.js';
import {
  parseNotificationSettings,
  parsePrivacy,
  toPublicUser,
  toSelfUser,
} from '../services/serialize.js';
import { areFriends, friendCount, friendIds, relationshipWith } from '../services/friends.service.js';
import { postInclude, serializePosts } from '../services/posts.service.js';
import type { changePasswordSchema, updateUserSchema } from '../validators/index.js';

export async function getUser(req: Request, res: Response): Promise<void> {
  const viewerId = req.user?.id ?? null;
  const key = req.params.id as string;

  const user = await prisma.user.findFirst({
    where: { OR: [{ id: key }, { username: key.toLowerCase().replace(/^@/, '') }] },
  });
  if (!user) throw notFound('That profile does not exist');

  const isSelf = viewerId === user.id;
  const isFriend = viewerId ? await areFriends(viewerId, user.id) : false;

  const [posts, friends, relationship, groups] = await Promise.all([
    prisma.post.count({ where: { userId: user.id, groupId: null } }),
    friendCount(user.id),
    viewerId ? relationshipWith(viewerId, user.id) : Promise.resolve({ status: 'none' as const, friendshipId: null }),
    prisma.groupMember.count({ where: { userId: user.id } }),
  ]);

  res.json({
    user: {
      ...(isSelf ? toSelfUser(user) : toPublicUser(user, { isSelf, isFriend })),
      stats: { posts, friends, groups },
      relationship: relationship.status,
      friendshipId: relationship.friendshipId,
    },
  });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const auth = currentUser(req);
  if (req.params.id !== auth.id && req.params.id !== 'me') {
    throw forbidden('You can only edit your own profile');
  }
  const body = req.body as z.infer<typeof updateUserSchema>;

  if (body.email) {
    const existing = await prisma.user.findFirst({
      where: { email: body.email, id: { not: auth.id } },
      select: { id: true },
    });
    if (existing) throw conflict('That email is already registered');
  }
  if (body.phone) {
    const existing = await prisma.user.findFirst({
      where: { phone: body.phone, id: { not: auth.id } },
      select: { id: true },
    });
    if (existing) throw conflict('That phone number is already registered');
  }

  const existing = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!existing) throw notFound('Account not found');

  const privacy = body.privacySettings
    ? { ...parsePrivacy(existing.privacySettings), ...body.privacySettings }
    : null;
  const notifications = body.notificationSettings
    ? { ...parseNotificationSettings(existing.notificationSettings), ...body.notificationSettings }
    : null;

  const user = await prisma.user.update({
    where: { id: auth.id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.isOnboarded !== undefined ? { isOnboarded: body.isOnboarded } : {}),
      ...(privacy ? { privacySettings: JSON.stringify(privacy) } : {}),
      ...(notifications ? { notificationSettings: JSON.stringify(notifications) } : {}),
    },
  });

  res.json({ user: toSelfUser(user) });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const auth = currentUser(req);
  const body = req.body as z.infer<typeof changePasswordSchema>;

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) throw notFound('Account not found');

  const ok = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!ok) throw badRequest('Your current password is incorrect');

  await prisma.user.update({
    where: { id: auth.id },
    data: { passwordHash: await hashPassword(body.newPassword) },
  });

  res.json({ success: true });
}

export async function listUserPosts(req: Request, res: Response): Promise<void> {
  const viewerId = req.user?.id ?? null;
  const targetId = req.params.id as string;
  const limit = parseLimit(req.query.limit, 20);

  const target = await prisma.user.findFirst({
    where: { OR: [{ id: targetId }, { username: targetId.toLowerCase() }] },
    select: { id: true, privacySettings: true },
  });
  if (!target) throw notFound('That profile does not exist');

  const isSelf = viewerId === target.id;
  const isFriend = viewerId ? await areFriends(viewerId, target.id) : false;
  const privacy = parsePrivacy(target.privacySettings);

  if (!isSelf) {
    if (privacy.postVisibility === 'nobody') {
      res.json({ items: [], nextCursor: null });
      return;
    }
    if (privacy.postVisibility === 'friends' && !isFriend) {
      res.json({ items: [], nextCursor: null });
      return;
    }
  }

  const visibilityFilter = isSelf
    ? {}
    : isFriend
      ? { visibility: { in: ['public', 'friends'] } }
      : { visibility: 'public' };

  const posts = await prisma.post.findMany({
    where: { userId: target.id, groupId: null, ...visibilityFilter },
    include: postInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({ items: await serializePosts(posts, viewerId), nextCursor: null });
}

/** GET /api/users/:id/media — every image/video the user has posted, for the Media tab. */
export async function listUserMedia(req: Request, res: Response): Promise<void> {
  const targetId = req.params.id as string;
  const target = await prisma.user.findFirst({
    where: { OR: [{ id: targetId }, { username: targetId.toLowerCase() }] },
    select: { id: true },
  });
  if (!target) throw notFound('That profile does not exist');

  const posts = await prisma.post.findMany({
    where: { userId: target.id, NOT: { mediaUrl: '' } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, mediaUrl: true, mediaType: true, createdAt: true },
  });

  const items = posts.flatMap((post) =>
    post.mediaUrl
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({
        postId: post.id,
        url,
        type: /\.(mp4|webm|ogv|mov)$/i.test(url) ? 'video' : 'image',
        createdAt: post.createdAt.toISOString(),
      })),
  );

  res.json({ items });
}

export async function listUserFriends(req: Request, res: Response): Promise<void> {
  const targetId = req.params.id as string;
  const target = await prisma.user.findFirst({
    where: { OR: [{ id: targetId }, { username: targetId.toLowerCase() }] },
    select: { id: true },
  });
  if (!target) throw notFound('That profile does not exist');

  const ids = await friendIds(target.id);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    orderBy: { displayName: 'asc' },
  });

  const viewerId = req.user?.id ?? null;
  const viewerFriends = viewerId ? new Set(await friendIds(viewerId)) : new Set<string>();

  res.json({
    items: users.map((user) =>
      toPublicUser(user, { isSelf: user.id === viewerId, isFriend: viewerFriends.has(user.id) }),
    ),
  });
}

export async function listUserGroups(req: Request, res: Response): Promise<void> {
  const targetId = req.params.id as string;
  const target = await prisma.user.findFirst({
    where: { OR: [{ id: targetId }, { username: targetId.toLowerCase() }] },
    select: { id: true },
  });
  if (!target) throw notFound('That profile does not exist');

  const memberships = await prisma.groupMember.findMany({
    where: { userId: target.id },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

  res.json({
    items: memberships
      .filter((membership) => membership.group.privacy === 'public' || target.id === req.user?.id)
      .map((membership) => ({
        id: membership.group.id,
        name: membership.group.name,
        description: membership.group.description,
        avatarUrl: membership.group.avatarUrl,
        coverUrl: membership.group.coverUrl,
        privacy: membership.group.privacy,
        memberCount: membership.group._count.members,
        role: membership.role,
      })),
  });
}

export async function searchUsers(req: Request, res: Response): Promise<void> {
  const viewerId = req.user?.id ?? null;
  const q = String(req.query.q ?? '').trim();
  const limit = parseLimit(req.query.limit, 20);

  if (!q) {
    res.json({ items: [] });
    return;
  }

  const term = q.toLowerCase().replace(/^@/, '');
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: term } },
        { displayName: { contains: q } },
        { phone: { contains: q.replace(/[^\d+]/g, '') || '\u0000' } },
      ],
      ...(viewerId ? { id: { not: viewerId } } : {}),
    },
    take: limit,
    orderBy: { displayName: 'asc' },
  });

  const viewerFriends = viewerId ? new Set(await friendIds(viewerId)) : new Set<string>();
  const relationships = viewerId
    ? await Promise.all(users.map((user) => relationshipWith(viewerId, user.id)))
    : [];

  res.json({
    items: users.map((user, index) => ({
      ...toPublicUser(user, { isFriend: viewerFriends.has(user.id) }),
      relationship: relationships[index]?.status ?? 'none',
      friendshipId: relationships[index]?.friendshipId ?? null,
    })),
  });
}

/** GET /api/users/suggestions — friends-of-friends and new members. Not a ranking algorithm. */
export async function suggestions(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const friends = await friendIds(user.id);

  const pending = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    select: { requesterId: true, addresseeId: true },
  });
  const excluded = new Set<string>([user.id, ...friends]);
  for (const row of pending) {
    excluded.add(row.requesterId);
    excluded.add(row.addresseeId);
  }

  const users = await prisma.user.findMany({
    where: { id: { notIn: [...excluded] } },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  res.json({ items: users.map((candidate) => toPublicUser(candidate)) });
}

/** GET /api/users/me/export — GDPR-style data export. */
export async function exportData(req: Request, res: Response): Promise<void> {
  const auth = currentUser(req);
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    include: {
      posts: true,
      comments: true,
      likes: true,
      stories: true,
      messages: true,
      groupMembers: { include: { group: { select: { name: true } } } },
      notifications: true,
    },
  });
  if (!user) throw notFound('Account not found');

  const { passwordHash, securityAnswerHash, ...safe } = user;
  res.setHeader('Content-Disposition', `attachment; filename="orbit-${user.username}-export.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    note: 'Orbit stores your data locally and never sells or shares it.',
    account: safe,
  });
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const auth = currentUser(req);
  await prisma.user.delete({ where: { id: auth.id } });
  res.json({ success: true });
}
