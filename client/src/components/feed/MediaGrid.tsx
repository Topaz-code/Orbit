import { useState } from 'react';
import ReactPlayer from 'react-player';
import { Play, X } from 'lucide-react';
import { cn, mediaUrl } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { MediaItem } from '@/types';

/** Facebook-style attachment grid: 1–4+ items with a lightbox on click. */
export function MediaGrid({ media, className }: { media: MediaItem[]; className?: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!media.length) return null;

  const visible = media.slice(0, 4);
  const overflow = media.length - visible.length;

  const layout =
    media.length === 1
      ? 'grid-cols-1'
      : media.length === 3
        ? 'grid-cols-2 [&>*:first-child]:row-span-2'
        : 'grid-cols-2';

  return (
    <>
      <div
        className={cn(
          'grid gap-0.5 overflow-hidden rounded-xl border border-border',
          layout,
          media.length > 1 && 'max-h-[26rem]',
          className,
        )}
      >
        {visible.map((item, index) => (
          <button
            key={`${item.url}-${index}`}
            type="button"
            onClick={() => setLightbox(index)}
            className={cn(
              'group relative overflow-hidden bg-muted',
              media.length === 1 ? 'max-h-[32rem]' : 'aspect-square',
            )}
          >
            {item.type === 'video' ? (
              <>
                <video
                  src={mediaUrl(item.url)}
                  className="h-full w-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                />
                <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/35">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 shadow-lg">
                    <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
                  </span>
                </span>
              </>
            ) : (
              <img
                src={mediaUrl(item.url)}
                alt=""
                loading="lazy"
                className={cn(
                  'h-full w-full transition-transform duration-300 group-hover:scale-[1.02]',
                  media.length === 1 ? 'object-contain' : 'object-cover',
                )}
              />
            )}

            {index === 3 && overflow > 0 ? (
              <span className="absolute inset-0 grid place-items-center bg-black/60 text-2xl font-bold text-white">
                +{overflow}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent
          className="max-w-4xl border-0 bg-transparent p-0 shadow-none"
          hideClose
          title="Attachment"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute -top-10 right-0 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {lightbox !== null && media[lightbox] ? (
            media[lightbox]!.type === 'video' ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                <ReactPlayer
                  url={mediaUrl(media[lightbox]!.url)}
                  controls
                  playing
                  width="100%"
                  height="100%"
                />
              </div>
            ) : (
              <img
                src={mediaUrl(media[lightbox]!.url)}
                alt=""
                className="max-h-[80vh] w-full rounded-xl object-contain"
              />
            )
          ) : null}

          {media.length > 1 ? (
            <div className="mt-3 flex justify-center gap-1.5">
              {media.map((item, index) => (
                <button
                  key={`${item.url}-dot-${index}`}
                  type="button"
                  onClick={() => setLightbox(index)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    index === lightbox ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70',
                  )}
                  aria-label={`View attachment ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
