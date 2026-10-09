// News feeds in RSS format (CBS Sports and Yahoo Sports). ESPN's own RSS feeds return nothing to
// automated requests, so ESPN news comes from its JSON news endpoint instead (see espn.js).

import { getText } from '../lib/http.js';

export const FEEDS = {
  nba: [
    { publisher: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nba/' },
    { publisher: 'Yahoo Sports', url: 'https://sports.yahoo.com/nba/rss.xml' },
  ],
  nfl: [
    { publisher: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nfl/' },
    { publisher: 'Yahoo Sports', url: 'https://sports.yahoo.com/nfl/rss.xml' },
  ],
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function entities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Feed text is often HTML that has itself been escaped, so: unwrap CDATA, decode, strip tags, decode again.
export function decode(text = '') {
  const unwrapped = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return entities(entities(unwrapped).replace(/<[^>]+>/g, ' '))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decode(match[1]) : '';
}

export function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, block]) => ({
    title: tag(block, 'title'),
    url: tag(block, 'link'),
    description: tag(block, 'description'),
    published: tag(block, 'pubDate') ? new Date(tag(block, 'pubDate')).toISOString() : null,
  })).filter(item => item.title && /^https?:\/\//.test(item.url));
}

export async function fetchFeeds(log, league) {
  const items = [];
  for (const feed of FEEDS[league]) {
    const xml = await getText(log, `${feed.publisher} ${league} rss`, feed.url);
    if (xml) items.push(...parseRss(xml).map(item => ({ ...item, publisher: feed.publisher })));
  }
  return items;
}
