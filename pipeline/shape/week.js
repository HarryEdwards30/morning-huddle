// The Wednesday edition: the week's label for the Wrap, and the games coming up for the watch guide.
//
// The watch guide is ranked here first, from records, standings and the TV slot, so there's always a
// sensible list even if Claude can't write that morning. On Wednesdays Claude re-ranks the same games
// and writes the reasons (see pipeline/write-brief.js).

import { seasonNote } from './games.js';
import { melbourneDate } from '../lib/time.js';

const competition = event => event?.competitions?.[0] || {};

const ordinal = n => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const record = r => (r.t ? `${r.w}–${r.l}–${r.t}` : `${r.w}–${r.l}`);
const played = r => (r ? r.w + r.l + r.t : 0);
const winPct = r => (played(r) >= 3 ? (r.w + r.t / 2) / played(r) : 0.5);

// "Week 6" for the NFL (from the week's games), or "8 to 14 Oct" for the NBA.
export function weekLabel(league, weekResults, fromDate, toDate) {
  if (league === 'nfl') {
    const weeks = weekResults.map(g => /^Week (\d+)$/.exec(g.note || '')?.[1]).filter(Boolean).map(Number);
    if (weeks.length) return `Week ${Math.max(...weeks)}`;
  }
  const fmt = (ymd, withMonth) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', ...(withMonth ? { month: 'short' } : {}) })
    .format(new Date(`${ymd}T12:00:00Z`));
  const sameMonth = fromDate.slice(0, 7) === toDate.slice(0, 7);
  return `${fmt(fromDate, !sameMonth)} to ${fmt(toDate, true)}`;
}

// Every team's standings row, keyed by ESPN id, with its group and place written out.
function standingsIndex(league, standings) {
  const index = new Map();
  for (const group of standings?.groups || []) {
    for (const r of group.rows) {
      const conf = league === 'nfl' ? group.conference : group.short;
      index.set(r.id, {
        ...r,
        group: group.name,
        conf,
        place: played(r) && r.seed ? `${ordinal(r.seed)} in the ${conf}` : null,
      });
    }
  }
  return index;
}

// US national TV, and NFL prime time (an evening kick-off in New York).
const NATIONAL_TV = /\b(ESPN|ABC|NBC|Peacock|Prime Video|Amazon|TNT|NBA TV|Netflix|NFL Network)\b/i;
function slot(league, start, tv) {
  if (league === 'nfl') {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date(start)));
    return hour >= 19 ? 'Prime time' : null;
  }
  return tv && NATIONAL_TV.test(tv) ? 'National TV' : null;
}

// Games starting from now until the end of the watch week (Tuesday, Melbourne date), from ESPN scoreboards.
export function upcomingGames(league, boards, idx, standings, { fromMs, lastDate }) {
  const table = standingsIndex(league, standings);
  const seen = new Set();
  const games = [];
  for (const board of boards) {
    for (const event of board?.events || []) {
      const comp = competition(event);
      const state = (comp.status || event.status)?.type?.state;
      if (seen.has(event.id) || state !== 'pre') continue;
      if (Date.parse(event.date) < fromMs || melbourneDate(new Date(event.date)) > lastDate) continue;
      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      seen.add(event.id);
      const side = c => {
        const id = String(c.team?.id ?? c.id);
        return { id, abbr: idx.abbr(id), name: idx.name(id), standing: table.get(id) || null };
      };
      const tv = comp.broadcast || comp.broadcasts?.flatMap(b => b.names || []).join('/') || null;
      const g = {
        id: event.id,
        start: event.date,
        home: side(home),
        away: side(away),
        tv,
        slot: slot(league, event.date, tv),
        note: comp.notes?.[0]?.headline || seasonNote(event),
      };
      g.mine = idx.isMine(g.home.id) || idx.isMine(g.away.id);
      g.score = score(league, g);
      g.reason = reason(league, g);
      games.push(g);
    }
  }
  return games.sort((a, b) => b.score - a.score || Date.parse(a.start) - Date.parse(b.start));
}

// How worth watching a game looks on paper: two good teams, evenly matched, in a big slot.
function score(league, g) {
  const a = g.away.standing;
  const h = g.home.standing;
  let s = winPct(a) + winPct(h) - Math.abs(winPct(a) - winPct(h)) / 2;
  if (g.slot) s += 0.3;
  if (league === 'nfl' && a && h && a.group === h.group) s += 0.15;
  const cut = league === 'nfl' ? 7 : 6;
  if (played(a) && played(h) && a.seed && h.seed && a.seed <= cut && h.seed <= cut) s += 0.2;
  if (g.note && !/^(Week \d+|Preseason)$/.test(g.note)) s += 0.1;
  return Math.round(s * 1000) / 1000;
}

// A plain, factual one-liner (used until Claude writes its own, or if it can't).
function reason(league, g) {
  const a = g.away.standing;
  const h = g.home.standing;
  const both = `${g.away.abbr} ${a ? record(a) : ''} at ${g.home.abbr} ${h ? record(h) : ''}`.replace(/ +/g, ' ').trim();
  const extras = [];
  if (league === 'nfl' && a && h && a.group === h.group) extras.push(`${a.group} game`);
  if (g.note && !/^(Week \d+|Preseason)$/.test(g.note)) extras.push(g.note);
  if (g.slot) extras.push(g.slot === 'Prime time' ? `prime time${g.tv ? ` on ${g.tv}` : ''}` : `national TV${g.tv ? ` (${g.tv})` : ''}`);
  if (played(a) >= 3 && played(h) >= 3 && a.w > a.l && h.w > h.l) {
    return `Two winning teams: ${both}.${extras.length ? ` ${cap(extras.join(', '))}.` : ''}`;
  }
  return extras.length ? `${cap(extras.join(', '))}. ${both}.` : `${both}.`;
}

const cap = text => text.charAt(0).toUpperCase() + text.slice(1);

// The shape the app shows (see site/js/tabs/watch.js).
export const watchEntry = (g, extra = {}) => ({
  id: g.id,
  start: g.start,
  away: { abbr: g.away.abbr, name: g.away.name },
  home: { abbr: g.home.abbr, name: g.home.name },
  reason: g.reason,
  ...extra,
});

// The ranked picks (top five) and your team's games that didn't make the list.
export function rankedGuide(games, size = 5) {
  const picks = games.slice(0, size);
  return {
    picks: picks.map((g, i) => watchEntry(g, { rank: i + 1 })),
    yourTeam: games.filter(g => g.mine && !picks.includes(g))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map(g => watchEntry(g)),
  };
}

// The line Claude sees for each candidate game.
export function describeForClaude(league, g) {
  const side = s => {
    const r = s.standing;
    const bits = [r && played(r) ? record(r) : null, r?.place, r?.streak && r.streak !== '-' ? `streak ${r.streak}` : null].filter(Boolean);
    return `${s.name} (${s.abbr}${bits.length ? `, ${bits.join(', ')}` : ''})`;
  };
  return {
    game: `${side(g.away)} at ${side(g.home)}`,
    start: g.start,
    tv: g.tv || undefined,
    slot: g.slot || undefined,
    note: g.note || undefined,
    divisionGame: league === 'nfl' && g.away.standing && g.away.standing.group === g.home.standing?.group ? true : undefined,
    jacksTeam: g.mine || undefined,
  };
}
