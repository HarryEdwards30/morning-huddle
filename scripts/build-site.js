// Puts the website together in _site/, ready for GitHub Pages:
//   site/                  -> the app itself
//   config/settings.json   -> _site/settings.json (the app reads teams, toggles and season dates from it)
//   edition data           -> _site/data/
//   site/sw.js             -> filled in with a version and the list of files to keep for offline use
//
// Usage: node scripts/build-site.js [data folder]
// With no data folder (or an empty one), it uses the clearly marked sample edition in sample/.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, '_site');
const requested = process.argv[2];
const hasData = requested && existsSync(join(requested, 'latest.json'));
const dataDir = hasData ? requested : join(root, 'sample');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'site'), out, { recursive: true });
cpSync(join(root, 'config', 'settings.json'), join(out, 'settings.json'));
// Copy the edition files only (not git's bookkeeping or the data branch's README).
cpSync(dataDir, join(out, 'data'), { recursive: true, filter: src => !['.git', 'README.md'].includes(basename(src)) });

// Offline copy: the app's own files plus the latest edition, its status and the archive list.
// (Past editions are kept on the phone once they've been opened.) A new version on every build means
// phones pick up the new copy the next time the app is opened.
const appFiles = dir => readdirSync(dir).flatMap(f => {
  const path = join(dir, f);
  return statSync(path).isDirectory() ? appFiles(path) : [relative(out, path)];
});
const keep = ['./', ...appFiles(out).filter(f => !f.startsWith('data/') && f !== 'sw.js'),
  'data/latest.json', 'data/status.json', 'data/editions/index.json'];
const sw = join(out, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8')
  .replace("'__BUILD_VERSION__'", JSON.stringify(new Date().toISOString()))
  .replace("['__FILES__']", JSON.stringify(keep)));

console.log(`Built _site/ using ${hasData ? `edition data from ${requested}` : 'the SAMPLE edition'}.`);
