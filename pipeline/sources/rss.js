// News feeds in RSS or Atom format, league-wide: CBS Sports, Yahoo Sports, RealGM (NBA),
// ProFootballTalk (NFL) and RotoWire's player news. ESPN's own RSS feeds return nothing to automated
// requests, so ESPN news comes from its JSON news endpoint instead (see espn.js).
// Team-specific feeds are in team-feeds.js; Google News searches in google-news.js.
//
// Each feed was checked from GitHub in October 2026. nba.com, NFL.com, SI, Bleacher Report, HoopsHype,
// Fox Sports and the Yahoo and CBS team pages either block scripts or have no feed, so they aren't used.

import { getText } from '../lib/http.js';

export const FEEDS = {
  nba: [
    { publisher: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nba/' },
    { publisher: 'Yahoo Sports', url: 'https://sports.yahoo.com/nba/rss.xml' },
    { publisher: 'RealGM', url: 'https://basketball.realgm.com/rss/wiretap/0/0.xml' },
    { publisher: 'RotoWire', url: 'https://www.rotowire.com/rss/news.php?sport=NBA' },
  ],
  nfl: [
    { publisher: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nfl/' },
    { publisher: 'Yahoo Sports', url: 'https://sports.yahoo.com/nfl/rss.xml' },
    { publisher: 'ProFootballTalk', url: 'https://profootballtalk.nbcsports.com/feed/' },
    { publisher: 'RotoWire', url: 'https://www.rotowire.com/rss/news.php?sport=NFL' },
  ],
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
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
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decode(match[1]) : '';
}

const isoDate = text => {
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

// RSS <item>s and Atom <entry>s in one shape: title, url, description, content (the full post where the
// feed carries it), published, and (Google News) the original publisher.
export function parseRss(xml) {
  const items = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map(([, block]) => ({
    title: tag(block, 'title'),
    url: tag(block, 'link'),
    description: tag(block, 'description'),
    content: tag(block, 'content:encoded'),
    published: isoDate(tag(block, 'pubDate')),
    source: tag(block, 'source') || null,
  }));
  const entries = [...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)].map(([, block]) => ({
    title: tag(block, 'title'),
    url: (block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || block.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '',
    description: tag(block, 'summary'),
    content: tag(block, 'content'),
    published: isoDate(tag(block, 'published') || tag(block, 'updated')),
    source: null,
  }));
  return [...items, ...entries].filter(item => item.title && /^https?:\/\//.test(item.url));
}

// Fetches a list of feeds ({ publisher, url }); a feed that fails is logged and skipped.
export async function fetchFeedList(log, feeds, label) {
  const items = [];
  for (const feed of feeds) {
    const xml = await getText(log, `${feed.publisher} ${label} rss`, feed.url);
    if (xml) items.push(...parseRss(xml).map(item => ({ ...item, publisher: feed.publisher, feed: feed.publisher })));
  }
  return items;
}

export const fetchFeeds = (log, league) => fetchFeedList(log, FEEDS[league], league);
