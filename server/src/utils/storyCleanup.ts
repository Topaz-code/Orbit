import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

/**
 * Stories expire exactly `STORY_TTL_HOURS` (default 24h) after creation. This job removes the
 * rows — and any media files they own — on an interval. Queries also filter on expiresAt, so an
 * expired story is never visible even between runs.
 */
export async function deleteExpiredStories(): Promise<number> {
  const now = new Date();
  const expired = await prisma.story.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;

  await prisma.story.deleteMany({ where: { id: { in: expired.map((story) => story.id) } } });
  return expired.length;
}

export function startStoryCleanupJob(): NodeJS.Timeout {
  const intervalMs = Math.max(1, env.storyCleanupIntervalMinutes) * 60 * 1000;

  const run = () => {
    deleteExpiredStories()
      .then((count) => {
        if (count > 0) console.log(`🧹 Removed ${count} expired ${count === 1 ? 'story' : 'stories'}`);
      })
      .catch((error) => console.error('Story cleanup failed:', error));
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
