import { NavLink } from 'react-router-dom';
import { Bell, Compass, Home, MessageCircle, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { useConversations } from '@/hooks/useChat';

/** Bottom tab bar shown on small screens. */
export function MobileNav() {
  const unreadNotifications = useNotificationStore((state) => state.unreadCount);
  const { data: conversations } = useConversations();
  const unreadMessages = (conversations ?? []).reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  const items = [
    { to: '/', label: 'Home', icon: Home, end: true, badge: 0 },
    { to: '/explore', label: 'Explore', icon: Compass, end: false, badge: 0 },
    { to: '/messages', label: 'Chats', icon: MessageCircle, end: false, badge: unreadMessages },
    { to: '/groups', label: 'Groups', icon: UsersRound, end: false, badge: 0 },
    { to: '/notifications', label: 'Alerts', icon: Bell, end: false, badge: unreadNotifications },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                isActive ? 'text-[#6366f1] dark:text-[#a5b4fc]' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                  {item.badge > 0 ? (
                    <span className="absolute -right-2 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-1 text-[10px] font-bold text-white">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
                {isActive ? (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]" />
                ) : null}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
