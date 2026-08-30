import { ExternalLink } from 'lucide-react';
import { cn, mediaUrl } from '@/lib/utils';
import type { LinkPreviewData } from '@/types';

/** Rich card for a URL found in a post. Falls back to the bare domain when no metadata exists. */
export function LinkPreview({ preview, className }: { preview: LinkPreviewData; className?: string }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'group block overflow-hidden rounded-xl border border-border transition-colors hover:border-primary/40 hover:bg-accent/30',
        className,
      )}
    >
      {preview.image ? (
        <div className="aspect-[1.91/1] w-full overflow-hidden bg-muted">
          <img
            src={mediaUrl(preview.image)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      <div className="space-y-1 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          {preview.siteName || preview.domain}
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{preview.title || preview.url}</p>
        {preview.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{preview.description}</p>
        ) : null}
      </div>
    </a>
  );
}
