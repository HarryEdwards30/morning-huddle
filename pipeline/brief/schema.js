// The shape Claude's daily brief must come back in (sent as a JSON schema, so the API enforces it),
// plus our own checks on top: every item must cite real input ids, and every number it states must
// appear in the input. Items that fail are dropped rather than shown.

const str = { type: 'string' };
const refs = { type: 'array', items: str };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });

const leagueSchema = obj({
  oneThing: nullable(obj({ text: str, refs })),
  headlines: { type: 'array', items: obj({ title: str, summary: str, whyItMatters: str, refs }) },
  contextCard: nullable(obj({ title: str, body: str })),
  awardRaces: { type: 'array', items: obj({ award: str, contenders: { type: 'array', items: obj({ name: str, team: str, note: str, refs }) } }) },
});

const teamSchema = obj({
  sinceLast: { type: 'array', items: obj({ text: str, refs }) },
  formNotes: { type: 'array', items: obj({ player: str, note: str }) },
  typicalRecovery: { type: 'array', items: obj({ player: str, text: str }) },
});

export const DAILY_BRIEF_SCHEMA = obj({
  nfl: leagueSchema,
  nba: leagueSchema,
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
export function checkBrief(brief, index, inputText) {
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
      contenders: (a.contenders || []).filter((c, i) => {
        const where = `${league} ${a.award} contender ${i + 1}`;
        if (!inputText.includes(c.name)) { dropped.push(`${where}: ${c.name} isn't in the data`); return false; }
        return numbersOk(c.note, where);
      }),
    })).filter(a => a.contenders.length);

    const t = brief.myTeams?.[league] || {};
    out.myTeams[league] = {
      sinceLast: (t.sinceLast || []).filter((s, i) => numbersOk(s.text, `${league} team update ${i + 1}`))
        .map(s => ({ text: s.text, refs: validRefs(s.refs, `${league} team update`) })),
      formNotes: (t.formNotes || []).filter((f, i) => numbersOk(f.note, `${league} form note ${i + 1}`)),
      // Typical recovery ranges are general knowledge (allowed by the rules), so their numbers aren't checked.
      typicalRecovery: t.typicalRecovery || [],
    };
  }
  return { brief: out, dropped };
}
