// Puts the website together in _site/, ready for GitHub Pages:
//   site/                  -> the app itself
//   config/settings.json   -> _site/settings.json (the app reads teams, toggles and season dates from it)
//   edition data           -> _site/data/
//
// Usage: node scripts/build-site.js [data folder]
// With no data folder (or an empty one), it uses the clearly marked sample edition in sample/.

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, '_site');
const requested = process.argv[2];
const hasData = requested && existsSync(join(requested, 'latest.json'));
const dataDir = hasData ? requested : join(root, 'sample');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'site'), out, { recursive: true });
cpSync(join(root, 'config', 'settings.json'), join(out, 'settings.json'));
cpSync(dataDir, join(out, 'data'), { recursive: true });

console.log(`Built _site/ using ${hasData ? `edition data from ${requested}` : 'the SAMPLE edition'}.`);
