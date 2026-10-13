// Google News search feed: every story from the last two days that names the team, from any outlet
// (local papers, team sites, national media). Titles arrive as "Headline - Outlet", so the outlet is
// split off and kept as the publisher. Links open the story through Google News.

import { getText } from '../lib/http.js';
import { parseRss } from './rss.js';

// Only stories whose headline names the team (for example "Spurs") are kept: the search also matches
// articles that mention the team in passing.
export async function googleNews(log, teamName, nickname) {
  const q = encodeURIComponent(`"${teamName}" when:2d`);
  const xml = await getText(log, `Google News (${teamName})`, `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml) return [];
  const named = new RegExp(`\\b${(nickname || teamName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return parseRss(xml).map(item => {
    const outlet = item.source || item.title.match(/ - ([^-]+)$/)?.[1]?.trim() || 'Google News';
    const title = item.title.replace(new RegExp(` - ${outlet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
    // The description is only the headline again plus a link list, so it's dropped.
    return { ...item, title, description: '', publisher: outlet, feed: 'Google News' };
  }).filter(item => named.test(item.title));
}
