import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { EmptyState } from '@/components/shared/EmptyState';

/** Two-pane messenger: list beside thread on desktop, one at a time on mobile. */
export default function MessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  return (
    <div className="flex h-[calc(100vh-3.5rem-4rem)] lg:h-[calc(100vh-3.5rem)]">
      <ConversationList
        activeId={conversationId}
        className={cn('w-full lg:w-80 lg:shrink-0', conversationId && 'hidden lg:flex')}
      />

      {conversationId ? (
        <ChatWindow
          key={conversationId}
          conversationId={conversationId}
          onBack={() => navigate('/messages')}
          className="flex-1"
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center bg-muted/20 lg:flex">
          <EmptyState
            icon={MessageCircle}
            title="Pick a conversation"
            description="Your messages stay on this server — no cloud provider in the middle."
          />
        </div>
      )}
    </div>
  );
}
