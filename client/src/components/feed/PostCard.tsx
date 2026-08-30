import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Globe,
  Heart,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import { cn, compactNumber, relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useDeletePost, useSharePost, useToggleBookmark, useToggleLike, useUpdatePost } from '@/hooks/usePosts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { RichText } from './RichText';
import { MediaGrid } from './MediaGrid';
import { LinkPreview } from './LinkPreview';
import { CommentThread } from './CommentThread';
import type { Post } from '@/types';

const visibilityIcon = { public: Globe, friends: Users, private: Lock } as const;

export function PostCard({
  post,
  defaultCommentsOpen = false,
  className,
}: {
  post: Post;
  defaultCommentsOpen?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.contentText);

  const toggleLike = useToggleLike();
  const toggleBookmark = useToggleBookmark();
  const sharePost = useSharePost();
  const deletePost = useDeletePost();
  const updatePost = useUpdatePost();

  const VisibilityIcon = visibilityIcon[post.visibility] ?? Globe;
  const canEdit = post.isOwn || post.author.id === currentUser?.id;

  return (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-md', className)}>
      <header className="flex items-start gap-3 p-4 pb-3">
        <Link to={`/profile/${post.author.username}`} aria-label={post.author.displayName}>
          <UserAvatar user={post.author} showStatus />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
            <Link to={`/profile/${post.author.username}`} className="font-semibold hover:underline">
              {post.author.displayName}
            </Link>
            {post.group ? (
              <>
                <span className="text-muted-foreground">in</span>
                <Link to={`/groups/${post.group.id}`} className="font-medium text-[#6366f1] hover:underline">
                  {post.group.name}
                </Link>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to={`/post/${post.id}`} className="hover:underline">
              {relativeTime(post.createdAt)}
            </Link>
            <span aria-hidden>·</span>
            <VisibilityIcon className="h-3 w-3" aria-label={post.visibility} />
            {post.updatedAt !== post.createdAt ? <span className="italic">edited</span> : null}
          </div>
        </div>

        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Post options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={() => {
                  setDraft(post.contentText);
                  setEditing(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit post
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {editing ? (
        <div className="space-y-2 px-4 pb-3">
          <Textarea
            value={draft}
            autoResize
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-[80px]"
            aria-label="Edit post text"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={updatePost.isPending}
              onClick={() => {
                updatePost.mutate(
                  { id: post.id, contentText: draft.trim() },
                  { onSuccess: () => setEditing(false) },
                );
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : post.contentText ? (
        <RichText
          text={post.contentText}
          className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] leading-relaxed"
        />
      ) : null}

      {post.media.length > 0 ? <MediaGrid media={post.media} className="mx-4 mb-3" /> : null}
      {post.linkPreview && post.media.length === 0 ? (
        <LinkPreview preview={post.linkPreview} className="mx-4 mb-3" />
      ) : null}

      {post.likesCount > 0 || post.commentsCount > 0 || post.sharesCount > 0 ? (
        <div className="flex items-center gap-3 px-4 pb-2 text-xs text-muted-foreground">
          {post.likesCount > 0 ? (
            <span className="flex items-center gap-1">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]">
                <Heart className="h-2.5 w-2.5 fill-white text-white" />
              </span>
              {compactNumber(post.likesCount)}
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-3">
            {post.commentsCount > 0 ? (
              <button type="button" onClick={() => setCommentsOpen(true)} className="hover:underline">
                {compactNumber(post.commentsCount)} {post.commentsCount === 1 ? 'comment' : 'comments'}
              </button>
            ) : null}
            {post.sharesCount > 0 ? <span>{compactNumber(post.sharesCount)} shares</span> : null}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-1 border-t border-border px-2 py-1">
        <ActionButton
          active={post.isLiked}
          activeClassName="text-[#ef4444]"
          icon={
            <Heart
              className={cn('h-[18px] w-[18px] transition-transform', post.isLiked && 'animate-heart-burst fill-current')}
            />
          }
          label="Like"
          onClick={() => toggleLike.mutate({ post })}
        />
        <ActionButton
          icon={<MessageCircle className="h-[18px] w-[18px]" />}
          label="Comment"
          onClick={() => setCommentsOpen((open) => !open)}
          active={commentsOpen}
        />
        <ActionButton
          icon={<Share2 className="h-[18px] w-[18px]" />}
          label="Share"
          onClick={() => sharePost.mutate(post.id)}
        />
        <ActionButton
          active={post.isBookmarked}
          activeClassName="text-[#6366f1]"
          icon={<Bookmark className={cn('h-[18px] w-[18px]', post.isBookmarked && 'fill-current')} />}
          label="Save"
          onClick={() => toggleBookmark.mutate({ post })}
        />
      </div>

      {commentsOpen ? (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <CommentThread postId={post.id} />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this post?"
        description="This removes the post, its comments and its likes. It cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deletePost.isPending}
        onConfirm={() => {
          deletePost.mutate(post.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              if (window.location.pathname === `/post/${post.id}`) navigate('/');
            },
          });
        }}
      />
    </Card>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
  activeClassName,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
        'text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98]',
        active && (activeClassName ?? 'text-foreground'),
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
