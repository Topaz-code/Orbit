import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Trash2 } from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';
import { useComments, useCreateComment, useDeleteComment, postKeys } from '@/hooks/usePosts';
import { useMqttSubscription } from '@/hooks/useMQTT';
import { topics } from '@/lib/mqtt';
import { useAuthStore } from '@/stores/authStore';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { RichText } from './RichText';
import type { Comment } from '@/types';

/** Threaded comments, one reply level deep, with live updates over MQTT. */
export function CommentThread({ postId }: { postId: string }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const { data: comments, isLoading } = useComments(postId);
  const createComment = useCreateComment(postId);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState('');

  // Live comments from other users.
  useMqttSubscription(topics.postComments(postId), (payload: { event: string; comment: Comment }) => {
    if (payload?.event !== 'comment_created' || !payload.comment) return;
    if (payload.comment.author.id === currentUser?.id) return;

    queryClient.setQueryData<Comment[]>(postKeys.comments(postId), (data) => {
      const list = data ?? [];
      const incoming = { ...payload.comment, isOwn: false };
      if (list.some((item) => item.id === incoming.id)) return list;
      if (!incoming.parentCommentId) return [...list, incoming];
      return list.map((root) =>
        root.id === incoming.parentCommentId ? { ...root, replies: [...root.replies, incoming] } : root,
      );
    });
  });

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    createComment.mutate(
      { content, parentCommentId: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setDraft('');
          setReplyTo(null);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <LoadingSpinner label="Loading comments" />
      ) : comments && comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                postId={postId}
                onReply={() => setReplyTo({ id: comment.id, name: comment.author.displayName })}
              />
              {comment.replies.length > 0 ? (
                <ul className="ml-11 mt-2 space-y-2 border-l-2 border-border pl-3">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        postId={postId}
                        compact
                        onReply={() => setReplyTo({ id: comment.id, name: reply.author.displayName })}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-center text-sm text-muted-foreground">
          No comments yet — start the conversation.
        </p>
      )}

      <CommentComposer
        draft={draft}
        setDraft={setDraft}
        onSubmit={submit}
        submitting={createComment.isPending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}

function CommentRow({
  comment,
  postId,
  compact,
  onReply,
}: {
  comment: Comment;
  postId: string;
  compact?: boolean;
  onReply: () => void;
}) {
  const deleteComment = useDeleteComment(postId);

  return (
    <div className="group flex gap-2.5">
      <Link to={`/profile/${comment.author.username}`} className="shrink-0">
        <UserAvatar user={comment.author} size={compact ? 'xs' : 'sm'} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-card px-3 py-2 shadow-sm ring-1 ring-border">
          <Link
            to={`/profile/${comment.author.username}`}
            className="text-[13px] font-semibold hover:underline"
          >
            {comment.author.displayName}
          </Link>
          <RichText
            text={comment.content}
            className="whitespace-pre-wrap break-words text-sm leading-relaxed"
          />
        </div>

        <div className="mt-1 flex items-center gap-3 pl-1 text-[11px] text-muted-foreground">
          <span>{relativeTime(comment.createdAt)}</span>
          <button type="button" onClick={onReply} className="font-medium hover:underline">
            Reply
          </button>
          {comment.isOwn ? (
            <button
              type="button"
              onClick={() => deleteComment.mutate(comment.id)}
              className="flex items-center gap-1 font-medium text-destructive opacity-0 transition-opacity hover:underline group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommentComposer({
  draft,
  setDraft,
  onSubmit,
  submitting,
  replyTo,
  onCancelReply,
}: {
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  replyTo: { id: string; name: string } | null;
  onCancelReply: () => void;
}) {
  const currentUser = useAuthStore((state) => state.user);
  const [inputRef, setInputRef] = useState<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (replyTo) inputRef?.focus();
  }, [replyTo, inputRef]);

  return (
    <div className="space-y-1.5">
      {replyTo ? (
        <div className="flex items-center gap-2 pl-11 text-xs text-muted-foreground">
          <span>
            Replying to <span className="font-medium text-foreground">{replyTo.name}</span>
          </span>
          <button type="button" onClick={onCancelReply} className="font-medium text-destructive hover:underline">
            Cancel
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2.5">
        {currentUser ? <UserAvatar user={currentUser} size="sm" /> : null}
        <Textarea
          ref={setInputRef}
          value={draft}
          autoResize
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Write a comment…'}
          className={cn('min-h-[40px] rounded-2xl bg-card py-2.5')}
          aria-label="Write a comment"
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={onSubmit}
          disabled={!draft.trim()}
          loading={submitting}
          aria-label="Post comment"
        >
          {submitting ? null : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
