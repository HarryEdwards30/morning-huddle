// Standings, the NFL playoff picture, each hub's playoff race, and hot/cold teams.

const stat = (entry, name) => entry.stats?.find(s => s.name === name || s.type === name);
const num = (entry, name) => Number(stat(entry, name)?.value ?? 0);
const shown = (entry, name) => stat(entry, name)?.displayValue ?? '';

function row(entry, idx) {
  const id = String(entry.team.id);
  return {
    id,
    abbr: idx.abbr(id),
    name: entry.team.shortDisplayName || entry.team.name,
    w: num(entry, 'wins'),
    l: num(entry, 'losses'),
    t: num(entry, 'ties'),
    pct: shown(entry, 'winPercent'),
    gb: shown(entry, 'gamesBehind') === '-' ? '–' : shown(entry, 'gamesBehind'),
    streak: shown(entry, 'streak'),
    l10: stat(entry, 'lasttengames')?.displayValue || null,
    seed: num(entry, 'playoffSeed') || null,
    diff: num(entry, 'pointDifferential'),
  };
}

const bySeed = (a, b) => (a.seed ?? 99) - (b.seed ?? 99);
const byRecord = (a, b) => (b.w - b.l) - (a.w - a.l) || b.diff - a.diff;

// NBA: one table per conference, ordered by seed. Jack's conference first.
export function nbaStandings(json, idx) {
  const groups = (json?.children || []).map(conf => ({
    name: conf.name,
    short: conf.abbreviation,
    rows: (conf.standings?.entries || []).map(e => row(e, idx)).sort(bySeed),
  }));
  groups.sort((a, b) => Number(b.rows.some(r => idx.isMine(r.id))) - Number(a.rows.some(r => idx.isMine(r.id))));
  return { groups };
}

// NFL: four divisions per conference (from the level=3 standings).
export function nflStandings(json, idx) {
  const groups = [];
  for (const conf of json?.children || []) {
    for (const div of conf.children || []) {
      groups.push({
        conference: conf.abbreviation,
        name: div.name,
        rows: (div.standings?.entries || []).map(e => row(e, idx)).sort(byRecord),
      });
    }
  }
  return { groups };
}

const gamesBehind = (leader, team) => ((leader.w - team.w) + (team.l - leader.l)) / 2;
const fmtGb = n => (n <= 0 ? '–' : n.toFixed(1));

// NFL playoff picture: seeds 1 to 7 in each conference, then the first teams out (and Jack's team if lower).
export function nflPlayoffPicture(confJson, idx) {
  const conferences = (confJson?.children || []).map(conf => {
    const rows = (conf.standings?.entries || []).map(e => row(e, idx)).filter(r => r.seed).sort(bySeed);
    const seventh = rows.find(r => r.seed === 7);
    const seeds = rows.filter(r => r.seed <= 7).map(r => ({
      seed: r.seed, abbr: r.abbr, name: r.name, record: record(r), how: r.seed <= 4 ? 'Division leader' : 'Wild card',
    }));
    const out = rows.filter(r => r.seed > 7);
    const outside = out.filter((r, i) => i < 3 || idx.isMine(r.id)).map(r => ({
      abbr: r.abbr, name: r.name, record: record(r), gb: seventh ? fmtGb(gamesBehind(seventh, r)) : '–',
    }));
    return { name: conf.abbreviation, seeds, outside };
  });
  if (!conferences.some(c => c.seeds.length)) return null;
  return {
    note: 'Seeds 1 to 4 are the division leaders. 5 to 7 are wild cards. Only the No. 1 seed gets a first-round bye.',
    conferences,
  };
}

const record = r => (r.t ? `${r.w}–${r.l}–${r.t}` : `${r.w}–${r.l}`);

const ordinal = n => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// The playoff race card in a team hub: the team's conference table around the playoff line.
export function playoffRace(league, confJson, idx) {
  const conf = (confJson?.children || []).find(c => (c.standings?.entries || []).some(e => idx.isMine(e.team.id)));
  if (!conf) return null;
  const rows = (conf.standings.entries || []).map(e => row(e, idx)).sort(bySeed);
  const mine = rows.find(r => idx.isMine(r.id));
  const cutoff = league === 'nfl' ? 7 : 6;
  const lastIn = league === 'nfl' ? rows.find(r => r.seed === 7) : rows.find(r => r.seed === 10);
  const shownRows = rows.filter(r => r.seed <= (league === 'nfl' ? 10 : 10) || idx.isMine(r.id));
  const gp = r => r.w + r.l + r.t;
  const summary = !mine || gp(mine) === 0
    ? `The regular season hasn't started yet. Every team in the ${conf.abbreviation} is 0–0.`
    : `${ordinal(mine.seed)} in the ${conf.abbreviation} at ${record(mine)}.` +
      (lastIn && mine.seed > (league === 'nfl' ? 7 : 10)
        ? ` ${fmtGb(gamesBehind(lastIn, mine))} games behind the last ${league === 'nfl' ? 'playoff' : 'play-in'} spot.`
        : '');
  const started = rows.some(r => gp(r) > 0);
  return {
    groupName: conf.abbreviation,
    summary,
    cutoffAfter: cutoff,
    cutoffLabel: league === 'nfl'
      ? 'Top 7 make the playoffs: 4 division leaders and 3 wild cards. GB is games behind the conference leader.'
      : 'Top 6 go straight to the playoffs. 7 to 10 play in. GB is games behind the conference leader.',
    rows: started ? shownRows.map(r => ({ seed: r.seed, abbr: r.abbr, name: r.name, record: record(r), gb: r.gb })) : [],
    seedsById: Object.fromEntries(rows.map(r => [r.id, { seed: r.seed, conf: conf.abbreviation }])),
  };
}

// Hot and cold teams from current streaks (and last-10 records in the NBA). Needs a few games played.
export function hotAndCold(league, allGroups) {
  const rows = allGroups.flatMap(g => g.rows);
  const streakOf = r => {
    const m = /^([WL])(\d+)$/.exec(r.streak || '');
    return m ? (m[1] === 'W' ? 1 : -1) * Number(m[2]) : 0;
  };
  const min = league === 'nba' ? 4 : 3;
  const describe = (r, s) => ({
    abbr: r.abbr,
    name: r.name,
    form: r.l10 ? `${r.streak} · ${r.l10} L10` : r.streak,
    note: `${Math.abs(s)} straight ${s > 0 ? 'wins' : 'losses'}, now ${record(r)}.`,
  });
  const hot = rows.map(r => [r, streakOf(r)]).filter(([, s]) => s >= min).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, s]) => describe(r, s));
  const cold = rows.map(r => [r, streakOf(r)]).filter(([, s]) => s <= -min).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([r, s]) => describe(r, s));
  return { hot, cold };
}
