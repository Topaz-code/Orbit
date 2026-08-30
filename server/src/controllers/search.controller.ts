import type { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { parseLimit, extractHashtags } from '../utils/helpers.js';
import { blockedIds, friendIds, relationshipWith } from '../services/friends.service.js';
import { postInclude, serializePosts } from '../services/posts.service.js';
import { toPublicUser } from '../services/serialize.js';

/** GET /api/search?q=&type= — people, posts and groups in one call. */
export async function search(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const q = String(req.query.q ?? '').trim();
  const type = String(req.query.type ?? 'all');
  const limit = parseLimit(req.query.limit, 20);

  if (!q) {
    res.json({ query: '', people: [], posts: [], groups: [] });
    return;
  }

  const term = q.replace(/^[@#]/, '');
  const blocked = await blockedIds(user.id);
  const wantAll = type === 'all';

  const [people, posts, groups] = await Promise.all([
    wantAll || type === 'people'
      ? prisma.user.findMany({
          where: {
            OR: [{ username: { contains: term.toLowerCase() } }, { displayName: { contains: term } }],
            id: { notIn: [user.id, ...blocked] },
          },
          take: limit,
        })
      : Promise.resolve([]),
    wantAll || type === 'posts'
      ? prisma.post.findMany({
          where: {
            contentText: { contains: term },
            visibility: 'public',
            groupId: null,
            ...(blocked.length ? { userId: { notIn: blocked } } : {}),
          },
          include: postInclude,
          orderBy: { createdAt: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),
    wantAll || type === 'groups'
      ? prisma.group.findMany({
          where: {
            privacy: 'public',
            OR: [{ name: { contains: term } }, { description: { contains: term } }],
          },
          include: { _count: { select: { members: true } } },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  const viewerFriends = new Set(await friendIds(user.id));
  const relationships = await Promise.all(
    people.map((person) => relationshipWith(user.id, person.id)),
  );
  const memberships = groups.length
    ? await prisma.groupMember.findMany({
        where: { userId: user.id, groupId: { in: groups.map((group) => group.id) } },
        select: { groupId: true },
      })
    : [];
  const joined = new Set(memberships.map((membership) => membership.groupId));

  res.json({
    query: q,
    people: people.map((person, index) => ({
      ...toPublicUser(person, { isFriend: viewerFriends.has(person.id) }),
      relationship: relationships[index]?.status ?? 'none',
      friendshipId: relationships[index]?.friendshipId ?? null,
    })),
    posts: await serializePosts(posts, user.id),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
      coverUrl: group.coverUrl,
      privacy: group.privacy,
      memberCount: group._count.members,
      maxMembers: group.maxMembers,
      isFull: group._count.members >= group.maxMembers,
      isMember: joined.has(group.id),
    })),
  });
}

/**
 * GET /api/search/trending — most-used hashtags in the last 24h.
 * A plain word count, not a recommendation engine: no personalisation, no profiling.
 */
export async function trending(req: Request, res: Response): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const posts = await prisma.post.findMany({
    where: { visibility: 'public', createdAt: { gte: since } },
    select: { contentText: true },
    take: 500,
  });

  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of extractHashtags(post.contentText)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  res.json({ items, windowHours: 24 });
}
