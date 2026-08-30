import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { TOPICS, publish } from '../config/mqtt.js';
import { isUserOnline } from '../services/presence.service.js';
import { env } from '../config/env.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { parseLimit } from '../utils/helpers.js';
import { areFriends } from '../services/friends.service.js';
import { createNotification } from '../services/notifications.service.js';
import { parsePrivacy } from '../services/serialize.js';
import type { createConversationSchema, createMessageSchema } from '../validators/index.js';

const memberSelect = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isOnline: true,
      lastSeen: true,
      privacySettings: true,
    },
  },
} as const;

interface MemberRow {
  userId: string;
  role: string;
  lastReadAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    isOnline: boolean;
    lastSeen: Date;
    privacySettings: string;
  };
}

function serializeMember(member: MemberRow) {
  const privacy = parsePrivacy(member.user.privacySettings);
  const showOnline = privacy.onlineStatusVisibility !== 'nobody';
  return {
    id: member.user.id,
    username: member.user.username,
    displayName: member.user.displayName,
    avatarUrl: member.user.avatarUrl,
    isOnline: showOnline ? isUserOnline(member.user.id) : false,
    lastSeen: showOnline ? member.user.lastSeen.toISOString() : null,
    role: member.role,
    lastReadAt: member.lastReadAt.toISOString(),
  };
}

interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl: string;
  mediaType: string;
  replyToId: string | null;
  isRead: boolean;
  deletedForAll: boolean;
  createdAt: Date;
  sender?: { id: string; username: string; displayName: string; avatarUrl: string };
  replyTo?: {
    id: string;
    content: string;
    senderId: string;
    mediaType: string;
    sender?: { displayName: string };
  } | null;
}

export function serializeMessage(message: MessageRow, viewerId: string | null) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: message.sender ?? null,
    content: message.deletedForAll ? '' : message.content,
    mediaUrl: message.deletedForAll ? '' : message.mediaUrl,
    mediaType: message.deletedForAll ? '' : message.mediaType,
    replyToId: message.replyToId,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.content,
          senderName: message.replyTo.sender?.displayName ?? '',
          mediaType: message.replyTo.mediaType,
        }
      : null,
    isRead: message.isRead,
    isDeleted: message.deletedForAll,
    isOwn: message.senderId === viewerId,
    createdAt: message.createdAt.toISOString(),
  };
}

async function requireMembership(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership) throw forbidden('You are not part of this conversation');
  return membership;
}

/** GET /api/conversations — sorted by most recent message. */
export async function listConversations(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user.id },
    include: {
      conversation: {
        include: {
          members: { include: memberSelect },
          group: { select: { id: true, name: true, avatarUrl: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, displayName: true } } },
          },
        },
      },
    },
  });

  const items = await Promise.all(
    memberships.map(async (membership) => {
      const conversation = membership.conversation;
      const last = conversation.messages[0];
      const unread = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: user.id },
          createdAt: { gt: membership.lastReadAt },
        },
      });

      const others = conversation.members.filter((member) => member.userId !== user.id);
      const partner = others[0];
      const isGroup = conversation.type === 'group';

      return {
        id: conversation.id,
        type: conversation.type,
        name: isGroup
          ? conversation.name || conversation.group?.name || 'Group chat'
          : partner?.user.displayName ?? 'Unknown',
        avatarUrl: isGroup
          ? conversation.avatarUrl || conversation.group?.avatarUrl || ''
          : partner?.user.avatarUrl ?? '',
        groupId: conversation.groupId,
        partnerId: isGroup ? null : partner?.userId ?? null,
        isOnline: isGroup ? false : partner ? isUserOnline(partner.userId) : false,
        members: conversation.members.map((member) => serializeMember(member as MemberRow)),
        memberCount: conversation.members.length,
        unreadCount: unread,
        lastReadAt: membership.lastReadAt.toISOString(),
        lastMessage: last
          ? {
              id: last.id,
              content: last.deletedForAll ? 'Message deleted' : last.content,
              mediaType: last.mediaType,
              senderId: last.senderId,
              senderName: last.sender?.displayName ?? '',
              isOwn: last.senderId === user.id,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        updatedAt: (last?.createdAt ?? conversation.createdAt).toISOString(),
      };
    }),
  );

  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json({ items });
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const id = req.params.id as string;
  await requireMembership(id, user.id);

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      members: { include: memberSelect },
      group: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  if (!conversation) throw notFound('That conversation no longer exists');

  const others = conversation.members.filter((member) => member.userId !== user.id);
  const partner = others[0];
  const isGroup = conversation.type === 'group';

  res.json({
    conversation: {
      id: conversation.id,
      type: conversation.type,
      name: isGroup
        ? conversation.name || conversation.group?.name || 'Group chat'
        : partner?.user.displayName ?? 'Unknown',
      avatarUrl: isGroup
        ? conversation.avatarUrl || conversation.group?.avatarUrl || ''
        : partner?.user.avatarUrl ?? '',
      groupId: conversation.groupId,
      partnerId: isGroup ? null : partner?.userId ?? null,
      isOnline: isGroup ? false : partner ? isUserOnline(partner.userId) : false,
      members: conversation.members.map((member) => serializeMember(member as MemberRow)),
      memberCount: conversation.members.length,
    },
  });
}

