// Writes the brief with Claude: one API call per edition, covering both leagues.
// On Wednesdays the same call also writes each league's Wednesday Wrap and ranks the watch guide.
//
// Usage: node pipeline/write-brief.js --out <folder>
//   Reads <folder>/latest.json and facts.json (written by build-edition.js), sends Claude a compact
//   version of the day's data with the instructions in prompts/, checks the reply, and merges the
//   written parts back into latest.json and today's archive copy.
//
// Also writes:
//   <folder>/brief-input.json  exactly what Claude was given (to check that nothing was invented)
//   <folder>/usage.json        tokens and estimated cost per run
//   <folder>/status.json       adds a "brief" entry saying whether the brief was written
//
// If anything goes wrong (no API key, API error, a reply that fails the checks twice), the edition keeps
// its fresh data without the written parts, status.json says why, and the script exits with code 2.
//
// The API key comes only from the ANTHROPIC_API_KEY environment variable (a GitHub secret).
// It is never printed or saved.

import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildInput, forClaude, idIndex, estimateTokens, DEFAULT_LIMITS, TRIM_STEPS } from './brief/input.js';
import { DAILY_BRIEF_SCHEMA, WEDNESDAY_SCHEMA, checkBrief } from './brief/schema.js';
import { melbourneIso } from './lib/time.js';
import { writeArchiveIndex } from './lib/archive.js';
import { sentencesOf, removeSentences } from './brief/factcheck.js';
import { watchEntry } from './shape/week.js';

const ROOT = new URL('..', import.meta.url).pathname;

function args() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--out');
  if (i < 0 || !argv[i + 1]) throw new Error('Usage: node pipeline/write-brief.js --out <folder>');
  return { out: argv[i + 1] };
}

const readJson = path => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };
const writeJson = (path, data, pretty = true) => writeFileSync(path, JSON.stringify(data, null, pretty ? 2 : 0) + '\n');

