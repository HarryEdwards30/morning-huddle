// Today tab: the daily brief.
// Sections, in order: Wednesday Wrap (Wednesdays only), one thing, your teams, followed players,
// league headlines, results, context card.

import { el, card, leagueChip, teamChip, gameRow, sourceLinks, emptyNote } from '../ui.js';
import { formatCalendarDate, formatTime } from '../time.js';

export function renderToday({ settings, edition }) {
  const e = edition.edition || {};
  return el('div', {},
    el('div', { class: 'page-title' },
      el('h1', {}, 'Today'),
      el('div', { class: 'meta' },
        e.date ? formatCalendarDate(e.date) : null,
        el('br'),
        e.generatedAt ? `Updated ${formatTime(e.generatedAt)}` : null),
    ),
    e.type === 'wednesday' ? wednesdayWrap(edition.wrap) : null,
    oneThing(edition.oneThing),
    yourTeams(edition.myTeams, settings.teams),
    followedPlayers(edition.followedPlayers),
    headlines(edition.headlines),
    results(edition.results),
    settings.sections?.contextCard === false ? null : contextCard(edition.contextCard),
  );
}

function oneThing(text) {
  if (!text) return null;
  return el('section', { class: 'card card-lead' },
    el('h2', { class: 'card-title' }, 'If you only read one thing'),
    el('p', { class: 'big' }, text),
  );
}

function bulletList(items) {
  return el('ul', { class: 'bullets' },
    (items || []).map(item => el('li', {}, typeof item === 'string' ? item : item.text, typeof item === 'string' ? null : sourceLinks(item.sources))));
}

function wednesdayWrap(wrap) {
  if (!wrap) return null;
  const leagueBlock = (label, w) => !w ? null : el('div', {},
    el('h3', { class: 'subhead' }, label),
    w.summary ? el('p', {}, w.summary) : null,
    w.storylines?.length ? bulletList(w.storylines) : null,
    w.standouts?.length ? el('div', { class: 'group' },
      el('p', { class: 'league-label' }, 'Who stood out'),
      w.standouts.map(s => el('div', { class: 'entry' },
        el('div', { class: 'entry-head' }, teamChip(s.team), s.name),
        el('p', { class: 'small' }, s.note)))) : null,
  );
  return el('section', { class: 'card card-wrap' },
    el('h2', { class: 'card-title' }, 'Wednesday Wrap', wrap.weekLabel ? el('span', { class: 'muted small' }, wrap.weekLabel) : null),
    leagueBlock('NBA', wrap.nba),
    leagueBlock('NFL', wrap.nfl),
  );
}

function yourTeams(myTeams, teamSettings) {
  if (!myTeams) return null;
  const blocks = ['nba', 'nfl'].map(league => {
    const team = myTeams[league];
    const info = teamSettings?.[league] || {};
    if (!team) return null;
    const updates = team.sinceLast || [];
    return el('div', { class: 'team-update' },
      el('header', {}, teamChip(info.abbr || team.abbr), el('h3', {}, info.shortName || info.name || team.name)),
      updates.length ? bulletList(updates) : emptyNote('Nothing new since the last edition.'),
    );
  });
  return card('Your teams', blocks);
}

function followedPlayers(players) {
  if (!players?.length) return null;
  return card('Players you follow',
    players.map(p => el('div', { class: 'entry' },
      el('div', { class: 'entry-head' }, teamChip(p.team), p.name),
      el('p', { class: 'small' }, p.note),
      sourceLinks(p.sources))));
}

function headlines(items) {
  if (!items?.length) return null;
  return card('League headlines',
    items.map(h => el('article', { class: 'story' },
      el('div', { class: 'story-meta' }, leagueChip(h.league)),
      el('h3', {}, h.title),
      el('p', {}, h.summary),
      h.whyItMatters ? el('div', { class: 'why' }, el('strong', {}, 'Why it matters'), h.whyItMatters) : null,
      sourceLinks(h.sources),
    )));
}

function results(res) {
  if (!res) return null;
  const nba = res.nba || [];
  const nfl = res.nfl || [];
  if (!nba.length && !nfl.length) return card('Results', emptyNote('No completed games since the last edition.'));
  return card('Results',
    nba.length ? [el('p', { class: 'league-label' }, 'NBA'), nba.map(gameRow)] : null,
    nfl.length ? [el('p', { class: 'league-label' }, 'NFL'), nfl.map(gameRow)] : null,
  );
}

function contextCard(ctx) {
  if (!ctx) return null;
  return card('Context',
    el('div', { class: 'story-meta' }, ctx.league ? leagueChip(ctx.league) : null),
    el('h3', { class: 'subhead' }, ctx.title),
    el('p', {}, ctx.body),
  );
}
