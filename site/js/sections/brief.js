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

// Wednesday Wrap for one league: the week's storylines and who stood out.
export function wednesdayWrap(wrap) {
  if (!wrap) return null;
  return card({ type: 'news', title: 'Wednesday Wrap', extra: wrap.weekLabel, iconName: 'lead' },
    wrap.summary ? el('p', {}, wrap.summary) : null,
    wrap.storylines?.length ? bulletList(wrap.storylines) : null,
    wrap.standouts?.length ? el('div', { class: 'group' },
      el('p', { class: 'label-strip' }, 'Who stood out'),
      wrap.standouts.map(s => el('div', { class: `entry${isMyTeam(s.team) ? ' mine' : ''}` },
        el('div', { class: 'entry-head' }, teamChip(s.team), s.name),
        el('p', { class: 'small' }, s.note)))) : null,
  );
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
      el('div', { class: 'entry-head' }, teamChip(p.team), p.name),
      el('p', { class: 'small' }, p.note),
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
  return card({ type: 'news', title: 'Headlines' },
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

export function results(games) {
  if (!games) return null;
  return card({ type: 'results', title: 'Results' },
    games.length ? games.map(gameRow) : emptyNote('No completed games since the last edition.'));
}

// One context card a day, shown in the tab of the league it's about. Can be turned off in settings.
export function contextCard(ctx) {
  if (!ctx) return null;
  return card({ type: 'plain', title: 'Context' },
    el('h3', { class: 'subhead' }, ctx.title),
    el('p', {}, ctx.body),
  );
}
