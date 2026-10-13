// Each completed game's key players, from ESPN's game summary (box score). Only the top performers
// are kept, as short stat lines like "Wembanyama 31 pts, 14 reb, 5 blk", never the full box score.

// "Victor Wembanyama" -> "Wembanyama", "Kenneth Walker III" -> "Walker III".
export const surname = name => {
  const parts = String(name || '').split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
};

const num = v => {
  const n = Number(String(v ?? '').split('/')[0].split('-')[0]);
  return Number.isFinite(n) ? n : 0;
};

// The stat columns for one category, as { label: value } per athlete.
function rows(category) {
  const labels = category?.labels || [];
  return (category?.athletes || []).filter(a => !a.didNotPlay && a.stats?.length).map(a => ({
    name: a.athlete?.displayName,
    stats: Object.fromEntries(labels.map((l, i) => [l, a.stats[i]])),
  })).filter(r => r.name);
}

function nbaPlayers(team) {
  return rows(team.statistics?.[0]).map(r => {
    const s = { pts: num(r.stats.PTS), reb: num(r.stats.REB), ast: num(r.stats.AST), stl: num(r.stats.STL), blk: num(r.stats.BLK), threes: num(r.stats['3PT']) };
    const bits = [`${s.pts} pts`, `${s.reb} reb`, `${s.ast} ast`];
    if (s.blk >= 3) bits.push(`${s.blk} blk`);
    if (s.stl >= 3) bits.push(`${s.stl} stl`);
    if (s.threes >= 5) bits.push(`${s.threes} 3PM`);
    const tripleDouble = [s.pts, s.reb, s.ast, s.stl, s.blk].filter(v => v >= 10).length >= 3;
    return {
      name: r.name, line: bits.join(', '), stats: s,
      score: s.pts + 1.2 * s.reb + 1.5 * s.ast + 2 * (s.stl + s.blk) + (tripleDouble ? 15 : 0),
      big: s.pts >= 35 || s.reb >= 18 || s.ast >= 14 || s.blk >= 6 || tripleDouble,
    };
  }).sort((a, b) => b.stats.pts - a.stats.pts || b.score - a.score);
}

function nflPlayers(team) {
  const cat = name => team.statistics?.find(c => c.name === name);
  const out = [];
  for (const r of rows(cat('passing')).slice(0, 1)) {
    const yds = num(r.stats.YDS), td = num(r.stats.TD), int = num(r.stats.INT);
    out.push({ role: 'passing', name: r.name, line: `${r.stats['C/ATT']}, ${yds} yds, ${td} TD${int ? `, ${int} INT` : ''}`, stats: { yds, td, int }, score: yds / 25 + 4 * td - 2 * int, big: yds >= 350 || td >= 4 });
  }
  for (const r of rows(cat('rushing')).sort((a, b) => num(b.stats.YDS) - num(a.stats.YDS)).slice(0, 1)) {
    const yds = num(r.stats.YDS), td = num(r.stats.TD);
    out.push({ role: 'rushing', name: r.name, line: `${num(r.stats.CAR)} car, ${yds} yds${td ? `, ${td} TD` : ''}`, stats: { yds, td }, score: yds / 10 + 6 * td, big: yds >= 130 || td >= 3 });
  }
  for (const r of rows(cat('receiving')).sort((a, b) => num(b.stats.YDS) - num(a.stats.YDS)).slice(0, 1)) {
    const yds = num(r.stats.YDS), td = num(r.stats.TD), rec = num(r.stats.REC);
    out.push({ role: 'receiving', name: r.name, line: `${rec} rec, ${yds} yds${td ? `, ${td} TD` : ''}`, stats: { yds, td, rec }, score: yds / 10 + 6 * td + rec / 2, big: yds >= 140 || td >= 3 });
  }
  // The best defender: sacks and interceptions first, then tackles.
  const ints = Object.fromEntries(rows(cat('interceptions')).map(r => [r.name, num(r.stats.INT)]));
  const defenders = rows(cat('defensive')).map(r => {
    const sacks = num(r.stats.SACKS), tkl = num(r.stats.TOT), int = ints[r.name] || 0, td = num(r.stats.TD);
    const bits = [sacks ? `${sacks} sack${sacks === 1 ? '' : 's'}` : null, int ? `${int} INT` : null, `${tkl} tkl`, td ? `${td} TD` : null].filter(Boolean);
    return { role: 'defence', name: r.name, line: bits.join(', '), stats: { sacks, tkl, int, td }, score: 4 * sacks + 5 * int + tkl / 2 + 6 * td, big: sacks >= 3 || int >= 2 };
  }).sort((a, b) => b.score - a.score);
  if (defenders[0]) out.push(defenders[0]);
  return out;
}

// { teamAbbr: [players] } for one game, best first. Empty if ESPN had no box score.
export function keyPlayers(league, summary, idx) {
  const out = {};
  for (const team of summary?.boxscore?.players || []) {
    const abbr = idx.abbr(team.team?.id);
    out[abbr] = (league === 'nba' ? nbaPlayers(team) : nflPlayers(team)).map(p => ({ ...p, team: abbr }));
  }
  return out;
}

// The line shown under a game recap: two players a side ("Wembanyama 31 pts, 14 reb, 5 blk · ...").
export function keyLine(league, players) {
  const pick = list => (league === 'nba' ? list.slice(0, 2)
    : [list.find(p => p.role === 'passing'), [...list].filter(p => p.role !== 'passing').sort((a, b) => b.score - a.score)[0]].filter(Boolean));
  return Object.values(players).flatMap(pick).map(p => `${surname(p.name)} ${p.line}`).join(' · ') || null;
}
