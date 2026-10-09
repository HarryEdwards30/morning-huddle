// The league-wide sections shown below the brief in the NFL and NBA tabs:
// pulse (hot and cold), standings, playoff picture, award races, major injuries, transactions, season timeline.

import { el, card, icon, teamChip, statusChip, sourceLinks, emptyNote, isMyTeam, involvesMyTeam, returnTimeline } from '../ui.js';
import { formatCalendarDate, formatShortDate, daysUntil } from '../time.js';

// League pulse: Hot and Cold side by side, each with its own colour and arrow.
export function pulse(p) {
  if (!p) return null;
  const column = (kind, label, side) => {
    const teams = side?.teams || [];
    const players = side?.players || [];
    return el('div', { class: `pulse-col ${kind}` },
      el('div', { class: 'pulse-col-head' }, icon(kind === 'hot' ? 'up' : 'down', ''), label),
      el('div', { class: 'pulse-col-body' },
        teams.length ? [
          el('p', { class: 'pulse-sub' }, 'Teams'),
          teams.map(t => el('div', { class: `pulse-item${isMyTeam(t.abbr) ? ' mine' : ''}` },
            el('div', { class: 'who' }, teamChip(t.abbr), t.name),
            t.form ? el('div', { class: 'form' }, t.form) : null,
            el('p', {}, t.note))),
        ] : null,
        players.length ? [
          el('p', { class: 'pulse-sub' }, 'Players'),
          players.map(pl => el('div', { class: `pulse-item${isMyTeam(pl.team) ? ' mine' : ''}` },
            el('div', { class: 'who' }, teamChip(pl.team), pl.name),
            el('p', {}, pl.note))),
        ] : null,
        !teams.length && !players.length ? emptyNote('Nobody stands out right now.') : null,
      ));
  };
  return card({ type: 'plain', title: 'League pulse', iconName: 'hot' },
    el('div', { class: 'pulse-split' },
      column('hot', 'Hot', p.hot),
      column('cold', 'Cold', p.cold)));
}

// Standings. NBA: both conferences, with lines after the playoff (6) and play-in (10) spots, so this card
// doubles as the NBA playoff race. NFL: pick AFC or NFC, then the four divisions.
export function standings(league, data, { offSeason = false } = {}) {
  const isNfl = league === 'nfl';
  const title = offSeason ? 'Last season’s final standings' : isNfl ? 'Standings' : 'Standings and playoff race';
  const groups = data?.groups || [];
  if (!groups.length) return card({ type: 'results', title }, emptyNote('Standings not available.'));

  if (!isNfl) {
    return card({ type: 'results', title },
      groups.map(g => standingsTable(g, false)),
      el('p', { class: 'muted small table-note' }, 'Dashed lines: the top 6 go straight to the playoffs and 7 to 10 go to the play-in.'));
  }

  const body = el('div');
  const draw = conference => body.replaceChildren(...groups.filter(g => g.conference === conference).map(g => standingsTable(g, true)));
  const conferences = [...new Set(groups.map(g => g.conference))];
  const myConference = groups.find(g => g.rows.some(r => isMyTeam(r.abbr)))?.conference || conferences[0];
  const buttons = conferences.map(c => el('button', {
    type: 'button',
    'aria-pressed': String(c === myConference),
    onclick: event => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === event.currentTarget));
      draw(c);
    },
  }, c));
  draw(myConference);
  return card({ type: 'results', title }, el('div', { class: 'segmented', role: 'group', 'aria-label': 'Choose conference' }, buttons), body);
}

function standingsTable(group, isNfl) {
  const head = isNfl ? ['#', group.name, 'W', 'L', 'T', 'PCT', 'STRK'] : ['#', group.name, 'W', 'L', 'PCT', 'GB', 'STRK'];
  return el('div', { class: 'table-wrap table-group' },
    el('table', { class: 'standings' },
      el('thead', {}, el('tr', {}, head.map(h => el('th', {}, h)))),
      el('tbody', {}, group.rows.map((r, i) => {
        const seed = i + 1;
        const classes = [isMyTeam(r.abbr) ? 'mine' : '', !isNfl && (seed === 6 || seed === 10) ? 'cutoff' : ''].join(' ').trim();
        const cells = isNfl ? [r.w, r.l, r.t ?? 0, r.pct, r.streak] : [r.w, r.l, r.pct, r.gb, r.streak];
        return el('tr', { class: classes || null },
          el('td', {}, seed),
          el('td', {}, el('span', { class: 'team-cell' }, teamChip(r.abbr), el('span', { class: 'small' }, r.shortName || r.name))),
          cells.map(c => el('td', {}, c ?? '')));
      })),
    ));
}

