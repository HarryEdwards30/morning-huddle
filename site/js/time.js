// Everything time-related. All times are shown in Melbourne time with the zone label (AEDT or AEST).

const ZONE = 'Australia/Melbourne';
const LOCALE = 'en-AU';

function parts(date, options) {
  const fmt = new Intl.DateTimeFormat(LOCALE, { timeZone: ZONE, ...options });
  const out = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

// "12:30pm AEDT"
export function formatTime(iso) {
  const p = parts(new Date(iso), { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  return `${p.hour}:${p.minute}${(p.dayPeriod || '').toLowerCase()} ${p.timeZoneName}`;
}

// "Thu 12:30pm AEDT"
export function formatGameTime(iso) {
  const p = parts(new Date(iso), { weekday: 'short' });
  return `${p.weekday} ${formatTime(iso)}`;
}

// "Thu 19 Nov, 12:30pm AEDT" (for games further away than this week)
export function formatGameDateTime(iso) {
  const p = parts(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${p.month}, ${formatTime(iso)}`;
}

// "Wed 18 Nov"
export function formatShortDate(iso) {
  const p = parts(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${p.month}`;
}

// A plain calendar date like "2026-11-18" -> "Wednesday 18 November 2026".
// Calendar dates have no time zone, so they are formatted as-is.
export function formatCalendarDate(ymd, { long = true } = {}) {
  const date = new Date(`${ymd}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: long ? 'long' : 'short',
    ...(long ? { year: 'numeric' } : {}),
  });
  const p = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  return long ? `${p.weekday} ${p.day} ${p.month} ${p.year}` : `${p.weekday} ${p.day} ${p.month}`;
}

// Today's date in Melbourne as "YYYY-MM-DD".
export function melbourneToday(now = new Date()) {
  const p = parts(now, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

// Whole days from today (Melbourne) until a calendar date. Negative if it has passed.
export function daysUntil(ymd, now = new Date()) {
  const today = Date.parse(`${melbourneToday(now)}T00:00:00Z`);
  const target = Date.parse(`${ymd}T00:00:00Z`);
  return Math.round((target - today) / 86400000);
}
