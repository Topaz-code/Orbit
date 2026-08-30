import { useMemo, useState } from 'react';
import { Ban, Search, UserCheck, UserPlus, Users } from 'lucide-react';
import {
  useBlockedUsers,
  useFriendRequests,
  useFriends,
  useSuggestions,
  useUnblockUser,
} from '@/hooks/useFriends';
import { UserCard } from '@/components/profile/UserCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoader';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FriendsPage() {
  const [tab, setTab] = useState('all');
  const [term, setTerm] = useState('');

  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: requests, isLoading: requestsLoading } = useFriendRequests();
  const { data: suggestions, isLoading: suggestionsLoading } = useSuggestions();
  const { data: blocked } = useBlockedUsers();
  const unblockUser = useUnblockUser();

  const filteredFriends = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return friends ?? [];
    return (friends ?? []).filter(
      (friend) =>
        friend.displayName.toLowerCase().includes(query) || friend.username.toLowerCase().includes(query),
    );
  }, [friends, term]);

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-4 sm:px-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Friends</h1>
        <p className="text-sm text-muted-foreground">
          Friendships are mutual on Orbit — there are no followers and no follower counts.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            <Users className="h-4 w-4" />
            All <span className="hidden sm:inline">friends</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 gap-1.5">
            <UserCheck className="h-4 w-4" />
            Requests
            {incoming.length > 0 ? (
              <Badge variant="brand" className="h-4 px-1.5 text-[10px]">
                {incoming.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex-1">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Suggestions</span>
            <span className="sm:hidden">Find</span>
          </TabsTrigger>
          <TabsTrigger value="blocked" className="flex-1">
            <Ban className="h-4 w-4" />
            <span className="hidden sm:inline">Blocked</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search your friends"
              className="pl-9"
              aria-label="Search friends"
            />
          </div>

          {friendsLoading ? (
            <CardGridSkeleton count={6} />
          ) : filteredFriends.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title={term ? 'No friends match that search' : 'No friends yet'}
                description={term ? 'Try a different name.' : 'Send a few friend requests to get started.'}
                action={
                  term ? null : (
                    <Button onClick={() => setTab('suggestions')}>See suggestions</Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredFriends.map((friend) => (
                <UserCard key={friend.id} user={friend} relationship="friends" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-5">
          <section className="space-y-2">
            <h2 className="text-sm font-bold">
              Received {incoming.length > 0 ? `(${incoming.length})` : ''}
            </h2>
            {requestsLoading ? (
              <CardGridSkeleton count={3} />
            ) : incoming.length === 0 ? (
              <Card>
                <EmptyState icon={UserCheck} title="No pending requests" compact />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {incoming.map((request) => (
                  <UserCard key={request.id} user={request.user} requestId={request.id} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold">Sent {outgoing.length > 0 ? `(${outgoing.length})` : ''}</h2>
            {outgoing.length === 0 ? (
              <Card>
                <EmptyState icon={UserPlus} title="No requests waiting for a reply" compact />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {outgoing.map((request) => (
                  <UserCard key={request.id} user={request.user} relationship="request_sent" />
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="suggestions">
          {suggestionsLoading ? (
            <CardGridSkeleton count={8} />
          ) : suggestions && suggestions.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {suggestions.map((person) => (
                <UserCard key={person.id} user={person} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={UserPlus}
                title="No suggestions right now"
                description="Suggestions are simply people you have not connected with yet — not a targeting model."
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="blocked">
          {blocked && blocked.length > 0 ? (
            <Card className="p-2">
              <ul className="space-y-0.5">
                {blocked.map((entry) => (
                  <li key={entry.friendshipId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/50">
                    <UserAvatar user={entry.user} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{entry.user.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{entry.user.username}</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={unblockUser.isPending}
                      onClick={() => unblockUser.mutate(entry.user.id)}
                    >
                      Unblock
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={Ban}
                title="No blocked accounts"
                description="Blocked people cannot message you, see your posts or find your profile."
              />
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