// NFL playoff picture: the 7 seeds in each conference and the first teams out.
export function playoffPicture(data) {
  if (!data?.conferences?.length) return null;
  const confs = data.conferences;
  const body = el('div');
  // replaceChildren would print a null as the word "null", so empty parts are filtered out first.
  const draw = conf => body.replaceChildren(...[el('div', { class: 'table-wrap' },
    el('table', { class: 'standings' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Seed'), el('th', {}, conf.name), el('th', {}, 'W-L'), el('th', {}, ''))),
      el('tbody', {},
        conf.seeds.map(s => el('tr', { class: [isMyTeam(s.abbr) ? 'mine' : '', s.seed === 7 ? 'cutoff' : ''].join(' ').trim() || null },
          el('td', {}, s.seed),
          el('td', {}, el('span', { class: 'team-cell' }, teamChip(s.abbr), el('span', { class: 'small' }, s.name))),
          el('td', {}, s.record),
          el('td', { class: 'small muted' }, s.how === 'Wild card' ? 'WC' : 'Div'))),
        (conf.outside || []).map(o => el('tr', { class: isMyTeam(o.abbr) ? 'mine' : null },
          el('td', {}, '–'),
          el('td', {}, el('span', { class: 'team-cell' }, teamChip(o.abbr), el('span', { class: 'small' }, o.name))),
          el('td', {}, o.record),
          el('td', { class: 'small muted' }, `${o.gb} GB`))),
      ))),
    (conf.outside || []).some(o => o.note) ? el('p', { class: 'muted small table-note' },
      conf.outside.filter(o => o.note).map(o => `${o.name}: ${o.note}.`).join(' ')) : null].filter(Boolean));

  const myConf = confs.find(c => [...c.seeds, ...(c.outside || [])].some(t => isMyTeam(t.abbr))) || confs[0];
  const buttons = confs.map(c => el('button', {
    type: 'button',
    'aria-pressed': String(c === myConf),
    onclick: event => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === event.currentTarget));
      draw(c);
    },
  }, c.name));
  draw(myConf);
  return card({ type: 'results', title: 'Playoff picture' },
    el('div', { class: 'segmented', role: 'group', 'aria-label': 'Choose conference' }, buttons),
    body,
    data.note ? el('p', { class: 'muted small table-note' }, `${data.note} GB is games behind the 7th seed.`) : null);
}

export function awardRaces(list) {
  if (!list?.length) return null;
  return card({ type: 'plain', title: 'Award races', extra: 'Current contenders', iconName: 'lead' },
    list.map(a => el('div', { class: 'award' },
      el('h3', { class: 'subhead' }, a.award),
      el('ol', {}, (a.contenders || []).map(c => el('li', {},
        el('span', { class: 'entry-head', style: 'display:inline-flex' }, c.name, teamChip(c.team)),
        c.note ? el('div', { class: 'small muted' }, c.note) : null))))),
    el('p', { class: 'muted small table-note' }, 'Based only on stats and news in the feeds, not betting odds.'),
  );
}

export function majorInjuries(list) {
  return card({ type: 'injury', title: 'Major injuries' },
    !list?.length ? emptyNote('No major injuries to stars or starters.') :
      list.map(i => el('div', { class: `injury${isMyTeam(i.team) ? ' mine' : ''}` },
        el('div', { class: 'injury-head' }, el('span', { class: 'player' }, i.player), statusChip(i.status)),
        el('div', { class: 'story-meta', style: 'margin-top:4px' }, teamChip(i.team), el('span', { class: 'small' }, i.injury)),
        returnTimeline(i.timeline),
        sourceLinks(i.sources),
      )));
}

export function transactions(list, title = 'Transactions') {
  return card({ type: 'moves', title },
    !list?.length ? emptyNote('No notable moves.') :
      list.map(t => el('div', { class: `entry${involvesMyTeam(t.teams) ? ' mine' : ''}` },
        el('div', { class: 'entry-head' },
          t.type ? el('span', { class: 'chip chip-type' }, t.type) : null,
          (t.teams || []).map(teamChip),
          t.date ? el('span', { class: 'muted small' }, formatShortDate(t.date)) : null),
        el('p', { style: 'margin-top:4px' }, t.text),
        sourceLinks(t.sources),
      )));
}

// Off-season: what the tab is showing instead, and the next key date from the settings file.
export function offSeason(league, dates, now) {
  const next = (dates || []).map(d => ({ ...d, days: daysUntil(d.date, now) })).filter(d => d.days >= 0).sort((a, b) => a.days - b.days)[0];
  return card({ type: 'plain', title: 'Off-season' },
    el('p', {}, `The ${league.toUpperCase()} season is over. Until the next one starts, this tab follows the draft, free agency, trades and coaching changes.`),
    next ? el('p', { class: 'small' }, el('strong', {}, 'Next up: '),
      `${next.label}, ${next.days === 0 ? 'today' : next.days === 1 ? 'tomorrow' : `in ${next.days} days`} (${formatCalendarDate(next.date, { long: false })}).`) : null,
    el('p', { class: 'muted small' }, 'Your team’s first game shows in My Teams once next season’s schedule is out.'),
  );
}

// Countdowns come straight from the settings file, so they stay correct even if an edition is late.
export function seasonTimeline(dates, now) {
  const upcoming = (dates || [])
    .map(d => ({ ...d, days: daysUntil(d.date, now), endDays: d.endDate ? daysUntil(d.endDate, now) : null }))
    .filter(d => (d.endDays ?? d.days) >= 0)
    .sort((a, b) => a.days - b.days);

  return card({ type: 'plain', title: 'Season timeline' },
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
    upcoming.length ? el('p', { class: 'muted small table-note' }, 'Dates are US dates.') : null,
  );
}
