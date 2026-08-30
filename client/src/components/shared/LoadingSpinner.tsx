import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingSpinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground" role="status">
      <Loader2 className={cn('h-5 w-5 animate-spin', className)} />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  );
}

/** Full-viewport loader used while the session is being restored. */
export function FullPageLoader({ label = 'Loading Orbit…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-ring-spin rounded-full bg-story-ring" />
          <div className="absolute inset-[3px] grid place-items-center rounded-full bg-background">
            <span className="text-lg font-bold orbit-gradient-text">O</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
