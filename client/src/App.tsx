import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes';
import { Toaster } from './components/shared/Toast';
import { TooltipProvider } from './components/ui/tooltip';
import { configureApi } from './lib/api';
import { useAuthStore } from './stores/authStore';
import { connectMqtt, disconnectMqtt } from './lib/mqtt';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Bridge the auth store into the axios layer once, at module scope.
configureApi({
  getTokens: () => {
    const { accessToken, refreshToken } = useAuthStore.getState();
    return { accessToken, refreshToken };
  },
  setTokens: (tokens) => useAuthStore.getState().setTokens(tokens),
  onLogout: () => {
    disconnectMqtt();
    useAuthStore.getState().clear();
    queryClient.clear();
  },
});

/** Opens the MQTT connection whenever a session exists, and tears it down on sign-out. */
function RealtimeGate() {
  const userId = useAuthStore((state) => state.user?.id);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!userId || !accessToken) {
      disconnectMqtt();
      return;
    }
    connectMqtt(userId, accessToken);
    return () => disconnectMqtt();
  }, [userId, accessToken]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <RealtimeGate />
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
