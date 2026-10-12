// The Explore tab's home view, and the detail view for a place found with search.
import { h, icon } from './dom.js';
import { ago } from '../projects/model.js';

const KIND = { country: 'Country', city: 'City', place: 'Place', point: 'Map point' };
const coords = (lat, lng) => `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`;

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
