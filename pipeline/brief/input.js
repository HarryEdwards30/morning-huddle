// Turns today's edition (and facts.json) into the compact input Claude writes from.
// Every item gets an id (like "nfl-h3") so Claude can say which items each sentence came from,
// and so the app can link each written story back to its sources.

import { describeForClaude } from '../shape/week.js';

const clip = (text, n) => (text && text.length > n ? `${text.slice(0, n - 1)}…` : text || null);

// Rough token estimate for the cost guard (about 3.5 characters per token for this kind of JSON).
export const estimateTokens = obj => Math.ceil(JSON.stringify(obj).length / 3.5);

// The stories, games and standout performances since the last edition (from facts.json `daily`), in the
// order they matter: notable games and Jack's team first; the newest news first.
function dailyLists(league, section, daily, limits) {
  const id = (kind, i) => `${league}-${kind}${i + 1}`;
  const story = (s, i, kind) => ({
    id: id(kind, i), title: s.title, summary: clip(s.summary, limits.summaryChars) || undefined,
    teams: s.teams?.length ? s.teams : undefined, outlet: s.publisher,
    detail: i < limits.detailStories && s.detailText ? clip(s.detailText, limits.detailChars) : undefined,
  });
  const gameFacts = new Map((daily?.games || []).map(g => [g.id, g]));
  const ordered = [...(section.results || [])].sort((a, b) => {
    const fa = gameFacts.get(a.id) || {}, fb = gameFacts.get(b.id) || {};
    return Number(Boolean(fb.notable)) - Number(Boolean(fa.notable));
  });
  const results = ordered.filter((g, i) => i < limits.results || gameFacts.get(g.id)?.notable).map((g, i) => {
    const f = gameFacts.get(g.id) || {};
    const record = side => (side.record ? ` (${side.record})` : '');
    return {
      id: id('r', i), _ref: g.id,
      game: `${g.away.name}${record(g.away)} ${g.away.score} at ${g.home.name}${record(g.home)} ${g.home.score}`,
      status: g.status, note: g.note || undefined, date: g.start,
      notable: f.notable || undefined,
      flags: f.flags?.length ? f.flags : undefined,
      keyPlayers: (f.players || []).slice(0, f.notable ? 99 : limits.playersPerOtherGame),
    };
  });
  return {
    stories: (daily?.stories || []).slice(0, limits.stories).map((s, i) => story(s, i, 'h')),
    teamStories: (daily?.teamStories || []).slice(0, limits.teamStories).map((s, i) => story(s, i, 'tm')),
    results,
    standoutCandidates: (daily?.standouts || []).slice(0, limits.standouts).map((p, i) => ({ id: id('sp', i), line: `${p.name} (${p.team}): ${p.line}, ${p.game}` })),
    recapGuide: daily?.plan?.recapAll ? 'Recap every game.' : `Recap about ${daily?.plan?.suggested ?? 5} games: the notable ones (notable: true) first. Always recap Jack's team.`,
  };
}

// About how many words to write for a league, from how much happened (not fixed counts).
// Roughly 230 words is a minute's reading.
export function targetWords(lists) {
  const stories = lists.stories.length;
  const top = Math.min(6, Math.ceil(stories / 4));
  const recaps = lists.recapGuide.startsWith('Recap every') ? lists.results.length : Math.min(lists.results.length, Number(lists.recapGuide.match(/about (\d+)/)?.[1] || 5));
  const words = 50 + top * 100 + lists.teamStories.length * 35 + recaps * 70
    + Math.min(5, lists.standoutCandidates.length) * 30 + Math.min(15, Math.max(0, stories - top)) * 18;
  return Math.max(120, Math.min(1700, Math.round(words / 10) * 10));
}

