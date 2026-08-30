import { z } from 'zod';

const visibility = z.enum(['everyone', 'friends', 'nobody']);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be 30 characters or fewer')
  .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers and underscores only')
  .transform((value) => value.toLowerCase());

export const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20, 'Enter a valid phone number')
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number')
  .transform((value) => value.replace(/[^\d+]/g, ''));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const registerSchema = z.object({
  username: usernameSchema,
  phone: phoneSchema,
  email: z.string().trim().email('Enter a valid email').toLowerCase(),
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Tell us your name').max(60),
  securityQuestion: z.string().trim().max(140).optional().default(''),
  securityAnswer: z.string().trim().max(140).optional().default(''),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username, phone or email'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean().optional().default(false),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Missing refresh token'),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1),
});

export const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(1),
  securityAnswer: z.string().trim().min(1, 'Answer your security question'),
  newPassword: passwordSchema,
});

export const privacySchema = z.object({
  postVisibility: visibility,
  whoCanMessage: visibility,
  phoneVisibility: visibility,
  onlineStatusVisibility: visibility,
  storyVisibility: visibility,
});

export const notificationSettingsSchema = z.object({
  friendRequests: z.boolean(),
  likes: z.boolean(),
  comments: z.boolean(),
  mentions: z.boolean(),
  messages: z.boolean(),
  groups: z.boolean(),
  stories: z.boolean(),
  calls: z.boolean(),
});

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(300).optional(),
  email: z.string().trim().email('Enter a valid email').toLowerCase().optional(),
  phone: phoneSchema.optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  coverUrl: z.string().trim().max(500).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  isOnboarded: z.boolean().optional(),
  privacySettings: privacySchema.partial().optional(),
  notificationSettings: notificationSettingsSchema.partial().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: passwordSchema,
});

export const createPostSchema = z
  .object({
    contentText: z.string().trim().max(5000).optional().default(''),
    mediaUrl: z.string().trim().max(2000).optional().default(''),
    mediaType: z.enum(['', 'image', 'video', 'audio']).optional().default(''),
    linkUrl: z.string().trim().max(2000).optional().default(''),
    visibility: z.enum(['public', 'friends', 'private']).optional().default('public'),
    groupId: z.string().trim().optional(),
  })
  .refine((data) => data.contentText.length > 0 || data.mediaUrl.length > 0 || data.linkUrl.length > 0, {
    message: 'Write something or attach media before posting',
    path: ['contentText'],
  });

export const updatePostSchema = z.object({
  contentText: z.string().trim().max(5000).optional(),
  visibility: z.enum(['public', 'friends', 'private']).optional(),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Write a comment').max(2000),
  parentCommentId: z.string().trim().optional().nullable(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const createStorySchema = z.object({
  mediaUrl: z.string().trim().min(1, 'A story needs an image or video'),
  mediaType: z.enum(['image', 'video']).default('image'),
  caption: z.string().trim().max(300).optional().default(''),
  overlay: z
    .object({
      text: z.string().max(200).optional(),
      color: z.string().max(30).optional(),
      fontSize: z.number().min(10).max(96).optional(),
      x: z.number().min(0).max(100).optional(),
      y: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export const createConversationSchema = z.object({
  type: z.enum(['direct', 'group']).default('direct'),
  memberIds: z.array(z.string().min(1)).min(1, 'Choose someone to chat with').max(9),
  name: z.string().trim().max(80).optional().default(''),
});

export const createMessageSchema = z
  .object({
    content: z.string().trim().max(4000).optional().default(''),
    mediaUrl: z.string().trim().max(2000).optional().default(''),
    mediaType: z.enum(['', 'image', 'video', 'audio', 'file']).optional().default(''),
    replyToId: z.string().trim().optional().nullable(),
  })
  .refine((data) => data.content.length > 0 || data.mediaUrl.length > 0, {
    message: 'Type a message first',
    path: ['content'],
  });

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Give the group a name').max(60),
  description: z.string().trim().max(500).optional().default(''),
  avatarUrl: z.string().trim().max(500).optional().default(''),
  coverUrl: z.string().trim().max(500).optional().default(''),
  privacy: z.enum(['public', 'private']).default('public'),
  memberIds: z.array(z.string().min(1)).max(9).optional().default([]),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  coverUrl: z.string().trim().max(500).optional(),
  privacy: z.enum(['public', 'private']).optional(),
});

export const addGroupMemberSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(['member', 'moderator', 'admin']).optional().default('member'),
});

export const createCallSchema = z.object({
  receiverId: z.string().trim().min(1),
  conversationId: z.string().trim().optional().nullable(),
  type: z.enum(['voice', 'video']).default('voice'),
});

export const updateCallSchema = z.object({
  status: z.enum(['ringing', 'ongoing', 'ended', 'missed', 'rejected']),
});

export const paginationSchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const searchSchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  type: z.enum(['all', 'people', 'posts', 'groups']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const linkPreviewSchema = z.object({
  url: z.string().trim().url('Enter a valid URL'),
});
