import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { CallOverlay } from '@/components/calls/CallOverlay';
import { Sheet } from '@/components/ui/sheet';
import { useNotifications, useLiveNotifications } from '@/hooks/useNotifications';
import { useGlobalChatNotifications } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';
import { useFriends } from '@/hooks/useFriends';
import { usePresenceSeed, usePresenceSubscriptions } from '@/hooks/usePresence';
import { useAuthStore } from '@/stores/authStore';

/**
 * The authenticated frame: navigation, global realtime subscriptions and the call overlay.
 * Everything inside `<Outlet />` is a page.
 */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const pruneTyping = useChatStore((state) => state.pruneTyping);

  // Global realtime wiring — mounted once for the whole session.
  useNotifications();
  useLiveNotifications();
  useGlobalChatNotifications();

  // Presence for everyone the user actually knows.
  const { data: friends } = useFriends();
  usePresenceSeed(friends);
  usePresenceSubscriptions([...(friends ?? []).map((friend) => friend.id), currentUserId]);

  // Typing indicators self-expire if a "stopped" event is ever dropped.
  useEffect(() => {
    const timer = setInterval(pruneTyping, 3000);
    return () => clearInterval(timer);
  }, [pruneTyping]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar className="sticky top-0 hidden h-screen lg:flex" />

      <Sheet open={navOpen} onOpenChange={setNavOpen} side="left">
        <Sidebar className="w-full border-r-0" />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CallOverlay />
    </div>
  );
}
