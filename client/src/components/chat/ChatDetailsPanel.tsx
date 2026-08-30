import { Link } from 'react-router-dom';
import { Crown, LogOut, ShieldCheck, UsersRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '@/lib/api';
import { lastSeenLabel } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';
import { toast } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { Sheet } from '@/components/ui/sheet';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { chatKeys } from '@/hooks/useChat';
import type { Conversation } from '@/types';

/** Side panel with members, presence and the leave action for group chats. */
export function ChatDetailsPanel({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const presence = useChatStore((state) => state.presence);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isGroup = conversation.type === 'group';

  const leave = async () => {
    try {
      await api.post(`/conversations/${conversation.id}/leave`);
      await queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      toast.success('You left the chat');
      onOpenChange(false);
      navigate('/messages');
    } catch (error) {
      toast.error('Could not leave', apiErrorMessage(error));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" title="Chat details">
      <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-8 text-center">
        <UserAvatar
          user={{ displayName: conversation.name, avatarUrl: conversation.avatarUrl }}
          size="3xl"
        />
        <h2 className="text-lg font-bold">{conversation.name}</h2>
        <p className="text-xs text-muted-foreground">
          {isGroup ? `${conversation.memberCount} members` : 'Direct message'}
        </p>

        {!isGroup && conversation.partnerId ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/profile/${conversation.partnerId}`}>View profile</Link>
          </Button>
        ) : null}

        {conversation.groupId ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/groups/${conversation.groupId}`}>
              <UsersRound className="h-4 w-4" />
              Open group
            </Link>
          </Button>
        ) : null}
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Members
        </h3>
        <ul className="space-y-0.5">
          {conversation.members.map((member) => {
            const online = presence[member.id]?.isOnline ?? member.isOnline ?? false;
            return (
              <li key={member.id}>
                <Link
                  to={`/profile/${member.username}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <UserAvatar user={{ ...member, isOnline: online }} size="sm" showStatus />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {member.id === currentUserId ? 'You' : member.displayName}
                      </span>
                      {member.role === 'admin' ? (
                        <Crown className="h-3 w-3 shrink-0 text-[#f59e0b]" aria-label="Admin" />
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {lastSeenLabel({ isOnline: online, lastSeen: member.lastSeen })}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <p className="flex items-start gap-2 rounded-lg bg-muted p-2.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22c55e]" />
          Messages are stored only on this server. Orbit has no analytics and no third-party trackers.
        </p>

        {isGroup ? (
          <Button variant="outline" size="sm" className="w-full text-destructive" onClick={() => void leave()}>
            <LogOut className="h-4 w-4" />
            Leave chat
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}
