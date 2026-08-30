import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../prisma/generated/client.js';
import { DATABASE_FILE, DATABASE_URL } from './paths.js';

fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });

if (!fs.existsSync(DATABASE_FILE)) {
  console.warn(
    `\n⚠️  No database found at ${DATABASE_FILE}\n   Run "npm run db:setup" to create and seed it.\n`,
  );
}

// Enable WAL + foreign keys once, before Prisma opens its own pool.
try {
  const bootstrap = new Database(DATABASE_FILE);
  bootstrap.pragma('journal_mode = WAL');
  bootstrap.pragma('foreign_keys = ON');
  bootstrap.close();
} catch {
  /* database will be created by the adapter */
}

const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
