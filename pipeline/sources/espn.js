// ESPN adapter. These endpoints are public but unofficial and undocumented, so every call goes through
// getJson(), which records failures instead of crashing the run. If ESPN changes something, this is the
// only file that should need fixing. Run `npm run check-sources` to see what each endpoint returns.

import { getJson } from '../lib/http.js';

const PATHS = { nba: 'basketball/nba', nfl: 'football/nfl' };
const site = league => `https://site.api.espn.com/apis/site/v2/sports/${PATHS[league]}`;
const core = league => `https://sports.core.api.espn.com/v2/sports/${PATHS[league].replace('/', '/leagues/')}`;

export const espn = {
  teams: (log, league) => getJson(log, `espn ${league} teams`, `${site(league)}/teams`),
  scoreboard: (log, league, usDate) => getJson(log, `espn ${league} scoreboard ${usDate}`, `${site(league)}/scoreboard?dates=${usDate}`),
  // Scoreboard for a date range (YYYYMMDD-YYYYMMDD): used for the week ahead.
  scoreboardRange: (log, league, from, to) => getJson(log, `espn ${league} scoreboard ${from}-${to}`, `${site(league)}/scoreboard?dates=${from}-${to}&limit=200`),
  news: (log, league, teamId) => getJson(log, `espn ${league} news${teamId ? ' (team)' : ''}`,
    `${site(league)}/news?limit=50${teamId ? `&team=${teamId}` : ''}`),
  // seasontype=2 is the regular season. Without it, NBA preseason games show up in the standings.
  standings: (log, league) => getJson(log, `espn ${league} standings`,
    `https://site.api.espn.com/apis/v2/sports/${PATHS[league]}/standings?seasontype=2${league === 'nfl' ? '&level=3' : ''}`),
  conferenceStandings: (log, league) => getJson(log, `espn ${league} conference standings`,
    `https://site.api.espn.com/apis/v2/sports/${PATHS[league]}/standings?seasontype=2`),
  injuries: (log, league) => getJson(log, `espn ${league} injuries`, `${site(league)}/injuries`),
  transactions: (log, league) => getJson(log, `espn ${league} transactions`, `${site(league)}/transactions`),
  team: (log, league, id) => getJson(log, `espn ${league} team`, `${site(league)}/teams/${id}`),
  schedule: (log, league, id, seasonType) => getJson(log, `espn ${league} team schedule${seasonType ? ` (type ${seasonType})` : ''}`,
    `${site(league)}/teams/${id}/schedule${seasonType ? `?seasontype=${seasonType}` : ''}`),
  roster: (log, league, id) => getJson(log, `espn ${league} team roster`, `${site(league)}/teams/${id}/roster`),
  teamLeaders: (log, league, season, seasonType, id) => getJson(log, `espn ${league} team leaders`,
    `${core(league)}/seasons/${season}/types/${seasonType}/teams/${id}/leaders`, { optional: true }),
  gamelog: (log, league, athleteId) => getJson(log, `espn ${league} player game log`,
    `https://site.web.api.espn.com/apis/common/v3/sports/${PATHS[league]}/athletes/${athleteId}/gamelog`, { optional: true }),
};
