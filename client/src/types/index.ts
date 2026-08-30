export type Visibility = 'everyone' | 'friends' | 'nobody';
export type PostVisibility = 'public' | 'friends' | 'private';
export type Theme = 'light' | 'dark' | 'system';

export interface PrivacySettings {
  postVisibility: Visibility;
  whoCanMessage: Visibility;
  phoneVisibility: Visibility;
  onlineStatusVisibility: Visibility;
  storyVisibility: Visibility;
}

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

export interface CurrentUser extends PublicUser {
  email: string;
  phone: string;
  isOnboarded: boolean;
  theme: Theme;
  privacySettings: PrivacySettings;
  notificationSettings: NotificationSettings;
}

export type RelationshipStatus =
  | 'self'
  | 'friends'
  | 'request_sent'
  | 'request_received'
  | 'blocked'
  | 'blocked_by'
  | 'none';

export interface ProfileUser extends CurrentUser {
  stats: { posts: number; friends: number; groups: number };
  relationship: RelationshipStatus;
  friendshipId: string | null;
}

export interface PostAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isOnline?: boolean;
}

export interface MediaItem {
  url: string;
  type: string;
}

export interface LinkPreviewData {
  url: string;
  domain: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface Post {
  id: string;
  contentText: string;
  media: MediaItem[];
  mediaUrl: string;
  mediaType: string;
  linkUrl: string;
  linkPreview: LinkPreviewData | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  visibility: PostVisibility;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  group: { id: string; name: string; avatarUrl: string } | null;
  isLiked: boolean;
  isBookmarked: boolean;
  isOwn: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  author: PostAuthor;
  isOwn: boolean;
  replies: Comment[];
}

export interface Story {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  overlay: StoryOverlay | null;
  createdAt: string;
  expiresAt: string;
  author: PostAuthor;
  isOwn: boolean;
  hasViewed: boolean;
  viewCount: number;
  viewers: Array<PostAuthor & { viewedAt: string }>;
}

export interface StoryOverlay {
  text?: string;
  color?: string;
  fontSize?: number;
  x?: number;
  y?: number;
}

export interface StoryGroup {
  userId: string;
  author: PostAuthor;
  isOwn: boolean;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string;
}

export interface ConversationMember extends PostAuthor {
  role: string;
  lastReadAt: string;
  lastSeen: string | null;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatarUrl: string;
  groupId: string | null;
  partnerId: string | null;
  isOnline: boolean;
  members: ConversationMember[];
  memberCount: number;
  unreadCount: number;
  lastReadAt: string;
  lastMessage: {
    id: string;
    content: string;
    mediaType: string;
    senderId: string;
    senderName: string;
    isOwn: boolean;
    createdAt: string;
  } | null;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: PostAuthor | null;
  content: string;
  mediaUrl: string;
  mediaType: string;
  replyToId: string | null;
  replyTo: { id: string; content: string; senderName: string; mediaType: string } | null;
  isRead: boolean;
  isDeleted: boolean;
  isOwn: boolean;
  createdAt: string;
  /** Client-only: set while an optimistic message is in flight. */
  pending?: boolean;
  failed?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  coverUrl: string;
  privacy: 'public' | 'private';
  maxMembers: number;
  memberCount: number;
  postCount: number;
  isFull: boolean;
  createdAt: string;
  creator: PostAuthor;
  isMember: boolean;
  role: string | null;
  isAdmin: boolean;
  inviteCode: string | null;
}

export interface GroupMember extends PostAuthor {
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
  isSelf: boolean;
}

export interface AppNotification {
  id: string;
  type: string;
  content: string;
  referenceId: string;
  referenceType: string;
  isRead: boolean;
  createdAt: string;
  actor: PostAuthor | null;
}

export interface Call {
  id: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';
  direction: 'incoming' | 'outgoing';
  peer: PostAuthor;
  caller: PostAuthor;
  receiver: PostAuthor;
  conversationId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  isMissed: boolean;
}

export interface FriendRequest {
  id: string;
  createdAt: string;
  user: PublicUser;
}

export interface SearchUser extends PublicUser {
  relationship: RelationshipStatus;
  friendshipId: string | null;
}

export interface SearchResults {
  query: string;
  people: SearchUser[];
  posts: Post[];
  groups: Array<{
    id: string;
    name: string;
    description: string;
    avatarUrl: string;
    coverUrl: string;
    privacy: 'public' | 'private';
    memberCount: number;
    maxMembers: number;
    isFull: boolean;
    isMember: boolean;
  }>;
}

export interface PresenceState {
  userId: string;
  isOnline: boolean;
  lastSeen: string | null;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuthResponse {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
}

export interface IncomingCallPayload {
  event: string;
  callId: string;
  type: 'voice' | 'video';
  conversationId: string | null;
  peerId: string;
  caller: PostAuthor;
  startedAt: string;
}
