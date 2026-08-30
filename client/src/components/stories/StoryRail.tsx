import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn, mediaUrl } from '@/lib/utils';
import { useStories } from '@/hooks/useStories';
import { useAuthStore } from '@/stores/authStore';
import { UserAvatar } from '@/components/ui/avatar';
import { StoryViewer } from './StoryViewer';
import { StoryComposer } from './StoryComposer';
import type { StoryGroup } from '@/types';

/** Horizontal ring rail at the top of the feed. */
export function StoryRail({ className }: { className?: string }) {
  const currentUser = useAuthStore((state) => state.user);
  const { data: groups, isLoading } = useStories();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const ordered = [...(groups ?? [])].sort((a, b) => {
    if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
  });

  const ownGroup = ordered.find((group) => group.isOwn);

  return (
    <>
      <div className={cn('overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (ownGroup) setViewerIndex(ordered.indexOf(ownGroup));
              else setComposerOpen(true);
            }}
            className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="relative">
              <span
                className={cn(
                  'grid h-16 w-16 place-items-center rounded-full p-[3px]',
                  ownGroup?.hasUnseen ? 'story-ring' : 'bg-border',
                )}
              >
                <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-background p-[2px]">
                  {currentUser ? (
                    <UserAvatar user={currentUser} size="xl" className="h-full w-full" />
                  ) : null}
                </span>
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white transition-transform group-hover:scale-110">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium">Your story</span>
          </button>

          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
                  <div className="skeleton h-16 w-16 rounded-full" />
                  <div className="skeleton h-2.5 w-12 rounded" />
                </div>
              ))
            : ordered
                .filter((group) => !group.isOwn)
                .map((group) => (
                  <StoryBubble
                    key={group.userId}
                    group={group}
                    onOpen={() => setViewerIndex(ordered.indexOf(group))}
                  />
                ))}
        </div>
      </div>

      {viewerIndex !== null ? (
        <StoryViewer
          groups={ordered}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onAddStory={() => {
            setViewerIndex(null);
            setComposerOpen(true);
          }}
        />
      ) : null}

      <StoryComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </>
  );
}

function StoryBubble({ group, onOpen }: { group: StoryGroup; onOpen: () => void }) {
  const cover = group.stories[0];

  return (
    <button type="button" onClick={onOpen} className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
      <span
        className={cn(
          'grid h-16 w-16 place-items-center rounded-full p-[3px] transition-transform group-hover:scale-105',
          group.hasUnseen ? 'story-ring' : 'bg-border',
        )}
      >
        <span className="h-full w-full overflow-hidden rounded-full bg-background p-[2px]">
          {cover && cover.mediaType === 'image' ? (
            <img
              src={mediaUrl(cover.mediaUrl)}
              alt=""
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <UserAvatar user={group.author} size="xl" className="h-full w-full" />
          )}
        </span>
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium">
        {group.author.displayName.split(' ')[0]}
      </span>
    </button>
  );
}
