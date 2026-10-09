// League tab: everything around the wider league, one league at a time (NBA / NFL switch at the top).
// Sections: league pulse, standings, award races, major injuries, transactions, season timeline.

import { el, card, teamChip, statusChip, sourceLinks, emptyNote, isMyTeam, returnTimeline } from '../ui.js';
import { formatCalendarDate, formatShortDate, daysUntil } from '../time.js';

const LEAGUES = ['nba', 'nfl'];

function pickedLeague() {
  const [, league] = location.hash.replace('#', '').split('/');
  return LEAGUES.includes(league) ? league : 'nba';
}

export function renderLeague({ settings, edition, now }) {
  const league = pickedLeague();
  const data = edition.league || {};
  const sections = settings.sections || {};

  return el('div', {},
    el('div', { class: 'page-title' }, el('h1', {}, 'League')),
    el('div', { class: 'segmented', role: 'group', 'aria-label': 'Choose league' },
      LEAGUES.map(l => el('button', {
        type: 'button',
        'aria-pressed': String(l === league),
        onclick: () => { location.hash = `league/${l}`; },
      }, l.toUpperCase()))),
    pulse(data.pulse?.[league]),
    standings(league, data.standings?.[league]),
    sections.awardRaces === false ? null : awardRaces(data.awardRaces?.[league]),
    majorInjuries((data.majorInjuries || []).filter(i => i.league.toLowerCase() === league)),
    transactions((data.transactions || []).filter(t => t.league.toLowerCase() === league)),
    sections.seasonTimeline === false ? null : seasonTimeline(settings.seasonDates?.[league], now),
  );
}

function pulse(p) {
  if (!p) return null;
  const teamList = (label, list, cls) => list?.length ? el('div', { class: 'group' },
    el('p', { class: 'league-label' }, label),
    list.map(t => el('div', { class: 'entry' },
      el('div', { class: 'entry-head' }, teamChip(t.abbr), t.name, el('span', { class: `trend ${cls}` }, t.form || '')),
      el('p', { class: 'small' }, t.note)))) : null;
  return card('League pulse',
    teamList('Hot', p.hot, 'trend-up'),
    teamList('Cold', p.cold, 'trend-down'),
    p.players?.length ? el('div', { class: 'group' },
      el('p', { class: 'league-label' }, 'Standout players'),
      p.players.map(pl => el('div', { class: 'entry' },
        el('div', { class: 'entry-head' }, teamChip(pl.team), pl.name),
        el('p', { class: 'small' }, pl.note)))) : null,
  );
}

// Standings. NBA: both conferences with lines after the playoff (6) and play-in (10) spots.
// NFL: pick AFC or NFC, then the four divisions.
function standings(league, data) {
  const groups = data?.groups || [];
  if (!groups.length) return card('Standings', emptyNote('Standings not available.'));

  const body = el('div');
  const isNfl = league === 'nfl';

  const draw = (filter) => {
    const shown = isNfl ? groups.filter(g => g.conference === filter) : groups;
    body.replaceChildren(...shown.map(g => standingsTable(g, isNfl)));
  };

  if (!isNfl) {
    draw();
    return card('Standings', body, el('p', { class: 'muted small', style: 'margin-top:8px' },
      'Dashed lines: top 6 go straight to the playoffs, 7–10 play in.'));
  }

  const conferences = [...new Set(groups.map(g => g.conference))];
  const buttons = conferences.map(c => el('button', {
    type: 'button',
    onclick: (event) => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === event.currentTarget));
      draw(c);
    },
  }, c));
  const mineConf = groups.find(g => g.rows.some(r => isMyTeam(r.abbr)))?.conference || conferences[0];
  for (const b of buttons) b.setAttribute('aria-pressed', String(b.textContent === mineConf));
  draw(mineConf);
  return card('Standings', el('div', { class: 'segmented', role: 'group', 'aria-label': 'Choose conference' }, buttons), body);
}

