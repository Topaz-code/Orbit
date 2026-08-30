import { useState } from 'react';
import { Compass, Plus, UsersRound } from 'lucide-react';
import { MAX_GROUP_MEMBERS } from '@/lib/constants';
import { useDiscoverGroups, useMyGroups } from '@/hooks/useGroups';
import { GroupCard } from '@/components/groups/GroupCard';
import { CreateGroupDialog } from '@/components/groups/CreateGroupDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function GroupsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: myGroups, isLoading: mineLoading } = useMyGroups();
  const { data: discover, isLoading: discoverLoading } = useDiscoverGroups();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Small on purpose — every group holds up to {MAX_GROUP_MEMBERS} people and comes with its own chat.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create group
        </Button>
      </header>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">
            <UsersRound className="h-4 w-4" />
            Your groups {myGroups?.length ? `(${myGroups.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="discover">
            <Compass className="h-4 w-4" />
            Discover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          {mineLoading ? (
            <CardGridSkeleton count={4} />
          ) : myGroups && myGroups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myGroups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={UsersRound}
                title="You are not in any groups yet"
                description="Create one for your close friends, or browse the public groups on this server."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create your first group
                  </Button>
                }
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="discover">
          {discoverLoading ? (
            <CardGridSkeleton count={6} />
          ) : discover && discover.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discover.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={Compass}
                title="No public groups to join"
                description="Every public group on this server already has you in it."
              />
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
