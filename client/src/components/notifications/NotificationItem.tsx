import { Link, useNavigate } from 'react-router-dom';
import {
  AtSign,
  Bell,
  Heart,
  MessageCircle,
  PhoneMissed,
  Share2,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';
import { NOTIFICATION_LABELS } from '@/lib/constants';
import { notificationHref, useDeleteNotification, useMarkNotificationRead } from '@/hooks/useNotifications';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { AppNotification } from '@/types';

const iconFor: Record<string, { icon: typeof Bell; className: string }> = {
  friend_request: { icon: UserPlus, className: 'bg-[#6366f1]' },
  friend_accept: { icon: UserPlus, className: 'bg-[#22c55e]' },
  post_like: { icon: Heart, className: 'bg-[#ef4444]' },
  post_comment: { icon: MessageCircle, className: 'bg-[#06b6d4]' },
  comment_reply: { icon: MessageCircle, className: 'bg-[#06b6d4]' },
  post_share: { icon: Share2, className: 'bg-[#8b5cf6]' },
  mention: { icon: AtSign, className: 'bg-[#f59e0b]' },
  message: { icon: MessageCircle, className: 'bg-[#6366f1]' },
  group_invite: { icon: UsersRound, className: 'bg-[#8b5cf6]' },
  group_post: { icon: UsersRound, className: 'bg-[#8b5cf6]' },
  group_join: { icon: UsersRound, className: 'bg-[#22c55e]' },
  story_reply: { icon: MessageCircle, className: 'bg-[#06b6d4]' },
  missed_call: { icon: PhoneMissed, className: 'bg-[#ef4444]' },
};

export function NotificationItem({ notification }: { notification: AppNotification }) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();

  const meta = iconFor[notification.type] ?? { icon: Bell, className: 'bg-muted-foreground' };
  const Icon = meta.icon;

  const open = () => {
    if (!notification.isRead) markRead.mutate(notification.id);
    navigate(notificationHref(notification));
  };

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-xl p-3 transition-colors',
        notification.isRead ? 'hover:bg-accent/50' : 'bg-[#6366f1]/[0.06] hover:bg-[#6366f1]/[0.1]',
      )}
    >
      <button type="button" onClick={open} className="absolute inset-0 rounded-xl" aria-label={notification.content} />

      <span className="relative shrink-0">
        {notification.actor ? (
          <Link
            to={`/profile/${notification.actor.username}`}
            className="relative z-10"
            onClick={(event) => event.stopPropagation()}
          >
            <UserAvatar user={notification.actor} size="lg" />
          </Link>
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </span>
        )}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background text-white',
            meta.className,
          )}
        >
          <Icon className="h-2.5 w-2.5" />
        </span>
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm leading-snug">{notification.content}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{relativeTime(notification.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>{NOTIFICATION_LABELS[notification.type] ?? 'Update'}</span>
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1">
        {!notification.isRead ? (
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]" aria-label="Unread" />
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            deleteNotification.mutate(notification.id);
          }}
          aria-label="Dismiss notification"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
