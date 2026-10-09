// Decides whether this workflow run should build an edition. Used by .github/workflows/daily.yml.
//
//   node scripts/should-run.js <event> <data folder>
//
// Prints run=true or run=false (for $GITHUB_OUTPUT) and a plain-English reason.
//
// - Manual runs ("Run workflow") always build.
// - Scheduled runs fire at 21:00 and 22:00 UTC. Melbourne is UTC+11 in summer (AEDT) and UTC+10 in
//   winter (AEST), so one of them lands at 8am Melbourne and the other at 7am or 9am. A scheduled run
//   builds only if it's at or after the run hour in settings (8am) in Melbourne and today's edition
//   doesn't exist yet. That covers the daylight-saving switch, a late start by GitHub, and stops the
//   second run from building twice.
// - Anything else (a change merged into main) just republishes the app.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { melbourneDate, melbourneParts } from '../pipeline/lib/time.js';

const [event, dataDir] = process.argv.slice(2);
const root = new URL('..', import.meta.url).pathname;
const settings = JSON.parse(readFileSync(join(root, 'config', 'settings.json'), 'utf8'));
const runHour = Number(settings.schedule?.runLocalHour ?? 8);

function decide(now = new Date()) {
  if (event === 'workflow_dispatch') return [true, 'Manual run: building a fresh edition.'];
  if (event !== 'schedule') return [false, 'Not a scheduled or manual run: republishing the app only.'];

  const hour = Number(melbourneParts(now).hour);
  const today = melbourneDate(now);
  if (hour < runHour) return [false, `It's ${hour}:00 in Melbourne, before the ${runHour}am run. The other scheduled run will build today's edition.`];

  let latestDate = null;
  try { latestDate = JSON.parse(readFileSync(join(dataDir, 'latest.json'), 'utf8')).edition?.date; } catch { /* no edition yet */ }
  if (latestDate === today) return [false, `Today's edition (${today}) already exists. Nothing to do.`];
  return [true, `It's ${hour}:00 in Melbourne and there's no edition for ${today} yet: building it.`];
}

const [run, reason] = decide();
console.log(reason);
console.log(`run=${run}`);
