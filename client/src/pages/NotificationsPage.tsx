import { useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useClearNotifications,
  useMarkAllNotificationsRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { EmptyState } from '@/components/shared/EmptyState';
import { NotificationSkeleton } from '@/components/shared/SkeletonLoader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const clearAll = useClearNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const items = data?.items ?? [];
  const visible = filter === 'unread' ? items.filter((item) => !item.isRead) : items;
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>

        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        ) : null}

        {items.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        ) : null}
      </header>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread" className={cn(unreadCount > 0 && 'font-bold')}>
            Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-2">
        {isLoading ? (
          <NotificationSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'Everything here has been read.'
                : 'Likes, comments, friend requests and calls will show up here in real time.'
            }
          />
        ) : (
          <div className="space-y-0.5">
            {visible.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all notifications?"
        description="This removes every notification from your list. It cannot be undone."
        confirmLabel="Clear all"
        destructive
        loading={clearAll.isPending}
        onConfirm={() => clearAll.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
      />
    </div>
  );
}
