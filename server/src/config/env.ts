import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './paths.js';

/** Minimal .env loader — avoids a dotenv dependency and keeps startup dependency-free. */
function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(PROJECT_ROOT, '.env'));
loadEnvFile(path.join(PROJECT_ROOT, 'server', '.env'));

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: num(process.env.PORT, 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'orbit-dev-access-secret-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'orbit-dev-refresh-secret-change-me',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: num(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),
  maxImageBytes: num(process.env.MAX_IMAGE_BYTES, 10 * 1024 * 1024),
  maxVideoBytes: num(process.env.MAX_VIDEO_BYTES, 50 * 1024 * 1024),
  maxGroupMembers: num(process.env.MAX_GROUP_MEMBERS, 10),
  storyTtlHours: num(process.env.STORY_TTL_HOURS, 24),
  storyCleanupIntervalMinutes: num(process.env.STORY_CLEANUP_INTERVAL_MINUTES, 60),
  clientOrigin: process.env.CLIENT_ORIGIN ?? '',
} as const;

if (env.isProduction) {
  if (env.jwtSecret.includes('change-me') || env.jwtRefreshSecret.includes('change-me')) {
    console.warn(
      '⚠️  Running in production with default JWT secrets. Set JWT_SECRET and JWT_REFRESH_SECRET in .env',
    );
  }
}
