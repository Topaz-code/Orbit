/**
 * Runs `prisma generate` in a way that never needs network access.
 *
 * Orbit uses the `prisma-client` generator with a driver adapter (better-sqlite3), so no
 * query-engine or schema-engine binary is ever loaded at runtime. The Prisma CLI still probes
 * binaries.prisma.sh for a schema-engine before generating, which fails on offline/firewalled
 * machines. Pointing PRISMA_SCHEMA_ENGINE_BINARY at a local placeholder skips that download
 * without changing generated output. If the user already set the variable, we respect it.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const placeholder = path.join(serverRoot, 'node_modules', '.orbit', 'schema-engine-placeholder');

if (!process.env.PRISMA_SCHEMA_ENGINE_BINARY) {
  fs.mkdirSync(path.dirname(placeholder), { recursive: true });
  if (!fs.existsSync(placeholder)) {
    fs.writeFileSync(placeholder, '');
    fs.chmodSync(placeholder, 0o755);
  }
  process.env.PRISMA_SCHEMA_ENGINE_BINARY = placeholder;
}
process.env.CHECKPOINT_DISABLE = process.env.CHECKPOINT_DISABLE ?? '1';

const result = spawnSync('prisma', ['generate', ...process.argv.slice(2)], {
  cwd: serverRoot,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
