// Melbourne dates for the pipeline. Display formatting happens in the app (site/js/time.js).

export const ZONE = 'Australia/Melbourne';

export function melbourneParts(date = new Date()) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-AU', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long',
  }).formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

// "2026-10-09" in Melbourne.
export function melbourneDate(date = new Date()) {
  const p = melbourneParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

// ISO time with the Melbourne offset, e.g. "2026-10-09T08:04:00+11:00".
export function melbourneIso(date = new Date()) {
  const p = melbourneParts(date);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  const offsetMin = Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offsetMin) % 60).padStart(2, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00${sign}${hh}:${mm}`;
}

// ESPN scoreboard dates (US calendar, YYYYMMDD) for the last `days` days, newest first.
export function recentUsDates(days, now = new Date()) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).replace(/-/g, ''));
  }
  return [...new Set(out)];
}
