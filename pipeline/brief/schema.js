// The shape Claude's brief must come back in (given to Claude as a JSON schema in its instructions),
// plus our own checks: every item must cite real input ids, and every number it states must appear in
// the input. Items that fail are dropped rather than shown.
//
// Three parts, each with an NFL and an NBA section: the daily brief (every day), and on Wednesdays the
// Wrap and the watch guide as well. All of it comes back in one reply.

const str = { type: 'string' };
const refs = { type: 'array', items: str };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });

const person = obj({ name: str, team: str, note: str, refs });

const dailyLeague = {
  oneThing: nullable(obj({ text: str, refs })),
  // Top stories. Each must cite at least one story (or team story) id.
  headlines: { type: 'array', items: obj({ title: str, summary: str, whyItMatters: str, refs }) },
  // Jack's team's news: every team story, covered here or in the top stories or quick hits.
  teamNews: { type: 'array', items: obj({ title: str, text: str, refs }) },
  // Game recaps. `game` is a result id; the app shows the score and the key players from the data.
  recaps: { type: 'array', items: obj({ game: str, text: str }) },
  // Standout performers. `id` is a standout candidate id; the app shows the stat line from the data.
  standouts: { type: 'array', items: obj({ id: str, why: str }) },
  // One-line updates for every other story worth knowing.
  quickHits: { type: 'array', items: obj({ text: str, refs }) },
  contextCard: nullable(obj({ title: str, body: str })),
  awardRaces: { type: 'array', items: obj({ award: str, contenders: { type: 'array', items: person } }) },
  // One line per followed player (only when the data has followedPlayers). `id` is the player's input id.
  followedNotes: { type: 'array', items: obj({ id: str, note: str }) },
};

// Wednesday Wrap: the league's past week. biggestResults are ids of the week's results (the app shows the scores).
export const WRAP_SCHEMA = nullable(obj({
  summary: str,
  storylines: { type: 'array', items: obj({ text: str, refs }) },
  biggestResults: refs,
  standouts: { type: 'array', items: person },
}));

// Watch guide: 3 to 5 games from the candidates, best first. `game` is a candidate id.
export const WATCH_SCHEMA = obj({ picks: { type: 'array', items: obj({ game: str, reason: str }) } });

const teamSchema = obj({
  sinceLast: { type: 'array', items: obj({ text: str, refs }) },
  formNotes: { type: 'array', items: obj({ player: str, note: str }) },
  typicalRecovery: { type: 'array', items: obj({ player: str, text: str }) },
});

export const DAILY_BRIEF_SCHEMA = obj({
  nfl: obj(dailyLeague),
  nba: obj(dailyLeague),
  myTeams: obj({ nfl: teamSchema, nba: teamSchema }),
});

const wednesdayLeague = obj({ ...dailyLeague, wrap: WRAP_SCHEMA, watch: WATCH_SCHEMA });
export const WEDNESDAY_SCHEMA = obj({
  nfl: wednesdayLeague,
  nba: wednesdayLeague,
  myTeams: obj({ nfl: teamSchema, nba: teamSchema }),
});

// Numbers in a sentence that must be found in the input. Small whole numbers (0 to 10) are allowed
// without a match, because they're usually counts ("two games clear", "3rd in the AFC").
export function unsupportedNumbers(text, inputText) {
  const found = String(text).match(/\d+(?:[.,]\d+)?/g) || [];
  return found.filter(n => {
    const plain = n.replace(/,/g, '');
    if (/^\d+$/.test(plain) && Number(plain) <= 10) return false;
    return !inputText.includes(plain) && !inputText.includes(n);
  });
}

