import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Image as ImageIcon, Newspaper, UserRound, Users, UsersRound } from 'lucide-react';
import { mediaUrl } from '@/lib/utils';
import { useProfile, useProfileFriends, useProfileGroups, useProfileMedia, useProfilePosts } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/authStore';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { UserCard } from '@/components/profile/UserCard';
import { PostCard } from '@/components/feed/PostCard';
import { PostComposer } from '@/components/feed/PostComposer';
import { GroupCard } from '@/components/groups/GroupCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProfileSkeleton, FeedSkeleton, CardGridSkeleton } from '@/components/shared/SkeletonLoader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Group } from '@/types';

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const [tab, setTab] = useState('posts');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: profile, isLoading, isError } = useProfile(handle);
  const { data: posts, isLoading: postsLoading } = useProfilePosts(handle);
  const { data: media, isLoading: mediaLoading } = useProfileMedia(handle, tab === 'media');
  const { data: friends, isLoading: friendsLoading } = useProfileFriends(handle, tab === 'friends');
  const { data: groups, isLoading: groupsLoading } = useProfileGroups(handle, tab === 'groups');

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
        <ProfileSkeleton />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-16 sm:px-4">
        <EmptyState
          icon={UserRound}
          title="Profile not found"
          description="That account does not exist, or it is not visible to you."
        />
      </div>
    );
  }

  const isSelf = profile.relationship === 'self' || profile.id === currentUser?.id;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4">
      <ProfileHeader profile={profile} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="posts" className="flex-1">
            <Newspaper className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
          <TabsTrigger value="media" className="flex-1">
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Media</span>
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Friends</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex-1">
            <UsersRound className="h-4 w-4" />
            <span className="hidden sm:inline">Groups</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          {isSelf ? <PostComposer /> : null}

          {postsLoading ? (
            <FeedSkeleton count={2} />
          ) : posts && posts.length > 0 ? (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <Card>
              <EmptyState
                icon={Newspaper}
                title={isSelf ? 'You have not posted yet' : `${profile.displayName} has not posted yet`}
                description={isSelf ? 'Share what you are up to — your friends will see it in their feed.' : undefined}
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="media">
          {mediaLoading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="skeleton aspect-square rounded-lg" />
              ))}
            </div>
          ) : media && media.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {media.map((item, index) => (
                <button
                  key={`${item.url}-${index}`}
                  type="button"
                  onClick={() => setLightbox(item.url)}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  {item.type === 'video' ? (
                    <video src={mediaUrl(item.url)} className="h-full w-full object-cover" muted />
                  ) : (
                    <img
                      src={mediaUrl(item.url)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState icon={ImageIcon} title="No photos or videos yet" />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="friends">
          {friendsLoading ? (
            <CardGridSkeleton count={6} />
          ) : friends && friends.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {friends.map((friend) => (
                <UserCard key={friend.id} user={friend} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState icon={Users} title="No friends to show" />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groups">
          {groupsLoading ? (
            <CardGridSkeleton count={4} />
          ) : groups && groups.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={
                    {
                      ...group,
                      maxMembers: 10,
                      postCount: 0,
                      isFull: group.memberCount >= 10,
                      createdAt: '',
                      creator: { id: '', username: '', displayName: '', avatarUrl: '' },
                      isMember: true,
                      role: group.role,
                      isAdmin: group.role === 'admin',
                      inviteCode: null,
                    } satisfies Group
                  }
                />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState icon={UsersRound} title="Not in any public groups" />
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none" title="Media">
          {lightbox ? (
            <img src={mediaUrl(lightbox)} alt="" className="max-h-[85vh] w-full rounded-xl object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
