// Builds today's edition from live data and writes it to a folder (normally the checked-out `data` branch):
//
//   <out>/latest.json             the edition the app shows
//   <out>/editions/YYYY-MM-DD.json a copy for the archive (older than 60 days are deleted)
//   <out>/status.json             whether the run worked, and how each data source went
//
// Usage: node pipeline/build-edition.js --out <folder>
//
// Phase 2: real data only. The written parts (one thing, "Why it matters", award races, context card,
// notes on player form) come from Claude in Phase 3, so they are empty for now.

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SourceLog } from './lib/http.js';
import { melbourneDate, melbourneIso, recentUsDates } from './lib/time.js';
import { espn } from './sources/espn.js';
import { fetchFeeds } from './sources/rss.js';
import { teamIndex } from './shape/teams.js';
import { resultsFrom, lastAndNext, weekAhead } from './shape/games.js';
import { nbaStandings, nflStandings, nflPlayoffPicture, playoffRace, hotAndCold } from './shape/standings.js';
import { teamInjuries, majorInjuries } from './shape/injuries.js';
import { Sources, espnArticles, headlines, transactions } from './shape/news.js';
import { leaderIds, rosterIndex, playerForm } from './shape/form.js';

const ROOT = new URL('..', import.meta.url).pathname;
const KEEP_DAYS = 60;
const DAY = 86400000;

