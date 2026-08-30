import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { inviteCode, parseLimit } from '../utils/helpers.js';
import { generateAvatar, generateCover } from '../utils/placeholder.js';
import { createNotification } from '../services/notifications.service.js';
import { postInclude, serializePosts } from '../services/posts.service.js';
import type { addGroupMemberSchema, createGroupSchema, updateGroupSchema } from '../validators/index.js';

const groupInclude = {
  _count: { select: { members: true, posts: true } },
  creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} as const;

interface GroupRecord {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  coverUrl: string;
  privacy: string;
  maxMembers: number;
  inviteCode: string;
  createdBy: string;
  createdAt: Date;
  _count: { members: number; posts: number };
  creator: { id: string; username: string; displayName: string; avatarUrl: string };
}

function serializeGroup(group: GroupRecord, membership: { role: string } | null, viewerId: string) {
  const isAdmin = membership?.role === 'admin' || group.createdBy === viewerId;
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    avatarUrl: group.avatarUrl,
    coverUrl: group.coverUrl,
    privacy: group.privacy,
    maxMembers: group.maxMembers,
    memberCount: group._count.members,
    postCount: group._count.posts,
    isFull: group._count.members >= group.maxMembers,
    createdAt: group.createdAt.toISOString(),
    creator: group.creator,
    isMember: Boolean(membership),
    role: membership?.role ?? null,
    isAdmin,
    // The invite link is only meaningful to members, so never leak it to outsiders.
    inviteCode: membership ? group.inviteCode : null,
  };
}

/** GET /api/groups — groups the viewer belongs to. */
export async function listMyGroups(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: { group: { include: groupInclude } },
    orderBy: { joinedAt: 'desc' },
  });

  res.json({
    items: memberships.map((membership) =>
      serializeGroup(membership.group as GroupRecord, { role: membership.role }, user.id),
    ),
  });
}

/** GET /api/groups/discover — public groups the viewer has not joined. */
export async function discoverGroups(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const joined = memberships.map((membership) => membership.groupId);

  const groups = await prisma.group.findMany({
    where: { privacy: 'public', ...(joined.length ? { id: { notIn: joined } } : {}) },
    include: groupInclude,
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 30),
  });

  res.json({ items: groups.map((group) => serializeGroup(group as GroupRecord, null, user.id)) });
}

export async function getGroup(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const group = await prisma.group.findUnique({
    where: { id: req.params.id as string },
    include: groupInclude,
  });
  if (!group) throw notFound('That group does not exist');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
  });

  if (group.privacy === 'private' && !membership) {
    throw forbidden('This group is private');
  }

  res.json({ group: serializeGroup(group as GroupRecord, membership, user.id) });
}

export async function createGroup(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof createGroupSchema>;

  const memberIds = [...new Set(body.memberIds.filter((id) => id !== user.id))];
  if (memberIds.length + 1 > env.maxGroupMembers) {
    throw badRequest(`Groups are limited to ${env.maxGroupMembers} members`);
  }

  const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'group';
  const seed = `${slug}-${Date.now().toString(36)}`;

  const group = await prisma.group.create({
    data: {
      name: body.name,
      description: body.description,
      avatarUrl: body.avatarUrl || generateAvatar(seed, body.name),
      coverUrl: body.coverUrl || generateCover(seed, 'groups'),
      createdBy: user.id,
      privacy: body.privacy,
      maxMembers: env.maxGroupMembers,
      inviteCode: inviteCode(),
      members: {
        create: [
          { userId: user.id, role: 'admin' },
          ...memberIds.map((id) => ({ userId: id, role: 'member' })),
        ],
      },
    },
    include: groupInclude,
  });

  // Every group gets a linked group chat so "Group chat" works out of the box.
  await prisma.conversation.create({
    data: {
      type: 'group',
      name: group.name,
      avatarUrl: group.avatarUrl,
      createdBy: user.id,
      groupId: group.id,
      maxMembers: env.maxGroupMembers,
      members: {
        create: [
          { userId: user.id, role: 'admin' },
          ...memberIds.map((id) => ({ userId: id, role: 'member' })),
        ],
      },
    },
  });

  await Promise.all(
    memberIds.map((id) =>
      createNotification({
        userId: id,
        actorId: user.id,
        type: 'group_invite',
        content: `${user.displayName} added you to ${group.name}`,
        referenceId: group.id,
        referenceType: 'group',
      }),
    ),
  );

  res.status(201).json({
    group: serializeGroup(group as GroupRecord, { role: 'admin' }, user.id),
  });
}

export async function updateGroup(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;
  const body = req.body as z.infer<typeof updateGroupSchema>;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership || membership.role !== 'admin') throw forbidden('Only admins can edit this group');

  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {}),
      ...(body.privacy !== undefined ? { privacy: body.privacy } : {}),
    },
    include: groupInclude,
  });

  res.json({ group: serializeGroup(group as GroupRecord, membership, user.id) });
}

