// The fact check: after the brief is written, a second, smaller Claude call reads every sentence against
// the same data and lists any that state something the data doesn't support. Those sentences are removed
// (an item left with no text is dropped). Turned on and off with "factCheck" in config/settings.json.

const FIELDS = [
  // [section path, text field] for each league; titles are left alone (they repeat the text).
  ['oneThing', 'text'], ['headlines', 'summary'], ['headlines', 'whyItMatters'], ['teamNews', 'text'],
  ['recaps', 'text'], ['standouts', 'why'], ['quickHits', 'text'], ['followedNotes', 'note'],
];

const split = text => String(text || '').split(/(?<=[.!?]["'”’)]?)\s+(?=["'“‘(]?[A-Z0-9])/).filter(s => s.trim());

// Every sentence in the written brief, with an id and where it lives (so it can be removed).
export function sentencesOf(brief) {
  const out = [];
  const add = (holder, field, where) => {
    split(holder?.[field]).forEach((text, i) => out.push({ id: `s${out.length + 1}`, text, where, holder, field, index: i }));
  };
  for (const league of ['nfl', 'nba']) {
    const l = brief[league];
    for (const [section, field] of FIELDS) {
      const value = l[section];
      if (Array.isArray(value)) value.forEach((item, i) => add(item, field, `${league} ${section} ${i + 1}`));
      else if (value) add(value, field, `${league} ${section}`);
    }
    if (l.wrap) {
      add(l.wrap, 'summary', `${league} wrap`);
      l.wrap.storylines.forEach((s, i) => add(s, 'text', `${league} wrap storyline ${i + 1}`));
    }
    for (const s of brief.myTeams[league].sinceLast) add(s, 'text', `${league} team update`);
  }
  return out;
}

// Removes the flagged sentences, then any item left without its main text.
export function removeSentences(brief, sentences, flaggedIds) {
  const flagged = new Set(flaggedIds);
  const byHolder = new Map();
  for (const s of sentences) {
    const key = s.holder;
    if (!byHolder.has(key)) byHolder.set(key, []);
    byHolder.get(key).push(s);
  }
  for (const [holder, list] of byHolder) {
    for (const field of new Set(list.map(s => s.field))) {
      const kept = list.filter(s => s.field === field && !flagged.has(s.id)).map(s => s.text);
      holder[field] = kept.join(' ');
    }
  }
  for (const league of ['nfl', 'nba']) {
    const l = brief[league];
    if (l.oneThing && !l.oneThing.text) l.oneThing = null;
    l.headlines = l.headlines.filter(h => h.summary);
    l.teamNews = l.teamNews.filter(t => t.text);
    l.standouts = l.standouts.filter(p => p.why);
    l.quickHits = l.quickHits.filter(q => q.text);
    l.followedNotes = l.followedNotes.filter(f => f.note);
    // A recap that loses all its text keeps the game: the app still shows the score and key players.
    if (l.wrap) l.wrap.storylines = l.wrap.storylines.filter(s => s.text);
    brief.myTeams[league].sinceLast = brief.myTeams[league].sinceLast.filter(s => s.text);
  }
}

