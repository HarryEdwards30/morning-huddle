// Morning Huddle: loads the settings and the latest edition, then shows the tab picked in the bottom bar.
// Tabs: NFL, NBA, My Teams, Watch. Each lives in js/tabs/ and only reads its own part of the edition.
// The app opens on the tab you used last (My Teams the first time).
// Past editions (the last 60 days) can be opened from the info button; see data/editions/index.json.
// sw.js keeps a copy on the phone so the app opens offline. When the app comes back to the front and a
// newer edition is out, it reloads (an app on the home screen has no reload button).

import { el, setMyTeams, setSources } from './ui.js';
import { formatCalendarDate, formatGameDateTime, melbourneToday, melbourneHour } from './time.js';
import { renderNfl, renderNba } from './tabs/league.js';
import { renderTeams } from './tabs/teams.js';
import { renderWatch } from './tabs/watch.js';

const TABS = {
  nfl: renderNfl,
  nba: renderNba,
  teams: renderTeams,
  watch: renderWatch,
};
const DEFAULT_TAB = 'teams';
const LAST_TAB_KEY = 'huddle:lastTab';

// Remembering the last tab is a convenience only: if the phone blocks storage, the app still works.
function rememberTab(route) {
  try { localStorage.setItem(LAST_TAB_KEY, route); } catch { /* storage unavailable */ }
}
function lastTab() {
  try { return localStorage.getItem(LAST_TAB_KEY); } catch { return null; }
}
function isKnownRoute(route) {
  return Boolean(route && TABS[route.split('/')[0]]);
}

const view = document.getElementById('view');
const notices = document.getElementById('notices');

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function currentRoute() {
  return location.hash.replace('#', '');
}
function currentTab() {
  const name = currentRoute().split('/')[0];
  return TABS[name] ? name : DEFAULT_TAB;
}

