/**
 * In-memory presence registry.
 *
 * Kept separate from the MQTT broker module so that scripts which only need to serialize users
 * (the seeder, CLI tools, tests) do not have to boot a broker.
 */
const connectionsByUser = new Map<string, number>();

type PresenceHandler = (userId: string, online: boolean) => void;
const handlers = new Set<PresenceHandler>();

export function onPresenceChange(handler: PresenceHandler): void {
  handlers.add(handler);
}

function emit(userId: string, online: boolean): void {
  for (const handler of handlers) handler(userId, online);
}

/** Returns true when this is the user's first connection. */
export function addConnection(userId: string): boolean {
  const next = (connectionsByUser.get(userId) ?? 0) + 1;
  connectionsByUser.set(userId, next);
  if (next === 1) {
    emit(userId, true);
    return true;
  }
  return false;
}

/** Returns true when the user's last connection has gone away. */
export function removeConnection(userId: string): boolean {
  const next = (connectionsByUser.get(userId) ?? 1) - 1;
  if (next <= 0) {
    connectionsByUser.delete(userId);
    emit(userId, false);
    return true;
  }
  connectionsByUser.set(userId, next);
  return false;
}

export function isUserOnline(userId: string): boolean {
  return (connectionsByUser.get(userId) ?? 0) > 0;
}

export function onlineUserIds(): string[] {
  return [...connectionsByUser.keys()];
}
