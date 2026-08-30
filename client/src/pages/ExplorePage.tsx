import { Compass, UserPlus } from 'lucide-react';
import { usePostFeed } from '@/hooks/usePosts';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useSuggestions } from '@/hooks/useFriends';
import { PostCard } from '@/components/feed/PostCard';
import { UserCard } from '@/components/profile/UserCard';
import { TrendingPanel } from '@/components/search/TrendingPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedSkeleton } from '@/components/shared/SkeletonLoader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card } from '@/components/ui/card';

/** Public posts from across this Orbit instance, newest first. */
export default function ExplorePage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePostFeed('explore');
  const { data: suggestions } = useSuggestions();

  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => void fetchNextPage(),
    hasMore: Boolean(hasNextPage),
    loading: isFetchingNextPage,
  });

  const posts = (data?.pages ?? []).flatMap((page) => page.items);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Compass className="h-5 w-5 text-[#6366f1]" />
            Explore
          </h1>
          <p className="text-sm text-muted-foreground">
            Every public post on this server, in the order it was written.
          </p>
        </header>

        {isLoading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <Card>
            <EmptyState
              icon={Compass}
              title="Nothing public yet"
              description="Public posts from anyone on this server will appear here."
            />
          </Card>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div ref={sentinelRef} aria-hidden />
            {isFetchingNextPage ? <LoadingSpinner /> : null}
          </>
        )}
      </div>

      <aside className="hidden space-y-4 lg:block">
        <div className="sticky top-[4.5rem] space-y-4">
          <TrendingPanel />

          {suggestions && suggestions.length > 0 ? (
            <Card>
              <div className="flex items-center gap-2 border-b border-border p-4">
                <UserPlus className="h-4 w-4 text-[#6366f1]" />
                <h2 className="text-sm font-bold">New on Orbit</h2>
              </div>
              <div className="p-2">
                {suggestions.slice(0, 5).map((person) => (
                  <UserCard key={person.id} user={person} variant="row" />
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