function showTab(ctx) {
  // No tab in the address (opening from the home screen) or an old one (Today, League): go to the last tab used.
  if (!isKnownRoute(currentRoute())) {
    const saved = lastTab();
    history.replaceState(null, '', `#${isKnownRoute(saved) ? saved : DEFAULT_TAB}`);
  }
  const name = currentTab();
  rememberTab(currentRoute());
  for (const link of document.querySelectorAll('.tab-bar a')) {
    if (link.dataset.tab === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  view.replaceChildren();
  view.classList.remove('fade-in');
  try {
    view.append(TABS[name](ctx));
  } catch (error) {
    console.error(error);
    view.append(el('p', { class: 'empty-state' }, 'Something went wrong showing this tab.'));
  }
  // Restart the small fade (skipped automatically if the phone has reduced motion turned on).
  void view.offsetWidth;
  view.classList.add('fade-in');
  window.scrollTo(0, 0);
}

// Banners, most serious first:
//   1. Sample data (no real edition exists yet).
//   2. Today's brief didn't update: the morning run failed, or (from 10am) it hasn't happened.
//   3. Today's data updated but Claude's writing didn't.
function showNotices(edition, status, now = new Date()) {
  notices.replaceChildren();
  const e = edition.edition || {};
  const lastUpdated = e.generatedAt ? formatGameDateTime(e.generatedAt) : 'unknown';
  const errorBanner = (title, reason) => notices.append(el('div', { class: 'notice notice-error', role: 'alert' },
    el('strong', {}, title), ` Last updated ${lastUpdated}. Reason: ${reason}`));

  // The sample edition only appears when there's no real edition yet (see scripts/build-site.js).
  if (edition.sample) {
    notices.append(el('div', { class: 'notice notice-sample', role: 'note' },
      el('strong', {}, 'SAMPLE DATA. '),
      'This is made-up content to show the layout. Real news arrives in a later phase.'));
    return;
  }

  const stale = e.date && e.date < melbourneToday(now);
  if (status?.ok === false) {
    errorBanner('Today’s brief didn’t update.', status.error || 'The morning run couldn’t get the data it needs.');
  } else if (stale && melbourneHour(now) >= 10) {
    errorBanner('Today’s brief didn’t update.', 'The 8am update didn’t run. GitHub sometimes starts late; if this is still here later, check the Actions tab.');
  } else if (status?.brief?.ok === false && !stale) {
    notices.append(el('div', { class: 'notice notice-error', role: 'alert' },
      el('strong', {}, 'Today’s written brief didn’t update.'),
      ` Scores, standings and news are up to date. Reason: ${status.brief.error}`));
  } else if (e.written === false) {
    notices.append(el('div', { class: 'notice notice-info', role: 'note' },
      el('strong', {}, 'LIVE DATA. '),
      'Real scores, standings, injuries and news. Claude\u2019s written brief (one thing, "Why it matters", award races and player notes) isn\u2019t in this edition.'));
  }
}

function setUpInfoDialog(ctx) {
  const dialog = document.getElementById('info-dialog');
  const body = document.getElementById('info-body');
  document.getElementById('info-button').addEventListener('click', () => {
    const edition = ctx.edition;
    const e = edition.edition || {};
    const past = (ctx.archive || []).filter(a => a.date !== e.date).slice(0, 14);
    body.replaceChildren(...[
      el('dl', {},
        el('dt', {}, 'Edition'), el('dd', {}, e.date ? formatCalendarDate(e.date) : 'Unknown'),
        el('dt', {}, 'Type'), el('dd', {}, e.type === 'wednesday' ? `Wednesday edition (with the Wrap and watch guide)${e.pretendWednesday ? ', made on a test run' : ''}` : 'Daily brief'),
        el('dt', {}, 'Updated'), el('dd', {}, e.generatedAt ? formatGameDateTime(e.generatedAt) : 'Unknown'),
        el('dt', {}, 'Written by'), el('dd', {}, e.written ? `Claude (${e.writtenBy || 'AI'}) from the day’s data` : 'Not written yet: data only'),
        el('dt', {}, 'Times'), el('dd', {}, 'All times are Melbourne time.'),
      ),
      edition.sample ? el('p', { class: 'muted small' }, 'This edition is sample data.') : null,
      installSteps(),
      past.length ? el('h3', { class: 'subhead' }, 'Past editions') : null,
      past.length ? el('ul', { class: 'past-editions' }, past.map(a => el('li', {},
        el('button', { class: 'button-small', type: 'button', onclick: () => { dialog.close(); openPastEdition(ctx, a.date); } },
          formatCalendarDate(a.date, { long: false }) + (a.type === 'wednesday' ? ' · Wrap' : ''))))) : null,
    ].flat().filter(Boolean));
    dialog.showModal();
  });
}

// How to add the app to the home screen. Hidden once it's opened from the home screen.
function installSteps() {
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installed) return null;
  const iPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return [
    el('h3', { class: 'subhead' }, 'Add it to your home screen'),
    el('ol', { class: 'install-steps' }, iPhone
      ? [el('li', {}, 'Open this page in Safari.'), el('li', {}, 'Tap the Share button (the square with an arrow).'),
        el('li', {}, 'Scroll down and tap Add to Home Screen, then Add.')]
      : [el('li', {}, 'Open this page in Chrome.'), el('li', {}, 'Tap the ⋮ menu at the top right.'),
        el('li', {}, 'Tap Add to Home screen (or Install app), then Install.')]),
  ];
}

// Shows a past edition from the archive, with a banner to get back to today's.
async function openPastEdition(ctx, date) {
  let past;
  try {
    past = await loadJson(`data/editions/${date}.json`);
  } catch (error) {
    console.error(error);
    return;
  }
  ctx.edition = past;
  setSources(past.sources);
  notices.replaceChildren(el('div', { class: 'notice notice-info', role: 'note' },
    el('strong', {}, 'PAST EDITION. '),
    `You’re reading the edition from ${formatCalendarDate(date)}.`,
    el('button', { class: 'button-small', type: 'button', onclick: () => backToToday(ctx) }, 'Back to today')));
  showTab(ctx);
}

function backToToday(ctx) {
  ctx.edition = ctx.latest;
  setSources(ctx.latest.sources);
  showNotices(ctx.latest, ctx.status);
  showTab(ctx);
}

async function start() {
  let settings;
  let edition;
  try {
    [settings, edition] = await Promise.all([loadJson('settings.json'), loadJson('data/latest.json')]);
  } catch (error) {
    console.error(error);
    view.replaceChildren(el('p', { class: 'empty-state' }, "Couldn't load today's brief. Check your connection and try again."));
    return;
  }

  // The run status and the archive list are optional: the app works without them.
  const [status, archive] = await Promise.all([
    loadJson('data/status.json').catch(() => null),
    loadJson('data/editions/index.json').catch(() => []),
  ]);

  setMyTeams(settings.teams);
  setSources(edition.sources);
  showNotices(edition, status);

  const ctx = { settings, edition, latest: edition, status, archive, now: new Date() };
  setUpInfoDialog(ctx);
  if (!navigator.onLine) showOfflineNotice();
  window.addEventListener('offline', showOfflineNotice);
  window.addEventListener('online', () => {
    document.getElementById('offline-notice')?.remove();
    checkForNewEdition(ctx);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewEdition(ctx);
  });
  showTab(ctx);
  window.addEventListener('hashchange', () => showTab(ctx));
}

// Shown with any other banners when the phone has no connection.
function showOfflineNotice() {
  if (document.getElementById('offline-notice')) return;
  notices.prepend(el('div', { class: 'notice notice-info', role: 'note', id: 'offline-notice' },
    el('strong', {}, 'OFFLINE. '), 'Showing the last edition saved on this phone.'));
}

// When the app is reopened from the background, reload if a newer edition has been published.
async function checkForNewEdition(ctx) {
  if (!navigator.onLine) return;
  ctx.now = new Date();
  try {
    const latest = await loadJson('data/latest.json');
    if (latest.edition?.generatedAt !== ctx.latest.edition?.generatedAt) location.reload();
  } catch { /* stay on what's showing */ }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(error => console.warn('Offline copy not available:', error));
}

start();
