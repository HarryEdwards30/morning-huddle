// Headlines, team news and transactions. Every item keeps its source (publisher and URL) so the app
// can link "Read more". Betting, fantasy and picks articles are left out.

// "Draft picks" stories are kept; "Week 6 picks" and expert-picks articles are not.
const SKIP = /\b(odds|betting|bets?|parlays?|predictions?|fantasy|dfs|props|sportsbook|promo code)\b|\bpicks:|expert picks|week \d+ picks|picks against the spread|highlights|top performers|player grades|uniforms|arrivals|live (game )?updates?|live ?streams?|free streams?|how to watch|what channel|tv channel|\bpodcast\b|^photos?:|pre-?game|post-?game|\bpresser\b/i;
// Spam headlines dressed up with "fancy" Unicode letters (live-stream scams turn up in Google News).
const SPAM = /[\u{1D400}-\u{1D7FF}\uFF01-\uFF5E]/u;

const normalise = title => title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 8).join(' ');

export class Sources {
  constructor() { this.map = {}; this.count = 0; }
  add({ publisher, url, title, published }) {
    const existing = Object.entries(this.map).find(([, s]) => s.url === url);
    if (existing) return existing[0];
    const id = `${publisher.toLowerCase().replace(/[^a-z]/g, '')}-${++this.count}`;
    this.map[id] = { publisher, url, title, published: published || null };
    return id;
  }
}

// ESPN JSON articles and RSS items in one shape.
export function espnArticles(newsJson) {
  return (newsJson?.articles || [])
    .filter(a => a.links?.web?.href && a.headline && !SKIP.test(a.headline))
    .map(a => ({
      title: a.headline,
      description: a.description || '',
      url: a.links.web.href,
      published: a.published || a.lastModified || null,
      publisher: 'ESPN',
      articleId: a.id || null,
      teamIds: (a.categories || []).filter(c => c.type === 'team' && (c.teamId || c.team?.id)).map(c => String(c.teamId || c.team.id)),
      type: a.type,
    }));
}

// Which teams a story is about: ESPN's tags, or team names in the headline.
function teamsIn(item, idx) {
  if (item.teamIds?.length) return [...new Set(item.teamIds.filter(id => idx.byId.has(id)).map(id => idx.abbr(id)))].slice(0, 3);
  const found = [];
  for (const [id, t] of idx.byId) {
    const names = [t.displayName, t.shortDisplayName, t.name].filter(Boolean);
    if (names.some(n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(item.title))) found.push(idx.abbr(id));
  }
  return found.slice(0, 3);
}

// The league's headlines since the last edition, newest first, without duplicates.
export function headlines(items, idx, sources, { since, limit = 8, perTeams = 2 }) {
  const seen = new Set();
  const perTeamSet = {};
  return items
    .filter(i => !SKIP.test(i.title) && (!since || !i.published || Date.parse(i.published) >= since))
    .sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0))
    .map(i => ({ ...i, teams: teamsIn(i, idx) }))
    .filter(i => {
      const key = normalise(i.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      // Variety: no more than two stories about the same game or the same teams.
      const teamKey = [...i.teams].sort().join('+');
      if (teamKey) {
        perTeamSet[teamKey] = (perTeamSet[teamKey] || 0) + 1;
        if (perTeamSet[teamKey] > perTeams) return false;
      }
      return true;
    })
    .slice(0, limit)
    .map(i => ({
      title: i.title,
      summary: i.description || null,
      whyItMatters: null,   // written by Claude from Phase 3
      teams: i.teams,
      sources: [sources.add(i)],
    }));
}

const clipText = (text, n) => (text && text.length > n ? `${text.slice(0, n - 1)}…` : text || '');

// Every story since the last edition, for the longer brief: one pool for the league and one for Jack's
// team. Duplicates (the same headline from two outlets) are merged and keep both sources. A story is the
// team's if it came from a team feed, is tagged with the team, or names the team in its headline.
//   items: articles and feed items, each with { title, description, content, url, published, publisher, teamFeed? }
export function newsPool(items, idx, sources, { since, limit = 40, teamLimit = 25 }) {
  const myAbbr = idx.abbr(idx.myId);
  const byKey = new Map();
  for (const item of items) {
    if (SKIP.test(item.title) || SPAM.test(item.title)) continue;
    if (since && item.published && Date.parse(item.published) < since) continue;
    const key = normalise(item.title);
    if (!key) continue;
    const teams = teamsIn(item, idx);
    const existing = byKey.get(key);
    if (existing) {
      existing.sources.push(sources.add(item));
      if (!existing.detailText && item.content) existing.detailText = item.content;
      existing.mine ||= Boolean(item.teamFeed);
      continue;
    }
    byKey.set(key, {
      title: item.title,
      summary: clipText(item.description || item.content, 320) || null,
      teams,
      mine: Boolean(item.teamFeed) || teams.includes(myAbbr),
      published: item.published || null,
      publisher: item.publisher,
      articleId: item.articleId || null,
      detailText: item.content && item.content.length > 400 ? item.content : null,
      sources: [sources.add(item)],
    });
  }
  const all = [...byKey.values()].map(s => ({ ...s, sources: [...new Set(s.sources)] }))
    .sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0));
  return {
    league: all.filter(s => !s.mine).slice(0, limit),
    team: all.filter(s => s.mine).slice(0, teamLimit),
  };
}

// What kind of roster move a transaction line describes.
export function moveType(text) {
  if (/^traded|acquired|trade/i.test(text)) return 'Trade';
  if (/^signed|re-signed|agreed/i.test(text)) return 'Signing';
  if (/^waived|released|cut/i.test(text)) return 'Release';
  if (/injured reserve|reserve\/injured|\bIR\b/i.test(text) && /^placed/i.test(text)) return 'Injured reserve';
  if (/^activated/i.test(text)) return 'Activated';
  if (/^(fired|hired|named|promoted)/i.test(text)) return 'Coaching';
  if (/^(assigned|recalled|elevated|promoted|claimed)/i.test(text)) return 'Roster';
  return 'Move';
}

export function transactions(json, idx, { since, teamId, limit = 10 } = {}) {
  return (json?.transactions || [])
    .filter(t => (!since || Date.parse(t.date) >= since) && (!teamId || String(t.team?.id) === String(teamId)))
    .slice(0, limit)
    .map(t => ({
      type: moveType(t.description || ''),
      teams: t.team?.id ? [idx.abbr(t.team.id)] : [],
      date: t.date,
      text: t.team?.displayName ? `${t.team.displayName}: ${t.description}` : t.description,
      plainText: t.description,
    }));
}
