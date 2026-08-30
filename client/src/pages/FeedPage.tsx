import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Newspaper, Sparkles, UserPlus } from 'lucide-react';
import { usePostFeed, postKeys } from '@/hooks/usePosts';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useSuggestions } from '@/hooks/useFriends';
import { useMqttSubscription } from '@/hooks/useMQTT';
import { useAuthStore } from '@/stores/authStore';
import { topics } from '@/lib/mqtt';
import { PostComposer } from '@/components/feed/PostComposer';
import { PostCard } from '@/components/feed/PostCard';
import { StoryRail } from '@/components/stories/StoryRail';
import { TrendingPanel } from '@/components/search/TrendingPanel';
import { UserCard } from '@/components/profile/UserCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedSkeleton } from '@/components/shared/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function FeedPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePostFeed('feed');
  const { data: suggestions } = useSuggestions();
  const [newPostCount, setNewPostCount] = useState(0);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => void fetchNextPage(),
    hasMore: Boolean(hasNextPage),
    loading: isFetchingNextPage,
  });

  // Someone else posted — offer a refresh instead of shifting the page under the reader.
  useMqttSubscription(topics.feedNew, (payload: { event: string; authorId: string }) => {
    if (payload?.event !== 'post_created') return;
    if (payload.authorId === currentUserId) return;
    setNewPostCount((count) => count + 1);
  });

  useEffect(() => {
    setNewPostCount(0);
  }, [data?.pages.length]);

  const posts = (data?.pages ?? []).flatMap((page) => page.items);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <StoryRail />

        <PostComposer />

        {newPostCount > 0 ? (
          <div className="sticky top-16 z-20 flex justify-center">
            <Button
              size="sm"
              className="shadow-lg animate-fade-in-up"
              onClick={() => {
                setNewPostCount(0);
                void queryClient.invalidateQueries({ queryKey: postKeys.feed });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'}
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <Card>
            <EmptyState
              icon={Newspaper}
              title="Your feed is quiet"
              description="Follow more people or write the first post. Orbit shows posts strictly in the order they were written — no algorithm deciding for you."
              action={
                <Button asChild>
                  <Link to="/explore">
                    <Sparkles className="h-4 w-4" />
                    Explore Orbit
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden />
            {isFetchingNextPage ? <LoadingSpinner label="Loading more posts" /> : null}
            {!hasNextPage && posts.length > 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                You are all caught up. Nothing hidden, nothing reordered.
              </p>
            ) : null}
          </>
        )}
      </div>

      <aside className="hidden space-y-4 lg:block">
        <div className="sticky top-[4.5rem] space-y-4">
          {suggestions && suggestions.length > 0 ? (
            <Card>
              <div className="flex items-center gap-2 border-b border-border p-4">
                <UserPlus className="h-4 w-4 text-[#6366f1]" />
                <h2 className="text-sm font-bold">People you may know</h2>
              </div>
              <div className="p-2">
                {suggestions.slice(0, 4).map((person) => (
                  <UserCard key={person.id} user={person} variant="row" />
                ))}
              </div>
              <div className="border-t border-border p-2">
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link to="/friends">See all suggestions</Link>
                </Button>
              </div>
            </Card>
          ) : null}

          <TrendingPanel />

          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">
            Orbit is self-hosted and open source. No ads, no tracking, no data sales — your posts
            live in a SQLite file you control.
          </p>
        </div>
      </aside>
    </div>
  );
}
