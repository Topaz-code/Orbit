import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Crown, Shield, UserMinus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_GROUP_MEMBERS } from '@/lib/constants';
import {
  useAddGroupMember,
  useGroupMembers,
  useRemoveGroupMember,
  useUpdateGroupMemberRole,
} from '@/hooks/useGroups';
import { useFriends } from '@/hooks/useFriends';
import { toast } from '@/stores/notificationStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Group, GroupMember } from '@/types';

export function GroupMembersPanel({ group }: { group: Group }) {
  const { data: members } = useGroupMembers(group.id);
  const { data: friends } = useFriends();
  const addMember = useAddGroupMember(group.id);
  const removeMember = useRemoveGroupMember(group.id);
  const updateRole = useUpdateGroupMemberRole(group.id);
  const [confirmRemove, setConfirmRemove] = useState<GroupMember | null>(null);

  const memberIds = new Set((members ?? []).map((member) => member.id));
  const invitable = (friends ?? []).filter((friend) => !memberIds.has(friend.id));
  const slotsLeft = group.maxMembers - (members?.length ?? 0);

  const copyInvite = () => {
    if (!group.inviteCode) return;
    const url = `${window.location.origin}/groups/${group.id}?code=${group.inviteCode}`;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success('Invite link copied'))
      .catch(() => toast.error('Could not copy', url));
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">
          Members <span className="font-normal text-muted-foreground">({members?.length ?? 0}/{group.maxMembers})</span>
        </h2>
        {group.isAdmin && group.inviteCode ? (
          <Button variant="ghost" size="sm" onClick={copyInvite}>
            <Copy className="h-3.5 w-3.5" />
            Invite link
          </Button>
        ) : null}
      </div>

      {slotsLeft <= 0 ? (
        <p className="mb-3 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
          This group is full. Orbit caps every group at {MAX_GROUP_MEMBERS} people so conversations
          stay personal.
        </p>
      ) : null}

      <ul className="space-y-0.5">
        {(members ?? []).map((member) => (
          <li key={member.id} className="group flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-accent/50">
            <Link to={`/profile/${member.username}`}>
              <UserAvatar user={member} size="sm" showStatus />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/profile/${member.username}`} className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium hover:underline">
                  {member.isSelf ? 'You' : member.displayName}
                </span>
                {member.role === 'admin' ? (
                  <Crown className="h-3 w-3 shrink-0 text-[#f59e0b]" aria-label="Admin" />
                ) : member.role === 'moderator' ? (
                  <Shield className="h-3 w-3 shrink-0 text-[#06b6d4]" aria-label="Moderator" />
                ) : null}
              </Link>
              <p className="truncate text-[11px] text-muted-foreground">@{member.username}</p>
            </div>

            {group.isAdmin && !member.isSelf ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Manage ${member.displayName}`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onSelect={() =>
                      updateRole.mutate({
                        userId: member.id,
                        role: member.role === 'moderator' ? 'member' : 'moderator',
                      })
                    }
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    {member.role === 'moderator' ? 'Remove moderator' : 'Make moderator'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmRemove(member)}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Remove from group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                {member.role}
              </Badge>
            )}
          </li>
        ))}
      </ul>

      {group.isAdmin && invitable.length > 0 && slotsLeft > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invite friends
          </h3>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {invitable.map((friend) => (
              <li key={friend.id} className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-accent/50">
                <UserAvatar user={friend} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{friend.displayName}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  loading={addMember.isPending}
                  onClick={() => addMember.mutate({ userId: friend.id })}
                  aria-label={`Add ${friend.displayName}`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.displayName ?? 'this member'}?`}
        description="They will lose access to the group and its chat."
        confirmLabel="Remove"
        destructive
        loading={removeMember.isPending}
        onConfirm={() => {
          if (confirmRemove) {
            removeMember.mutate(confirmRemove.id, { onSuccess: () => setConfirmRemove(null) });
          }
        }}
      />

      <p className={cn('mt-3 text-[11px] text-muted-foreground')}>
        Group size is enforced by the server, not just this screen.
      </p>
    </Card>
  );
}
