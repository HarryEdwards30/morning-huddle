// Watch tab: the weekly watch guide, refreshed every Wednesday for the coming Wednesday to Tuesday.
// For each league: the ranked games most worth watching, then any of your team's games not already in the list.
// Games that have already been played this week stay in the list, dimmed and marked "Played".

import { el, card, teamChip, yourTeamChip, isMyTeam, emptyNote } from '../ui.js';
import { formatCalendarDate, formatGameTime } from '../time.js';

const PLAYED_AFTER = 4 * 3600000; // a game is shown as played four hours after it starts

export function renderWatch({ edition, now = new Date() }) {
  const guide = edition.watchGuide;
  return el('div', {},
    el('div', { class: 'page-title' },
      el('h1', {}, 'Watch'),
      guide?.weekOf ? el('div', { class: 'meta' },
        `${formatCalendarDate(guide.weekOf, { long: false })} to ${formatCalendarDate(guide.weekEnd, { long: false })}`) : null),
    !guide ? el('p', { class: 'empty-state' }, 'The watch guide arrives on Wednesday morning.') : [
      guide.note ? el('p', { class: 'muted small', style: 'margin:0 0 16px' }, guide.note) : null,
      leagueGuide('NBA', guide.nba, now),
      leagueGuide('NFL', guide.nfl, now),
      el('p', { class: 'muted small', style: 'text-align:center' }, 'All times are Melbourne time.'),
    ],
  );
}

function leagueGuide(label, data, now) {
  const picks = data?.picks || [];
  const yours = data?.yourTeam || [];
  const title = `${label} games to watch`;
  if (!picks.length && !yours.length) return card({ type: 'watch', title }, emptyNote('No games this week.'));
  return card({ type: 'watch', title },
    picks.map(g => gameEntry(g, g.rank, now)),
    yours.length ? el('div', { class: 'group' },
      el('p', { class: 'label-strip' }, picks.length ? 'Also your team' : 'Your team this week'),
      yours.map(g => gameEntry(g, '·', now)),
    ) : null,
  );
}

function gameEntry(game, rank, now) {
  const mine = isMyTeam(game.home.abbr) || isMyTeam(game.away.abbr);
  const played = Date.parse(game.start) + PLAYED_AFTER < now.getTime();
  return el('div', { class: `watch-game${mine ? ' mine' : ''}${played ? ' played' : ''}` },
    el('div', { class: 'watch-rank', 'aria-hidden': 'true' }, rank),
    el('div', { class: 'watch-when' }, formatGameTime(game.start), played ? el('span', { class: 'chip played-chip' }, 'Played') : null),
    el('div', { class: 'watch-matchup' },
      teamChip(game.away.abbr), el('span', { class: 'small' }, game.away.name),
      el('span', { class: 'muted small' }, 'at'),
      teamChip(game.home.abbr), el('span', { class: 'small' }, game.home.name),
      mine ? yourTeamChip() : null),
    game.reason ? el('p', { class: 'small muted' }, game.reason) : null,
  );
}
