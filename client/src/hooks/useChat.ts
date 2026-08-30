import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { publish, subscribe, topics } from '@/lib/mqtt';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { toast } from '@/stores/notificationStore';
import { useMqttSubscription } from './useMQTT';
import type { Conversation, Message } from '@/types';

export const chatKeys = {
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversations', id] as const,
  messages: (id: string) => ['conversations', id, 'messages'] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: async () => {
      const response = await api.get<{ items: Conversation[] }>('/conversations');
      return response.data.items;
    },
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.conversation(conversationId ?? ''),
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const response = await api.get<{ conversation: Conversation }>(`/conversations/${conversationId}`);
      return response.data.conversation;
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId ?? ''),
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const response = await api.get<{ items: Message[] }>(`/conversations/${conversationId}/messages`, {
        params: { limit: 60 },
      });
      return response.data.items;
    },
  });
}

export interface SendMessageInput {
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  replyToId?: string | null;
}

/** Sends a message with an optimistic bubble that reconciles once the server responds. */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const response = await api.post<{ message: Message }>(
        `/conversations/${conversationId}/messages`,
        input,
      );
      return response.data.message;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(conversationId) });
      const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const optimistic: Message = {
        id: tempId,
        conversationId,
        senderId: currentUser?.id ?? '',
        sender: currentUser
          ? {
              id: currentUser.id,
              username: currentUser.username,
              displayName: currentUser.displayName,
              avatarUrl: currentUser.avatarUrl,
            }
          : null,
        content: input.content,
        mediaUrl: input.mediaUrl ?? '',
        mediaType: input.mediaType ?? '',
        replyToId: input.replyToId ?? null,
        replyTo: null,
        isRead: false,
        isDeleted: false,
        isOwn: true,
        createdAt: new Date().toISOString(),
        pending: true,
      };

      queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) => [
        ...(data ?? []),
        optimistic,
      ]);

      return { tempId };
    },
    onSuccess: (message, _input, context) => {
      queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) =>
        (data ?? []).map((item) => (item.id === context?.tempId ? message : item)),
      );
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
    onError: (error, _input, context) => {
      // Keep the bubble but flag it so the user can retry rather than losing their text.
      queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) =>
        (data ?? []).map((item) =>
          item.id === context?.tempId ? { ...item, pending: false, failed: true } : item,
        ),
      );
      toast.error('Message not sent', apiErrorMessage(error));
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberIds: string[]; type?: 'direct' | 'group'; name?: string }) => {
      const response = await api.post<{ conversation: { id: string }; existing: boolean }>(
        '/conversations',
        { type: input.type ?? 'direct', memberIds: input.memberIds, name: input.name ?? '' },
      );
      return response.data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chatKeys.conversations }),
    onError: (error) => toast.error('Could not start chat', apiErrorMessage(error)),
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, scope }: { messageId: string; scope: 'me' | 'all' }) => {
      await api.delete(`/messages/${messageId}`, { params: { scope } });
      return { messageId, scope };
    },
    onSuccess: ({ messageId, scope }) => {
      queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) => {
        if (!data) return data;
        if (scope === 'all') {
          return data.map((message) =>
            message.id === messageId
              ? { ...message, isDeleted: true, content: '', mediaUrl: '', mediaType: '' }
              : message,
          );
        }
        return data.filter((message) => message.id !== messageId);
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
    onError: (error) => toast.error('Could not delete message', apiErrorMessage(error)),
  });
}

export function useMarkConversationRead(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      await api.put(`/conversations/${conversationId}/read`);
    },
    onSuccess: () => {
      queryClient.setQueryData<Conversation[]>(chatKeys.conversations, (data) =>
        data?.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
        ),
      );
    },
  });
}

