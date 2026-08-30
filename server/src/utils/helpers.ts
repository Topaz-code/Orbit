import crypto from 'node:crypto';

/** Collision-resistant, sortable-ish id. Mirrors Prisma's cuid shape closely enough for our use. */
export function createId(prefix = 'c'): string {
  return `${prefix}${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`;
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function inviteCode(): string {
  return crypto.randomBytes(6).toString('base64url');
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Extracts #hashtags and @mentions from post/comment text. */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]{2,40}/gu) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z0-9_]{3,30}/g) ?? [];
  return [...new Set(matches.map((mention) => mention.slice(1).toLowerCase()))];
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(Math.trunc(parsed), 1, max);
}

/** Deterministic pseudo-random generator so seeds and placeholder art are reproducible. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
