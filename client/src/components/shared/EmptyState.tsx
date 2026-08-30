import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/** Friendly illustration + copy used by every empty list in the app. */
export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center animate-fade-in',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className,
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6366f1]/25 to-[#8b5cf6]/25 blur-xl" />
        <div
          className={cn(
            'relative grid place-items-center rounded-full bg-gradient-to-br from-[#6366f1]/12 to-[#8b5cf6]/12 ring-1 ring-primary/15',
            compact ? 'h-12 w-12' : 'h-20 w-20',
          )}
        >
          <Icon className={cn('text-primary', compact ? 'h-5 w-5' : 'h-8 w-8')} strokeWidth={1.75} />
        </div>
      </div>
      <h3 className={cn('font-bold', compact ? 'text-sm' : 'mt-1 text-base')}>{title}</h3>
      {description ? (
        <p className={cn('max-w-sm text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
