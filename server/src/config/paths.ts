import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** server/ — resolved from src/config or dist/config alike. */
export const SERVER_ROOT = path.resolve(here, '..', '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

export const DATA_DIR = process.env.ORBIT_DATA_DIR
  ? path.resolve(process.env.ORBIT_DATA_DIR)
  : path.join(SERVER_ROOT, 'prisma');

export const DATABASE_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(DATA_DIR, 'orbit.db');

export const DATABASE_URL = `file:${DATABASE_FILE}`;

export const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'prisma', 'migrations');

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(SERVER_ROOT, 'uploads');

export const UPLOAD_SUBDIRS = ['avatars', 'covers', 'posts', 'stories', 'messages', 'groups'] as const;

export type UploadCategory = (typeof UPLOAD_SUBDIRS)[number];

export function ensureUploadDirs(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const dir of UPLOAD_SUBDIRS) {
    fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
  }
}
