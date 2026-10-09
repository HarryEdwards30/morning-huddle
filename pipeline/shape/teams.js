// A lookup of every team in a league, built from ESPN's team list.
// ESPN's abbreviations are used for other teams. Jack's team uses the abbreviation from settings
// (for example SAS rather than ESPN's SA), so the app always recognises it.

export function teamIndex(teamsJson, settingsTeam) {
  const list = teamsJson?.sports?.[0]?.leagues?.[0]?.teams?.map(t => t.team) || [];
  const byId = new Map();
  let myId = null;
  for (const t of list) {
    byId.set(String(t.id), t);
    if (t.displayName === settingsTeam.name) myId = String(t.id);
  }
  const abbr = id => {
    const key = String(id);
    if (key === myId) return settingsTeam.abbr;
    return byId.get(key)?.abbreviation || '?';
  };
  const name = id => byId.get(String(id))?.shortDisplayName || byId.get(String(id))?.name || 'TBC';
  const fullName = id => byId.get(String(id))?.displayName || name(id);
  return { byId, myId, abbr, name, fullName, isMine: id => String(id) === myId };
}
