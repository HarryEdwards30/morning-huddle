// Morning Huddle: loads the settings and the latest edition, then shows the tab picked in the bottom bar.
// Each tab lives in its own file in js/tabs/ and only reads its own part of the edition.

import { el, setMyTeams, setSources } from './ui.js';
import { formatCalendarDate, formatGameDateTime } from './time.js';
import { renderToday } from './tabs/today.js';
import { renderTeams } from './tabs/teams.js';
import { renderLeague } from './tabs/league.js';
import { renderWatch } from './tabs/watch.js';

const TABS = {
  today: renderToday,
  teams: renderTeams,
  league: renderLeague,
  watch: renderWatch,
};

const view = document.getElementById('view');
const notices = document.getElementById('notices');

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function currentTab() {
  const name = location.hash.replace('#', '').split('/')[0];
  return TABS[name] ? name : 'today';
}

function showTab(ctx) {
  const name = currentTab();
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

function showNotices(edition) {
  notices.replaceChildren();
  if (edition.sample) {
    notices.append(el('div', { class: 'notice notice-sample', role: 'note' },
      el('strong', {}, 'SAMPLE DATA. '),
      'This is made-up content to show the layout. Real news arrives in a later phase.'));
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

  setMyTeams(settings.teams);
  setSources(edition.sources);
  showNotices(edition);
  setUpInfoDialog(edition);

  const ctx = { settings, edition, now: new Date() };
  showTab(ctx);
  window.addEventListener('hashchange', () => showTab(ctx));
}

start();