// Checks the parsed reply, returning the cleaned brief and a list of what was dropped and why.
export function checkBrief(brief, index, inputText, { wednesday = false } = {}) {
  const dropped = [];
  const validRefs = (list, where) => {
    const good = (list || []).filter(r => index.has(r));
    if ((list || []).length && good.length < list.length) dropped.push(`${where}: unknown refs ${list.filter(r => !index.has(r)).join(', ')}`);
    return good;
  };
  const numbersOk = (text, where) => {
    const bad = unsupportedNumbers(text, inputText);
    if (bad.length) dropped.push(`${where}: numbers not in the data (${bad.join(', ')})`);
    return bad.length === 0;
  };
  // A named player must be in the data. The data reads "Name (ABBR) ..."; use that abbreviation for the team chip.
  const personOk = (p, where) => {
    if (!p?.name || !inputText.includes(p.name)) { dropped.push(`${where}: ${p?.name} isn't in the data`); return false; }
    const abbr = new RegExp(`${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(([A-Z]{2,4})\\)`).exec(inputText)?.[1];
    if (abbr) p.team = abbr;
    return numbersOk(p.note, where);
  };

  const out = { nfl: {}, nba: {}, myTeams: {} };
  let contextCards = 0;
  for (const league of ['nfl', 'nba']) {
    const l = brief[league] || {};
    const one = l.oneThing;
    out[league].oneThing = one && one.text && numbersOk(one.text, `${league} one thing`) ? { text: one.text, refs: validRefs(one.refs, `${league} one thing`) } : null;

    // Items that must cite something from this league: a story, a team story, or (for a story told from
    // the data) a game, roster move, injury or team fact.
    const storyRefs = (refs, where, kinds = ['headline', 'teamStory', 'result', 'move', 'injury', 'teamfact']) =>
      validRefs(refs, where).filter(id => kinds.includes(index.get(id).kind) && index.get(id).league === league);

    out[league].headlines = (l.headlines || []).filter((h, i) => {
      const where = `${league} top story ${i + 1}`;
      const r = storyRefs(h.refs, where);
      if (!r.length) { dropped.push(`${where}: no source story`); return false; }
      h.refs = r;
      return numbersOk(`${h.title} ${h.summary} ${h.whyItMatters}`, where);
    });

    out[league].teamNews = (l.teamNews || []).filter((t, i) => {
      const where = `${league} team news ${i + 1}`;
      const r = storyRefs(t.refs, where);
      if (!r.length) { dropped.push(`${where}: no source story`); return false; }
      t.refs = r;
      return t.text && numbersOk(`${t.title} ${t.text}`, where);
    });

    const recapped = new Set();
    out[league].recaps = (l.recaps || []).filter((rc, i) => {
      const where = `${league} recap ${i + 1}`;
      const entry = index.get(rc.game);
      if (!entry || entry.kind !== 'result' || entry.league !== league || !entry.item) { dropped.push(`${where}: ${rc.game} isn't one of the games`); return false; }
      if (recapped.has(rc.game)) return false;
      recapped.add(rc.game);
      return rc.text && numbersOk(rc.text, where);
    });

    const picked = new Set();
    out[league].standouts = (l.standouts || []).filter((st, i) => {
      const where = `${league} standout ${i + 1}`;
      const entry = index.get(st.id);
      if (!entry || entry.kind !== 'standoutCandidate' || entry.league !== league) { dropped.push(`${where}: ${st.id} isn't a standout candidate`); return false; }
      if (picked.has(st.id)) return false;
      picked.add(st.id);
      return st.why && numbersOk(st.why, where);
    });

    out[league].quickHits = (l.quickHits || []).filter((q, i) => {
      const where = `${league} quick hit ${i + 1}`;
      const r = storyRefs(q.refs, where);
      if (!r.length) { dropped.push(`${where}: no source story`); return false; }
      q.refs = r;
      return q.text && numbersOk(q.text, where);
    });

    // At most one context card a day, across both leagues.
    const card = l.contextCard;
    out[league].contextCard = card && card.title && card.body && contextCards === 0 ? card : null;
    if (out[league].contextCard) contextCards++;

    out[league].followedNotes = (l.followedNotes || []).filter((f, i) => {
      const entry = index.get(f.id);
      if (!entry || entry.kind !== 'followed' || entry.league !== league) { dropped.push(`${league} followed note ${i + 1}: ${f.id} isn't a followed player`); return false; }
      return f.note && numbersOk(f.note, `${league} followed note ${i + 1}`);
    });

    out[league].awardRaces = (l.awardRaces || []).map(a => ({
      award: a.award,
      contenders: (a.contenders || []).filter((c, i) => personOk(c, `${league} ${a.award} contender ${i + 1}`)),
    })).filter(a => a.contenders.length);

    const t = brief.myTeams?.[league] || {};
    out.myTeams[league] = {
      sinceLast: (t.sinceLast || []).filter((s, i) => numbersOk(s.text, `${league} team update ${i + 1}`))
        .map(s => ({ text: s.text, refs: validRefs(s.refs, `${league} team update`) })),
      formNotes: (t.formNotes || []).filter((f, i) => numbersOk(f.note, `${league} form note ${i + 1}`)),
      // Typical recovery ranges are general knowledge (allowed by the rules), so their numbers aren't checked.
      typicalRecovery: t.typicalRecovery || [],
    };

    if (wednesday) {
      out[league].wrap = checkWrap(l.wrap, league);
      out[league].watch = checkWatch(l.watch, league);
    }
  }
  return { brief: out, dropped };

  function checkWrap(w, league) {
    if (!w?.summary) return null;
    if (!numbersOk(w.summary, `${league} wrap summary`)) return null;
    return {
      summary: w.summary,
      storylines: (w.storylines || []).filter((s, i) => s.text && numbersOk(s.text, `${league} wrap storyline ${i + 1}`))
        .map(s => ({ text: s.text, refs: validRefs(s.refs, `${league} wrap storyline`) })),
      biggestResults: [...new Set(validRefs(w.biggestResults, `${league} wrap results`))]
        .filter(id => index.get(id).kind === 'weekResult' && index.get(id).league === league).slice(0, 4),
      standouts: (w.standouts || []).filter((p, i) => personOk(p, `${league} wrap standout ${i + 1}`)),
    };
  }

  // Picks must be candidate games from this league, each once. A reason with a number that isn't in the
  // data is dropped (the game keeps its place with the plain reason from the data).
  function checkWatch(w, league) {
    const picks = [];
    for (const [i, p] of (w?.picks || []).entries()) {
      const where = `${league} watch pick ${i + 1}`;
      const entry = index.get(p.game);
      if (!entry || entry.kind !== 'watchGame' || entry.league !== league) { dropped.push(`${where}: ${p.game} isn't a candidate game`); continue; }
      if (picks.some(x => x.game === p.game)) continue;
      picks.push({ game: p.game, reason: p.reason && numbersOk(p.reason, where) ? p.reason : null });
    }
    return { picks: picks.slice(0, 5) };
  }
}
