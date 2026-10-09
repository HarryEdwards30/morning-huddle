// The edition archive on the data branch: editions/YYYY-MM-DD.json (kept 60 days) and editions/index.json,
// the list the app reads to show past editions and past Wednesday Wraps.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const readJson = path => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };
const dates = dir => (existsSync(dir) ? readdirSync(dir) : [])
  .map(f => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1]).filter(Boolean).sort();

// Editions from the `days` days before `today` (oldest first), for the Wrap's look back over the week.
export function recentEditions(out, today, days) {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  return dates(join(out, 'editions')).filter(d => d >= from && d < today)
    .map(d => readJson(join(out, 'editions', `${d}.json`))).filter(Boolean);
}

// Rewrites editions/index.json: newest first, with each league's Wrap label on Wednesday editions.
export function writeArchiveIndex(out) {
  const dir = join(out, 'editions');
  const index = dates(dir).reverse().map(date => {
    const e = readJson(join(dir, `${date}.json`));
    if (!e) return null;
    return {
      date,
      type: e.edition?.type || 'daily',
      written: Boolean(e.edition?.written),
      wraps: { nfl: e.nfl?.wrap?.weekLabel || null, nba: e.nba?.wrap?.weekLabel || null },
    };
  }).filter(Boolean);
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index) + '\n');
}