/** POST /api/conversations — start a DM or small group chat (max 10 members). */
export async function createConversation(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof createConversationSchema>;

  const memberIds = [...new Set(body.memberIds.filter((id) => id !== user.id))];
  if (memberIds.length === 0) throw badRequest('Choose at least one person');
  if (memberIds.length + 1 > env.maxGroupMembers) {
    throw badRequest(`Conversations are limited to ${env.maxGroupMembers} members`);
  }

  const targets = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, displayName: true, privacySettings: true },
  });
  if (targets.length !== memberIds.length) throw badRequest('Some of those people do not exist');

  // Respect "who can message me".
  for (const target of targets) {
    const privacy = parsePrivacy(target.privacySettings);
    if (privacy.whoCanMessage === 'nobody') {
      throw forbidden(`${target.displayName} does not accept new messages`);
    }
    if (privacy.whoCanMessage === 'friends' && !(await areFriends(user.id, target.id))) {
      throw forbidden(`${target.displayName} only accepts messages from friends`);
    }
  }

  const type = memberIds.length > 1 ? 'group' : body.type;

  // Reuse an existing 1:1 thread rather than creating duplicates.
  if (type === 'direct') {
    const partnerId = memberIds[0] as string;
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'direct',
        groupId: null,
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: partnerId } } },
        ],
      },
      include: { members: true },
    });
    if (existing && existing.members.length === 2) {
      res.json({ conversation: { id: existing.id }, existing: true });
      return;
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      type,
      name: type === 'group' ? body.name || 'New group' : '',
      createdBy: user.id,
      maxMembers: env.maxGroupMembers,
      members: {
        create: [
          { userId: user.id, role: 'admin' },
          ...memberIds.map((id) => ({ userId: id, role: 'member' })),
        ],
      },
    },
  });

  res.status(201).json({ conversation: { id: conversation.id }, existing: false });
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const conversationId = req.params.id as string;
  await requireMembership(conversationId, user.id);

  const limit = parseLimit(req.query.limit, 30, 100);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  let cursorFilter = {};
  if (cursor) {
    const anchor = await prisma.message.findUnique({
      where: { id: cursor },
      select: { createdAt: true },
    });
    if (anchor) cursorFilter = { createdAt: { lt: anchor.createdAt } };
  }

  const messages = await prisma.message.findMany({
    where: { conversationId, ...cursorFilter },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          mediaType: true,
          sender: { select: { displayName: true } },
        },
      },
    },
  });

  res.json({
    items: messages.reverse().map((message) => serializeMessage(message as MessageRow, user.id)),
    nextCursor: messages.length === limit ? messages[0]?.id ?? null : null,
  });
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const conversationId = req.params.id as string;
  const body = req.body as z.infer<typeof createMessageSchema>;
  await requireMembership(conversationId, user.id);

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: user.id,
      content: body.content,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      replyToId: body.replyToId || null,
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          mediaType: true,
          sender: { select: { displayName: true } },
        },
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const serialized = serializeMessage(message as MessageRow, user.id);

  publish(TOPICS.chatMessages(conversationId), {
    event: 'message_created',
    message: { ...serialized, isOwn: false },
  });

  const recipients = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { not: user.id } },
    select: { userId: true },
  });

  const preview = body.content || (body.mediaType ? `Sent ${body.mediaType}` : 'New message');
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient.userId,
        actorId: user.id,
        type: 'message',
        content: `${user.displayName}: ${preview.slice(0, 80)}`,
        referenceId: conversationId,
        referenceType: 'conversation',
      }),
    ),
  );

  res.status(201).json({ message: serialized });
}

/** PUT /api/conversations/:id/read — marks everything up to now as read, emits receipts. */
export async function markRead(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const conversationId = req.params.id as string;
  await requireMembership(conversationId, user.id);

  const now = new Date();
  await prisma.$transaction([
    prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: now },
    }),
    prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, isRead: false },
      data: { isRead: true },
    }),
  ]);

  publish(TOPICS.chatRead(conversationId), {
    event: 'read',
    userId: user.id,
    readAt: now.toISOString(),
  });

  res.json({ success: true, readAt: now.toISOString() });
}

/** DELETE /api/messages/:id?scope=all|me */
export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const messageId = req.params.id as string;
  const scope = String(req.query.scope ?? 'me');

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw notFound('That message no longer exists');
  if (message.senderId !== user.id) throw forbidden('You can only delete your own messages');

  if (scope === 'all') {
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedForAll: true, content: '', mediaUrl: '', mediaType: '' },
    });
    publish(TOPICS.chatMessages(message.conversationId), {
      event: 'message_deleted',
      messageId,
      conversationId: message.conversationId,
    });
  } else {
    await prisma.message.delete({ where: { id: messageId } });
    publish(TOPICS.chatMessages(message.conversationId), {
      event: 'message_removed',
      messageId,
      conversationId: message.conversationId,
    });
  }

  res.json({ success: true });
}

/** POST /api/conversations/:id/members — add someone to a group chat. */
export async function addMember(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const conversationId = req.params.id as string;
  const { userId } = req.body as { userId: string };

  const membership = await requireMembership(conversationId, user.id);
  if (membership.role !== 'admin') throw forbidden('Only the chat admin can add people');

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { _count: { select: { members: true } } },
  });
  if (!conversation) throw notFound('That conversation no longer exists');
  if (conversation.type !== 'group') throw badRequest('You cannot add people to a direct message');
  if (conversation._count.members >= conversation.maxMembers) {
    throw badRequest(`This chat is full (${conversation.maxMembers} members max)`);
  }

  await prisma.conversationMember.create({
    data: { conversationId, userId, role: 'member' },
  });

  res.status(201).json({ success: true });
}

export async function leaveConversation(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const conversationId = req.params.id as string;
  await requireMembership(conversationId, user.id);

  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });

  const remaining = await prisma.conversationMember.count({ where: { conversationId } });
  if (remaining === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
  }

  res.json({ success: true });
}
