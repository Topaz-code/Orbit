import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  Compass,
  Home,
  MessageCircle,
  Phone,
  Search,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useConversations } from '@/hooks/useChat';
import { useFriendRequests } from '@/hooks/useFriends';
import { OrbitWordmark } from '@/components/shared/OrbitLogo';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: number;
  end?: boolean;
}

export function Sidebar({ className }: { className?: string }) {
  const user = useAuthStore((state) => state.user);
  const unreadNotifications = useNotificationStore((state) => state.unreadCount);
  const { data: conversations } = useConversations();
  const { data: requests } = useFriendRequests();
  const location = useLocation();

  const unreadMessages = (conversations ?? []).reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );
  const pendingRequests = requests?.incoming.length ?? 0;

  const primary: NavItem[] = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/messages', label: 'Messages', icon: MessageCircle, badge: unreadMessages },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { to: '/friends', label: 'Friends', icon: Users, badge: pendingRequests },
    { to: '/groups', label: 'Groups', icon: UsersRound },
    { to: '/calls', label: 'Calls', icon: Phone },
    { to: '/bookmarks', label: 'Saved', icon: Bookmark },
  ];

  return (
    <aside
      className={cn(
        'flex h-full w-64 shrink-0 flex-col gap-1 border-r border-border bg-card px-3 py-4',
        className,
      )}
    >
      <div className="px-2 pb-4">
        <NavLink to="/" className="inline-flex" aria-label="Orbit home">
          <OrbitWordmark />
        </NavLink>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
        {primary.map((item) => (
          <SidebarLink key={item.to} item={item} active={isActive(location.pathname, item)} />
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-border pt-3">
        <SidebarLink
          item={{ to: '/settings', label: 'Settings', icon: Settings }}
          active={location.pathname.startsWith('/settings')}
        />
        {user ? (
          <NavLink
            to={`/profile/${user.username}`}
            className={({ isActive: linkActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                linkActive ? 'bg-accent' : 'hover:bg-accent/60',
              )
            }
          >
            <UserAvatar user={user} size="sm" showStatus={false} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
            </span>
          </NavLink>
        ) : null}
      </div>
    </aside>
  );
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-gradient-to-r from-[#6366f1]/12 to-[#8b5cf6]/12 text-[#6366f1] dark:text-[#a5b4fc]'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0 transition-transform group-hover:scale-105')} strokeWidth={active ? 2.4 : 2} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <Badge variant="brand" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[11px]">
          {item.badge > 99 ? '99+' : item.badge}
        </Badge>
      ) : null}
    </NavLink>
  );
}
