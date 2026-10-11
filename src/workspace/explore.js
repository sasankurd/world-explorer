// The Explore tab's home view, and the detail view for a place found with search.
import { h, icon } from './dom.js';
import { ago } from '../projects/model.js';

const KIND = { country: 'Country', city: 'City', place: 'Place', point: 'Map point' };
const coords = (lat, lng) => `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`;

export function renderExplore(root, c) {
  const kids = [];
  kids.push(h('h2', { class: 'sv-h', tabindex: '-1' }, 'Explore the world'),
    h('p', { class: 'pj-sub' }, 'Search for a country, city or address, or click a country on the map. Press ',
      h('kbd', {}, '/'), ' to jump to the search box.'));
  if (c.active) kids.push(h('div', { class: 'ex-active' },
    h('span', { class: 'ex-dot', 'aria-hidden': 'true' }),
    h('div', {}, h('small', {}, 'Working in'), h('b', {}, c.active.name), h('small', {}, `${c.active.places.length} ${c.active.places.length === 1 ? 'place' : 'places'} pinned on the map`)),
    h('button', { type: 'button', class: 'btn', onclick: c.onOpenActive }, 'Open project')));
  kids.push(h('h3', { class: 'ex-h' }, 'Recently opened'));
  if (!c.recent.length) kids.push(h('p', { class: 'muted' }, 'Places you open will show up here.'));
  else kids.push(h('ul', { class: 'ex-list' }, c.recent.map((r) => h('li', {},
    h('button', { type: 'button', class: 'ex-item', onclick: () => c.onOpenRecent(r) },
      icon('pin'), h('span', {}, h('b', {}, r.name), h('small', {}, KIND[r.kind] + ' · ' + ago(r.at))))))));
  kids.push(h('h3', { class: 'ex-h' }, 'Start somewhere'),
    h('div', { class: 'ex-start' },
      h('button', { type: 'button', class: 'btn', onclick: c.onRandom }, 'Open a random country'),
      h('button', { type: 'button', class: 'btn', onclick: c.onLayers }, 'Browse layers and tools'),
      h('button', { type: 'button', class: 'btn', onclick: c.onPlay }, 'Play a trivia game')));
  root.replaceChildren(...kids);
}

// details for a place chosen from the search results
export function renderPlace(root, place, c) {
  root.replaceChildren(
    h('div', { class: 'ph' },
      h('span', { class: 'flag', 'aria-hidden': 'true' }, '📍'),
      h('h2', {}, place.name),
      h('button', { type: 'button', class: 'ph-save', onclick: c.onSave, 'aria-label': `Save ${place.name} to a project` }, icon('bookmark', 'ic'), h('span', {}, 'Save')),
      h('button', { type: 'button', class: 'ph-x', onclick: c.onClose, 'aria-label': 'Close place details' }, '✕')),
    h('div', { class: 'body' },
      h('table', {}, h('tbody', {},
        h('tr', {}, h('td', {}, 'Type'), h('td', {}, KIND[place.kind] || 'Place')),
        place.sub ? h('tr', {}, h('td', {}, 'Where'), h('td', {}, place.sub)) : null,
        h('tr', {}, h('td', {}, 'Position'), h('td', {}, coords(place.lat, place.lng))))),
      place.ref ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: c.onCountry }, 'Open its country')) : null,
      h('p', { class: 'hint' }, 'Saving adds this place to a project so you can come back to it, add notes and see it as a pin.')));
}
