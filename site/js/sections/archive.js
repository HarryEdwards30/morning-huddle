// The edition archive: past Wednesday Wraps at the bottom of each league tab.
// The list comes from data/editions/index.json; a Wrap's edition is only downloaded when it's opened.

import { el, card, withSources } from '../ui.js';
import { formatCalendarDate } from '../time.js';
import { wrapBody } from './brief.js';

// Up to eight past Wraps for this league, newest first (today's is already at the top of the tab).
export function pastWraps(league, archive, today) {
  const wraps = (archive || []).filter(e => e.wraps?.[league] && e.date !== today).slice(0, 8);
  if (!wraps.length) return null;
  return card({ type: 'news', title: 'Past Wednesday Wraps', iconName: 'lead' },
    wraps.map(e => {
      const body = el('div', { class: 'archive-body' });
      const item = el('details', { class: 'archive-item' },
        el('summary', {},
          el('span', { class: 'archive-label' }, e.wraps[league]),
          el('span', { class: 'muted small' }, formatCalendarDate(e.date, { long: false }))),
        body);
      item.addEventListener('toggle', () => {
        if (item.open && !['loading', 'loaded'].includes(body.dataset.state)) loadWrap(league, e.date, body);
      });
      return item;
    }),
  );
}

async function loadWrap(league, date, body) {
  body.dataset.state = 'loading';
  body.replaceChildren(el('p', { class: 'muted small' }, 'Loading…'));
  try {
    const response = await fetch(`data/editions/${date}.json`);
    if (!response.ok) throw new Error(String(response.status));
    const edition = await response.json();
    const wrap = edition[league]?.wrap;
    body.replaceChildren(...(wrap ? withSources(edition.sources, () => wrapBody(wrap)).filter(Boolean)
      : [el('p', { class: 'muted small' }, 'This Wrap isn’t in the archive any more.')]));
    body.dataset.state = 'loaded';
  } catch {
    // Opening it again tries again.
    body.replaceChildren(el('p', { class: 'muted small' }, 'Couldn’t load this Wrap. Check your connection, then close and reopen it.'));
    body.dataset.state = 'error';
  }
}
