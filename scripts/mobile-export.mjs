#!/usr/bin/env node
/**
 * Static export for Capacitor.
 *
 * `output: 'export'` cannot carry dynamic route handlers (API routes and OAuth callbacks),
 * and the native app doesn't need them — it calls NEXT_PUBLIC_API_ORIGIN (the deployed web
 * app) for all server work. So we temporarily move them out of the tree, run the export,
 * then restore them no matter what.
 */
import { execSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dirsToStash = [
  { original: join(root, 'src', 'app', 'api'), stash: join(root, 'src', 'app', '_api_stash') },
  { original: join(root, 'src', 'app', 'auth'), stash: join(root, 'src', 'app', '_auth_stash') },
];

function restore() {
  for (const { original, stash } of dirsToStash) {
    if (existsSync(stash)) renameSync(stash, original);
  }
}

try {
  for (const { original, stash } of dirsToStash) {
    if (existsSync(original)) renameSync(original, stash);
  }
  execSync('next build', {
    stdio: 'inherit',
    env: { ...process.env, MOBILE_EXPORT: '1' },
  });
} catch (e) {
  restore();
  console.error('\nMobile export failed.');
  process.exit(1);
} finally {
  restore();
}
console.log('\n✓ Static export written to ./out (server routes restored).');
