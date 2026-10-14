// Draws a project's saved places on the map as amber pins (HTML markers, like the rest of the site's map overlays).
// Pins are real buttons, so they can be reached with the keyboard. They are not drawn on the 3D globe yet.
import * as maplibregl from 'maplibre-gl';

const NAME_ZOOM = 5; // zoomed out, saved places are small dots; their names appear when you zoom in, or on hover and selection
export function createPins(map, { onSelect } = {}) {
  let markers = new Map(), selected = '', showAllNames = true;
  const el = (p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ppin'; b.dataset.id = p.id;
    b.setAttribute('aria-label', `${p.name}, saved place`);
    const dot = document.createElement('span'); dot.className = 'pd'; dot.setAttribute('aria-hidden', 'true');
    const nm = document.createElement('span'); nm.className = 'pn'; nm.textContent = p.name; // textContent: names are untrusted text
    b.append(dot, nm);
    b.addEventListener('click', (e) => { e.stopPropagation(); onSelect?.(p.id); });
    return b;
  };
  function show(places) {
    clear();
    showAllNames = places.length <= 15;
    for (const p of places) {
      const m = new maplibregl.Marker({ element: el(p), anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
      markers.set(p.id, m);
    }
    mark();
  }
  map.on('zoomend', () => mark());
  function clear() { markers.forEach((m) => m.remove()); markers = new Map(); selected = ''; }
  function mark() {
    markers.forEach((m, id) => { const e = m.getElement(); e.classList.toggle('sel', id === selected); e.classList.toggle('names', showAllNames && map.getZoom() >= NAME_ZOOM); });
  }
  return {
    show, clear,
    select(id) { selected = id; mark(); },
    get count() { return markers.size; },
    visible(on) { markers.forEach((m) => { m.getElement().hidden = !on; }); },
  };
}
