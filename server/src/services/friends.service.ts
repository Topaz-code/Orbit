import { prisma } from '../config/database.js';

export type FriendStatus =
  | 'self'
  | 'friends'
  | 'request_sent'
  | 'request_received'
  | 'blocked'
  | 'blocked_by'
  | 'none';

/** Ids of every accepted friend of `userId`. */
export async function friendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const found = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function blockedIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'blocked',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
}

export async function relationshipWith(
  viewerId: string,
  otherId: string,
): Promise<{ status: FriendStatus; friendshipId: string | null }> {
  if (viewerId === otherId) return { status: 'self', friendshipId: null };

  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: viewerId },
      ],
    },
  });
  if (!friendship) return { status: 'none', friendshipId: null };

  if (friendship.status === 'accepted') {
    return { status: 'friends', friendshipId: friendship.id };
  }
  if (friendship.status === 'blocked') {
    return {
      status: friendship.requesterId === viewerId ? 'blocked' : 'blocked_by',
      friendshipId: friendship.id,
    };
  }
  return {
    status: friendship.requesterId === viewerId ? 'request_sent' : 'request_received',
    friendshipId: friendship.id,
  };
}

export async function friendCount(userId: string): Promise<number> {
  return prisma.friendship.count({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}
