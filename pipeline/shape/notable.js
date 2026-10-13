// Flags the games most worth a recap, before Claude sees them: close finishes and overtime, upsets on
// record, huge individual games, meetings of good teams, division games, and always Jack's team.
// Claude makes the final choice; this just puts the likely ones first and says why.

const parseRecord = text => {
  const [w, l, t = 0] = String(text || '').split('-').map(Number);
  return Number.isFinite(w) && Number.isFinite(l) ? { w, l, t } : null;
};
const games = r => r.w + r.l + r.t;
const pct = r => (games(r) ? (r.w + r.t / 2) / games(r) : 0.5);

// The record going into the game (ESPN gives the record after it).
function before(record, won, tied) {
  const r = parseRecord(record);
  if (!r) return null;
  return tied ? { ...r, t: r.t - 1 } : won ? { ...r, w: r.w - 1 } : { ...r, l: r.l - 1 };
}

export function flagGames(league, results, players, standings, isMine) {
  const group = new Map();
  for (const g of standings?.groups || []) for (const r of g.rows) group.set(r.abbr, { name: g.name, seed: r.seed });
  const closeAt = league === 'nba' ? 5 : 3;

  return results.map(g => {
    const flags = [];
    let score = 0;
    const add = (text, points) => { flags.push(text); score += points; };
    const mine = isMine(g.home.id) || isMine(g.away.id);
    if (mine) add('Jack’s team', 10);

    const margin = Math.abs((g.home.score ?? 0) - (g.away.score ?? 0));
    if (g.ot) add('overtime', 3);
    if (margin <= closeAt) add(`close finish (${margin === 0 ? 'tie' : `${margin}-point margin`})`, 3);
    else if (league === 'nfl' && margin <= 8) add('one-score game', 1);

    const tied = g.home.score === g.away.score;
    const homeWon = g.home.score > g.away.score;
    const winner = homeWon ? g.home : g.away;
    const loser = homeWon ? g.away : g.home;
    const wRec = before(winner.record, true, tied);
    const lRec = before(loser.record, false, tied);
    if (!tied && wRec && lRec && games(wRec) >= 3 && games(lRec) >= 3) {
      if (pct(lRec) - pct(wRec) >= 0.25) add(`upset: ${winner.abbr} (${wRec.w}-${wRec.l}) beat ${loser.abbr} (${lRec.w}-${lRec.l})`, 3);
      if (pct(wRec) >= 0.6 && pct(lRec) >= 0.6) add('two winning teams', 2);
    }
    const gh = group.get(g.home.abbr), ga = group.get(g.away.abbr);
    if (league === 'nfl' && gh && ga && gh.name === ga.name) add(`${gh.name} game`, 1);

    let bigCount = 0;
    for (const p of [...(players[g.id]?.[g.home.abbr] || []), ...(players[g.id]?.[g.away.abbr] || [])]) {
      if (p.big && bigCount < 2) { add(`big game: ${p.name} ${p.line}`, 2); bigCount++; }
    }
    return { id: g.id, mine, flags, score };
  });
}

// How many games to recap: all of them on a light day, otherwise the notable ones (about 5 or 6).
export function recapPlan(flagged) {
  const notable = flagged.filter(f => f.mine || f.score >= 3);
  if (flagged.length <= 4) return { recapAll: true, suggested: flagged.length, notableIds: flagged.map(f => f.id) };
  const ranked = [...flagged].sort((a, b) => b.score - a.score);
  const suggested = Math.min(7, Math.max(5, notable.length));
  return { recapAll: false, suggested, notableIds: ranked.slice(0, Math.max(suggested, notable.length)).map(f => f.id) };
}