function leagueInput(league, section, facts, limits) {
  const week = facts?.week?.[league];
  const id = (kind, i) => `${league}-${kind}${i + 1}`;
  const lists = dailyLists(league, section, facts?.daily?.[league], limits);
  // #N is the team's current place (seed) in its conference, so Claude never has to work it out.
  const standings = (section.standings?.groups || []).map(gr => ({
    group: gr.name,
    teams: gr.rows.map(r => `${r.seed && r.w + r.l + r.t ? `#${r.seed} ` : ''}${r.abbr} ${r.w}-${r.l}${r.t ? `-${r.t}` : ''}${r.streak && r.streak !== '-' ? ` ${r.streak}` : ''}`).join(', '),
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
  const followed = (section.followedPlayers || []).map((p, i) => ({
    id: id('p', i), player: `${p.name}${p.team ? ` (${p.team})` : ''}`, facts: p.facts.map(f => f.text),
  }));
  return {
    ...(section.offSeason ? { offSeason: true } : {}),
    ...(followed.length ? { followedPlayers: followed } : {}),
    ...lists, standings, ...(playoffPicture ? { playoffPicture } : {}), hotAndCold: pulse, majorInjuries: injuries, transactions: moves, statLeaders,
    ...(week ? { week: weekInput(league, week, limits), watchCandidates: watchInput(league, week, limits) } : {}),
  };
}

// Wednesdays: the past seven days, for the Wrap.
function weekInput(league, week, limits) {
  const id = (kind, i) => `${league}-${kind}${i + 1}`;
  return {
    label: week.label,
    results: week.results.slice(0, limits.weekResults).map((g, i) => ({
      id: id('w', i), game: `${g.away.name} ${g.away.score} at ${g.home.name} ${g.home.score}`, note: g.note || undefined, date: g.start,
    })),
    standouts: week.standouts.map((p, i) => ({ id: id('s', i), line: `${p.name} (${p.team}): ${p.note}` })),
    headlines: week.headlines.slice(0, limits.weekHeadlines).map((h, i) => ({
      id: id('wh', i), title: h.title, summary: clip(h.summary, limits.summaryChars), teams: h.teams,
    })),
    transactions: week.moves.slice(0, limits.weekMoves).map((t, i) => ({ id: id('wt', i), type: t.type, text: t.text })),
  };
}

// Wednesdays: the games in the coming week, already ranked on paper, plus all of Jack's team's games.
function watchInput(league, week, limits) {
  return watchGames(week, limits).map((g, i) => ({ id: `${league}-g${i + 1}`, ...describeForClaude(league, g) }));
}
const watchGames = (week, limits) => week.games.filter((g, i) => i < limits.watchGames || g.mine);

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
  stories: 30, teamStories: 20, detailStories: 10, detailChars: 1200, summaryChars: 300,
  results: 16, playersPerOtherGame: 2, standouts: 10, injuries: 8, moves: 8,
  leaderCategories: 8, leadersPer: 5, teamNews: 6,
  weekResults: 60, weekHeadlines: 14, weekMoves: 10, watchGames: 12,
};

// Smaller limits, tried in order if the input is over the token budget. The lowest-priority items go
// first: older news (the lists are newest first), story detail, and the key players of non-notable games
// (notable games and Jack's team always keep theirs).
export const TRIM_STEPS = [
  { stories: 24, detailChars: 900, playersPerOtherGame: 1, moves: 6, leadersPer: 4, weekResults: 45, weekHeadlines: 12, weekMoves: 8 },
  { stories: 18, teamStories: 15, detailStories: 6, detailChars: 700, summaryChars: 200, playersPerOtherGame: 0, results: 10, injuries: 6, moves: 4, leaderCategories: 6, leadersPer: 3, teamNews: 4, weekResults: 30, weekHeadlines: 10, weekMoves: 6, watchGames: 10 },
  { stories: 12, teamStories: 10, detailStories: 4, detailChars: 500, summaryChars: 140, results: 6, injuries: 4, moves: 3, leaderCategories: 4, leadersPer: 3, teamNews: 3, weekResults: 20, weekHeadlines: 8, weekMoves: 4, watchGames: 8 },
];

// The whole brief aims for 5 to 10 minutes on a normal day, longer on a big day (about 11 at most).
const MAX_TOTAL_WORDS = 2600;

export function buildInput(edition, facts, recentContextCards, limits = DEFAULT_LIMITS) {
  const nfl = leagueInput('nfl', edition.nfl, facts, limits);
  const nba = leagueInput('nba', edition.nba, facts, limits);
  const raw = { nfl: targetWords(nfl), nba: targetWords(nba) };
  const scale = Math.min(1, MAX_TOTAL_WORDS / (raw.nfl + raw.nba));
  for (const [league, data] of [['nfl', nfl], ['nba', nba]]) data.targetWords = Math.round(raw[league] * scale / 10) * 10;
  return {
    today: edition.edition.date,
    note: 'All times are UTC ISO strings unless stated. Records are wins-losses(-ties); in results they are each team\'s record after the game. In standings, #N is the team\'s current place (seed) in its conference. GB means games behind.',
    recentContextCards,
    nfl,
    nba,
    myTeams: {
      nfl: teamInput('nfl', edition.myTeams?.nfl, limits),
      nba: teamInput('nba', edition.myTeams?.nba, limits),
    },
  };
}

// Every id in the input, mapped to what it points at (for checking refs and finding sources).
export function idIndex(input, edition, facts, limits = DEFAULT_LIMITS) {
  const index = new Map();
  for (const league of ['nfl', 'nba']) {
    const data = input[league];
    const week = facts?.week?.[league];
    if (data.week) {
      data.week.results.forEach((r, i) => index.set(r.id, { kind: 'weekResult', league, item: week.results[i] }));
      data.week.standouts.forEach(r => index.set(r.id, { kind: 'standout', league }));
      data.week.headlines.forEach((h, i) => index.set(h.id, { kind: 'weekHeadline', league, item: week.headlines[i], sources: week.headlines[i].sources || [] }));
      data.week.transactions.forEach(r => index.set(r.id, { kind: 'weekMove', league }));
      const games = watchGames(week, limits);
      data.watchCandidates.forEach((g, i) => index.set(g.id, { kind: 'watchGame', league, item: games[i] }));
    }
    const daily = facts?.daily?.[league] || {};
    data.stories.forEach((h, i) => index.set(h.id, { kind: 'headline', league, item: daily.stories[i], sources: daily.stories[i].sources || [] }));
    data.teamStories.forEach((h, i) => index.set(h.id, { kind: 'teamStory', league, item: daily.teamStories[i], sources: daily.teamStories[i].sources || [] }));
    data.results.forEach(r => index.set(r.id, { kind: 'result', league, item: edition[league].results.find(g => g.id === r._ref) }));
    data.standoutCandidates.forEach((p, i) => index.set(p.id, { kind: 'standoutCandidate', league, item: daily.standouts[i] }));
    data.majorInjuries.forEach(r => index.set(r.id, { kind: 'injury', league }));
    data.transactions.forEach(r => index.set(r.id, { kind: 'move', league }));
    data.statLeaders.forEach(r => index.set(r.id, { kind: 'leaders', league }));
    (data.followedPlayers || []).forEach((p, i) => index.set(p.id, { kind: 'followed', league, item: edition[league].followedPlayers[i] }));
    input.myTeams[league]?.facts.forEach(f => index.set(f.id, { kind: 'teamfact', league, sources: f._sources || [] }));
  }
  return index;
}

// The input exactly as Claude sees it: our private `_` fields removed.
export function forClaude(input) {
  return JSON.parse(JSON.stringify(input, (key, value) => (key.startsWith('_') ? undefined : value)));
}
