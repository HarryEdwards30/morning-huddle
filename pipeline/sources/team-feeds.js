// News feeds about one team: fan sites, the team's own site and local papers. Keyed by the team
// abbreviation in config/settings.json. Every story from these counts as team news.
//
// If you change teams in settings.json, add the new team's feeds here (SB Nation sites have a feed at
// /rss/index.xml). Google News (google-news.js) covers any team by name without changes.
// Checked from GitHub in October 2026: nba.com/spurs, the San Antonio Express-News, KENS 5 and the Yahoo
// and CBS team pages block scripts or have no feed.

import { fetchFeedList } from './rss.js';

export const TEAM_FEEDS = {
  SAS: [
    { publisher: 'Pounding The Rock', url: 'https://www.poundingtherock.com/rss/index.xml' },
  ],
  LV: [
    { publisher: 'Silver And Black Pride', url: 'https://www.silverandblackpride.com/rss/index.xml' },
    { publisher: 'Raiders.com', url: 'https://www.raiders.com/rss/news' },
    { publisher: 'Las Vegas Review-Journal', url: 'https://www.reviewjournal.com/sports/raiders/feed/' },
  ],
};

export const fetchTeamFeeds = (log, abbr) => fetchFeedList(log, TEAM_FEEDS[abbr] || [], `${abbr} team`);
