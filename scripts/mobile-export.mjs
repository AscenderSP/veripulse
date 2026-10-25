#!/usr/bin/env node
/**
 * Static export for Capacitor.
 *
 * `output: 'export'` cannot carry dynamic POST route handlers, and the native
 * app doesn't need them — it calls NEXT_PUBLIC_API_ORIGIN (the deployed web
 * app) for all server work. So we temporarily move src/app/api out of the
 * tree, run the export, then restore it no matter what.
 */
import { execSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const apiDir = join(root, 'src', 'app', 'api');
const stash = join(root, 'src', 'app', '_api_stash');

function restore() {
  if (existsSync(stash)) renameSync(stash, apiDir);
}

try {
  if (existsSync(apiDir)) renameSync(apiDir, stash);
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
console.log('\n✓ Static export written to ./out (API routes restored).');
