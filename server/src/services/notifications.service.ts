import { prisma } from '../config/database.js';
import { TOPICS, publish } from '../config/mqtt.js';
import { parseNotificationSettings } from './serialize.js';

export type NotificationType =
  | 'friend_request'
  | 'friend_accept'
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'post_share'
  | 'mention'
  | 'message'
  | 'group_invite'
  | 'group_post'
  | 'group_join'
  | 'story_reply'
  | 'missed_call';

const SETTING_FOR_TYPE: Record<NotificationType, keyof ReturnType<typeof parseNotificationSettings>> = {
  friend_request: 'friendRequests',
  friend_accept: 'friendRequests',
  post_like: 'likes',
  post_comment: 'comments',
  comment_reply: 'comments',
  post_share: 'likes',
  mention: 'mentions',
  message: 'messages',
  group_invite: 'groups',
  group_post: 'groups',
  group_join: 'groups',
  story_reply: 'stories',
  missed_call: 'calls',
};

export interface CreateNotificationInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  content: string;
  referenceId?: string;
  referenceType?: string;
}

/**
 * Persists a notification and pushes it over MQTT. Never notifies a user about their own action,
 * and respects the recipient's per-type notification preferences.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;

  const recipient = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { notificationSettings: true },
  });
  if (!recipient) return;

  const settings = parseNotificationSettings(recipient.notificationSettings);
  if (settings[SETTING_FOR_TYPE[input.type]] === false) return;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      content: input.content,
      referenceId: input.referenceId ?? '',
      referenceType: input.referenceType ?? '',
    },
    include: {
      actor: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: input.userId, isRead: false },
  });

  publish(TOPICS.userNotifications(input.userId), {
    event: 'notification',
    notification: serializeNotification(notification),
    unreadCount,
  });
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  await Promise.all(inputs.map((input) => createNotification(input)));
}

interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  referenceId: string;
  referenceType: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  actor?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  } | null;
}

export function serializeNotification(notification: NotificationRecord) {
  return {
    id: notification.id,
    type: notification.type,
    content: notification.content,
    referenceId: notification.referenceId,
    referenceType: notification.referenceType,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    actor: notification.actor ?? null,
  };
}

/** Notifies every @mentioned user that exists and is not the author. */
export async function notifyMentions(options: {
  text: string;
  actorId: string;
  actorName: string;
  referenceId: string;
  referenceType: string;
  context: string;
}): Promise<void> {
  const usernames = (options.text.match(/@[a-zA-Z0-9_]{3,30}/g) ?? []).map((m) =>
    m.slice(1).toLowerCase(),
  );
  if (usernames.length === 0) return;

  const users = await prisma.user.findMany({
    where: { username: { in: [...new Set(usernames)] } },
    select: { id: true },
  });

  await createNotifications(
    users
      .filter((user) => user.id !== options.actorId)
      .map((user) => ({
        userId: user.id,
        actorId: options.actorId,
        type: 'mention' as const,
        content: `${options.actorName} mentioned you in ${options.context}`,
        referenceId: options.referenceId,
        referenceType: options.referenceType,
      })),
  );
}
