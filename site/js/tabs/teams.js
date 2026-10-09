// My Teams tab: one hub per team (NBA team and NFL team from settings), switchable at the top.
// Sections: header with record, since the last edition, last result and next game, injury report,
// player form, roster moves and news, playoff race. In the off-season, player form and the playoff race
// are left out.

import { el, card, icon, teamChip, statusChip, sourceLinks, emptyNote, returnTimeline, typicalRecovery } from '../ui.js';
import { formatGameDateTime, formatShortDate } from '../time.js';

const LEAGUES = ['nba', 'nfl'];

function pickedLeague() {
  const [, league] = location.hash.replace('#', '').split('/');
  return LEAGUES.includes(league) ? league : 'nba';
}

export function renderTeams({ settings, edition }) {
  const league = pickedLeague();
  const info = settings.teams?.[league] || {};
  const team = edition.myTeams?.[league];

  const switcher = el('div', { class: 'team-switch', role: 'group', 'aria-label': 'Choose team' },
    LEAGUES.map(l => {
      const t = settings.teams?.[l] || {};
      return el('button', {
        type: 'button',
        'aria-pressed': String(l === league),
        style: `--team-accent: ${t.accent || 'var(--silver)'}`,
        onclick: () => { location.hash = `teams/${l}`; },
      }, t.shortName || t.abbr || l.toUpperCase());
    }));

  if (!team) return el('div', {}, switcher, el('p', { class: 'empty-state' }, 'No team data in this edition.'));

  return el('div', { style: `--team-accent: ${info.accent || 'var(--silver)'}` },
    switcher,
    hero(team, info),
    sinceLast(team.sinceLast),
    lastAndNext(team),
    injuries(team.injuries),
    team.offSeason ? null : playerForm(team.form),
    rosterNews(team.news),
    team.offSeason ? null : playoffRace(team.playoffRace, info.abbr),
  );
}

function hero(team, info) {
  return el('section', { class: 'team-hero' },
    el('div', { class: 'story-meta' }, teamChip(info.abbr || team.abbr), el('span', { class: 'chip chip-league' }, team.league),
      team.offSeason ? el('span', { class: 'chip chip-league' }, 'Off-season') : null),
    el('h1', {}, info.name || team.name),
    team.record ? el('div', { class: 'record num' }, team.record.summary) : null,
    team.record?.standing ? el('div', { class: 'standing' }, team.record.standing) : null,
  );
}

// The team's news since the previous edition (it used to sit on the Today tab).
function sinceLast(items) {
  return card({ type: 'news', title: 'Since the last edition', mine: true },
    !items?.length ? emptyNote('Nothing new since the last edition.') :
      el('ul', { class: 'bullets' }, items.map(item => el('li', {}, item.text, sourceLinks(item.sources)))));
}

function versus(game) {
  return [game.homeAway === 'away' ? 'at ' : 'vs ', game.opponent?.name || game.opponent?.abbr || 'TBC'];
}

function lastAndNext(team) {
  const last = team.lastResult;
  const next = team.nextGame;
  if (!last && !next) return null;
  return el('div', { class: 'pair', style: 'margin-bottom:var(--card-gap)' },
    el('div', {},
      el('div', { class: 'label' }, 'Last result'),
      last ? [
        el('div', { class: 'value num' }, `${last.result} ${last.teamScore}–${last.oppScore}`),
        el('div', { class: 'small' }, versus(last)),
        el('div', { class: 'small muted' }, formatShortDate(last.start), last.note ? ` · ${last.note}` : ''),
      ] : el('div', { class: 'small muted' }, 'None yet'),
    ),
    el('div', {},
      el('div', { class: 'label' }, 'Next game'),
      next ? [
        el('div', { class: 'value' }, versus(next)),
        el('div', { class: 'small num' }, formatGameDateTime(next.start)),
        next.note ? el('div', { class: 'small muted' }, next.note) : null,
      ] : el('div', { class: 'small muted' }, team.offSeason ? 'Schedule not out yet' : 'Not scheduled'),
    ),
  );
}

