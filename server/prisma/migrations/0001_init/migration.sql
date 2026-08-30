-- Orbit initial schema (SQLite)
-- This file is the canonical DDL. `npm run db:migrate` applies it with better-sqlite3,
-- which keeps setup working on machines that cannot reach Prisma's engine CDN.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "bio" TEXT NOT NULL DEFAULT '',
  "avatarUrl" TEXT NOT NULL DEFAULT '',
  "coverUrl" TEXT NOT NULL DEFAULT '',
  "securityQuestion" TEXT NOT NULL DEFAULT '',
  "securityAnswerHash" TEXT NOT NULL DEFAULT '',
  "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
  "privacySettings" TEXT NOT NULL DEFAULT '{}',
  "notificationSettings" TEXT NOT NULL DEFAULT '{}',
  "theme" TEXT NOT NULL DEFAULT 'system',
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");

CREATE TABLE IF NOT EXISTS "groups" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "avatarUrl" TEXT NOT NULL DEFAULT '',
  "coverUrl" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL,
  "maxMembers" INTEGER NOT NULL DEFAULT 10,
  "privacy" TEXT NOT NULL DEFAULT 'public',
  "inviteCode" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "groups_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "groups_inviteCode_key" ON "groups"("inviteCode");

CREATE TABLE IF NOT EXISTS "posts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "groupId" TEXT,
  "contentText" TEXT NOT NULL DEFAULT '',
  "mediaUrl" TEXT NOT NULL DEFAULT '',
  "mediaType" TEXT NOT NULL DEFAULT '',
  "linkUrl" TEXT NOT NULL DEFAULT '',
  "linkPreview" TEXT NOT NULL DEFAULT '',
  "likesCount" INTEGER NOT NULL DEFAULT 0,
  "commentsCount" INTEGER NOT NULL DEFAULT 0,
  "sharesCount" INTEGER NOT NULL DEFAULT 0,
  "visibility" TEXT NOT NULL DEFAULT 'public',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "posts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "posts_createdAt_idx" ON "posts"("createdAt");
CREATE INDEX IF NOT EXISTS "posts_userId_idx" ON "posts"("userId");
CREATE INDEX IF NOT EXISTS "posts_groupId_idx" ON "posts"("groupId");

CREATE TABLE IF NOT EXISTS "comments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentCommentId" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "comments_postId_idx" ON "comments"("postId");

CREATE TABLE IF NOT EXISTS "likes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "likes_userId_postId_key" ON "likes"("userId", "postId");

CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bookmarks_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_userId_postId_key" ON "bookmarks"("userId", "postId");

CREATE TABLE IF NOT EXISTS "stories" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL DEFAULT 'image',
  "caption" TEXT NOT NULL DEFAULT '',
  "overlay" TEXT NOT NULL DEFAULT '',
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "stories_expiresAt_idx" ON "stories"("expiresAt");

CREATE TABLE IF NOT EXISTS "story_views" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "story_views_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "story_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "story_views_storyId_userId_key" ON "story_views"("storyId", "userId");

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL DEFAULT 'direct',
  "name" TEXT NOT NULL DEFAULT '',
  "avatarUrl" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL,
  "groupId" TEXT,
  "maxMembers" INTEGER NOT NULL DEFAULT 10,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_groupId_key" ON "conversations"("groupId");

CREATE TABLE IF NOT EXISTS "conversation_members" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_members_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_members_conversationId_userId_key" ON "conversation_members"("conversationId", "userId");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "mediaUrl" TEXT NOT NULL DEFAULT '',
  "mediaType" TEXT NOT NULL DEFAULT '',
  "replyToId" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "deletedForAll" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

CREATE TABLE IF NOT EXISTS "group_members" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "group_members_groupId_userId_key" ON "group_members"("groupId", "userId");

CREATE TABLE IF NOT EXISTS "friendships" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requesterId" TEXT NOT NULL,
  "addresseeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_requesterId_addresseeId_key" ON "friendships"("requesterId", "addresseeId");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL DEFAULT '',
  "referenceType" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "calls" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "callerId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "conversationId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'voice',
  "status" TEXT NOT NULL DEFAULT 'ringing',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
  CONSTRAINT "calls_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "calls_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "calls_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "calls_callerId_idx" ON "calls"("callerId");
CREATE INDEX IF NOT EXISTS "calls_receiverId_idx" ON "calls"("receiverId");

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
