// Small building blocks shared by every tab: making elements, chips, cards, source links and scoreboards.

import { formatShortDate } from './time.js';

// Create an element. `children` can be strings, elements, arrays or null (null is skipped).
// Strings are always added as text, never as HTML, so data can't inject markup.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') node.setAttribute('style', value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Small line icons, drawn as SVG paths so they pick up the surrounding colour.
const ICONS = {
  injury: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
  hot: 'M12 19V5M5 12l7-7 7 7',
  cold: 'M12 5v14M5 12l7 7 7-7',
  results: 'M3 6h18v12H3zM12 6v12M7 10v4M17 10v4',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  moves: 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
  watch: 'M3 5h18v12H3zM8 21h8M10 9l5 2-5 2z',
  lead: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  plain: 'M12 4l8 8-8 8-8-8z',
  mine: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z',
  why: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 8l4 4-4 4',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  steady: 'M5 12h14',
};
export function icon(name, className = 'icon') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name] || ICONS.plain);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

// A section card. `type` picks its colour (see the card colours at the top of app.css):
// plain, injury, hot, cold, results, news, moves, watch, lead.
// Every card starts with a coloured header strip so it's clear where one section ends and the next begins.
export function card({ type = 'plain', title, extra, mine = false, iconName }, ...children) {
  return el('section', { class: `card card--${type}${mine ? ' card--mine' : ''}` },
    title ? el('header', { class: 'card-head' },
      icon(iconName || (mine ? 'mine' : type)),
      el('h2', {}, title),
      extra ? el('span', { class: 'extra' }, extra) : null) : null,
    ...children);
}

// The user's teams, read from settings: { nba: {abbr, ...}, nfl: {...} }
let myTeams = {};
export function setMyTeams(teams) { myTeams = teams || {}; }
export function isMyTeam(abbr) {
  return Object.values(myTeams).some(t => t.abbr === abbr);
}
// True if any of the listed team abbreviations is one of Jack's teams.
export function involvesMyTeam(abbrs) {
  return (abbrs || []).some(isMyTeam);
}

export function teamChip(abbr) {
  return el('span', { class: `chip chip-team${isMyTeam(abbr) ? ' chip-mine' : ''}` }, abbr);
}

export function yourTeamChip() {
  return el('span', { class: 'chip chip-your-team' }, 'Your team');
}

// Injury status chip. The colour is backed up by the text label.
const STATUS_CLASS = {
  'out': 'status-out',
  'doubtful': 'status-doubtful',
  'questionable': 'status-questionable',
  'probable': 'status-probable',
  'day-to-day': 'status-probable',
};
export function statusChip(status) {
  const cls = STATUS_CLASS[String(status).toLowerCase()] || '';
  return el('span', { class: `chip chip-status ${cls}` }, status);
}

// "Read more" links for a story. `ids` point into the edition's `sources` list.
let sourceIndex = {};
export function setSources(sources) { sourceIndex = sources || {}; }
export function sourceLinks(ids) {
  const links = (ids || [])
    .map(id => sourceIndex[id])
    .filter(s => s && /^https?:\/\//i.test(s.url || ''))
    .map(s => el('a', { class: 'read-more', href: s.url, target: '_blank', rel: 'noopener' }, `Read more: ${s.publisher || 'source'} ↗`));
  return links.length ? el('div', {}, links) : null;
}

// One completed game in scoreboard style: winner in bold, Jack's team highlighted.
export function gameRow(game) {
  const { home, away } = game;
  const awayWon = away.score > home.score;
  const homeWon = home.score > away.score;
  const mine = isMyTeam(home.abbr) || isMyTeam(away.abbr);
  const line = (team, won) => [
    el('div', { class: `game-team${won ? ' winner' : ''}` }, teamChip(team.abbr), el('span', { class: 'name' }, team.name)),
    el('div', { class: `game-score${won ? ' winner' : ''}` }, team.score),
  ];
  return el('div', { class: `game${mine ? ' mine' : ''}` },
    line(away, awayWon),
    line(home, homeWon),
    el('div', { class: 'game-status' },
      [game.status || 'Final', game.start ? ` · ${formatShortDate(game.start)}` : '', game.note ? ` · ${game.note}` : ''].join(''),
      mine ? yourTeamChip() : null),
  );
}

export function emptyNote(text) {
  return el('p', { class: 'muted' }, text);
}

// "Expected back: 2-3 weeks [Team report]". The label always says where the timeline came from,
// so a reported timeline can't be mistaken for a typical recovery time.
const BASIS_LABEL = {
  team: 'Team report',
  media: 'Media report',
  typical: 'Typical recovery',
};
export function returnTimeline(timeline) {
  if (!timeline) return null;
  return el('div', { class: 'timeline-line' },
    'Expected back: ', el('strong', {}, timeline.text),
    el('span', { class: 'basis' }, BASIS_LABEL[timeline.basis] || 'Unconfirmed'));
}
