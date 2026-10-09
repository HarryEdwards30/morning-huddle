// Writes the brief with Claude: one API call per edition, covering both leagues.
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
import { DAILY_BRIEF_SCHEMA, checkBrief } from './brief/schema.js';
import { melbourneIso } from './lib/time.js';

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
  const system = ['style.md', 'daily-brief.md'].map(f => readFileSync(join(ROOT, 'prompts', f), 'utf8')).join('\n\n---\n\n');

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
  const index = idIndex(input, edition);

  let result = null;
  let usage = { input_tokens: 0, output_tokens: 0 };
  let error = null;
  let dropped = [];

  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('missing key');
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

    const request = {
      model,
      max_tokens: 16000,
      system,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: DAILY_BRIEF_SCHEMA } },
      messages: [{ role: 'user', content: `Here is today's data (JSON). Write today's brief.\n\n${inputText}` }],
    };

    // Cost guard: the cheap Haiku rate only applies under 100k input tokens.
    const counted = await client.messages.countTokens({ model, system, messages: request.messages });
    console.log(`Input: ${counted.input_tokens} tokens (limit ${maxInputTokens}).`);
    if (counted.input_tokens > maxInputTokens) throw new Error(`the input was ${counted.input_tokens} tokens, over the ${maxInputTokens} limit`);

    // One attempt, plus one retry if the reply can't be used.
    for (let attempt = 1; attempt <= 2 && !result; attempt++) {
      const response = await client.messages.create(request);
      usage = { input_tokens: usage.input_tokens + response.usage.input_tokens, output_tokens: usage.output_tokens + response.usage.output_tokens };
      if (response.stop_reason === 'refusal') { error = new Error('Claude declined to write the brief'); continue; }
      if (response.stop_reason === 'max_tokens') { error = new Error('the reply was cut off'); continue; }
      const text = response.content.find(b => b.type === 'text')?.text;
      try {
        const checked = checkBrief(JSON.parse(text), index, inputText);
        result = checked.brief;
        dropped = checked.dropped;
        error = null;
      } catch (parseError) {
        error = new Error(`the reply wasn't valid (${parseError.message})`);
        console.warn(`Attempt ${attempt}: ${error.message}`);
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
    status.brief = { ok: false, error: explain(error), at: melbourneIso() };
    writeJson(statusPath, status);
    console.error(`Brief not written: ${status.brief.error}`);
    process.exitCode = 2;
    return;
  }

  merge(edition, result, index, model);
  writeJson(join(out, 'latest.json'), edition);
  writeJson(join(out, 'editions', `${edition.edition.date}.json`), edition, false);
  status.brief = { ok: true, error: null, at: melbourneIso(), droppedItems: dropped.length };
  writeJson(statusPath, status);
  if (dropped.length) console.log(`Dropped ${dropped.length} item(s) that failed the checks:\n - ${dropped.join('\n - ')}`);
  console.log('Brief written.');
}

// Put Claude's writing into the edition. Sources for each story come from the items it cited.
function merge(edition, brief, index, model) {
  for (const league of ['nfl', 'nba']) {
    const b = brief[league];
    const section = edition[league];
    section.oneThing = b.oneThing?.text || null;
    if (b.headlines.length) {
      section.headlines = b.headlines.map(h => {
        const cited = h.refs.map(r => index.get(r).item);
        return {
          title: h.title,
          summary: h.summary,
          whyItMatters: h.whyItMatters,
          teams: [...new Set(cited.flatMap(c => c.teams || []))].slice(0, 3),
          sources: [...new Set(cited.flatMap(c => c.sources || []))],
        };
      });
    }
    section.contextCard = b.contextCard;
    section.awardRaces = b.awardRaces.map(a => ({ award: a.award, contenders: a.contenders.map(({ refs, ...c }) => c) }));

    const team = edition.myTeams?.[league];
    const t = brief.myTeams[league];
    if (team) {
      if (t.sinceLast.length) {
        team.sinceLast = t.sinceLast.map(s => ({
          text: s.text,
          sources: [...new Set(s.refs.flatMap(r => index.get(r)?.sources || []))],
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
