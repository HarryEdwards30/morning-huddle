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

// A card with an optional small uppercase title.
export function card(title, ...children) {
  return el('section', { class: 'card' }, title ? el('h2', { class: 'card-title' }, title) : null, ...children);
}

// The user's teams, read from settings: { nba: {abbr, ...}, nfl: {...} }
let myTeams = {};
export function setMyTeams(teams) { myTeams = teams || {}; }
export function isMyTeam(abbr) {
  return Object.values(myTeams).some(t => t.abbr === abbr);
}

export function teamChip(abbr) {
  return el('span', { class: `chip chip-team${isMyTeam(abbr) ? ' chip-mine' : ''}` }, abbr);
}

export function leagueChip(league) {
  return el('span', { class: 'chip chip-league' }, league);
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
    el('div', { class: 'game-status' }, [game.status || 'Final', game.start ? ` · ${formatShortDate(game.start)}` : '', game.note ? ` · ${game.note}` : ''].join('')),
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
