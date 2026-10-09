// Watch tab: the weekly watch guide, refreshed every Wednesday for the coming Wednesday to Tuesday.
// For each league: the ranked games most worth watching, then any of your team's games not already in the list.

import { el, card, teamChip, yourTeamChip, isMyTeam, emptyNote } from '../ui.js';
import { formatCalendarDate, formatGameTime } from '../time.js';

export function renderWatch({ edition }) {
  const guide = edition.watchGuide;
  return el('div', {},
    el('div', { class: 'page-title' },
      el('h1', {}, 'Watch'),
      guide?.weekOf ? el('div', { class: 'meta' },
        `${formatCalendarDate(guide.weekOf, { long: false })} to ${formatCalendarDate(guide.weekEnd, { long: false })}`) : null),
    !guide ? el('p', { class: 'empty-state' }, 'The watch guide arrives on Wednesday morning.') : [
      leagueGuide('NBA', guide.nba),
      leagueGuide('NFL', guide.nfl),
      el('p', { class: 'muted small', style: 'text-align:center' }, 'All times are Melbourne time.'),
    ],
  );
}

function leagueGuide(label, data) {
  const picks = data?.picks || [];
  const yours = data?.yourTeam || [];
  const title = `${label} games to watch`;
  if (!picks.length && !yours.length) return card({ type: 'watch', title }, emptyNote('No games this week.'));
  return card({ type: 'watch', title },
    picks.map(g => gameEntry(g, g.rank)),
    yours.length ? el('div', { class: 'group' },
      el('p', { class: 'label-strip' }, 'Also your team'),
      yours.map(g => gameEntry(g, '·')),
    ) : null,
  );
}

function gameEntry(game, rank) {
  const mine = isMyTeam(game.home.abbr) || isMyTeam(game.away.abbr);
  return el('div', { class: `watch-game${mine ? ' mine' : ''}` },
    el('div', { class: 'watch-rank', 'aria-hidden': 'true' }, rank),
    el('div', { class: 'watch-when' }, formatGameTime(game.start)),
    el('div', { class: 'watch-matchup' },
      teamChip(game.away.abbr), el('span', { class: 'small' }, game.away.name),
      el('span', { class: 'muted small' }, 'at'),
      teamChip(game.home.abbr), el('span', { class: 'small' }, game.home.name),
      mine ? yourTeamChip() : null),
    game.reason ? el('p', { class: 'small muted' }, game.reason) : null,
  );
}
