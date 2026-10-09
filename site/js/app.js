// Morning Huddle: loads the settings and the latest edition, then shows the tab picked in the bottom bar.
// Tabs: NFL, NBA, My Teams, Watch. Each lives in js/tabs/ and only reads its own part of the edition.
// The app opens on the tab you used last (My Teams the first time).

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

function setUpInfoDialog(edition) {
  const dialog = document.getElementById('info-dialog');
  const body = document.getElementById('info-body');
  document.getElementById('info-button').addEventListener('click', () => {
    const e = edition.edition || {};
    body.replaceChildren(
      el('dl', {},
        el('dt', {}, 'Edition'), el('dd', {}, e.date ? formatCalendarDate(e.date) : 'Unknown'),
        el('dt', {}, 'Type'), el('dd', {}, e.type === 'wednesday' ? 'Wednesday edition (with the Wrap and watch guide)' : 'Daily brief'),
        el('dt', {}, 'Updated'), el('dd', {}, e.generatedAt ? formatGameDateTime(e.generatedAt) : 'Unknown'),
        el('dt', {}, 'Written by'), el('dd', {}, e.written ? `Claude (${e.writtenBy || 'AI'}) from the day’s data` : 'Not written yet: data only'),
        el('dt', {}, 'Times'), el('dd', {}, 'All times are Melbourne time.'),
      ),
      edition.sample ? el('p', { class: 'muted small' }, 'This edition is sample data.') : null,
    );
    dialog.showModal();
  });
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

  // The run status is optional: if it can't be loaded, the app works without the banners.
  const status = await loadJson('data/status.json').catch(() => null);

  setMyTeams(settings.teams);
  setSources(edition.sources);
  showNotices(edition, status);
  setUpInfoDialog(edition);

  const ctx = { settings, edition, now: new Date() };
  showTab(ctx);
  window.addEventListener('hashchange', () => showTab(ctx));
}

start();
