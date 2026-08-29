import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'dist/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const required = ['id', 'name', 'description', 'authors', 'version', 'main'];

for (const field of required) {
  if (!(field in manifest) || manifest[field] === undefined) {
    throw new Error(`Manifest missing required field: ${field}`);
  }
}

if (!Array.isArray(manifest.authors) || manifest.authors.length === 0) {
  throw new Error('Manifest authors must be a non-empty array.');
}

if (manifest.type !== 'plugin') {
  throw new Error('Manifest type must be "plugin".');
}

const bundlePath = resolve(dirname(manifestPath), manifest.main);
await access(bundlePath);
const bundle = await readFile(bundlePath, 'utf8');

// This intentionally mirrors Unbound's current plugin evaluator.
const iife = eval(`(() => { return ${bundle} })`);
const payload = iife();
const instance = payload?.default ?? payload;

if (typeof instance?.start !== 'function' || typeof instance?.stop !== 'function') {
  throw new Error('Bundle did not evaluate to an Unbound start/stop plugin.');
}

console.log(`Verified ${manifest.id}: manifest + ${manifest.main}`);
