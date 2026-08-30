import { Link } from 'react-router-dom';
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Video,
} from 'lucide-react';
import { callDuration, cn, fullTimestamp, relativeTime } from '@/lib/utils';
import { useCallEngine, useCallHistory } from '@/hooks/useCall';
import { useFriends } from '@/hooks/useFriends';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Call } from '@/types';

export default function CallsPage() {
  const { data: calls, isLoading } = useCallHistory();
  const { data: friends } = useFriends();
  const { startCall } = useCallEngine();

  const onlineFriends = (friends ?? []).filter((friend) => friend.isOnline).slice(0, 8);

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-bold">Calls</h1>
          <p className="text-sm text-muted-foreground">
            Voice and video run peer-to-peer over WebRTC. Only connection setup touches this server —
            audio and video never do.
          </p>
        </header>

        <Card className="p-2">
          {isLoading ? (
            <LoadingSpinner label="Loading call history" />
          ) : calls && calls.length > 0 ? (
            <ul className="space-y-0.5">
              {calls.map((call) => (
                <CallRow
                  key={call.id}
                  call={call}
                  onCallBack={(type) => void startCall(call.peer, type, call.conversationId)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Phone}
              title="No calls yet"
              description="Start a voice or video call from any chat or profile."
              action={
                <Button asChild>
                  <Link to="/messages">Open messages</Link>
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-bold">Online now</h2>
            <p className="text-xs text-muted-foreground">Friends you can reach right away</p>
          </div>
          <div className="p-2">
            {onlineFriends.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                None of your friends are online at the moment.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {onlineFriends.map((friend) => (
                  <li key={friend.id} className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-accent/50">
                    <Link to={`/profile/${friend.username}`}>
                      <UserAvatar user={friend} size="sm" showStatus />
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{friend.displayName}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Call ${friend.displayName}`}
                      onClick={() => void startCall(friend, 'voice')}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Video call ${friend.displayName}`}
                      onClick={() => void startCall(friend, 'video')}
                    >
                      <Video className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function CallRow({ call, onCallBack }: { call: Call; onCallBack: (type: 'voice' | 'video') => void }) {
  const missed = call.isMissed || call.status === 'missed' || call.status === 'rejected';
  const DirectionIcon = missed ? PhoneMissed : call.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;

  return (
    <li className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50">
      <Link to={`/profile/${call.peer.username}`}>
        <UserAvatar user={call.peer} size="lg" showStatus />
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={`/profile/${call.peer.username}`} className="block truncate text-sm font-semibold hover:underline">
          {call.peer.displayName}
        </Link>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DirectionIcon className={cn('h-3.5 w-3.5 shrink-0', missed && 'text-destructive')} />
          <span className={cn(missed && 'text-destructive')}>
            {missed
              ? call.status === 'rejected'
                ? 'Declined'
                : 'Missed'
              : call.direction === 'incoming'
                ? 'Incoming'
                : 'Outgoing'}
          </span>
          <span aria-hidden>·</span>
          {call.type === 'video' ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
          {call.durationSeconds > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>{callDuration(call.durationSeconds)}</span>
            </>
          ) : null}
        </p>
      </div>

      <time
        dateTime={call.startedAt}
        title={fullTimestamp(call.startedAt)}
        className="shrink-0 text-[11px] text-muted-foreground"
      >
        {relativeTime(call.startedAt)}
      </time>

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button variant="ghost" size="icon-sm" onClick={() => onCallBack('voice')} aria-label="Call back">
          <Phone className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onCallBack('video')} aria-label="Video call back">
          <Video className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
