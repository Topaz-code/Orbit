import { Link } from 'react-router-dom';
import { Check, Clock, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresenceOf } from '@/hooks/usePresence';
import {
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useSendFriendRequest,
} from '@/hooks/useFriends';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import type { PublicUser, RelationshipStatus } from '@/types';

/** Compact person card used by suggestions, search results and friend lists. */
export function UserCard({
  user,
  relationship = 'none',
  requestId,
  className,
  variant = 'card',
}: {
  user: PublicUser;
  relationship?: RelationshipStatus;
  /** When present, renders accept/decline buttons for an incoming request. */
  requestId?: string;
  className?: string;
  variant?: 'card' | 'row';
}) {
  const online = usePresenceOf(user.id, user.isOnline);
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const rejectRequest = useRejectFriendRequest();

  const actions = requestId ? (
    <div className="flex gap-1.5">
      <Button
        size="sm"
        className="flex-1"
        loading={acceptRequest.isPending}
        onClick={() => acceptRequest.mutate(requestId)}
      >
        <Check className="h-4 w-4" />
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={rejectRequest.isPending}
        onClick={() => rejectRequest.mutate(requestId)}
        aria-label="Decline request"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  ) : relationship === 'friends' ? (
    <Button size="sm" variant="outline" className="w-full" asChild>
      <Link to={`/profile/${user.username}`}>View profile</Link>
    </Button>
  ) : relationship === 'request_sent' ? (
    <Button size="sm" variant="outline" className="w-full" disabled>
      <Clock className="h-4 w-4" />
      Requested
    </Button>
  ) : relationship === 'self' ? null : (
    <Button
      size="sm"
      className="w-full"
      loading={sendRequest.isPending}
      onClick={() => sendRequest.mutate(user.id)}
    >
      <UserPlus className="h-4 w-4" />
      Add friend
    </Button>
  );

  if (variant === 'row') {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50', className)}>
        <Link to={`/profile/${user.username}`}>
          <UserAvatar user={{ ...user, isOnline: online }} size="lg" showStatus />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/profile/${user.username}`} className="block truncate text-sm font-semibold hover:underline">
            {user.displayName}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {user.bio || `@${user.username}`}
          </p>
        </div>
        <div className="shrink-0">{actions}</div>
      </div>
    );
  }

  return (
    <Card className={cn('flex flex-col items-center gap-2 p-4 text-center', className)}>
      <Link to={`/profile/${user.username}`}>
        <UserAvatar user={{ ...user, isOnline: online }} size="2xl" showStatus />
      </Link>
      <div className="min-w-0 w-full">
        <Link to={`/profile/${user.username}`} className="block truncate font-semibold hover:underline">
          {user.displayName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
        {user.bio ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{user.bio}</p> : null}
      </div>
      <div className="mt-auto w-full pt-1">{actions}</div>
    </Card>
  );
}
