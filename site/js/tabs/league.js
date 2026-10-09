// NFL and NBA tabs. Both use the same layout, each reading its own part of the edition (edition.nfl / edition.nba):
//
//   Today's brief:      Wednesday Wrap (Wednesdays only), one thing, players you follow, headlines,
//                       results, context card (if it's about this league)
//   Around the league:  pulse (hot and cold), standings, playoff picture (NFL), award races,
//                       major injuries, transactions, season timeline, past Wednesday Wraps
//
// In the off-season (data.offSeason), "Around the league" becomes: what's happening in the off-season
// and the next key date, trades, signings and coaching changes, major injuries, the season timeline,
// last season's final standings and past Wraps.

import { el } from '../ui.js';
import { formatCalendarDate, formatTime } from '../time.js';
import * as brief from '../sections/brief.js';
import * as info from '../sections/league-info.js';
import { pastWraps } from '../sections/archive.js';

export const renderNfl = ctx => renderLeague('nfl', ctx);
export const renderNba = ctx => renderLeague('nba', ctx);

function renderLeague(league, { settings, edition, latest, now, archive }) {
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

    el('h2', { class: 'part-heading' }, edition === latest ? "Today's brief" : 'The brief'),
    e.type === 'wednesday' ? brief.wednesdayWrap(data.wrap) : null,
    brief.oneThing(data.oneThing),
    brief.followedPlayers(data.followedPlayers),
    brief.headlines(data.headlines),
    data.offSeason && !data.results?.length ? null : brief.results(data.results),
    sections.contextCard === false ? null : brief.contextCard(data.contextCard),

    el('h2', { class: 'part-heading' }, `Around the ${league.toUpperCase()}`),
    data.offSeason ? offSeasonInfo(league, data, settings, now) : seasonInfo(league, data, settings, now),
    pastWraps(league, archive, e.date),
  );
}

function seasonInfo(league, data, settings, now) {
  const sections = settings.sections || {};
  return [
    info.pulse(data.pulse),
    info.standings(league, data.standings),
    league === 'nfl' ? info.playoffPicture(data.playoffPicture) : null,
    sections.awardRaces === false ? null : info.awardRaces(data.awardRaces),
    info.majorInjuries(data.majorInjuries),
    info.transactions(data.transactions),
    sections.seasonTimeline === false ? null : info.seasonTimeline(settings.seasonDates?.[league], now),
  ];
}

function offSeasonInfo(league, data, settings, now) {
  const sections = settings.sections || {};
  return [
    info.offSeason(league, settings.seasonDates?.[league], now),
    info.transactions(data.transactions, 'Trades, signings and coaching'),
    info.majorInjuries(data.majorInjuries),
    sections.seasonTimeline === false ? null : info.seasonTimeline(settings.seasonDates?.[league], now),
    info.standings(league, data.standings, { offSeason: true }),
  ];
}
