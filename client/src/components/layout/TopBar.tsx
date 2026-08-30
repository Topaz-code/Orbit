import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, MessageCircle, Moon, Search, Settings, Sun, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useConversations } from '@/hooks/useChat';
import { useSearch } from '@/hooks/useSearch';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrbitLogo } from '@/components/shared/OrbitLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const unreadNotifications = useNotificationStore((state) => state.unreadCount);
  const { data: conversations } = useConversations();

  const unreadMessages = (conversations ?? []).reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md md:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-2 lg:hidden"
        aria-label="Orbit home"
      >
        <OrbitLogo className="h-7 w-7" />
      </button>

      <QuickSearch />

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative hidden sm:inline-flex"
          onClick={() => navigate('/messages')}
          aria-label={`Messages${unreadMessages ? `, ${unreadMessages} unread` : ''}`}
        >
          <MessageCircle className="h-5 w-5" />
          {unreadMessages > 0 ? <CountDot value={unreadMessages} /> : null}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => navigate('/notifications')}
          aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadNotifications > 0 ? <CountDot value={unreadNotifications} /> : null}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 rounded-full ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Account menu"
              >
                <UserAvatar user={user} size="sm" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate">{user.displayName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">@{user.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate(`/profile/${user.username}`)}>
                <User className="mr-2 h-4 w-4" />
                Your profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  void logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}

function CountDot({ value }: { value: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-1 text-[10px] font-bold text-white">
      {value > 9 ? '9+' : value}
    </span>
  );
}

/** Header search with a live people dropdown; Enter opens the full search page. */
function QuickSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useSearch(term, 'people');

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const people = data?.people ?? [];

  return (
    <div ref={containerRef} className="relative ml-1 hidden max-w-md flex-1 md:block">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!term.trim()) return;
          setOpen(false);
          navigate(`/search?q=${encodeURIComponent(term.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search people, posts and groups"
          className="h-9 pl-9"
          aria-label="Search Orbit"
        />
      </form>

      {open && term.trim().length > 0 ? (
        <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-xl border border-border bg-popover shadow-lg animate-scale-in">
          {people.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {isFetching ? 'Searching…' : 'No people found'}
            </p>
          ) : (
            <ul>
              {people.slice(0, 5).map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                    onClick={() => {
                      setOpen(false);
                      setTerm('');
                      navigate(`/profile/${person.username}`);
                    }}
                  >
                    <UserAvatar user={person} size="sm" showStatus />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{person.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className={cn(
              'w-full border-t border-border px-3 py-2 text-left text-sm font-medium text-[#6366f1]',
              'transition-colors hover:bg-accent',
            )}
            onClick={() => {
              setOpen(false);
              navigate(`/search?q=${encodeURIComponent(term.trim())}`);
            }}
          >
            See all results for “{term.trim()}”
          </button>
        </div>
      ) : null}
    </div>
  );
}
