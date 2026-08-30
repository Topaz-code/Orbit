import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { FullPageLoader } from '@/components/shared/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const FeedPage = lazy(() => import('@/pages/FeedPage'));
const PostPage = lazy(() => import('@/pages/PostPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const MessagesPage = lazy(() => import('@/pages/MessagesPage'));
const CallsPage = lazy(() => import('@/pages/CallsPage'));
const GroupsPage = lazy(() => import('@/pages/GroupsPage'));
const GroupDetailPage = lazy(() => import('@/pages/GroupDetailPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const ExplorePage = lazy(() => import('@/pages/ExplorePage'));
const FriendsPage = lazy(() => import('@/pages/FriendsPage'));
const BookmarksPage = lazy(() => import('@/pages/BookmarksPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function useSession() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  return { user, isAuthenticated: Boolean(user && accessToken), isHydrated };
}

/** Blocks app routes until a session exists; remembers where the user was heading. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isHydrated } = useSession();
  const location = useLocation();

  if (!isHydrated) return <FullPageLoader label="Restoring your session" />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  // New accounts finish onboarding before they can reach the rest of the app.
  if (user && !user.isOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

/** Keeps signed-in users out of the auth screens. */
function RequireGuest({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated } = useSession();
  if (!isHydrated) return <FullPageLoader label="Loading Orbit" />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader label="Loading Orbit" />}>
      <Routes>
        <Route
          path="/login"
          element={
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          }
        />
        <Route
          path="/register"
          element={
            <RequireGuest>
              <RegisterPage />
            </RequireGuest>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RequireGuest>
              <ForgotPasswordPage />
            </RequireGuest>
          }
        />

        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<FeedPage />} />
          <Route path="/post/:postId" element={<PostPage />} />
          <Route path="/profile/:handle" element={<ProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<MessagesPage />} />
          <Route path="/calls" element={<CallsPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:tab" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
