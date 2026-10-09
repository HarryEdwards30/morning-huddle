// Checks that every data source still answers, and prints a short outline of what each one returns.
// Run on GitHub (Actions) or locally with: npm run check-sources
// ESPN's endpoints are unofficial and undocumented, so this is the first thing to run if data stops appearing.

const SPORTS = { nba: 'basketball/nba', nfl: 'football/nfl' };
const TEAM_IDS = { nba: process.env.NBA_TEAM_ID || '24', nfl: process.env.NFL_TEAM_ID || '13' };

function ymd(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

// A compact outline of a JSON value: keys, array lengths and short sample values.
function outline(value, depth = 0, maxDepth = Number(process.env.OUTLINE_DEPTH || 3)) {
  const pad = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (depth >= maxDepth) return `[${value.length} items]`;
    return `[${value.length} items] first:\n${pad}  ${outline(value[0], depth + 1, maxDepth)}`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (depth >= maxDepth) return `{${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', …' : ''}}`;
    return '{\n' + keys.slice(0, 25).map(k => `${pad}  ${k}: ${outline(value[k], depth + 1, maxDepth)}`).join('\n') + `\n${pad}}`;
  }
  const text = JSON.stringify(value);
  return text && text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

async function check(name, url, { xml = false } = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'MorningHuddle/1.0 (personal news app)' } });
    const ms = Date.now() - started;
    const body = await response.text();
    console.log(`\n=== ${name} :: HTTP ${response.status} :: ${ms}ms :: ${body.length} bytes\n${url}`);
    if (!response.ok) return;
    if (xml) {
      const items = body.match(/<item>/g)?.length || 0;
      const first = body.match(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/);
      console.log(`items: ${items}; first: ${first ? `${first[1].trim()} | ${first[2].trim()}` : 'n/a'}`);
    } else {
      console.log(outline(JSON.parse(body)));
    }
  } catch (error) {
    console.log(`\n=== ${name} :: FAILED :: ${error.message}\n${url}`);
  }
}

const only = process.argv[2];
const today = new Date();
const yesterday = new Date(Date.now() - 86400000);

const checks = [];
for (const [league, path] of Object.entries(SPORTS)) {
  const site = `https://site.api.espn.com/apis/site/v2/sports/${path}`;
  const id = TEAM_IDS[league];
  checks.push(
    [`${league} teams`, `${site}/teams`],
    [`${league} scoreboard today`, `${site}/scoreboard?dates=${ymd(today)}`],
    [`${league} scoreboard yesterday`, `${site}/scoreboard?dates=${ymd(yesterday)}`],
    [`${league} news`, `${site}/news?limit=50`],
    [`${league} standings`, `https://site.api.espn.com/apis/v2/sports/${path}/standings`],
    [`${league} injuries`, `${site}/injuries`],
    [`${league} transactions`, `${site}/transactions`],
    [`${league} team`, `${site}/teams/${id}`],
    [`${league} team schedule`, `${site}/teams/${id}/schedule`],
    [`${league} team roster`, `${site}/teams/${id}/roster`],
    [`${league} team news`, `${site}/news?team=${id}&limit=20`],
  );
}
checks.push(
  ['espn nba rss', 'https://www.espn.com/espn/rss/nba/news', { xml: true }],
  ['espn nfl rss', 'https://www.espn.com/espn/rss/nfl/news', { xml: true }],
  ['cbs nba rss', 'https://www.cbssports.com/rss/headlines/nba/', { xml: true }],
  ['cbs nfl rss', 'https://www.cbssports.com/rss/headlines/nfl/', { xml: true }],
  ['yahoo nba rss', 'https://sports.yahoo.com/nba/rss.xml', { xml: true }],
  ['yahoo nfl rss', 'https://sports.yahoo.com/nfl/rss.xml', { xml: true }],
);

for (const [name, url, opts] of checks) {
  if (only && !name.includes(only)) continue;
  await check(name, url, opts);
}