function injuries(list) {
  return card({ type: 'injury', title: 'Injury report' },
    !list?.length ? emptyNote('No injuries listed.') :
      list.map(i => el('div', { class: 'injury' },
        el('div', { class: 'injury-head' },
          el('span', { class: 'player' }, i.player, i.position ? el('span', { class: 'muted' }, ` · ${i.position}`) : null),
          statusChip(i.status)),
        el('p', { class: 'what' }, i.injury, i.about ? el('span', { class: 'muted' }, `. ${i.about}`) : null),
        returnTimeline(i.timeline),
        typicalRecovery(i.typical),
        sourceLinks(i.sources),
      )));
}

// Show both numbers with one decimal place if either has decimals, so "4" and "4.2" line up as "4.0" and "4.2".
function statPair(last5, season) {
  const decimals = [last5, season].some(n => typeof n === 'number' && !Number.isInteger(n));
  const show = n => (typeof n === 'number' && decimals ? n.toFixed(1) : n ?? '–');
  return [show(last5), show(season)];
}

const TREND = {
  up: { cls: 'trend-up', label: 'Trending up' },
  down: { cls: 'trend-down', label: 'Trending down' },
  steady: { cls: 'trend-steady', label: 'Steady' },
};

function playerForm(list) {
  if (!list?.length) {
    return card({ type: 'plain', title: 'Player form', iconName: 'up' },
      emptyNote('Player form appears once a few games have been played.'));
  }
  const preseason = list.some(p => /preseason/i.test(p.seasonLabel || ''));
  return card({ type: 'plain', title: 'Player form', extra: preseason ? 'Last 5 vs preseason' : 'Last 5 vs season', iconName: 'up' },
    list.map(p => {
      const key = TREND[p.trend] ? p.trend : 'steady';
      const trend = TREND[key];
      return el('div', { class: 'form-row' },
        el('div', { class: 'form-head' },
          el('span', { class: 'player' }, p.player, p.position ? el('span', { class: 'muted' }, ` · ${p.position}`) : null),
          el('span', { class: `trend ${trend.cls}` }, icon(key, ''), trend.label)),
        el('div', { class: 'stat-grid' },
          (p.stats || []).map(s => {
            const [last5, season] = statPair(s.last5, s.season);
            return el('div', { class: 'stat' },
              el('div', { class: 'label' }, s.label),
              el('div', { class: 'value' }, last5),
              el('div', { class: 'season' }, `Season ${season}`));
          })),
        p.note ? el('p', { class: 'small' }, p.note) : null,
      );
    }));
}

function rosterNews(list) {
  return card({ type: 'moves', title: 'Roster moves and news' },
    !list?.length ? emptyNote('No roster moves or news this week.') :
      list.map(n => el('div', { class: 'entry' },
        el('div', { class: 'entry-head' },
          n.type ? el('span', { class: 'chip chip-type' }, n.type) : null,
          n.date ? el('span', { class: 'muted small' }, formatShortDate(n.date)) : null),
        el('p', { style: 'margin-top:4px' }, n.text),
        sourceLinks(n.sources),
      )));
}

function playoffRace(race, myAbbr) {
  if (!race) return null;
  const rows = race.rows || [];
  return card({ type: 'results', title: 'Playoff race' },
    race.summary ? el('p', {}, race.summary) : null,
    rows.length ? el('div', { class: 'table-wrap' },
      el('table', { class: 'standings' },
        el('caption', { class: 'muted small', style: 'text-align:left; caption-side: bottom; padding-top: 8px' },
          race.cutoffLabel || ''),
        el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, race.groupName || 'Team'), el('th', {}, 'W-L'), el('th', {}, 'GB'))),
        el('tbody', {}, rows.map(r => el('tr', {
          class: [r.abbr === myAbbr ? 'mine' : '', race.cutoffAfter && r.seed === race.cutoffAfter ? 'cutoff' : ''].join(' ').trim() || null,
        },
          el('td', {}, r.seed),
          el('td', {}, el('span', { class: 'team-cell' }, teamChip(r.abbr), r.name)),
          el('td', {}, r.record),
          el('td', {}, r.gb))))),
    ) : null,
    race.keyGames?.length ? el('div', { class: 'group' },
      el('p', { class: 'label-strip' }, 'Key games ahead'),
      race.keyGames.map(g => el('div', { class: 'entry' },
        el('div', { class: 'entry-head' }, versus(g), el('span', { class: 'muted small num' }, formatGameDateTime(g.start))),
        g.why ? el('p', { class: 'small' }, g.why) : null))) : null,
  );
}
