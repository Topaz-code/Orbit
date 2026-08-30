import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Globe, Lock, LogOut, MessageCircle, Settings, Trash2, Users } from 'lucide-react';
import { mediaUrl } from '@/lib/utils';
import { useConversations } from '@/hooks/useChat';
import {
  useDeleteGroup,
  useGroup,
  useGroupPosts,
  useJoinGroup,
  useLeaveGroup,
} from '@/hooks/useGroups';
import { PostComposer } from '@/components/feed/PostComposer';
import { PostCard } from '@/components/feed/PostCard';
import { GroupMembersPanel } from '@/components/groups/GroupMembersPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedSkeleton, ProfileSkeleton } from '@/components/shared/SkeletonLoader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const inviteCode = params.get('code') ?? undefined;

  const { data: group, isLoading, isError } = useGroup(groupId);
  const { data: posts, isLoading: postsLoading } = useGroupPosts(group?.isMember ? groupId : undefined);
  const { data: conversations } = useConversations();
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoJoined, setAutoJoined] = useState(false);

  // Arriving via an invite link joins the group straight away.
  useEffect(() => {
    if (!groupId || !inviteCode || !group || group.isMember || autoJoined) return;
    setAutoJoined(true);
    joinGroup.mutate({ groupId, code: inviteCode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, inviteCode, group?.isMember]);

  const groupChat = conversations?.find((conversation) => conversation.groupId === group?.id);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-4">
        <ProfileSkeleton />
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-16 sm:px-4">
        <EmptyState
          icon={Users}
          title="Group not available"
          description="It may be private, or it may have been deleted."
          action={
            <Button asChild>
              <Link to="/groups">Back to groups</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const PrivacyIcon = group.privacy === 'private' ? Lock : Globe;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/groups">
          <ArrowLeft className="h-4 w-4" />
          All groups
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <div className="relative h-32 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] sm:h-44">
          {group.coverUrl ? (
            <img src={mediaUrl(group.coverUrl)} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-4 p-4">
          <span className="-mt-14 grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border-4 border-card bg-muted">
            {group.avatarUrl ? (
              <img src={mediaUrl(group.avatarUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Users className="h-7 w-7 text-muted-foreground" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{group.name}</h1>
              <Badge variant={group.privacy === 'private' ? 'secondary' : 'accent'} className="gap-1">
                <PrivacyIcon className="h-3 w-3" />
                {group.privacy === 'private' ? 'Private' : 'Public'}
              </Badge>
              {group.isAdmin ? <Badge variant="brand">Admin</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {group.memberCount}/{group.maxMembers} members · {group.postCount} posts
            </p>
            {group.description ? <p className="mt-1.5 text-sm">{group.description}</p> : null}
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              Created by
              <Link to={`/profile/${group.creator.username}`} className="inline-flex items-center gap-1 hover:underline">
                <UserAvatar user={group.creator} size="xs" className="h-4 w-4" />
                {group.creator.displayName}
              </Link>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {group.isMember ? (
              <>
                {groupChat ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/messages/${groupChat.id}`}>
                      <MessageCircle className="h-4 w-4" />
                      Group chat
                    </Link>
                  </Button>
                ) : null}

                {group.isAdmin ? (
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Leave</span>
                  </Button>
                )}
              </>
            ) : group.isFull ? (
              <Button size="sm" disabled>
                Group is full
              </Button>
            ) : (
              <Button
                size="sm"
                loading={joinGroup.isPending}
                onClick={() => groupId && joinGroup.mutate({ groupId, code: inviteCode })}
              >
                Join group
              </Button>
            )}
          </div>
        </div>
      </Card>

      {group.isMember ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            <PostComposer groupId={group.id} />

            {postsLoading ? (
              <FeedSkeleton count={2} />
            ) : posts && posts.length > 0 ? (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <Card>
                <EmptyState
                  icon={Settings}
                  title="No posts in this group yet"
                  description="Be the first to share something with the group."
                />
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <div className="sticky top-[4.5rem]">
              <GroupMembersPanel group={group} />
            </div>
          </aside>
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Lock}
            title="Join to see the conversation"
            description={
              group.privacy === 'private'
                ? 'This group is invite-only. Ask an admin for a link.'
                : 'Posts and members are visible to group members.'
            }
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Leave ${group.name}?`}
        description="You will lose access to its posts and group chat. You can rejoin if it is public."
        confirmLabel="Leave group"
        destructive
        loading={leaveGroup.isPending}
        onConfirm={() =>
          groupId &&
          leaveGroup.mutate(groupId, {
            onSuccess: () => {
              setConfirmLeave(false);
              navigate('/groups');
            },
          })
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${group.name}?`}
        description="This permanently removes the group, its posts and its chat for everyone."
        confirmLabel="Delete group"
        destructive
        loading={deleteGroup.isPending}
        onConfirm={() =>
          groupId &&
          deleteGroup.mutate(groupId, {
            onSuccess: () => {
              setConfirmDelete(false);
              navigate('/groups');
            },
          })
        }
      />
    </div>
  );
}
