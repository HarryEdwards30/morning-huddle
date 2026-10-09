// Injury reports from ESPN's injuries feed (which carries RotoWire notes).
// Only facts from the feed: the status, what the injury is, the note, and ESPN's estimated return date,
// which is labelled as a media report. Typical recovery times are left to the AI (Phase 3), labelled as typical.

const STATUS = {
  'out': 'Out',
  'injured reserve': 'Out',
  'doubtful': 'Doubtful',
  'questionable': 'Questionable',
  'probable': 'Probable',
  'day-to-day': 'Day-to-day',
  'suspension': 'Out',
};

const clean = v => (v && !/not specified/i.test(v) ? v : null);

function injuryText(details) {
  if (!details) return 'Injury not specified';
  const side = clean(details.side);
  const type = clean(details.type);
  const detail = clean(details.detail);
  const what = [side, type ? type.toLowerCase() : null].filter(Boolean).join(' ');
  const extra = detail && detail.toLowerCase() !== (type || '').toLowerCase() ? `(${detail.toLowerCase()})` : null;
  const text = [what || null, extra].filter(Boolean).join(' ');
  return text ? text[0].toUpperCase() + text.slice(1) : 'Injury not specified';
}

function returnText(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const label = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(',', '');
  return `Around ${label} (estimate)`;
}

export function shapeInjury(item, idx) {
  const raw = String(item.status || item.type?.description || '').toLowerCase();
  const status = STATUS[raw];
  if (!status) return null; // "Active" means cleared to play
  const teamId = item.athlete?.team?.id;
  return {
    player: item.athlete?.displayName || 'Unknown player',
    position: item.athlete?.position?.abbreviation || null,
    team: teamId ? idx.abbr(teamId) : null,
    status,
    injury: injuryText(item.details),
    // Some feed notes are a single word ("questionable"), which adds nothing to the status chip.
    about: (item.shortComment || '').length >= 25 ? item.shortComment.slice(0, 220) : null,
    onInjuredReserve: raw === 'injured reserve',
    timeline: item.details?.returnDate ? { text: returnText(item.details.returnDate), basis: 'media' }
      : raw === 'injured reserve' ? { text: 'On injured reserve', basis: 'team' } : null,
    date: item.date || null,
  };
}

const ORDER = { 'Out': 0, 'Doubtful': 1, 'Questionable': 2, 'Day-to-day': 3, 'Probable': 4 };

export function teamInjuries(injuriesJson, idx, teamId) {
  const team = (injuriesJson?.injuries || []).find(t => String(t.id) === String(teamId))
    || (injuriesJson?.injuries || []).find(t => t.injuries?.some(i => String(i.athlete?.team?.id) === String(teamId)));
  return (team?.injuries || [])
    .map(i => shapeInjury(i, idx))
    .filter(Boolean)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}

// "Major" injuries for the league tab: injured players who are also in today's news (a sign they're
// stars or starters), plus anyone Out on Jack's team. The AI takes over this choice in Phase 3.
export function majorInjuries(injuriesJson, idx, newsText, limit = 8) {
  const all = (injuriesJson?.injuries || []).flatMap(t => t.injuries || []).map(i => shapeInjury(i, idx)).filter(Boolean);
  const text = newsText.toLowerCase();
  const inNews = p => text.includes(p.player.toLowerCase());
  return all
    .filter(p => (p.status === 'Out' || p.status === 'Doubtful' || p.status === 'Questionable') && inNews(p))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status])
    .slice(0, limit)
    .map(({ onInjuredReserve, date, ...rest }) => rest);
}
