// The daily-brief sections shown at the top of the NFL and NBA tabs.
// Each function takes that league's part of the edition (edition.nfl or edition.nba) and returns one card,
// or null when there's nothing to show.

import { el, card, icon, teamChip, gameRow, sourceLinks, emptyNote, isMyTeam, involvesMyTeam } from '../ui.js';

function bulletList(items) {
  return el('ul', { class: 'bullets' },
    (items || []).map(item => el('li', {},
      typeof item === 'string' ? item : item.text,
      typeof item === 'string' ? null : sourceLinks(item.sources))));
}

// Wednesday Wrap for one league: the week's storylines, biggest results and who stood out.
export function wednesdayWrap(wrap) {
  if (!wrap) return null;
  return card({ type: 'news', title: 'Wednesday Wrap', extra: wrap.weekLabel, iconName: 'lead' }, wrapBody(wrap));
}

// The inside of a Wrap (also used for past Wraps in the archive).
export function wrapBody(wrap) {
  return [
    wrap.summary ? el('p', {}, wrap.summary) : null,
    wrap.storylines?.length ? bulletList(wrap.storylines) : null,
    wrap.biggestResults?.length ? el('div', { class: 'group' },
      el('p', { class: 'label-strip' }, 'Biggest results'),
      wrap.biggestResults.map(gameRow)) : null,
    wrap.standouts?.length ? el('div', { class: 'group' },
      el('p', { class: 'label-strip' }, 'Who stood out'),
      wrap.standouts.map(s => el('div', { class: `entry${isMyTeam(s.team) ? ' mine' : ''}` },
        el('div', { class: 'entry-head' }, teamChip(s.team), s.name),
        el('p', { class: 'small' }, s.note)))) : null,
  ];
}

export function oneThing(text) {
  if (!text) return null;
  return card({ type: 'lead', title: 'If you only read one thing' },
    el('p', { class: 'big' }, text));
}

// Only appears when Jack has added players to followedPlayers in the settings file.
export function followedPlayers(players) {
  if (!players?.length) return null;
  return card({ type: 'plain', title: 'Players you follow', iconName: 'mine' },
    players.map(p => el('div', { class: 'entry' },
      el('div', { class: 'entry-head' }, p.team ? teamChip(p.team) : null, p.name),
      p.note ? el('p', { class: 'small' }, p.note)
        : p.facts?.length ? el('ul', { class: 'bullets small' }, p.facts.map(f => el('li', {}, f.text)))
          : el('p', { class: 'small muted' }, 'No news since the last edition.'),
      sourceLinks(p.sources))));
}

// "Why it matters" sits in its own highlighted callout inside each story.
function whyItMatters(text) {
  if (!text) return null;
  return el('div', { class: 'why' },
    icon('why', ''),
    el('strong', {}, 'Why it matters'),
    el('span', {}, text));
}

export function headlines(items) {
  if (!items?.length) return null;
  return card({ type: 'news', title: 'Top stories' },
    items.map(h => {
      const mine = involvesMyTeam(h.teams);
      return el('article', { class: `story${mine ? ' mine' : ''}` },
        h.teams?.length ? el('div', { class: 'story-meta' }, h.teams.map(teamChip)) : null,
        el('h3', {}, h.title),
        h.summary ? el('p', {}, h.summary) : null,
        whyItMatters(h.whyItMatters),
        sourceLinks(h.sources),
      );
    }));
}

// Every story about Jack's team: Claude's write-ups, then (folded away) every other team headline found,
// each with its link, so nothing is missed.
export function teamNews(items, teamName, more = []) {
  if (!items?.length && !more?.length) return null;
  return card({ type: 'team', title: `${teamName} news`, mine: true },
    (items || []).map(t => el('article', { class: 'story' },
      t.text ? el('h3', { class: 'story-title-small' }, t.title) : null,
      el('p', {}, t.text || t.title),
      sourceLinks(t.sources))),
    more?.length ? el('details', { class: 'archive-item more-headlines' },
      el('summary', {}, el('span', { class: 'archive-label' }, `More ${teamName} headlines (${more.length})`)),
      el('ul', { class: 'bullets' }, more.map(m => el('li', {}, m.title, sourceLinks(m.sources))))) : null);
}

// Recaps of the day's notable games (all of them on a light day), with the key players' stat lines.
export function recaps(items) {
  if (!items?.length) return null;
  return card({ type: 'recap', title: 'Game recaps' },
    items.map(g => el('article', { class: `recap${involvesMyTeam([g.home.abbr, g.away.abbr]) ? ' mine' : ''}` },
      gameRow(g),
      g.text ? el('p', {}, g.text) : null,
      g.keyLine ? el('p', { class: 'key-players small' }, el('strong', {}, 'Key players: '), g.keyLine) : null)));
}

// The best individual performances of the day: the stat line from the box score, and why it stood out.
export function standouts(items) {
  if (!items?.length) return null;
  return card({ type: 'star', title: 'Standout performers' },
    items.map(p => el('div', { class: `entry${isMyTeam(p.team) ? ' mine' : ''}` },
      el('div', { class: 'entry-head' }, teamChip(p.team), p.name),
      el('p', { class: 'stat-line num' }, p.line),
      p.game ? el('p', { class: 'small muted' }, p.game) : null,
      p.why ? el('p', { class: 'small' }, p.why) : null)));
}

// One line for every other story worth knowing.
export function quickHits(items) {
  if (!items?.length) return null;
  return card({ type: 'quick', title: 'Quick hits' },
    el('ul', { class: 'bullets quick-hits' }, items.map(q => el('li', { class: involvesMyTeam(q.teams) ? 'mine-hit' : null },
      q.text, sourceLinks(q.sources)))));
}

export function results(games, { title = 'Results' } = {}) {
  if (!games) return null;
  return card({ type: 'results', title },
    games.length ? games.map(gameRow) : emptyNote('No completed games since the last edition.'));
}

// About how long the written brief takes to read (230 words a minute).
export function readingMinutes(data) {
  const texts = [
    data.oneThing, data.wrap?.summary, ...(data.wrap?.storylines || []).map(s => s.text),
    ...(data.headlines || []).flatMap(h => [h.title, h.summary, h.whyItMatters]),
    ...(data.teamNews || []).flatMap(t => [t.title, t.text]),
    ...(data.recaps || []).flatMap(r => [r.text, r.keyLine]),
    ...(data.standouts || []).flatMap(p => [p.name, p.line, p.why]),
    ...(data.quickHits || []).map(q => q.text),
    data.contextCard?.body,
  ];
  const words = texts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

// One context card a day, shown in the tab of the league it's about. Can be turned off in settings.
export function contextCard(ctx) {
  if (!ctx) return null;
  return card({ type: 'plain', title: 'Context' },
    el('h3', { class: 'subhead' }, ctx.title),
    el('p', {}, ctx.body),
  );
}