function args() {
  const out = { out: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--out') out.out = argv[++i];
  if (!out.out) throw new Error('Usage: node pipeline/build-edition.js --out <folder>');
  return out;
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

const ordinal = n => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Everything for one league: its brief section, its "around the league" section, and Jack's team hub.
async function buildLeague(league, settingsTeam, ctx) {
  const { log, sources, since, shownBefore, now } = ctx;
  console.log(`\n${league.toUpperCase()}`);

  const teams = await espn.teams(log, league);
  const idx = teamIndex(teams, settingsTeam);
  if (!idx.myId) console.warn(`  ! Couldn't find "${settingsTeam.name}" in ESPN's ${league.toUpperCase()} team list. Check the name in config/settings.json.`);

  // Scores: the last three US dates covers everything since yesterday's edition.
  const boards = [];
  for (const date of recentUsDates(3, now)) boards.push(await espn.scoreboard(log, league, date));
  const results = resultsFrom(boards, idx, { excludeIds: new Set(shownBefore[league] || []), since });

  // Standings (NBA by conference; NFL by division, plus conference standings for the playoff seeds).
  const standingsJson = await espn.standings(log, league);
  const confJson = league === 'nfl' ? await espn.conferenceStandings(log, league) : standingsJson;
  const standings = league === 'nfl' ? nflStandings(standingsJson, idx) : nbaStandings(standingsJson, idx);
  const playoffPicture = league === 'nfl' ? nflPlayoffPicture(confJson, idx) : null;

  // News: ESPN plus the CBS and Yahoo feeds.
  const espnNews = espnArticles(await espn.news(log, league));
  const rssNews = await fetchFeeds(log, league);
  const allNews = [...espnNews, ...rssNews];
  const leagueHeadlines = headlines(allNews, idx, sources, { since: since - 12 * 3600000, limit: 8 });

  const injuriesJson = await espn.injuries(log, league);
  const transactionsJson = await espn.transactions(log, league);
  const newsText = allNews.map(n => `${n.title} ${n.description}`).join(' ');

  // Hot and cold: teams on a streak, and the best individual lines from the latest games.
  const streaks = hotAndCold(league, standings.groups);
  const hotPlayers = standoutLines(league, results);

  const leagueSection = {
    oneThing: null,
    wrap: null,
    headlines: leagueHeadlines,
    results: results.map(({ leaders, ...game }) => game),
    contextCard: null,
    followedPlayers: [],
    pulse: { hot: { teams: streaks.hot, players: hotPlayers }, cold: { teams: streaks.cold, players: [] } },
    standings,
    ...(league === 'nfl' ? { playoffPicture } : {}),
    awardRaces: [],
    majorInjuries: majorInjuries(injuriesJson, idx, newsText),
    transactions: transactions(transactionsJson, idx, { since: now.getTime() - 3 * DAY, limit: 10 })
      .map(({ plainText, ...t }) => t),
  };

  const myTeam = idx.myId ? await buildTeamHub(league, settingsTeam, idx, {
    ...ctx, results, confJson, injuriesJson, transactionsJson, teamNewsSince: since,
  }) : null;

  return { leagueSection, myTeam, idx };
}

// The best single-game lines from the latest results, for the "Hot" column.
function standoutLines(league, results) {
  const THRESHOLDS = league === 'nba'
    ? { points: 30, rebounds: 15, assists: 12 }
    : { passingYards: 300, rushingYards: 120, receivingYards: 120 };
  const lines = results.flatMap(g => g.leaders.map(l => ({ ...l, game: g })))
    .filter(l => THRESHOLDS[l.category] !== undefined && l.value >= THRESHOLDS[l.category])
    .sort((a, b) => b.value / THRESHOLDS[b.category] - a.value / THRESHOLDS[a.category]);
  const seen = new Set();
  return lines.filter(l => !seen.has(l.name) && seen.add(l.name)).slice(0, 4).map(l => {
    const opp = l.game.home.abbr === l.team ? l.game.away : l.game.home;
    return { name: l.name, team: l.team, note: `${l.line} against the ${opp.name}.` };
  });
}

async function buildTeamHub(league, settingsTeam, idx, ctx) {
  const { log, sources, now, results, confJson, injuriesJson, transactionsJson, teamNewsSince } = ctx;
  const id = idx.myId;

  const teamJson = await espn.team(log, league, id);
  // The default schedule is the current part of the season (preseason, regular season or playoffs).
  // If nothing is left in it, look at the regular season too, so the next game always shows.
  const schedule = await espn.schedule(log, league, id);
  let events = schedule?.events || [];
  let games = lastAndNext(events, idx);
  if (!games.nextGame && schedule?.requestedSeason?.type !== 2) {
    const regular = await espn.schedule(log, league, id, 2);
    events = [...events, ...(regular?.events || [])];
    games = lastAndNext(events, idx);
  }

  const race = playoffRace(league, confJson, idx);
  const seeds = race?.seedsById || {};
  const keyGames = games.upcoming.slice(0, 3).map(g => {
    const oppId = [...idx.byId.keys()].find(k => idx.abbr(k) === g.opponent.abbr);
    const seed = seeds[oppId];
    return {
      start: g.start, opponent: g.opponent, homeAway: g.homeAway,
      why: seed?.seed && race && !race.summary.startsWith("The regular season hasn't") ? `The ${g.opponent.name} are ${ordinal(seed.seed)} in the ${seed.conf}.` : g.note,
    };
  });

  // Player form for the team's statistical leaders (regular season, or preseason before it starts).
  const season = Number(schedule?.season?.year || now.getUTCFullYear());
  const seasonType = Number(schedule?.season?.type || 2);
  let ids = leaderIds(await espn.teamLeaders(log, league, season, seasonType, id), league);
  if (!ids.length) ids = leaderIds(await espn.teamLeaders(log, league, season, seasonType === 2 ? 1 : 2, id), league);
  const roster = rosterIndex(await espn.roster(log, league, id));
  const form = [];
  for (const athleteId of ids.slice(0, 4)) {
    const row = playerForm(league, athleteId, roster.get(athleteId), await espn.gamelog(log, league, athleteId));
    if (row) form.push(row);
  }

  // Roster moves and news: this team's transactions (last 14 days) and ESPN team news (last 5 days).
  const moves = transactions(transactionsJson, idx, { since: now.getTime() - 14 * DAY, teamId: id, limit: 8 });
  const teamNews = espnArticles(await espn.news(log, league, id))
    .filter(a => a.teamIds.includes(String(id)) && Date.parse(a.published || 0) >= now.getTime() - 5 * DAY)
    .slice(0, 5);
  const news = [
    ...moves.map(m => ({ type: m.type, date: m.date, text: m.plainText })),
    ...teamNews.map(a => ({ type: 'News', date: a.published, text: a.title, sources: [sources.add(a)] })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const injuries = teamInjuries(injuriesJson, idx, id);

  // "Since the last edition": the result, roster moves, injury updates and team news since then.
  const sinceLast = [];
  const mineGame = results.find(g => idx.isMine(g.home.id) || idx.isMine(g.away.id));
  if (mineGame) {
    const mine = idx.isMine(mineGame.home.id) ? mineGame.home : mineGame.away;
    const opp = mine === mineGame.home ? mineGame.away : mineGame.home;
    const verb = mine.score > opp.score ? 'Beat' : mine.score < opp.score ? 'Lost to' : 'Tied with';
    sinceLast.push({ text: `${verb} the ${opp.name} ${mine.score}–${opp.score} ${mine === mineGame.home ? 'at home' : 'on the road'}${mineGame.note ? ` (${mineGame.note.toLowerCase().startsWith('week') ? mineGame.note : mineGame.note.toLowerCase()})` : ''}.` });
  }
  for (const m of moves.filter(m => Date.parse(m.date) >= teamNewsSince - DAY)) sinceLast.push({ text: m.plainText });
  // Injury notes from the feed, if they're new and say something (some are just one word).
  for (const i of injuries.filter(i => i.date && Date.parse(i.date) >= teamNewsSince && (i.about || '').length >= 25)) sinceLast.push({ text: i.about });
  for (const a of teamNews.filter(a => Date.parse(a.published || 0) >= teamNewsSince).slice(0, 3)) sinceLast.push({ text: a.title, sources: [sources.add(a)] });

  return {
    league: league.toUpperCase(),
    name: settingsTeam.name,
    abbr: settingsTeam.abbr,
    sinceLast: sinceLast.slice(0, 6),
    record: {
      summary: teamJson?.team?.record?.items?.find(r => r.type === 'total')?.summary || schedule?.team?.recordSummary || '0-0',
      standing: teamJson?.team?.standingSummary || schedule?.team?.standingSummary || null,
    },
    lastResult: games.lastResult,
    nextGame: games.nextGame,
    injuries: injuries.map(({ onInjuredReserve, date, ...rest }) => rest),
    form: form.map(({ athleteId, games: played, ...rest }) => rest),
    news: news.slice(0, 8),
    playoffRace: race && { ...race, seedsById: undefined, keyGames },
    weekAhead: weekAhead(games.upcoming, idx, now.getTime()),
  };
}

function pruneArchive(dir, today) {
  if (!existsSync(dir)) return;
  const cutoff = Date.parse(`${today}T00:00:00Z`) - KEEP_DAYS * DAY;
  for (const file of readdirSync(dir)) {
    const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(file)?.[1];
    if (date && Date.parse(`${date}T00:00:00Z`) < cutoff) rmSync(join(dir, file));
  }
}

async function main() {
  const { out } = args();
  const settings = JSON.parse(readFileSync(join(ROOT, 'config', 'settings.json'), 'utf8'));
  mkdirSync(join(out, 'editions'), { recursive: true });

  const now = new Date();
  const today = melbourneDate(now);
  const previous = readJson(join(out, 'latest.json'));
  const realPrevious = previous && !previous.sample ? previous : null;

  // "Since the last edition" covers from the previous day's edition to now (36 hours on the very first run).
  // Re-running on the same day rebuilds today's edition over the same window, so nothing goes missing.
  const sameDay = realPrevious?.edition?.date === today && realPrevious.edition.window;
  const since = sameDay ? realPrevious.edition.window.since
    : realPrevious?.edition?.generatedAt ? Date.parse(realPrevious.edition.generatedAt) : now.getTime() - 36 * 3600000;
  const shownBefore = sameDay ? realPrevious.edition.window.shownBefore
    : { nba: (realPrevious?.nba?.results || []).map(g => g.id), nfl: (realPrevious?.nfl?.results || []).map(g => g.id) };

  const log = new SourceLog();
  const sources = new Sources();
  const ctx = { log, sources, since, shownBefore, now };

  const nba = await buildLeague('nba', settings.teams.nba, ctx);
  const nfl = await buildLeague('nfl', settings.teams.nfl, ctx);

  const weekEnd = melbourneDate(new Date(now.getTime() + 6 * DAY));
  const edition = {
    edition: {
      date: today, generatedAt: melbourneIso(now), type: 'daily', written: false,
      // What "since the last edition" meant for this edition (used if today's edition is rebuilt).
      window: { since, shownBefore },
    },
    nfl: nfl.leagueSection,
    nba: nba.leagueSection,
    myTeams: {
      nba: nba.myTeam && { ...nba.myTeam, weekAhead: undefined },
      nfl: nfl.myTeam && { ...nfl.myTeam, weekAhead: undefined },
    },
    // Ranked picks come with the Wednesday edition (Phase 5). Until then, your teams' games this week.
    watchGuide: {
      weekOf: today,
      weekEnd,
      note: 'Ranked picks start with the Wednesday edition. For now, here are your teams’ games this week.',
      nba: { picks: [], yourTeam: nba.myTeam?.weekAhead || [] },
      nfl: { picks: [], yourTeam: nfl.myTeam?.weekAhead || [] },
    },
    sources: sources.map,
  };

  const summary = log.summary;
  // The run counts as a failure only if the core data is missing (no scores or standings for either league).
  const coreMissing = ['nba', 'nfl'].filter(l => !edition[l].standings.groups.length);
  const ok = coreMissing.length === 0;

  const status = {
    ok,
    lastAttempt: melbourneIso(now),
    lastSuccess: ok ? melbourneIso(now) : readJson(join(out, 'status.json'))?.lastSuccess || null,
    error: ok ? null : `Couldn't get ${coreMissing.map(l => l.toUpperCase()).join(' and ')} standings from ESPN.`,
    sources: { total: summary.total, ok: summary.ok, failed: summary.failed },
  };

  if (ok) {
    writeFileSync(join(out, 'latest.json'), JSON.stringify(edition, null, 2) + '\n');
    writeFileSync(join(out, 'editions', `${today}.json`), JSON.stringify(edition) + '\n');
    pruneArchive(join(out, 'editions'), today);
  }
  writeFileSync(join(out, 'status.json'), JSON.stringify(status, null, 2) + '\n');

  console.log(`\n${ok ? 'Edition written' : 'Edition NOT written (kept the last good one)'}: ${today}`);
  console.log(`Sources: ${summary.ok}/${summary.total} OK${summary.failed.length ? `; failed: ${summary.failed.map(f => f.name).join(', ')}` : ''}`);
  for (const l of ['nfl', 'nba']) {
    const s = edition[l];
    console.log(`${l.toUpperCase()}: ${s.results.length} results, ${s.headlines.length} headlines, ${s.standings.groups.length} standings groups, ${s.majorInjuries.length} major injuries, ${s.transactions.length} moves`);
    const t = edition.myTeams[l];
    if (t) console.log(`  ${t.name}: ${t.record.summary} (${t.record.standing}); last ${t.lastResult ? `${t.lastResult.result} ${t.lastResult.teamScore}-${t.lastResult.oppScore}` : 'none'}; next ${t.nextGame?.start || 'none'}; ${t.injuries.length} injuries; ${t.form.length} form; ${t.news.length} news; ${t.sinceLast.length} since-last`);
  }
  if (!ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
