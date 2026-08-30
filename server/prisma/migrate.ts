/**
 * Applies the SQL migrations in prisma/migrations/* to the SQLite database.
 *
 * Why not `prisma migrate dev`? That command needs Prisma's schema-engine binary, which is
 * downloaded from binaries.prisma.sh at runtime. Orbit is designed to install and run fully
 * offline on a laptop, so we apply the same migration.sql files ourselves with better-sqlite3
 * and track them in a `_migrations` table. Users who can reach the CDN may still use the
 * Prisma CLI — the directory layout is identical.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DATABASE_FILE, MIGRATIONS_DIR, UPLOAD_SUBDIRS, UPLOADS_DIR } from '../src/config/paths.js';

const force = process.argv.includes('--force');

function ensureDirectories(): void {
  fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const dir of UPLOAD_SUBDIRS) {
    fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
  }
}

function main(): void {
  ensureDirectories();

  if (force && fs.existsSync(DATABASE_FILE)) {
    fs.rmSync(DATABASE_FILE);
    for (const suffix of ['-wal', '-shm']) {
      const extra = `${DATABASE_FILE}${suffix}`;
      if (fs.existsSync(extra)) fs.rmSync(extra);
    }
    console.log('⟳  Dropped existing database');
  }

  const db = new Database(DATABASE_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`CREATE TABLE IF NOT EXISTS "_migrations" (
    "name" TEXT PRIMARY KEY,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const applied = new Set(
    db.prepare('SELECT name FROM "_migrations"').all().map((row) => (row as { name: string }).name),
  );

  const migrations = fs.existsSync(MIGRATIONS_DIR)
    ? fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((entry) => fs.existsSync(path.join(MIGRATIONS_DIR, entry, 'migration.sql')))
        .sort()
    : [];

  if (migrations.length === 0) {
    console.warn('No migrations found in', MIGRATIONS_DIR);
  }

  let count = 0;
  for (const name of migrations) {
    if (applied.has(name)) {
      console.log(`•  ${name} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO "_migrations" (name) VALUES (?)').run(name);
      db.exec('COMMIT');
      count += 1;
      console.log(`✓  applied ${name}`);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  db.close();
  console.log(
    count > 0
      ? `\n✅ Database ready at ${DATABASE_FILE} (${count} migration${count === 1 ? '' : 's'} applied)`
      : `\n✅ Database already up to date at ${DATABASE_FILE}`,
  );
}

main();
