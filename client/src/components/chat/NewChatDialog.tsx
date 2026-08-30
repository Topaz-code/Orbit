import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_GROUP_MEMBERS } from '@/lib/constants';
import { useFriends } from '@/hooks/useFriends';
import { useCreateConversation } from '@/hooks/useChat';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Pick one friend for a DM, or several for a group chat (capped at 10 including you). */
export function NewChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: friends, isLoading } = useFriends();
  const createConversation = useCreateConversation();

  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return friends ?? [];
    return (friends ?? []).filter(
      (friend) =>
        friend.displayName.toLowerCase().includes(query) || friend.username.toLowerCase().includes(query),
    );
  }, [friends, term]);

  const isGroup = selected.length > 1;
  const atCapacity = selected.length >= MAX_GROUP_MEMBERS - 1;

  const reset = () => {
    setTerm('');
    setSelected([]);
    setGroupName('');
  };

  const submit = () => {
    if (selected.length === 0) return;
    createConversation.mutate(
      {
        memberIds: selected,
        type: isGroup ? 'group' : 'direct',
        name: isGroup ? groupName.trim() || 'Group chat' : '',
      },
      {
        onSuccess: (data) => {
          reset();
          onOpenChange(false);
          navigate(`/messages/${data.conversation.id}`);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Choose one friend for a direct message, or several to start a group chat (max{' '}
            {MAX_GROUP_MEMBERS} people).
          </DialogDescription>
        </DialogHeader>

        {isGroup ? (
          <Input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Group chat name"
            maxLength={80}
            aria-label="Group chat name"
          />
        ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search friends"
            className="pl-9"
            aria-label="Search friends"
          />
        </div>

        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={term ? 'No friends match' : 'No friends yet'}
              description={term ? 'Try another name.' : 'Add friends to start chatting.'}
              compact
            />
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((friend) => {
                const checked = selected.includes(friend.id);
                const disabled = !checked && atCapacity;
                return (
                  <li key={friend.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setSelected((current) =>
                          checked ? current.filter((id) => id !== friend.id) : [...current, friend.id],
                        )
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                        checked ? 'bg-accent' : 'hover:bg-accent/60',
                        disabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <UserAvatar user={friend} size="sm" showStatus />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{friend.displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">@{friend.username}</span>
                      </span>
                      <span
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors',
                          checked
                            ? 'border-transparent bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white'
                            : 'border-border',
                        )}
                      >
                        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.length === 0} loading={createConversation.isPending}>
            {isGroup ? `Create group (${selected.length + 1})` : 'Start chat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
