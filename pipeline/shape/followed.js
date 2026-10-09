// Players you follow (settings.json "followedPlayers"): everything about them in today's data.
// Each entry in settings is { "name": "Victor Wembanyama", "league": "nba" }.
// Only facts already in the data are used: their lines in the latest games, where they sit in the
// league's stat leaders, their injury status, and news stories that name them. Claude turns these into
// a one-line note; without Claude, the app shows the facts themselves.

import { shapeInjury } from './injuries.js';

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function followedPlayers(players, league, { results, leaders, injuriesJson, news, sources, idx }) {
  return (players || []).filter(p => p?.name && (p.league || '').toLowerCase() === league).map(p => {
    const named = new RegExp(`\\b${escape(p.name)}\\b`, 'i');
    const facts = [];
    let team = p.team || null;

    for (const g of results) {
      for (const l of (g.leaders || []).filter(l => l.name === p.name)) {
        team = team || l.team;
        facts.push({ text: `${l.line} in ${g.away.name} ${g.away.score} at ${g.home.name} ${g.home.score} (${g.status}).` });
      }
    }
    for (const c of leaders || []) {
      const i = c.leaders.findIndex(l => l.name === p.name);
      if (i >= 0) {
        team = team || c.leaders[i].team;
        facts.push({ text: `${c.category}: ${c.leaders[i].value}, number ${i + 1} in the league.` });
      }
    }
    for (const t of injuriesJson?.injuries || []) {
      for (const item of (t.injuries || []).filter(i => i.athlete?.displayName === p.name)) {
        const injury = shapeInjury(item, idx);
        if (injury) {
          team = team || injury.team;
          facts.push({ text: `Injury report: ${injury.status}, ${injury.injury.toLowerCase()}.${injury.about ? ` ${injury.about}` : ''}` });
        }
      }
    }
    for (const n of news.filter(n => named.test(n.title) || named.test(n.description || '')).slice(0, 3)) {
      facts.push({ text: n.title, sources: [sources.add(n)] });
    }

    return {
      name: p.name,
      team,
      note: null, // written by Claude
      facts: facts.slice(0, 6),
      sources: [...new Set(facts.flatMap(f => f.sources || []))],
    };
  });
}
