import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Pause, Play, Plus, Send, Trash2, X } from 'lucide-react';
import { STORY_DURATION_MS } from '@/lib/constants';
import { cn, mediaUrl, relativeTime } from '@/lib/utils';
import { useDeleteStory, useReplyToStory, useViewStory } from '@/hooks/useStories';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { StoryGroup } from '@/types';

/**
 * Full-screen story player: auto-advances through each author's stories, then moves to the next
 * author. Tap/click the left or right third to step, hold to pause.
 */
export function StoryViewer({
  groups,
  startIndex,
  onClose,
  onAddStory,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  onAddStory?: () => void;
}) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const viewStory = useViewStory();
  const replyToStory = useReplyToStory();
  const deleteStory = useDeleteStory();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const goNext = useCallback(() => {
    setProgress(0);
    setStoryIndex((current) => {
      const total = groups[groupIndex]?.stories.length ?? 0;
      if (current + 1 < total) return current + 1;
      setGroupIndex((currentGroup) => {
        if (currentGroup + 1 < groups.length) return currentGroup + 1;
        onClose();
        return currentGroup;
      });
      return 0;
    });
  }, [groupIndex, groups, onClose]);

  const goPrevious = useCallback(() => {
    setProgress(0);
    setStoryIndex((current) => {
      if (current > 0) return current - 1;
      setGroupIndex((currentGroup) => {
        if (currentGroup > 0) {
          const previousGroup = groups[currentGroup - 1];
          setStoryIndex(Math.max(0, (previousGroup?.stories.length ?? 1) - 1));
          return currentGroup - 1;
        }
        return currentGroup;
      });
      return 0;
    });
  }, [groups]);

  // Mark the story seen exactly once.
  useEffect(() => {
    if (!story || story.isOwn || viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    viewStory.mutate(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Progress timer. Videos advance on their own `ended` event instead.
  useEffect(() => {
    if (!story || paused || showViewers) return;
    if (story.mediaType === 'video') return;

    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - started;
      const ratio = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(ratio);
      if (ratio >= 1) goNext();
    }, 50);

    return () => clearInterval(timer);
  }, [story, paused, showViewers, goNext]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goPrevious();
      if (event.key === ' ') {
        event.preventDefault();
        setPaused((current) => !current);
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [goNext, goPrevious, onClose]);

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fade-in">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Close stories"
      >
        <X className="h-6 w-6" />
      </button>

      {groupIndex > 0 ? (
        <button
          type="button"
          onClick={goPrevious}
          className="absolute left-2 z-20 hidden rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:block"
          aria-label="Previous story"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}
      {groupIndex < groups.length - 1 ? (
        <button
          type="button"
          onClick={() => {
            setStoryIndex(0);
            setProgress(0);
            setGroupIndex((current) => Math.min(groups.length - 1, current + 1));
          }}
          className="absolute right-2 z-20 hidden rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:block"
          aria-label="Next story"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      <div className="relative flex h-full w-full max-w-md flex-col md:h-[92vh] md:rounded-2xl md:overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2">
          {group.stories.map((item, index) => (
            <span key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-75"
                style={{
                  width: index < storyIndex ? '100%' : index === storyIndex ? `${progress * 100}%` : '0%',
                }}
              />
            </span>
          ))}
        </div>

        <div className="absolute inset-x-0 top-4 z-10 flex items-center gap-2.5 p-3">
          <Link to={`/profile/${group.author.username}`} onClick={onClose}>
            <UserAvatar user={group.author} size="sm" className="ring-2 ring-white/40" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to={`/profile/${group.author.username}`}
              onClick={onClose}
              className="block truncate text-sm font-semibold text-white hover:underline"
            >
              {group.author.displayName}
            </Link>
            <p className="text-[11px] text-white/70">{relativeTime(story.createdAt)}</p>
          </div>

          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          {story.isOwn ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-destructive"
              aria-label="Delete story"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {story.mediaType === 'video' ? (
            <video
              ref={videoRef}
              key={story.id}
              src={mediaUrl(story.mediaUrl)}
              className="max-h-full w-full object-contain"
              autoPlay
              playsInline
              controls={false}
              onTimeUpdate={(event) => {
                const el = event.currentTarget;
                if (el.duration) setProgress(el.currentTime / el.duration);
              }}
              onEnded={goNext}
            />
          ) : (
            <img
              key={story.id}
              src={mediaUrl(story.mediaUrl)}
              alt={story.caption || 'Story'}
              className="max-h-full w-full object-contain"
            />
          )}

          {story.overlay?.text ? (
            <p
              className="pointer-events-none absolute max-w-[85%] text-center font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              style={{
                color: story.overlay.color ?? '#ffffff',
                fontSize: `${story.overlay.fontSize ?? 28}px`,
                left: `${story.overlay.x ?? 50}%`,
                top: `${story.overlay.y ?? 50}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {story.overlay.text}
            </p>
          ) : null}

          {/* Tap zones for stepping through stories. */}
          <button
            type="button"
            className="absolute inset-y-0 left-0 w-1/3 cursor-default focus:outline-none"
            onClick={goPrevious}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            aria-label="Previous"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 w-1/3 cursor-default focus:outline-none"
            onClick={goNext}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            aria-label="Next"
          />
        </div>

        {story.caption ? (
          <p className="bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 text-center text-sm text-white">
            {story.caption}
          </p>
        ) : null}

        <div className="bg-black p-3">
          {story.isOwn ? (
            <button
              type="button"
              onClick={() => setShowViewers((current) => !current)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Eye className="h-4 w-4" />
              {story.viewCount} {story.viewCount === 1 ? 'view' : 'views'}
            </button>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!reply.trim()) return;
                replyToStory.mutate(
                  { storyId: story.id, content: reply.trim() },
                  { onSuccess: () => setReply('') },
                );
              }}
            >
              <Input
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                placeholder={`Reply to ${group.author.displayName.split(' ')[0]}…`}
                className="h-10 rounded-full border-white/25 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/40"
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full"
                disabled={!reply.trim()}
                loading={replyToStory.isPending}
                aria-label="Send reply"
              >
                {replyToStory.isPending ? null : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {showViewers && story.isOwn ? (
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg bg-white/5 p-2">
              {story.viewers.length === 0 ? (
                <li className="py-2 text-center text-xs text-white/60">No views yet</li>
              ) : (
                story.viewers.map((viewer) => (
                  <li key={viewer.id} className="flex items-center gap-2">
                    <UserAvatar user={viewer} size="xs" />
                    <span className="flex-1 truncate text-xs text-white">{viewer.displayName}</span>
                    <span className="text-[10px] text-white/50">{relativeTime(viewer.viewedAt)}</span>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {story.isOwn && onAddStory ? (
            <Button variant="ghost" size="sm" className="mt-1 w-full text-white/80" onClick={onAddStory}>
              <Plus className="h-4 w-4" />
              Add another story
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this story?"
        description="It will disappear for everyone immediately."
        confirmLabel="Delete"
        destructive
        loading={deleteStory.isPending}
        onConfirm={() =>
          deleteStory.mutate(story.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />

      <span className={cn('sr-only')} aria-live="polite">
        {group.author.displayName}, story {storyIndex + 1} of {group.stories.length}
      </span>
    </div>
  );
}