export async function deleteGroup(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw notFound('That group does not exist');
  if (group.createdBy !== user.id) throw forbidden('Only the group creator can delete it');

  await prisma.group.delete({ where: { id: groupId } });
  res.json({ success: true });
}

export async function joinGroup(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;
  const code = String(req.query.code ?? (req.body as { code?: string })?.code ?? '');

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } }, conversation: { select: { id: true } } },
  });
  if (!group) throw notFound('That group does not exist');

  if (group.privacy === 'private' && code !== group.inviteCode) {
    throw forbidden('This group is invite-only');
  }
  if (group._count.members >= group.maxMembers) {
    throw badRequest(`This group is full (${group.maxMembers} members max)`);
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (existing) throw conflict('You are already a member');

  await prisma.groupMember.create({ data: { groupId, userId: user.id, role: 'member' } });

  if (group.conversation) {
    await prisma.conversationMember
      .create({
        data: { conversationId: group.conversation.id, userId: user.id, role: 'member' },
      })
      .catch(() => undefined);
  }

  await createNotification({
    userId: group.createdBy,
    actorId: user.id,
    type: 'group_join',
    content: `${user.displayName} joined ${group.name}`,
    referenceId: group.id,
    referenceType: 'group',
  });

  res.json({ success: true, isMember: true });
}

export async function leaveGroup(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { conversation: { select: { id: true } } },
  });
  if (!group) throw notFound('That group does not exist');
  if (group.createdBy === user.id) {
    throw badRequest('Transfer ownership or delete the group instead');
  }

  await prisma.groupMember.deleteMany({ where: { groupId, userId: user.id } });
  if (group.conversation) {
    await prisma.conversationMember.deleteMany({
      where: { conversationId: group.conversation.id, userId: user.id },
    });
  }

  res.json({ success: true, isMember: false });
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw notFound('That group does not exist');

  const viewerMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (group.privacy === 'private' && !viewerMembership) throw forbidden('This group is private');

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true },
      },
    },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });

  res.json({
    items: members.map((member) => ({
      ...member.user,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      isSelf: member.userId === user.id,
    })),
  });
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;
  const body = req.body as z.infer<typeof addGroupMemberSchema>;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
    throw forbidden('Only admins and moderators can add members');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } }, conversation: { select: { id: true } } },
  });
  if (!group) throw notFound('That group does not exist');
  if (group._count.members >= group.maxMembers) {
    throw badRequest(`This group is full (${group.maxMembers} members max)`);
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: body.userId } },
  });
  if (existing) throw conflict('They are already a member');

  await prisma.groupMember.create({
    data: { groupId, userId: body.userId, role: body.role },
  });

  if (group.conversation) {
    await prisma.conversationMember
      .create({ data: { conversationId: group.conversation.id, userId: body.userId } })
      .catch(() => undefined);
  }

  await createNotification({
    userId: body.userId,
    actorId: user.id,
    type: 'group_invite',
    content: `${user.displayName} added you to ${group.name}`,
    referenceId: group.id,
    referenceType: 'group',
  });

  res.status(201).json({ success: true });
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;
  const targetId = req.params.userId as string;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { conversation: { select: { id: true } } },
  });
  if (!group) throw notFound('That group does not exist');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership || membership.role !== 'admin') throw forbidden('Only admins can remove members');
  if (targetId === group.createdBy) throw badRequest('The group creator cannot be removed');

  await prisma.groupMember.deleteMany({ where: { groupId, userId: targetId } });
  if (group.conversation) {
    await prisma.conversationMember.deleteMany({
      where: { conversationId: group.conversation.id, userId: targetId },
    });
  }

  res.json({ success: true });
}

export async function updateMemberRole(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;
  const targetId = req.params.userId as string;
  const { role } = req.body as { role: 'member' | 'moderator' | 'admin' };

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership || membership.role !== 'admin') throw forbidden('Only admins can change roles');

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: targetId } },
    data: { role },
  });

  res.json({ success: true });
}

/** GET /api/groups/:id/posts — the group feed, chronological. */
export async function listGroupPosts(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const groupId = req.params.id as string;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw notFound('That group does not exist');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (group.privacy === 'private' && !membership) throw forbidden('This group is private');

  const posts = await prisma.post.findMany({
    where: { groupId },
    include: postInclude,
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 20),
  });

  res.json({ items: await serializePosts(posts, user.id), nextCursor: null });
}

/** GET /api/groups/invite/:code — resolve an invite link to a group. */
export async function getByInviteCode(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const group = await prisma.group.findUnique({
    where: { inviteCode: req.params.code as string },
    include: groupInclude,
  });
  if (!group) throw notFound('That invite link is not valid');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
  });

  res.json({ group: serializeGroup(group as GroupRecord, membership, user.id) });
}
