import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn, initials, mediaUrl } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full object-cover', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-semibold text-white',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

const avatarSizes = {
  xs: { avatar: 'h-7 w-7 text-[10px]', dot: 'h-2 w-2' },
  sm: { avatar: 'h-9 w-9 text-xs', dot: 'h-2.5 w-2.5' },
  md: { avatar: 'h-10 w-10 text-xs', dot: 'h-3 w-3' },
  lg: { avatar: 'h-12 w-12 text-sm', dot: 'h-3 w-3' },
  xl: { avatar: 'h-16 w-16 text-base', dot: 'h-3.5 w-3.5' },
  '2xl': { avatar: 'h-24 w-24 text-xl', dot: 'h-4 w-4' },
  '3xl': { avatar: 'h-32 w-32 text-3xl', dot: 'h-5 w-5' },
} as const;

export type AvatarSize = keyof typeof avatarSizes;

/** Convenience wrapper: avatar + initials fallback + optional online dot. */
export function UserAvatar({
  user,
  size = 'md',
  className,
  showStatus = false,
  statusClassName,
}: {
  user: { displayName: string; avatarUrl?: string; isOnline?: boolean };
  size?: AvatarSize;
  className?: string;
  showStatus?: boolean;
  statusClassName?: string;
}) {
  const sizing = avatarSizes[size];
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn(sizing.avatar, className)}>
        {user.avatarUrl ? <AvatarImage src={mediaUrl(user.avatarUrl)} alt={user.displayName} /> : null}
        <AvatarFallback className="text-[inherit]">{initials(user.displayName)}</AvatarFallback>
      </Avatar>
      {showStatus && user.isOnline ? (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-background bg-[#22c55e]',
            sizing.dot,
            statusClassName,
          )}
          aria-label="Online"
        />
      ) : null}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
