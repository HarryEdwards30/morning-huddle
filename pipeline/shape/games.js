// Results, last and next games, and the week ahead, from ESPN scoreboards and team schedules.

const scoreOf = competitor => {
  const s = competitor?.score;
  if (s && typeof s === 'object') return Number(s.value ?? s.displayValue);
  return s === undefined || s === '' ? null : Number(s);
};

const competition = event => event?.competitions?.[0] || {};
const isCompleted = event => Boolean((competition(event).status || event.status)?.type?.completed);
const isUpcoming = event => (competition(event).status || event.status)?.type?.state === 'pre';

function seasonNote(event) {
  const type = event.season?.type ?? event.seasonType?.type;
  if (type === 1) return 'Preseason';
  if (type === 3) return 'Playoffs';
  if (event.week?.number) return `Week ${event.week.number}`;
  return null;
}

function side(competitor, idx) {
  const id = competitor.team?.id ?? competitor.id;
  return { abbr: idx.abbr(id), name: idx.name(id), score: scoreOf(competitor), id: String(id) };
}

// Completed games from the last few scoreboards that weren't already in the previous edition.
export function resultsFrom(scoreboards, idx, { excludeIds = new Set(), since } = {}) {
  const seen = new Set();
  const games = [];
  for (const board of scoreboards) {
    for (const event of board?.events || []) {
      if (seen.has(event.id) || excludeIds.has(event.id) || !isCompleted(event)) continue;
      if (since && Date.parse(event.date) < since - 6 * 3600000) continue;
      seen.add(event.id);
      const comp = competition(event);
      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      const status = (comp.status || event.status)?.type?.shortDetail || 'Final';
      games.push({
        id: event.id,
        start: event.date,
        status,
        note: seasonNote(event),
        home: side(home, idx),
        away: side(away, idx),
        leaders: gameLeaders(comp, idx),
      });
    }
  }
  return games.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

// Standout individual lines from a game (used for the "Hot" players list).
function gameLeaders(comp, idx) {
  const out = [];
  const add = (category, leader) => {
    if (!leader?.athlete) return;
    const teamId = leader.team?.id ?? leader.athlete.team?.id;
    out.push({ category, value: Number(leader.value), line: leader.displayValue, name: leader.athlete.displayName, team: teamId ? idx.abbr(teamId) : null });
  };
  for (const cat of comp.leaders || []) add(cat.name, cat.leaders?.[0]);            // NFL: game leaders
  for (const competitor of comp.competitors || []) {                                // NBA: leaders per team
    for (const cat of competitor.leaders || []) add(cat.name, { ...cat.leaders?.[0], team: { id: competitor.team?.id } });
  }
  return out;
}

// Last completed and next upcoming game for one team, from its schedule.
export function lastAndNext(scheduleEvents, idx) {
  const events = [...scheduleEvents].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const completed = events.filter(isCompleted);
  const upcoming = events.filter(isUpcoming);
  const describe = event => {
    const comp = competition(event);
    const mine = comp.competitors?.find(c => idx.isMine(c.team?.id ?? c.id));
    const opp = comp.competitors?.find(c => c !== mine);
    if (!mine || !opp) return null;
    const oppId = opp.team?.id ?? opp.id;
    return { id: event.id, start: event.date, opponent: { abbr: idx.abbr(oppId), name: idx.name(oppId) }, homeAway: mine.homeAway, mine, opp, note: seasonNote(event) };
  };
  const last = completed.length ? describe(completed.at(-1)) : null;
  const next = upcoming.length ? describe(upcoming[0]) : null;
  return {
    lastResult: last && {
      start: last.start, opponent: last.opponent, homeAway: last.homeAway, note: last.note,
      teamScore: scoreOf(last.mine), oppScore: scoreOf(last.opp),
      result: scoreOf(last.mine) > scoreOf(last.opp) ? 'W' : scoreOf(last.mine) < scoreOf(last.opp) ? 'L' : 'T',
    },
    nextGame: next && { start: next.start, opponent: next.opponent, homeAway: next.homeAway, note: next.note },
    upcoming: upcoming.map(describe).filter(Boolean),
  };
}

// The team's games in the coming week, for the Watch tab.
export function weekAhead(upcoming, idx, fromMs, days = 7) {
  const until = fromMs + days * 86400000;
  return upcoming
    .filter(g => Date.parse(g.start) >= fromMs && Date.parse(g.start) < until)
    .map(g => {
      const mineSide = { abbr: idx.abbr(idx.myId), name: idx.name(idx.myId) };
      const home = g.homeAway === 'home' ? mineSide : g.opponent;
      const away = g.homeAway === 'home' ? g.opponent : mineSide;
      return { start: g.start, home, away, reason: g.note };
    });
}
