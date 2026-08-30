import type { PostVisibility, Visibility } from '@/types';
import { Globe, Lock, Users } from 'lucide-react';

export const APP_NAME = 'Orbit';
export const APP_TAGLINE = 'Break free. Stay connected.';

export const MAX_GROUP_MEMBERS = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const STORY_DURATION_MS = 5000;

export const VISIBILITY_OPTIONS: Array<{
  value: PostVisibility;
  label: string;
  description: string;
  icon: typeof Globe;
}> = [
  { value: 'public', label: 'Public', description: 'Anyone on this Orbit', icon: Globe },
  { value: 'friends', label: 'Friends only', description: 'Only people you have added', icon: Users },
  { value: 'private', label: 'Only me', description: 'Visible to you alone', icon: Lock },
];

export const PRIVACY_CHOICES: Array<{ value: Visibility; label: string }> = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'nobody', label: 'Nobody' },
];

export const EMOJI_GROUPS: Array<{ name: string; emojis: string[] }> = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😍', '🥰', '😘', '😗', '🤪', '😝', '🤗', '🤔', '🤨', '😐', '😴', '🥳', '😎', '🤓', '🥺', '😢', '😭', '😤', '😡'],
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '🙏', '💪', '👀', '🫶', '🤝', '✋', '👋'],
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❤️‍🔥', '💯', '✨', '⭐', '🔥', '🎉', '🎊'],
  },
  {
    name: 'Life',
    emojis: ['☕', '🍕', '🍔', '🍰', '🍪', '🎂', '🍎', '🥑', '🏃', '⚽', '🎮', '🎧', '🎵', '🎸', '🎹', '📸', '🎨', '📚', '💻', '🚀', '🌙', '🌞', '🌧️', '🏔️', '🌊', '🐶', '🐱'],
  },
];

export const NOTIFICATION_LABELS: Record<string, string> = {
  friend_request: 'Friend request',
  friend_accept: 'Friend accepted',
  post_like: 'Like',
  post_comment: 'Comment',
  comment_reply: 'Reply',
  post_share: 'Share',
  mention: 'Mention',
  message: 'Message',
  group_invite: 'Group invite',
  group_post: 'Group post',
  group_join: 'New member',
  story_reply: 'Story reply',
  missed_call: 'Missed call',
};

export const NOTIFICATION_PREFERENCES: Array<{
  key: keyof import('@/types').NotificationSettings;
  label: string;
  description: string;
}> = [
  { key: 'friendRequests', label: 'Friend requests', description: 'When someone adds you or accepts your request' },
  { key: 'likes', label: 'Likes', description: 'When someone likes or shares your post' },
  { key: 'comments', label: 'Comments', description: 'Comments and replies on your posts' },
  { key: 'mentions', label: 'Mentions', description: 'When someone @mentions you' },
  { key: 'messages', label: 'Messages', description: 'New direct and group messages' },
  { key: 'groups', label: 'Groups', description: 'Invites, new members and group posts' },
  { key: 'stories', label: 'Stories', description: 'Replies to your stories' },
  { key: 'calls', label: 'Calls', description: 'Missed and declined calls' },
];

/** Google's public STUN servers — the only external network dependency, used for NAT traversal. */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
