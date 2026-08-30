import type { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { createNotification } from '../services/notifications.service.js';
import { toPublicUser } from '../services/serialize.js';
import { friendIds, relationshipWith } from '../services/friends.service.js';

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  coverUrl: true,
  bio: true,
  isOnline: true,
  lastSeen: true,
  createdAt: true,
  privacySettings: true,
} as const;

export async function listFriends(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const ids = await friendIds(user.id);
  const friends = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: userSelect,
    orderBy: { displayName: 'asc' },
  });
  res.json({ items: friends.map((friend) => toPublicUser(friend, { isFriend: true })) });
}

export async function listRequests(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);

  const [incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: { addresseeId: user.id, status: 'pending' },
      include: { requester: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: { requesterId: user.id, status: 'pending' },
      include: { addressee: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  res.json({
    incoming: incoming.map((request) => ({
      id: request.id,
      createdAt: request.createdAt.toISOString(),
      user: toPublicUser(request.requester),
    })),
    outgoing: outgoing.map((request) => ({
      id: request.id,
      createdAt: request.createdAt.toISOString(),
      user: toPublicUser(request.addressee),
    })),
  });
}

export async function sendRequest(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const targetId = req.params.userId as string;
  if (targetId === user.id) throw badRequest('You cannot add yourself');

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) throw notFound('That person does not exist');

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: targetId },
        { requesterId: targetId, addresseeId: user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'accepted') throw conflict('You are already friends');
    if (existing.status === 'blocked') throw forbidden('That request cannot be sent');
    // They already invited us — accept instead of creating a duplicate.
    if (existing.addresseeId === user.id) {
      const accepted = await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'accepted' },
      });
      await createNotification({
        userId: existing.requesterId,
        actorId: user.id,
        type: 'friend_accept',
        content: `${user.displayName} accepted your friend request`,
        referenceId: user.id,
        referenceType: 'user',
      });
      res.json({ friendship: accepted, status: 'friends' });
      return;
    }
    throw conflict('Friend request already sent');
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: user.id, addresseeId: targetId, status: 'pending' },
  });

  await createNotification({
    userId: targetId,
    actorId: user.id,
    type: 'friend_request',
    content: `${user.displayName} sent you a friend request`,
    referenceId: friendship.id,
    referenceType: 'friendship',
  });

  res.status(201).json({ friendship, status: 'request_sent' });
}

export async function acceptRequest(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const request = await prisma.friendship.findUnique({
    where: { id: req.params.requestId as string },
  });
  if (!request) throw notFound('That request no longer exists');
  if (request.addresseeId !== user.id) throw forbidden('That request is not yours to accept');
  if (request.status !== 'pending') throw badRequest('That request was already handled');

  const friendship = await prisma.friendship.update({
    where: { id: request.id },
    data: { status: 'accepted' },
  });

  await createNotification({
    userId: request.requesterId,
    actorId: user.id,
    type: 'friend_accept',
    content: `${user.displayName} accepted your friend request`,
    referenceId: user.id,
    referenceType: 'user',
  });

  res.json({ friendship, status: 'friends' });
}

export async function rejectRequest(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const request = await prisma.friendship.findUnique({
    where: { id: req.params.requestId as string },
  });
  if (!request) throw notFound('That request no longer exists');
  if (request.addresseeId !== user.id && request.requesterId !== user.id) {
    throw forbidden('That request is not yours');
  }

  await prisma.friendship.delete({ where: { id: request.id } });
  res.json({ success: true, status: 'none' });
}

export async function removeFriend(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const friendship = await prisma.friendship.findUnique({
    where: { id: req.params.friendshipId as string },
  });
  if (!friendship) throw notFound('You are not connected');
  if (friendship.requesterId !== user.id && friendship.addresseeId !== user.id) {
    throw forbidden('That connection is not yours');
  }

  await prisma.friendship.delete({ where: { id: friendship.id } });
  res.json({ success: true, status: 'none' });
}

export async function blockUser(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const targetId = req.params.userId as string;
  if (targetId === user.id) throw badRequest('You cannot block yourself');

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: targetId },
        { requesterId: targetId, addresseeId: user.id },
      ],
    },
  });

  if (existing) {
    await prisma.friendship.delete({ where: { id: existing.id } });
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: user.id, addresseeId: targetId, status: 'blocked' },
  });

  res.json({ friendship, status: 'blocked' });
}

export async function unblockUser(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const targetId = req.params.userId as string;

  await prisma.friendship.deleteMany({
    where: { requesterId: user.id, addresseeId: targetId, status: 'blocked' },
  });

  res.json({ success: true, status: 'none' });
}

export async function listBlocked(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const rows = await prisma.friendship.findMany({
    where: { requesterId: user.id, status: 'blocked' },
    include: { addressee: { select: userSelect } },
  });
  res.json({
    items: rows.map((row) => ({
      friendshipId: row.id,
      user: toPublicUser(row.addressee),
    })),
  });
}

export async function getRelationship(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const relationship = await relationshipWith(user.id, req.params.userId as string);
  res.json(relationship);
}
