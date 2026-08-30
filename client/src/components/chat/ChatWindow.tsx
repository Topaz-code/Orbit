import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Info, Phone, Users, Video } from 'lucide-react';
import { cn, dayLabel, lastSeenLabel, shouldGroupMessage } from '@/lib/utils';
import {
  useConversation,
  useConversationRealtime,
  useDeleteMessage,
  useMarkConversationRead,
  useMessages,
} from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';
import { usePresenceSubscriptions } from '@/hooks/usePresence';
import { useCallEngine } from '@/hooks/useCall';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSkeleton } from '@/components/shared/SkeletonLoader';
import { EmptyState } from '@/components/shared/EmptyState';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { ChatDetailsPanel } from './ChatDetailsPanel';
import type { Message } from '@/types';

export function ChatWindow({
  conversationId,
  onBack,
  className,
}: {
  conversationId: string;
  onBack?: () => void;
  className?: string;
}) {
  const { data: conversation, isLoading: loadingConversation } = useConversation(conversationId);
  const { data: messages, isLoading: loadingMessages } = useMessages(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const deleteMessage = useDeleteMessage(conversationId);
  const { startCall } = useCallEngine();

  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const typing = useChatStore((state) => state.typingByConversation[conversationId] ?? []);
  const presence = useChatStore((state) => state.presence);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useConversationRealtime(conversationId);
  usePresenceSubscriptions((conversation?.members ?? []).map((member) => member.id));

  const isGroup = conversation?.type === 'group';
  const partnerId = conversation?.partnerId ?? null;
  const partnerOnline = partnerId ? presence[partnerId]?.isOnline ?? conversation?.isOnline ?? false : false;
  const partnerLastSeen = partnerId
    ? presence[partnerId]?.lastSeen ?? conversation?.members.find((m) => m.id === partnerId)?.lastSeen ?? null
    : null;

  // Track the active thread so global toasts stay quiet while it is open.
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  // Clear the unread badge whenever the thread is open and new messages land.
  useEffect(() => {
    if (!conversationId || !messages?.length) return;
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages?.length]);

  // Keep the newest message in view unless the user has scrolled up to read history.
  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: messages && messages.length > 30 ? 'auto' : 'smooth' });
    }
  }, [messages, typing.length]);

  const groupedByDay = useMemo(() => {
    const buckets: Array<{ label: string; items: Message[] }> = [];
    for (const message of messages ?? []) {
      const label = dayLabel(message.createdAt);
      const last = buckets[buckets.length - 1];
      if (last && last.label === label) last.items.push(message);
      else buckets.push({ label, items: [message] });
    }
    return buckets;
  }, [messages]);

  if (loadingConversation) {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="h-14 border-b border-border" />
        <MessageSkeleton />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className={cn('grid h-full place-items-center', className)}>
        <EmptyState icon={Users} title="Conversation not found" description="It may have been deleted." />
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-w-0 flex-col bg-muted/20', className)}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        {onBack ? (
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Back to chats">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}

        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 text-left transition-colors hover:bg-accent/60"
        >
          <UserAvatar
            user={{ displayName: conversation.name, avatarUrl: conversation.avatarUrl, isOnline: partnerOnline }}
            size="sm"
            showStatus={!isGroup}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{conversation.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {typing.length > 0
                ? `${typing.map((entry) => entry.displayName.split(' ')[0]).join(', ')} typing…`
                : isGroup
                  ? `${conversation.memberCount} members`
                  : lastSeenLabel({ isOnline: partnerOnline, lastSeen: partnerLastSeen })}
            </span>
          </span>
        </button>

        {!isGroup && partnerId ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Voice call"
              onClick={() => {
                const partner = conversation.members.find((member) => member.id === partnerId);
                if (partner) void startCall(partner, 'voice', conversation.id);
              }}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Video call"
              onClick={() => {
                const partner = conversation.members.find((member) => member.id === partnerId);
                if (partner) void startCall(partner, 'video', conversation.id);
              }}
            >
              <Video className="h-4 w-4" />
            </Button>
          </>
        ) : null}

        <Button variant="ghost" size="icon-sm" onClick={() => setDetailsOpen(true)} aria-label="Chat details">
          <Info className="h-4 w-4" />
        </Button>
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
      >
        {loadingMessages ? (
          <MessageSkeleton />
        ) : groupedByDay.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No messages yet"
            description={`Say hello to ${conversation.name}.`}
            compact
          />
        ) : (
          groupedByDay.map((bucket) => (
            <div key={bucket.label} className="space-y-1.5">
              <div className="sticky top-0 z-10 flex justify-center py-1">
                <span className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                  {bucket.label}
                </span>
              </div>

              {bucket.items.map((message, index) => {
                const previous = bucket.items[index - 1];
                const next = bucket.items[index + 1];
                const grouped = shouldGroupMessage(message, previous);
                const showAvatar = !next || next.senderId !== message.senderId;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    grouped={grouped}
                    showAvatar={showAvatar}
                    isGroupChat={isGroup}
                    onReply={setReplyTo}
                    onDelete={(target, scope) => deleteMessage.mutate({ messageId: target.id, scope })}
                  />
                );
              })}
            </div>
          ))
        )}

        {typing.length > 0 ? <TypingIndicator names={typing.map((entry) => entry.displayName)} /> : null}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        conversationId={conversationId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      <ChatDetailsPanel
        conversation={conversation}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
