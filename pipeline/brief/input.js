// Turns today's edition (and facts.json) into the compact input Claude writes from.
// Every item gets an id (like "nfl-h3") so Claude can say which items each sentence came from,
// and so the app can link each written story back to its sources.

const clip = (text, n) => (text && text.length > n ? `${text.slice(0, n - 1)}…` : text || null);

// Rough token estimate for the cost guard (about 3.5 characters per token for this kind of JSON).
export const estimateTokens = obj => Math.ceil(JSON.stringify(obj).length / 3.5);

function leagueInput(league, section, facts, limits) {
  const id = (kind, i) => `${league}-${kind}${i + 1}`;
  const headlines = (section.headlines || []).slice(0, limits.headlines).map((h, i) => ({
    id: id('h', i), title: h.title, summary: clip(h.summary, limits.summaryChars), teams: h.teams,
  }));
  const results = (section.results || []).slice(0, limits.results).map((g, i) => ({
    id: id('r', i),
    game: `${g.away.name} ${g.away.score} at ${g.home.name} ${g.home.score}`,
    status: g.status, note: g.note || undefined, date: g.start,
  }));
  const standings = (section.standings?.groups || []).map(gr => ({
    group: gr.name,
    teams: gr.rows.map(r => `${r.abbr} ${r.w}-${r.l}${r.t ? `-${r.t}` : ''}${r.streak ? ` ${r.streak}` : ''}`).join(', '),
  }));
  const playoffPicture = section.playoffPicture?.conferences?.map(c => ({
    conference: c.name,
    seeds: c.seeds.map(s => `${s.seed}. ${s.abbr} ${s.record}`).join(', '),
    outside: c.outside.map(o => `${o.abbr} ${o.record} (${o.gb} GB)`).join(', '),
  }));
  const injuries = (section.majorInjuries || []).slice(0, limits.injuries).map((p, i) => ({
    id: id('i', i), player: p.player, team: p.team, status: p.status, injury: p.injury,
  }));
  const moves = (section.transactions || []).slice(0, limits.moves).map((t, i) => ({ id: id('t', i), type: t.type, text: t.text }));
  const pulse = {
    hot: [...(section.pulse?.hot?.teams || []).map(t => `${t.abbr} ${t.form}: ${t.note}`), ...(section.pulse?.hot?.players || []).map(p => `${p.name} (${p.team}): ${p.note}`)],
    cold: (section.pulse?.cold?.teams || []).map(t => `${t.abbr} ${t.form}: ${t.note}`),
  };
  const statLeaders = (facts?.leaders?.[league] || []).slice(0, limits.leaderCategories).map((c, i) => ({
    id: id('l', i),
    category: c.category,
    leaders: c.leaders.slice(0, limits.leadersPer).map(l => `${l.name} (${l.team}) ${l.value}`).join('; '),
  }));
  return { headlines, results, standings, ...(playoffPicture ? { playoffPicture } : {}), hotAndCold: pulse, majorInjuries: injuries, transactions: moves, statLeaders };
}

function teamInput(league, team, limits) {
  if (!team) return null;
  const facts = [];
  // `_sources` stays on our side: it's stripped before sending (see forClaude) and used to link the written items.
  const add = (kind, text, sources = []) => facts.push({ id: `myteam-${league}-f${facts.length + 1}`, kind, text, _sources: sources });
  if (team.lastResult) {
    const r = team.lastResult;
    add('last result', `${r.result} ${r.teamScore}-${r.oppScore} ${r.homeAway === 'home' ? 'vs' : 'at'} ${r.opponent.name}${r.note ? ` (${r.note})` : ''}, ${r.start}`);
  }
  if (team.nextGame) add('next game', `${team.nextGame.homeAway === 'home' ? 'vs' : 'at'} ${team.nextGame.opponent.name}, ${team.nextGame.start}${team.nextGame.note ? ` (${team.nextGame.note})` : ''}`);
  for (const s of team.sinceLast || []) add('since last edition', s.text, s.sources);
  for (const n of (team.news || []).slice(0, limits.teamNews)) {
    if ((team.sinceLast || []).some(s => s.text === n.text)) continue;
    add(n.type === 'News' ? 'news headline' : `roster move (${n.type})`, n.text, n.sources);
  }
  if (team.playoffRace?.summary) add('playoff race', team.playoffRace.summary);
  return {
    name: team.name,
    record: team.record,
    facts,
    injuries: (team.injuries || []).map(i => ({ player: i.player, position: i.position, status: i.status, injury: i.injury, note: i.about || undefined, reportedTimeline: i.timeline?.text || undefined })),
    form: (team.form || []).map(p => ({ player: p.player, position: p.position, trend: p.trend, seasonLabel: p.seasonLabel, stats: p.stats.map(s => `${s.label}: last 5 ${s.last5}, season ${s.season}`).join('; ') })),
  };
}

export const DEFAULT_LIMITS = {
  headlines: 10, summaryChars: 260, results: 16, injuries: 8, moves: 8,
  leaderCategories: 8, leadersPer: 5, teamNews: 6,
};

// Smaller limits, tried in order if the input is over the token budget.
export const TRIM_STEPS = [
  { headlines: 8, summaryChars: 180, results: 12, moves: 6, leadersPer: 4 },
  { headlines: 6, summaryChars: 120, results: 10, injuries: 6, moves: 4, leaderCategories: 6, leadersPer: 3, teamNews: 4 },
  { headlines: 5, summaryChars: 80, results: 8, injuries: 4, moves: 3, leaderCategories: 4, leadersPer: 3, teamNews: 3 },
];

export function buildInput(edition, facts, recentContextCards, limits = DEFAULT_LIMITS) {
  return {
    today: edition.edition.date,
    note: 'All times are UTC ISO strings unless stated. Records are wins-losses(-ties). GB means games behind.',
    recentContextCards,
    nfl: leagueInput('nfl', edition.nfl, facts, limits),
    nba: leagueInput('nba', edition.nba, facts, limits),
    myTeams: {
      nfl: teamInput('nfl', edition.myTeams?.nfl, limits),
      nba: teamInput('nba', edition.myTeams?.nba, limits),
    },
  };
}

// Every id in the input, mapped to what it points at (for checking refs and finding sources).
export function idIndex(input, edition) {
  const index = new Map();
  for (const league of ['nfl', 'nba']) {
    const data = input[league];
    data.headlines.forEach((h, i) => index.set(h.id, { kind: 'headline', league, item: edition[league].headlines[i] }));
    data.results.forEach(r => index.set(r.id, { kind: 'result', league }));
    data.majorInjuries.forEach(r => index.set(r.id, { kind: 'injury', league }));
    data.transactions.forEach(r => index.set(r.id, { kind: 'move', league }));
    data.statLeaders.forEach(r => index.set(r.id, { kind: 'leaders', league }));
    input.myTeams[league]?.facts.forEach(f => index.set(f.id, { kind: 'teamfact', league, sources: f._sources || [] }));
  }
  return index;
}

// The input exactly as Claude sees it: our private `_` fields removed.
export function forClaude(input) {
  return JSON.parse(JSON.stringify(input, (key, value) => (key.startsWith('_') ? undefined : value)));
}
