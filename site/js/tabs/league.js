// NFL and NBA tabs. Both use the same layout, each reading its own part of the edition (edition.nfl / edition.nba):
//
//   Today's brief:      Wednesday Wrap (Wednesdays only), one thing, players you follow, headlines,
//                       results, context card (if it's about this league)
//   Around the league:  pulse (hot and cold), standings, playoff picture (NFL), award races,
//                       major injuries, transactions, season timeline, past Wednesday Wraps

import { el } from '../ui.js';
import { formatCalendarDate, formatTime } from '../time.js';
import * as brief from '../sections/brief.js';
import * as info from '../sections/league-info.js';
import { pastWraps } from '../sections/archive.js';

export const renderNfl = ctx => renderLeague('nfl', ctx);
export const renderNba = ctx => renderLeague('nba', ctx);

function renderLeague(league, { settings, edition, now, archive }) {
  const e = edition.edition || {};
  const data = edition[league] || {};
  const sections = settings.sections || {};

  return el('div', {},
    el('div', { class: 'page-title' },
      el('h1', {}, league.toUpperCase()),
      el('div', { class: 'meta' },
        e.date ? formatCalendarDate(e.date) : null,
        el('br'),
        e.generatedAt ? `Updated ${formatTime(e.generatedAt)}` : null),
    ),

    el('h2', { class: 'part-heading' }, "Today's brief"),
    e.type === 'wednesday' ? brief.wednesdayWrap(data.wrap) : null,
    brief.oneThing(data.oneThing),
    brief.followedPlayers(data.followedPlayers),
    brief.headlines(data.headlines),
    brief.results(data.results),
    sections.contextCard === false ? null : brief.contextCard(data.contextCard),

    el('h2', { class: 'part-heading' }, `Around the ${league.toUpperCase()}`),
    info.pulse(data.pulse),
    info.standings(league, data.standings),
    league === 'nfl' ? info.playoffPicture(data.playoffPicture) : null,
    sections.awardRaces === false ? null : info.awardRaces(data.awardRaces),
    info.majorInjuries(data.majorInjuries),
    info.transactions(data.transactions),
    sections.seasonTimeline === false ? null : info.seasonTimeline(settings.seasonDates?.[league], now),
    pastWraps(league, archive, e.date),
  );
}
