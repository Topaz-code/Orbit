import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import { cn, chatTimestamp } from '@/lib/utils';
import { useConversations } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';
import { UserAvatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConversationListSkeleton } from '@/components/shared/SkeletonLoader';
import { NewChatDialog } from './NewChatDialog';
import type { Conversation } from '@/types';

export function ConversationList({
  activeId,
  className,
}: {
  activeId?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const { data: conversations, isLoading } = useConversations();
  const presence = useChatStore((state) => state.presence);
  const typingByConversation = useChatStore((state) => state.typingByConversation);
  const [term, setTerm] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return conversations ?? [];
    return (conversations ?? []).filter(
      (conversation) =>
        conversation.name.toLowerCase().includes(query) ||
        conversation.lastMessage?.content.toLowerCase().includes(query),
    );
  }, [conversations, term]);

  return (
    <div className={cn('flex h-full flex-col border-r border-border bg-card', className)}>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search chats"
            className="h-9 pl-9"
            aria-label="Search conversations"
          />
        </div>
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => setNewChatOpen(true)} aria-label="New chat">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title={term ? 'No matching chats' : 'No conversations yet'}
            description={term ? 'Try a different search.' : 'Start a chat with a friend to see it here.'}
            compact
            action={
              term ? null : (
                <Button size="sm" onClick={() => setNewChatOpen(true)}>
                  Start a chat
                </Button>
              )
            }
          />
        ) : (
          <ul>
            {filtered.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                online={
                  conversation.partnerId
                    ? presence[conversation.partnerId]?.isOnline ?? conversation.isOnline
                    : false
                }
                typing={(typingByConversation[conversation.id]?.length ?? 0) > 0}
                onSelect={() => navigate(`/messages/${conversation.id}`)}
              />
            ))}
          </ul>
        )}
      </div>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  online,
  typing,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  online: boolean;
  typing: boolean;
  onSelect: () => void;
}) {
  const preview = typing
    ? 'typing…'
    : conversation.lastMessage
      ? `${conversation.lastMessage.isOwn ? 'You: ' : conversation.type === 'group' ? `${conversation.lastMessage.senderName.split(' ')[0]}: ` : ''}${
          conversation.lastMessage.content || mediaLabel(conversation.lastMessage.mediaType)
        }`
      : 'No messages yet';

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors',
          active
            ? 'border-l-[#6366f1] bg-gradient-to-r from-[#6366f1]/10 to-transparent'
            : 'border-l-transparent hover:bg-accent/60',
        )}
      >
        <span className="relative shrink-0">
          <UserAvatar
            user={{
              displayName: conversation.name,
              avatarUrl: conversation.avatarUrl,
              isOnline: online,
            }}
            size="lg"
            showStatus={conversation.type === 'direct'}
          />
          {conversation.type === 'group' ? (
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-secondary">
              <Users className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={cn('truncate text-sm', conversation.unreadCount > 0 ? 'font-bold' : 'font-medium')}>
              {conversation.name}
            </span>
            {conversation.lastMessage ? (
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                {chatTimestamp(conversation.lastMessage.createdAt)}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'truncate text-xs',
                typing
                  ? 'font-medium text-[#22c55e]'
                  : conversation.unreadCount > 0
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground',
              )}
            >
              {preview}
            </span>
            {conversation.unreadCount > 0 ? (
              <span className="ml-auto grid h-5 min-w-[1.25rem] shrink-0 place-items-center rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-1.5 text-[11px] font-bold text-white">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function mediaLabel(mediaType: string): string {
  if (mediaType === 'image') return '📷 Photo';
  if (mediaType === 'video') return '🎥 Video';
  if (mediaType === 'audio') return '🎵 Audio';
  if (mediaType) return '📎 Attachment';
  return 'Message deleted';
}
