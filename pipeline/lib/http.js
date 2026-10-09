// Fetching with a timeout and one retry, and a log of how each source went.
// A failed source never stops the run: callers get null and the failure is recorded for status.json.

// ESPN's firewall turns some identifiers away (this exact text was tested and is accepted).
// If every ESPN source starts failing with HTTP 403, try changing it.
const USER_AGENT = 'MorningHuddle/1.0 (personal news app)';

export class SourceLog {
  constructor() { this.entries = {}; }
  ok(name) { this.entries[name] = { ok: true }; }
  fail(name, error) { this.entries[name] = { ok: false, error: String(error?.message || error).slice(0, 200) }; }
  get failed() { return Object.entries(this.entries).filter(([, e]) => !e.ok).map(([name, e]) => ({ name, error: e.error })); }
  get summary() {
    const all = Object.values(this.entries);
    return { total: all.length, ok: all.filter(e => e.ok).length, failed: this.failed };
  }
}

async function fetchOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, { timeoutMs = 20000 } = {}) {
  try {
    return await fetchOnce(url, timeoutMs);
  } catch (first) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return fetchOnce(url, timeoutMs);
  }
}

// Fetch JSON from a named source. Returns null (and logs the failure) instead of throwing.
// `optional` lookups (like player stats before a season starts) don't count as a failed source.
export async function getJson(log, name, url, { optional = false } = {}) {
  try {
    const data = JSON.parse(await fetchText(url));
    log.ok(name);
    return data;
  } catch (error) {
    if (optional) {
      console.log(`  - ${name}: nothing available (${error.message})`);
      return null;
    }
    log.fail(name, error);
    console.warn(`  ! ${name} failed: ${error.message}`);
    return null;
  }
}

export async function getText(log, name, url) {
  try {
    const text = await fetchText(url);
    if (!text.trim()) throw new Error('empty response');
    log.ok(name);
    return text;
  } catch (error) {
    log.fail(name, error);
    console.warn(`  ! ${name} failed: ${error.message}`);
    return null;
  }
}