/** Publishes throttled typing events; automatically emits "stopped" after a pause. */
export function useTypingPublisher(conversationId: string | undefined) {
  const currentUser = useAuthStore((state) => state.user);
  const lastSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = useCallback(
    (isTyping: boolean) => {
      if (!conversationId || !currentUser) return;
      publish(topics.chatTyping(conversationId), {
        userId: currentUser.id,
        displayName: currentUser.displayName,
        isTyping,
      });
    },
    [conversationId, currentUser],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current > 2000) {
      lastSent.current = now;
      emit(true);
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      lastSent.current = 0;
      emit(false);
    }, 2500);
  }, [emit]);

  const stopTyping = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    lastSent.current = 0;
    emit(false);
  }, [emit]);

  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
  }, []);

  return { notifyTyping, stopTyping };
}

/** Wires a conversation's MQTT topics (messages, typing, read receipts) into the caches. */
export function useConversationRealtime(conversationId: string | undefined): void {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const setTyping = useChatStore((state) => state.setTyping);
  const setReadReceipt = useChatStore((state) => state.setReadReceipt);

  useMqttSubscription(
    conversationId ? topics.chatMessages(conversationId) : null,
    (payload: { event: string; message?: Message; messageId?: string }) => {
      if (!conversationId) return;

      if (payload.event === 'message_created' && payload.message) {
        const incoming = payload.message;
        if (incoming.senderId === currentUserId) return; // our own echo
        queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) => {
          const list = data ?? [];
          if (list.some((message) => message.id === incoming.id)) return list;
          return [...list, { ...incoming, isOwn: false }];
        });
        void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      }

      if (payload.event === 'message_deleted' && payload.messageId) {
        queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) =>
          data?.map((message) =>
            message.id === payload.messageId
              ? { ...message, isDeleted: true, content: '', mediaUrl: '', mediaType: '' }
              : message,
          ),
        );
      }

      if (payload.event === 'message_removed' && payload.messageId) {
        queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) =>
          data?.filter((message) => message.id !== payload.messageId),
        );
      }
    },
    Boolean(conversationId),
  );

  useMqttSubscription(
    conversationId ? topics.chatTyping(conversationId) : null,
    (payload: { userId: string; displayName: string; isTyping: boolean }) => {
      if (!conversationId || !payload?.userId || payload.userId === currentUserId) return;
      setTyping(
        conversationId,
        { userId: payload.userId, displayName: payload.displayName, at: Date.now() },
        payload.isTyping,
      );
    },
    Boolean(conversationId),
  );

  useMqttSubscription(
    conversationId ? topics.chatRead(conversationId) : null,
    (payload: { userId: string; readAt: string }) => {
      if (!conversationId || !payload?.userId || payload.userId === currentUserId) return;
      setReadReceipt(conversationId, payload.userId, payload.readAt);
      // Mark our sent messages as read so the double-ticks turn blue.
      queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (data) =>
        data?.map((message) => (message.isOwn ? { ...message, isRead: true } : message)),
      );
    },
    Boolean(conversationId),
  );
}

/** Global chat listener: raises toasts for messages that arrive outside the open conversation. */
export function useGlobalChatNotifications(): void {
  const queryClient = useQueryClient();
  const { data: conversations } = useConversations();
  const activeId = useChatStore((state) => state.activeConversationId);
  const currentUserId = useAuthStore((state) => state.user?.id);

  // Refs keep the effect from re-subscribing every time the active chat changes.
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  const conversationKey = (conversations ?? []).map((conversation) => conversation.id).join(',');

  useEffect(() => {
    if (!currentUserId || !conversationKey) return;
    const ids = conversationKey.split(',').filter(Boolean);
    const names = new Map((conversations ?? []).map((c) => [c.id, c.name]));

    const unsubscribers = ids.map((conversationId) =>
      subscribe(topics.chatMessages(conversationId), (raw) => {
        const payload = raw as { event: string; message?: Message };
        if (payload.event !== 'message_created' || !payload.message) return;
        if (payload.message.senderId === currentUserId) return;

        void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });

        // Suppress the toast when the user is already looking at that thread.
        if (activeRef.current === conversationId) return;
        toast.message({
          title: payload.message.sender?.displayName ?? names.get(conversationId) ?? 'New message',
          description: payload.message.content || 'Sent an attachment',
          avatarUrl: payload.message.sender?.avatarUrl,
          href: `/messages/${conversationId}`,
        });
      }),
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationKey, currentUserId, queryClient]);
}
