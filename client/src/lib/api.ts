import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/**
 * Axios instance with automatic access-token refresh.
 *
 * All requests are relative (`/api/...`) so the browser always talks to the origin serving the
 * app — essential when Orbit is reached over a LAN address or a proxy rather than localhost.
 */
export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

type TokenGetter = () => { accessToken: string | null; refreshToken: string | null };
type TokenSetter = (tokens: { accessToken: string; refreshToken: string }) => void;
type LogoutHandler = () => void;

let getTokens: TokenGetter = () => ({ accessToken: null, refreshToken: null });
let setTokens: TokenSetter = () => undefined;
let onLogout: LogoutHandler = () => undefined;

export function configureApi(options: {
  getTokens: TokenGetter;
  setTokens: TokenSetter;
  onLogout: LogoutHandler;
}): void {
  getTokens = options.getTokens;
  setTokens = options.setTokens;
  onLogout = options.onLogout;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = getTokens();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  // Let the browser set the multipart boundary itself.
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getTokens();
  if (!refreshToken) return null;
  try {
    const response = await axios.post('/api/auth/refresh', { refreshToken });
    const data = response.data as { accessToken: string; refreshToken: string };
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;
    const url = original?.url ?? '';

    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/register');

    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      // Share one refresh across concurrent 401s.
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const token = await refreshPromise;
      refreshPromise = null;

      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      onLogout();
    }
    return Promise.reject(error);
  },
);

export interface ApiErrorShape {
  code: string;
  message: string;
  fields?: Array<{ path: string; message: string }>;
}

/** Normalises any thrown value into a user-presentable message. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: ApiErrorShape } | undefined;
    if (data?.error?.fields?.length) return data.error.fields[0]!.message;
    if (data?.error?.message) return data.error.message;
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond';
    if (!error.response) return 'Cannot reach the Orbit server';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {};
  const data = error.response?.data as { error?: ApiErrorShape } | undefined;
  const fields = data?.error?.fields ?? [];
  return Object.fromEntries(fields.map((field) => [field.path, field.message]));
}

/** Uploads one or more files and returns their public URLs. */
export async function uploadFiles(
  files: File[],
  category: 'avatars' | 'covers' | 'posts' | 'stories' | 'messages' | 'groups' = 'posts',
): Promise<Array<{ url: string; type: string }>> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const response = await api.post(`/upload?category=${category}`, form);
  return (response.data as { items: Array<{ url: string; type: string }> }).items;
}
