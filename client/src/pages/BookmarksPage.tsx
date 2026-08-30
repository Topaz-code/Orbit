import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { usePostFeed } from '@/hooks/usePosts';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PostCard } from '@/components/feed/PostCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedSkeleton } from '@/components/shared/SkeletonLoader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function BookmarksPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePostFeed('bookmarks');

  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => void fetchNextPage(),
    hasMore: Boolean(hasNextPage),
    loading: isFetchingNextPage,
  });

  const posts = (data?.pages ?? []).flatMap((page) => page.items);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Saved posts</h1>
        <p className="text-sm text-muted-foreground">
          Only you can see these. Saving a post never notifies its author.
        </p>
      </header>

      {isLoading ? (
        <FeedSkeleton count={2} />
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bookmark}
            title="Nothing saved yet"
            description="Tap Save on any post to keep it here for later."
            action={
              <Button asChild>
                <Link to="/">Browse your feed</Link>
              </Button>
            }
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
  );
}
