import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { usePost } from '@/hooks/usePosts';
import { PostCard } from '@/components/feed/PostCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { PostSkeleton } from '@/components/shared/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Permalink view — opens with the comment thread already expanded. */
export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { data: post, isLoading, isError } = usePost(postId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
      </Button>

      {isLoading ? (
        <PostSkeleton />
      ) : isError || !post ? (
        <Card>
          <EmptyState
            icon={FileQuestion}
            title="Post not found"
            description="It may have been deleted, or you may not have permission to see it."
            action={
              <Button asChild>
                <Link to="/">Back to feed</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <PostCard post={post} defaultCommentsOpen />
      )}
    </div>
  );
}
