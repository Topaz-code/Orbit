import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { TOPICS, publish } from '../config/mqtt.js';
import { env } from '../config/env.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { forbidden, notFound } from '../utils/errors.js';
import { hoursFromNow, safeJsonParse } from '../utils/helpers.js';
import { friendIds } from '../services/friends.service.js';
import { parsePrivacy } from '../services/serialize.js';
import { createNotification } from '../services/notifications.service.js';
import type { createStorySchema } from '../validators/index.js';

const storyInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  views: {
    include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  },
} as const;

interface StoryRecord {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  overlay: string;
  expiresAt: Date;
  createdAt: Date;
  user: { id: string; username: string; displayName: string; avatarUrl: string };
  views: Array<{
    userId: string;
    viewedAt: Date;
    user: { id: string; username: string; displayName: string; avatarUrl: string };
  }>;
}

function serializeStory(story: StoryRecord, viewerId: string) {
  const isOwn = story.userId === viewerId;
  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    caption: story.caption,
    overlay: safeJsonParse<unknown>(story.overlay, null),
    createdAt: story.createdAt.toISOString(),
    expiresAt: story.expiresAt.toISOString(),
    author: story.user,
    isOwn,
    hasViewed: story.views.some((view) => view.userId === viewerId),
    viewCount: story.views.length,
    // Only the story owner may see who watched.
    viewers: isOwn
      ? story.views.map((view) => ({ ...view.user, viewedAt: view.viewedAt.toISOString() }))
      : [],
  };
}

/**
 * GET /api/stories — active stories from friends + self, grouped by author.
 * Expired stories are filtered here as a safety net in addition to the hourly cleanup job.
 */
export async function listStories(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const friends = await friendIds(user.id);

  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: new Date() },
      userId: { in: [user.id, ...friends] },
    },
    include: storyInclude,
    orderBy: { createdAt: 'asc' },
  });

  const visible = [] as StoryRecord[];
  const privacyCache = new Map<string, ReturnType<typeof parsePrivacy>>();
  for (const story of stories as StoryRecord[]) {
    if (story.userId === user.id) {
      visible.push(story);
      continue;
    }
    let privacy = privacyCache.get(story.userId);
    if (!privacy) {
      const author = await prisma.user.findUnique({
        where: { id: story.userId },
        select: { privacySettings: true },
      });
      privacy = parsePrivacy(author?.privacySettings);
      privacyCache.set(story.userId, privacy);
    }
    if (privacy.storyVisibility === 'nobody') continue;
    visible.push(story);
  }

  const groups = new Map<string, ReturnType<typeof serializeStory>[]>();
  for (const story of visible) {
    const list = groups.get(story.userId) ?? [];
    list.push(serializeStory(story, user.id));
    groups.set(story.userId, list);
  }

  const items = [...groups.entries()].map(([userId, group]) => ({
    userId,
    author: group[0]!.author,
    isOwn: userId === user.id,
    stories: group,
    hasUnseen: group.some((story) => !story.hasViewed),
    latestAt: group[group.length - 1]!.createdAt,
  }));

  // Own stories first, then unseen, then most recent. Ordering only — no engagement ranking.
  items.sort((a, b) => {
    if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return b.latestAt.localeCompare(a.latestAt);
  });

  res.json({ items });
}

export async function getStory(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const story = await prisma.story.findUnique({
    where: { id: req.params.id as string },
    include: storyInclude,
  });
  if (!story || story.expiresAt.getTime() < Date.now()) throw notFound('That story has expired');
  res.json({ story: serializeStory(story as StoryRecord, user.id) });
}

export async function createStory(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof createStorySchema>;

  const story = await prisma.story.create({
    data: {
      userId: user.id,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      caption: body.caption,
      overlay: body.overlay ? JSON.stringify(body.overlay) : '',
      expiresAt: hoursFromNow(env.storyTtlHours),
    },
    include: storyInclude,
  });

  publish(TOPICS.storyNew, {
    event: 'story_created',
    story: serializeStory(story as StoryRecord, user.id),
    authorId: user.id,
  });

  res.status(201).json({ story: serializeStory(story as StoryRecord, user.id) });
}

export async function viewStory(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const storyId = req.params.id as string;

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) throw notFound('That story has expired');

  if (story.userId !== user.id) {
    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId, userId: user.id } },
      create: { storyId, userId: user.id },
      update: {},
    });
  }

  const viewCount = await prisma.storyView.count({ where: { storyId } });
  res.json({ success: true, viewCount });
}

export async function deleteStory(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const story = await prisma.story.findUnique({ where: { id: req.params.id as string } });
  if (!story) throw notFound('That story no longer exists');
  if (story.userId !== user.id) throw forbidden('You can only delete your own stories');

  await prisma.story.delete({ where: { id: story.id } });
  res.json({ success: true });
}

/** POST /api/stories/:id/reply — replies land in the author's DMs. */
export async function replyToStory(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const storyId = req.params.id as string;
  const { content } = req.body as { content: string };

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: { user: { select: { id: true, displayName: true } } },
  });
  if (!story) throw notFound('That story has expired');
  if (story.userId === user.id) throw forbidden('You cannot reply to your own story');

  let conversation = await prisma.conversation.findFirst({
    where: {
      type: 'direct',
      groupId: null,
      AND: [
        { members: { some: { userId: user.id } } },
        { members: { some: { userId: story.userId } } },
      ],
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        type: 'direct',
        createdBy: user.id,
        members: {
          create: [
            { userId: user.id, role: 'member' },
            { userId: story.userId, role: 'member' },
          ],
        },
      },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user.id,
      content: `Replied to your story: ${content}`,
      mediaUrl: story.mediaUrl,
      mediaType: 'story-reply',
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  publish(TOPICS.chatMessages(conversation.id), {
    event: 'message_created',
    message: {
      id: message.id,
      conversationId: conversation.id,
      senderId: user.id,
      sender: message.sender,
      content: message.content,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      isOwn: false,
      isRead: false,
      isDeleted: false,
      replyToId: null,
      replyTo: null,
      createdAt: message.createdAt.toISOString(),
    },
  });

  await createNotification({
    userId: story.userId,
    actorId: user.id,
    type: 'story_reply',
    content: `${user.displayName} replied to your story`,
    referenceId: conversation.id,
    referenceType: 'conversation',
  });

  res.status(201).json({ success: true, conversationId: conversation.id });
}
