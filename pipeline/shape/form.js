// Player form: each key player's last 5 games against their season average, from ESPN game logs.
// Key players are the team's statistical leaders. The trend marker compares the last 5 with the season
// on the player's main stat (10% either way). The one-line note is written by Claude from Phase 3.

const NFL_LEADER_CATEGORIES = ['passingYards', 'rushingYards', 'receivingYards', 'sacks'];
const NBA_LEADER_CATEGORIES = ['points', 'rebounds', 'assists', 'blocks'];

// Which stats to show for each kind of player, in order of preference (ESPN game-log stat names).
const STAT_SETS = {
  QB: [['passingYards', 'PASS YDS'], ['passingTouchdowns', 'TD'], ['interceptions', 'INT']],
  RB: [['rushingYards', 'RUSH YDS'], ['yardsPerRushAttempt', 'YPC'], ['rushingTouchdowns', 'TD']],
  REC: [['receptions', 'REC'], ['receivingYards', 'YDS'], ['receivingTouchdowns', 'TD']],
  DEF: [['totalTackles', 'TCKL'], ['sacks', 'SACKS'], ['passesDefended', 'PD']],
  NBA: [['points', 'PTS'], ['totalRebounds', 'REB'], ['assists', 'AST'], ['blocks', 'BLK']],
};

function statSet(league, position) {
  if (league === 'nba') return STAT_SETS.NBA;
  if (position === 'QB') return STAT_SETS.QB;
  if (position === 'RB' || position === 'FB') return STAT_SETS.RB;
  if (['WR', 'TE'].includes(position)) return STAT_SETS.REC;
  return STAT_SETS.DEF;
}

export function leaderIds(leadersJson, league) {
  const wanted = league === 'nfl' ? NFL_LEADER_CATEGORIES : NBA_LEADER_CATEGORIES;
  const ids = [];
  for (const name of wanted) {
    const cat = leadersJson?.categories?.find(c => c.name === name);
    const ref = cat?.leaders?.[0]?.athlete?.$ref || '';
    const id = /athletes\/(\d+)/.exec(ref)?.[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function rosterIndex(rosterJson) {
  const athletes = (rosterJson?.athletes || []).flatMap(a => (a.items ? a.items : [a]));
  return new Map(athletes.map(a => [String(a.id), { name: a.displayName, position: a.position?.abbreviation || null }]));
}

// Per-game numbers for the current season type, newest game first.
function gameRows(gamelog) {
  const names = gamelog?.names || [];
  const seasonType = gamelog?.seasonTypes?.find(t => /regular/i.test(t.displayName || '')) || gamelog?.seasonTypes?.[0];
  if (!seasonType) return { names, games: [], label: null };
  const games = (seasonType.categories || [])
    .filter(c => c.type !== 'total' && Array.isArray(c.events))
    .flatMap(c => c.events)
    .map(e => ({ id: e.eventId, date: gamelog.events?.[e.eventId]?.gameDate || null, stats: e.stats }))
    .sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
  return { names, games, label: seasonType.displayName };
}

const toNumber = v => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const average = list => {
  const vals = list.filter(v => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};

const round = n => (n === null ? null : Math.round(n * 10) / 10);

export function playerForm(league, athleteId, info, gamelog) {
  const { names, games, label } = gameRows(gamelog);
  if (games.length < 2) return null;
  const set = statSet(league, info?.position).filter(([name]) => names.includes(name)).slice(0, 3);
  if (!set.length) return null;
  const column = name => games.map(g => toNumber(g.stats?.[names.indexOf(name)]));
  const stats = set.map(([name, labelText]) => {
    const all = column(name);
    return { label: labelText, last5: round(average(all.slice(0, 5))), season: round(average(all)) };
  });
  const main = stats[0];
  let trend = 'steady';
  if (games.length >= 4 && main.season) {
    const change = (main.last5 - main.season) / main.season;
    if (change >= 0.1) trend = 'up';
    else if (change <= -0.1) trend = 'down';
  }
  return {
    player: info?.name || 'Unknown',
    position: info?.position || null,
    trend,
    note: null,          // written by Claude from Phase 3
    games: games.length,
    seasonLabel: label,
    stats,
    athleteId,
  };
}
