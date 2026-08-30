import { useEffect } from 'react';
import { subscribe, topics } from '@/lib/mqtt';
import { useChatStore } from '@/stores/chatStore';
import type { PresenceState } from '@/types';

/**
 * Presence has two sources:
 *  - the `isOnline` / `lastSeen` fields that come back on every user payload (the snapshot), and
 *  - `orbit/user/{id}/status` retained MQTT messages (the live updates).
 *
 * `seedPresence` feeds the first into the store; `usePresenceSubscriptions` wires up the second.
 */
export function seedPresence(
  users: Array<{ id: string; isOnline?: boolean; lastSeen?: string | null }> | undefined,
): void {
  if (!users?.length) return;
  const entries: PresenceState[] = users.map((user) => ({
    userId: user.id,
    isOnline: Boolean(user.isOnline),
    lastSeen: user.lastSeen ?? null,
  }));
  useChatStore.getState().setPresenceBulk(entries);
}

/** Keeps the store in sync with the snapshot embedded in an API response. */
export function usePresenceSeed(
  users: Array<{ id: string; isOnline?: boolean; lastSeen?: string | null }> | undefined,
): void {
  const key = (users ?? []).map((user) => `${user.id}:${user.isOnline ? 1 : 0}`).join(',');
  useEffect(() => {
    seedPresence(users);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Subscribes to the status topic of every user id passed in. */
export function usePresenceSubscriptions(userIds: Array<string | null | undefined>): void {
  const setPresence = useChatStore((state) => state.setPresence);
  const key = [...new Set(userIds.filter((id): id is string => Boolean(id)))].sort().join(',');

  useEffect(() => {
    const ids = key.split(',').filter(Boolean);
    if (!ids.length) return;

    const unsubscribers = ids.map((userId) =>
      subscribe(topics.userStatus(userId), (raw) => {
        const payload = raw as { userId?: string; isOnline?: boolean; lastSeen?: string | null };
        setPresence({
          userId: payload.userId ?? userId,
          isOnline: Boolean(payload.isOnline),
          lastSeen: payload.lastSeen ?? new Date().toISOString(),
        });
      }),
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [key, setPresence]);
}

/** Reads one user's live presence, falling back to the snapshot value passed in. */
export function usePresenceOf(userId: string | undefined, fallbackOnline = false): boolean {
  return useChatStore((state) => (userId ? state.presence[userId]?.isOnline ?? fallbackOnline : false));
}

export function useLastSeen(userId: string | undefined): string | null {
  return useChatStore((state) => (userId ? state.presence[userId]?.lastSeen ?? null : null));
}
