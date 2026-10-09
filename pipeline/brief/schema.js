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
  headlines: { type: 'array', items: obj({ title: str, summary: str, whyItMatters: str, refs }) },
  contextCard: nullable(obj({ title: str, body: str })),
  awardRaces: { type: 'array', items: obj({ award: str, contenders: { type: 'array', items: person } }) },
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

    out[league].headlines = (l.headlines || []).filter((h, i) => {
      const where = `${league} headline ${i + 1}`;
      const r = validRefs(h.refs, where).filter(id => index.get(id).kind === 'headline' && index.get(id).league === league);
      if (!r.length) { dropped.push(`${where}: no source headline`); return false; }
      h.refs = r;
      return numbersOk(`${h.title} ${h.summary} ${h.whyItMatters}`, where);
    });

    // At most one context card a day, across both leagues.
    const card = l.contextCard;
    out[league].contextCard = card && card.title && card.body && contextCards === 0 ? card : null;
    if (out[league].contextCard) contextCards++;

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
