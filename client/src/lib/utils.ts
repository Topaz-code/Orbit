import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNowStrict, isThisYear, isToday, isYesterday } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** "2h ago", "3d ago" — compact relative time used on posts and comments. */
export function relativeTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 45) return 'just now';
  return `${formatDistanceToNowStrict(date)
    .replace(' seconds', 's')
    .replace(' second', 's')
    .replace(' minutes', 'm')
    .replace(' minute', 'm')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd')
    .replace(' months', 'mo')
    .replace(' month', 'mo')
    .replace(' years', 'y')
    .replace(' year', 'y')} ago`;
}

/** Chat list timestamps: time for today, "Yesterday", weekday, then date. */
export function chatTimestamp(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'd MMM');
  return format(date, 'dd/MM/yy');
}

export function fullTimestamp(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, "d MMM yyyy 'at' HH:mm");
}

export function joinedDate(value: string | Date | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, 'MMMM yyyy');
}

export function callDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

/** Resolves an API-relative media path against the current origin. */
export function mediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

export function lastSeenLabel(user: { isOnline: boolean; lastSeen: string | null }): string {
  if (user.isOnline) return 'Active now';
  if (!user.lastSeen) return 'Offline';
  return `Active ${relativeTime(user.lastSeen)}`;
}

/** Splits text into plain segments, #hashtags, @mentions and URLs for rich rendering. */
export type TextToken =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'url'; value: string };

export function tokenizeText(text: string): TextToken[] {
  const pattern = /(https?:\/\/[^\s]+)|(#[\p{L}\p{N}_]{2,40})|(@[a-zA-Z0-9_]{3,30})/gu;
  const tokens: TextToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) tokens.push({ type: 'url', value: match[1] });
    else if (match[2]) tokens.push({ type: 'hashtag', value: match[2] });
    else if (match[3]) tokens.push({ type: 'mention', value: match[3] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) });
  return tokens;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Groups messages so consecutive messages from one sender render as a cluster. */
export function shouldGroupMessage(
  current: { senderId: string; createdAt: string },
  previous?: { senderId: string; createdAt: string },
): boolean {
  if (!previous) return false;
  if (previous.senderId !== current.senderId) return false;
  const gap = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return gap < 5 * 60 * 1000;
}

export function dayLabel(value: string): string {
  const date = new Date(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'EEEE, d MMMM');
  return format(date, 'd MMMM yyyy');
}