function standingsTable(group, isNfl) {
  const head = isNfl ? ['#', group.name, 'W', 'L', 'T', 'PCT', 'STRK'] : ['#', group.name, 'W', 'L', 'PCT', 'GB', 'STRK'];
  return el('div', { class: 'table-wrap', style: 'margin-bottom:16px' },
    el('table', { class: 'standings' },
      el('thead', {}, el('tr', {}, head.map(h => el('th', {}, h)))),
      el('tbody', {}, group.rows.map((r, i) => {
        const seed = i + 1;
        const classes = [isMyTeam(r.abbr) ? 'mine' : '', !isNfl && (seed === 6 || seed === 10) ? 'cutoff' : ''].join(' ').trim();
        const cells = isNfl
          ? [r.w, r.l, r.t ?? 0, r.pct, r.streak]
          : [r.w, r.l, r.pct, r.gb, r.streak];
        return el('tr', { class: classes || null },
          el('td', {}, seed),
          el('td', {}, el('span', { class: 'team-cell' }, teamChip(r.abbr), el('span', { class: 'small' }, r.shortName || r.name))),
          cells.map(c => el('td', {}, c ?? '')));
      })),
    ));
}

function awardRaces(list) {
  if (!list?.length) return null;
  return card('Award races · current contenders',
    list.map(a => el('div', { class: 'award' },
      el('h3', { class: 'subhead' }, a.award),
      el('ol', {}, (a.contenders || []).map(c => el('li', {},
        el('span', { class: 'entry-head', style: 'display:inline-flex' }, c.name, teamChip(c.team)),
        c.note ? el('div', { class: 'small muted' }, c.note) : null))))),
    el('p', { class: 'muted small', style: 'margin-top:12px' }, 'Based only on stats and news in the feeds, not betting odds.'),
  );
}

function majorInjuries(list) {
  return card('Major injuries',
    !list.length ? emptyNote('No major injuries to stars or starters.') :
      list.map(i => el('div', { class: 'injury' },
        el('div', { class: 'injury-head' },
          el('span', { class: 'player' }, i.player), statusChip(i.status)),
        el('div', { class: 'story-meta', style: 'margin-top:4px' }, teamChip(i.team), el('span', { class: 'small' }, i.injury)),
        returnTimeline(i.timeline),
        sourceLinks(i.sources),
      )));
}

function transactions(list) {
  return card('Transactions',
    !list.length ? emptyNote('No notable moves.') :
      list.map(t => el('div', { class: 'entry' },
        el('div', { class: 'entry-head' },
          t.type ? el('span', { class: 'chip' }, t.type) : null,
          (t.teams || []).map(teamChip),
          t.date ? el('span', { class: 'muted small' }, formatShortDate(t.date)) : null),
        el('p', { style: 'margin-top:4px' }, t.text),
        sourceLinks(t.sources),
      )));
}

// Countdowns come straight from the settings file, so they stay correct even if an edition is late.
function seasonTimeline(dates, now) {
  const upcoming = (dates || [])
    .map(d => ({ ...d, days: daysUntil(d.date, now), endDays: d.endDate ? daysUntil(d.endDate, now) : null }))
    .filter(d => (d.endDays ?? d.days) >= 0)
    .sort((a, b) => a.days - b.days);

  return card('Season timeline',
    !upcoming.length ? emptyNote('Key dates will appear here once they are added to the settings file.') :
      upcoming.map(d => {
        const happening = d.days <= 0;
        return el('div', { class: `countdown${happening ? ' now' : ''}` },
          el('div', { class: 'days' }, happening ? 'Now' : d.days, el('small', {}, happening ? 'on' : d.days === 1 ? 'day' : 'days')),
          el('div', {},
            el('div', { style: 'font-weight:700' }, d.label),
            el('div', { class: 'small muted' },
              formatCalendarDate(d.date, { long: false }),
              d.endDate ? ` to ${formatCalendarDate(d.endDate, { long: false })}` : '')));
      }),
    upcoming.length ? el('p', { class: 'muted small', style: 'margin-top:10px' }, 'Dates are US dates.') : null,
  );
}
