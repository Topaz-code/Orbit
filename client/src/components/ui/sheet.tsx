import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A slide-in panel built on Radix Dialog. Used for the mobile navigation drawer and any
 * edge-anchored surface.
 */
export function Sheet({
  open,
  onOpenChange,
  side = 'left',
  className,
  children,
  title = 'Navigation',
  showClose = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'left' | 'right' | 'bottom';
  className?: string;
  children: React.ReactNode;
  title?: string;
  showClose?: boolean;
}) {
  const sideClasses = {
    left: 'inset-y-0 left-0 h-full w-72 max-w-[85vw] data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
    right:
      'inset-y-0 right-0 h-full w-80 max-w-[85vw] data-[state=open]:animate-slide-in-right-panel data-[state=closed]:animate-slide-out-right',
    bottom:
      'inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down',
  } as const;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col overflow-y-auto bg-card shadow-2xl focus:outline-none',
            sideClasses[side],
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Press Escape to close this panel.
          </DialogPrimitive.Description>
          {showClose ? (
            <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
