import { safeJsonParse } from '../utils/helpers.js';
import { isUserOnline } from './presence.service.js';

export interface PrivacySettings {
  postVisibility: 'everyone' | 'friends' | 'nobody';
  whoCanMessage: 'everyone' | 'friends' | 'nobody';
  phoneVisibility: 'everyone' | 'friends' | 'nobody';
  onlineStatusVisibility: 'everyone' | 'friends' | 'nobody';
  storyVisibility: 'everyone' | 'friends' | 'nobody';
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  postVisibility: 'everyone',
  whoCanMessage: 'everyone',
  phoneVisibility: 'friends',
  onlineStatusVisibility: 'everyone',
  storyVisibility: 'friends',
};

export interface NotificationSettings {
  friendRequests: boolean;
  likes: boolean;
  comments: boolean;
  mentions: boolean;
  messages: boolean;
  groups: boolean;
  stories: boolean;
  calls: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  friendRequests: true,
  likes: true,
  comments: true,
  mentions: true,
  messages: true,
  groups: true,
  stories: true,
  calls: true,
};

export function parsePrivacy(json: string | null | undefined): PrivacySettings {
  return { ...DEFAULT_PRIVACY, ...safeJsonParse<Partial<PrivacySettings>>(json, {}) };
}

export function parseNotificationSettings(json: string | null | undefined): NotificationSettings {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...safeJsonParse<Partial<NotificationSettings>>(json, {}),
  };
}

interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  coverUrl?: string;
  bio?: string;
  phone?: string;
  email?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  createdAt?: Date;
  privacySettings?: string;
  notificationSettings?: string;
  theme?: string;
  isOnboarded?: boolean;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  coverUrl: string;
  bio: string;
  isOnline: boolean;
  lastSeen: string | null;
  createdAt: string | null;
  phone?: string;
  email?: string;
}

/** Trims a user record for public consumption, honouring privacy settings. */
export function toPublicUser(
  user: UserRecord,
  options: { isSelf?: boolean; isFriend?: boolean } = {},
): PublicUser {
  const privacy = parsePrivacy(user.privacySettings);
  const { isSelf = false, isFriend = false } = options;

  const canSee = (setting: 'everyone' | 'friends' | 'nobody'): boolean => {
    if (isSelf) return true;
    if (setting === 'everyone') return true;
    if (setting === 'friends') return isFriend;
    return false;
  };

  const online = user.isOnline ?? isUserOnline(user.id);

  const result: PublicUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl ?? '',
    bio: user.bio ?? '',
    isOnline: canSee(privacy.onlineStatusVisibility) ? online : false,
    lastSeen: canSee(privacy.onlineStatusVisibility) ? (user.lastSeen?.toISOString() ?? null) : null,
    createdAt: user.createdAt?.toISOString() ?? null,
  };

  if (canSee(privacy.phoneVisibility) && user.phone) result.phone = user.phone;
  if (isSelf && user.email) result.email = user.email;

  return result;
}

/** Full self-profile including settings — only ever returned to the owner. */
export function toSelfUser(user: UserRecord & { privacySettings?: string }) {
  return {
    ...toPublicUser(user, { isSelf: true }),
    email: user.email ?? '',
    phone: user.phone ?? '',
    isOnboarded: user.isOnboarded ?? false,
    theme: user.theme ?? 'system',
    privacySettings: parsePrivacy(user.privacySettings),
    notificationSettings: parseNotificationSettings(user.notificationSettings),
  };
}
