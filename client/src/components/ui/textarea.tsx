import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, autoResize, onInput, ...props }, ref) => (
    <textarea
      ref={ref}
      onInput={(event) => {
        if (autoResize) {
          const el = event.currentTarget;
          el.style.height = 'auto';
          el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
        }
        onInput?.(event);
      }}
      className={cn(
        'flex min-h-[80px] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