// Context card titles from the last two weeks, so Claude doesn't repeat a topic.
function recentContextCards(out) {
  const dir = join(out, 'editions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort().slice(-14)
    .map(f => readJson(join(dir, f)))
    .flatMap(e => [e?.nfl?.contextCard?.title, e?.nba?.contextCard?.title])
    .filter(Boolean);
}

// Plain-English reasons for the status banner (and the README's troubleshooting list).
function explain(error) {
  if (!process.env.ANTHROPIC_API_KEY) return 'No API key. The ANTHROPIC_API_KEY secret is missing from the repo settings.';
  if (error instanceof Anthropic.AuthenticationError) return 'The API key was rejected. It may have expired or been deleted.';
  if (error instanceof Anthropic.PermissionDeniedError) return 'The API key isn’t allowed to use this model.';
  if (error instanceof Anthropic.RateLimitError) return 'Claude was busy or the spending limit has been reached.';
  if (error instanceof Anthropic.BadRequestError && /credit|billing|spend/i.test(error.message)) return 'The Claude Console spending limit has been reached, or the account is out of credit.';
  if (error instanceof Anthropic.APIConnectionError) return 'Couldn’t connect to the Claude API.';
  if (error instanceof Anthropic.APIError) return `The Claude API returned an error (${error.status}).`;
  return error?.message ? `The brief couldn’t be written: ${error.message}` : 'The brief couldn’t be written.';
}

async function main() {
  const { out } = args();
  const settings = readJson(join(ROOT, 'config', 'settings.json'));
  const edition = readJson(join(out, 'latest.json'));
  const facts = readJson(join(out, 'facts.json')) || {};
  const statusPath = join(out, 'status.json');
  const status = readJson(statusPath) || {};
  if (!edition || edition.sample) throw new Error('No real edition to write a brief for.');

  const model = settings.ai.model;
  const maxInputTokens = settings.ai.maxInputTokens;
  const wednesday = edition.edition.type === 'wednesday' && Boolean(facts.week);
  const promptFiles = ['style.md', 'daily-brief.md', ...(wednesday ? ['wednesday-wrap.md', 'watch-guide.md'] : [])];
  const system = promptFiles.map(f => readFileSync(join(ROOT, 'prompts', f), 'utf8')).join('\n\n---\n\n');
  const schema = wednesday ? WEDNESDAY_SCHEMA : DAILY_BRIEF_SCHEMA;
  if (wednesday) console.log('Wednesday edition: the brief, the Wrap and the watch guide in one call.');

  // Build the input, trimming lower-priority items if it's over budget.
  const cards = recentContextCards(out);
  let limits = { ...DEFAULT_LIMITS };
  let input = buildInput(edition, facts, cards, limits);
  for (const step of TRIM_STEPS) {
    if (estimateTokens(forClaude(input)) + estimateTokens(system) < maxInputTokens * 0.5) break;
    limits = { ...limits, ...step };
    input = buildInput(edition, facts, cards, limits);
  }
  const sent = forClaude(input);
  writeJson(join(out, 'brief-input.json'), sent);
  const inputText = JSON.stringify(sent);
  const index = idIndex(input, edition, facts, limits);

  let result = null;
  let usage = { input_tokens: 0, output_tokens: 0 };
  let error = null;
  let dropped = [];
  const rejected = []; // API 400s from request variants that were tried and turned down
  let factCheck = null; // what the fact check looked at and removed

  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('missing key');
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

    const ask = wednesday ? "Write today's brief, both Wednesday Wraps and the watch guide." : "Write today's brief.";
    const userMessage = { role: 'user', content: `Here is today's data (JSON). ${ask}\n\n${inputText}` };

    // Cost guard: the cheap Haiku rate only applies under 100k input tokens.
    const counted = await client.messages.countTokens({ model, system, messages: [userMessage] });
    console.log(`Input: ${counted.input_tokens} tokens (limit ${maxInputTokens}).`);
    if (counted.input_tokens > maxInputTokens) throw new Error(`the input was ${counted.input_tokens} tokens, over the ${maxInputTokens} limit`);

    // The reply's JSON shape is given in the instructions and checked by checkBrief().
    // (Structured output isn't used: the API rejects this schema with "The compiled grammar is too large".)
    // If the API rejects a request (HTTP 400), the next variant drops the effort setting.
    // The API's explanation is always logged.
    const schemaNote = `\n\n---\n\nReply with only one JSON object (no other text) that matches this JSON schema:\n${JSON.stringify(schema)}`;
    // The longer brief needs room: up to about 10 minutes of reading plus the JSON around it. This is a
    // ceiling, not what's used (a normal day uses well under half). Streamed, so a long reply can't time out.
    const maxTokens = settings.ai.maxOutputTokens || 48000;
    const variants = [
      { label: 'JSON by instruction', request: { model, max_tokens: maxTokens, system: system + schemaNote, output_config: { effort: 'low' }, messages: [userMessage] } },
      { label: 'JSON by instruction, default effort', request: { model, max_tokens: maxTokens, system: system + schemaNote, messages: [userMessage] } },
    ];

    let variant = 0;
    let usableAttempts = 0;
    // Up to two usable replies (one retry), stepping to the next variant only on a 400.
    while (!result && usableAttempts < 2 && variant < variants.length) {
      const { label, request } = variants[variant];
      let response;
      try {
        response = await client.messages.stream(request).finalMessage();
      } catch (apiError) {
        if (apiError instanceof Anthropic.BadRequestError) {
          console.warn(`The API rejected the request (${label}): ${apiError.message}`);
          rejected.push(`${label}: ${apiError.message}`.slice(0, 300));
          error = apiError;
          variant++;
          continue;
        }
        throw apiError;
      }
      usableAttempts++;
      usage = { input_tokens: usage.input_tokens + response.usage.input_tokens, output_tokens: usage.output_tokens + response.usage.output_tokens };
      if (response.stop_reason === 'refusal') { error = new Error('Claude declined to write the brief'); continue; }
      if (response.stop_reason === 'max_tokens') { error = new Error('the reply was cut off'); continue; }
      const text = response.content.find(b => b.type === 'text')?.text || '';
      try {
        // Without structured output the JSON can arrive wrapped in a code fence; take the outermost object.
        const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const checked = checkBrief(JSON.parse(json), index, inputText, { wednesday });
        result = checked.brief;
        dropped = checked.dropped;
        error = null;
        console.log(`Brief written using ${label}.`);
      } catch (parseError) {
        error = new Error(`the reply wasn't valid (${parseError.message})`);
        console.warn(`Attempt ${usableAttempts} (${label}): ${error.message}`);
      }
    }

    // The fact check: a second, smaller call reads every sentence against the same data and lists any the
    // data doesn't support; those are removed. If the check itself fails, the brief goes ahead unchecked.
    if (result && settings.ai.factCheck !== false) {
      try {
        const sentences = sentencesOf(result);
        const response = await client.messages.stream({
          model, max_tokens: 16000, output_config: { effort: 'low' },
          system: readFileSync(join(ROOT, 'prompts', 'fact-check.md'), 'utf8'),
          messages: [{ role: 'user', content: `DATA (JSON):\n${inputText}\n\nBRIEF SENTENCES (JSON):\n${JSON.stringify(sentences.map(({ id, text }) => ({ id, text })))}` }],
        }).finalMessage();
        usage = { input_tokens: usage.input_tokens + response.usage.input_tokens, output_tokens: usage.output_tokens + response.usage.output_tokens };
        const text = response.content.find(b => b.type === 'text')?.text || '';
        const reply = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
        const known = new Set(sentences.map(x => x.id));
        const flagged = (reply.unsupported || []).filter(f => known.has(f.id));
        const reasons = Object.fromEntries(flagged.map(f => [f.id, f.reason]));
        if (flagged.length > sentences.length * 0.3) {
          // Flagging this much means the check went wrong, not the brief: keep the brief as written.
          console.warn(`Fact check flagged ${flagged.length} of ${sentences.length} sentences; that's too many to trust, so nothing was removed.`);
          factCheck = { checked: sentences.length, removed: 0, skipped: 'too many flagged' };
        } else {
          const removed = sentences.filter(x => reasons[x.id]).map(x => ({ where: x.where, sentence: x.text, reason: reasons[x.id] }));
          removeSentences(result, sentences, flagged.map(f => f.id));
          factCheck = { checked: sentences.length, removed: removed.length, sentences: removed };
          console.log(`Fact check: ${sentences.length} sentences checked, ${removed.length} removed.`);
          for (const r of removed) console.log(` - ${r.where}: ${r.sentence}\n   (${r.reason})`);
        }
      } catch (checkError) {
        console.warn(`Fact check skipped: ${checkError.message}`);
        factCheck = { checked: 0, removed: 0, skipped: String(checkError.message).slice(0, 200) };
      }
    }
  } catch (e) {
    error = e;
  }

  // Usage log: one line per run, plus the month's running total.
  const usageLog = readJson(join(out, 'usage.json')) || { runs: [] };
  const price = settings.ai.pricePerMillionTokensUsd || { input: 0.10, output: 0.50 };
  const costUsd = (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1e6;
  usageLog.runs.push({ date: edition.edition.date, at: melbourneIso(), model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, costUsd: Number(costUsd.toFixed(5)), ok: Boolean(result) });
  usageLog.runs = usageLog.runs.slice(-120);
  const month = edition.edition.date.slice(0, 7);
  usageLog.monthToDate = { month, costUsd: Number(usageLog.runs.filter(r => r.date.startsWith(month)).reduce((sum, r) => sum + r.costUsd, 0).toFixed(4)) };
  writeJson(join(out, 'usage.json'), usageLog);
  console.log(`Usage: ${usage.input_tokens} in, ${usage.output_tokens} out, about US$${costUsd.toFixed(4)} (month so far US$${usageLog.monthToDate.costUsd}).`);

  if (!result) {
    status.brief = { ok: false, error: explain(error), detail: error?.message ? String(error.message).slice(0, 300) : null, at: melbourneIso() };
    writeJson(statusPath, status);
    console.error(`Brief not written: ${status.brief.error}${status.brief.detail ? `\nDetail: ${status.brief.detail}` : ''}`);
    process.exitCode = 2;
    return;
  }

  merge(edition, result, index, model, facts, input);
  const words = { nfl: wordsIn(edition.nfl), nba: wordsIn(edition.nba) };
  const minutes = Math.round((words.nfl + words.nba) / 230);
  console.log(`Written brief: about ${minutes} minutes to read (NFL ${words.nfl} words, NBA ${words.nba}; aimed for ${input.nfl.targetWords} and ${input.nba.targetWords}).`);
  usageLog.runs.at(-1).words = words.nfl + words.nba;
  writeJson(join(out, 'usage.json'), usageLog);
  writeJson(join(out, 'latest.json'), edition);
  writeJson(join(out, 'editions', `${edition.edition.date}.json`), edition, false);
  writeArchiveIndex(out);
  status.brief = { ok: true, error: null, at: melbourneIso(), droppedItems: dropped.length, rejectedRequests: rejected,
    factCheck: factCheck && { checked: factCheck.checked, removed: factCheck.removed, ...(factCheck.skipped ? { skipped: factCheck.skipped } : {}) } };
  if (factCheck) writeJson(join(out, 'fact-check.json'), { date: edition.edition.date, ...factCheck });
  writeJson(statusPath, status);
  if (dropped.length) console.log(`Dropped ${dropped.length} item(s) that failed the checks:\n - ${dropped.join('\n - ')}`);
  if (wednesday) for (const league of ['nfl', 'nba']) {
    const w = edition[league].wrap;
    console.log(`${league.toUpperCase()} Wrap: ${w ? `${w.storylines.length} storylines, ${w.biggestResults.length} results, ${w.standouts.length} standouts` : 'not written'}; watch: ${edition.watchGuide[league].picks.map(p => `${p.away.abbr}@${p.home.abbr}`).join(', ') || 'none'}`);
  }
  console.log('Brief written.');
}

// Words in a league's written brief (what a reader reads in the "Today's brief" part of the tab).
function wordsIn(section) {
  const texts = [
    section.oneThing, section.wrap?.summary, ...(section.wrap?.storylines || []).map(s => s.text),
    ...(section.headlines || []).flatMap(h => [h.title, h.summary, h.whyItMatters]),
    ...(section.teamNews || []).flatMap(t => [t.title, t.text]),
    ...(section.recaps || []).flatMap(r => [r.text, r.keyLine]),
    ...(section.standouts || []).flatMap(p => [p.name, p.line, p.why]),
    ...(section.quickHits || []).map(q => q.text),
    section.contextCard?.body,
  ];
  return texts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
}

// Put Claude's writing into the edition. Sources for each story come from the items it cited.
function merge(edition, brief, index, model, facts, input) {
  const sourcesOf = refs => [...new Set(refs.flatMap(r => index.get(r)?.sources || []))];
  const teamsOf = refs => [...new Set(refs.flatMap(r => index.get(r)?.item?.teams || []))].slice(0, 3);
  for (const league of ['nfl', 'nba']) {
    const b = brief[league];
    const section = edition[league];
    section.oneThing = b.oneThing?.text || null;
    if (b.headlines.length) {
      section.headlines = b.headlines.map(h => {
        // A top story can cite news, a game or a roster move; only news items carry teams and links.
        const gameTeams = h.refs.map(r => index.get(r)?.item).filter(g => g?.home && g?.away).flatMap(g => [g.home.abbr, g.away.abbr]);
        return {
          title: h.title,
          summary: h.summary,
          whyItMatters: h.whyItMatters,
          teams: [...new Set([...teamsOf(h.refs), ...gameTeams])].slice(0, 3),
          sources: sourcesOf(h.refs),
        };
      });
    }
    section.contextCard = b.contextCard;

    // Jack's team's news: Claude's write-ups. Any team story it didn't use anywhere is still listed, as a
    // headline with its link under "More … headlines", so no team story is ever missed.
    const cited = new Set([...b.headlines, ...b.teamNews, ...b.quickHits].flatMap(x => x.refs));
    if (b.teamNews.length) section.teamNews = b.teamNews.map(t => ({ title: t.title, text: t.text, teams: teamsOf(t.refs), sources: sourcesOf(t.refs) }));
    section.teamMore = input[league].teamStories.filter(t => !cited.has(t.id)).map(t => {
      const story = index.get(t.id).item;
      return { title: story.title, sources: story.sources };
    });

    // Game recaps, in Claude's order. Jack's team's games are always included, even if Claude skipped one.
    const myAbbr = edition.myTeams?.[league]?.abbr;
    const recapped = new Set(b.recaps.map(r => r.game));
    section.recaps = [
      ...b.recaps.map(r => ({ ...index.get(r.game).item, text: r.text })),
      ...input[league].results.filter(r => !recapped.has(r.id)).map(r => index.get(r.id).item)
        .filter(g => g && myAbbr && [g.home.abbr, g.away.abbr].includes(myAbbr)).map(g => ({ ...g, text: null })),
    ];
    if (b.standouts.length) {
      section.standouts = b.standouts.map(st => {
        const { name, team, line, game } = index.get(st.id).item;
        return { name, team, line, game, why: st.why };
      });
    }
    section.quickHits = b.quickHits.map(q => ({ text: q.text, teams: teamsOf(q.refs), sources: sourcesOf(q.refs) }));
    for (const f of b.followedNotes) index.get(f.id).item.note = f.note;
    section.awardRaces = b.awardRaces.map(a => ({ award: a.award, contenders: a.contenders.map(({ refs, ...c }) => c) }));

    if (b.wrap !== undefined) {
      section.wrap = b.wrap && {
        weekLabel: facts.week[league].label,
        summary: b.wrap.summary,
        storylines: b.wrap.storylines.map(s => ({ text: s.text, sources: sourcesOf(s.refs) })),
        biggestResults: b.wrap.biggestResults.map(id => index.get(id).item),
        standouts: b.wrap.standouts.map(({ refs, ...p }) => p),
      };
    }

    // Claude's ranking replaces the one worked out from the data, if it picked enough games.
    const guide = edition.watchGuide?.[league];
    const games = facts?.week?.[league]?.games || [];
    if (b.watch && guide && games.length && b.watch.picks.length >= Math.min(3, games.length)) {
      const chosen = b.watch.picks.map(p => index.get(p.game).item);
      guide.picks = b.watch.picks.map((p, i) => watchEntry(chosen[i], { rank: i + 1, ...(p.reason ? { reason: p.reason } : {}) }));
      guide.yourTeam = games.filter(g => g.mine && !chosen.includes(g))
        .sort((x, y) => Date.parse(x.start) - Date.parse(y.start)).map(g => watchEntry(g));
    }

    const team = edition.myTeams?.[league];
    const t = brief.myTeams[league];
    if (team) {
      if (t.sinceLast.length) {
        team.sinceLast = t.sinceLast.map(s => ({
          text: s.text,
          sources: sourcesOf(s.refs),
        }));
      }
      for (const p of team.form || []) p.note = t.formNotes.find(f => f.player === p.player)?.note || null;
      for (const i of team.injuries || []) {
        const typical = t.typicalRecovery.find(r => r.player === i.player)?.text;
        if (typical) i.typical = typical;
      }
    }
  }
  edition.edition.written = true;
  edition.edition.writtenBy = model;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
