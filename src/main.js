import * as maplibregl from 'maplibre-gl';
const workerUrl = '/maplibre/maplibre-gl-worker.mjs';
maplibregl.setWorkerUrl(workerUrl);
import 'maplibre-gl/dist/maplibre-gl.css';

const $ = (s) => document.querySelector(s);
const enc = encodeURIComponent;
const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('en', { maximumFractionDigits: d }));

const [borders, countries] = await Promise.all([
  fetch('/data/borders.geojson').then((r) => r.json()),
  fetch('/data/countries.json').then((r) => r.json()),
]);
const list = Object.values(countries);
for (const c of list) c.density = c.population && c.area ? c.population / c.area : null;

// ---------- rankings (computed from the data) ----------
const rankOf = (key) => {
  const sorted = list.filter((c) => c[key] != null).sort((a, b) => b[key] - a[key]);
  const m = {};
  sorted.forEach((c, i) => (m[c.id] = i + 1));
  return { m, total: sorted.length, sorted };
};
const R = { population: rankOf('population'), area: rankOf('area'), density: rankOf('density') };

// ---------- map ----------
const hueOf = (id) => ((id.charCodeAt(0) * 37 + id.charCodeAt(1) * 91 + id.charCodeAt(2) * 13) % 360);
const regionHue = { Africa: 28, Americas: 130, Asia: 345, Europe: 215, Oceania: 275, Antarctic: 190 };
const politicalColor = (c) => `hsl(${(regionHue[c.region] ?? 0) + (hueOf(c.id) % 30) - 15},55%,${58 + (hueOf(c.id) % 14)}%)`;

const esri = (name) => ({
  type: 'raster', tileSize: 256, maxzoom: 18,
  tiles: [`https://server.arcgisonline.com/ArcGIS/rest/services/${name}/MapServer/tile/{z}/{y}/{x}`],
  attribution: 'Imagery © Esri and contributors',
});

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      satellite: esri('World_Imagery'),
      terrain: esri('World_Topo_Map'),
      countries: { type: 'geojson', data: borders, promoteId: 'id' },
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': '#cfe5f5' } },
      { id: 'terrain', type: 'raster', source: 'terrain', layout: { visibility: 'none' } },
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
      {
        id: 'fill', type: 'fill', source: 'countries',
        paint: {
          'fill-color': ['coalesce', ['feature-state', 'fill'], '#cccccc'],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.82],
        },
      },
      { id: 'line', type: 'line', source: 'countries', paint: { 'line-color': '#ffffff', 'line-width': 0.6, 'line-opacity': 0.8 } },
      {
        id: 'selected', type: 'line', source: 'countries',
        paint: { 'line-color': '#111', 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.4, 0] },
      },
    ],
  },
  center: [20, 25], zoom: 1.6, minZoom: 0.8, maxZoom: 10, dragRotate: false, attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
map.touchZoomRotate.disableRotation();

// ---------- views ----------
let view = 'political';
const stat = () => $('#stat').value;

function colorFor(c) {
  if (view === 'stats') {
    const key = stat(), v = c[key];
    if (v == null || v <= 0) return '#bbbbbb';
    const t = 1 - (R[key].m[c.id] - 1) / (R[key].total - 1); // by rank, so the colours spread evenly
    return `hsl(212,75%,${90 - t * 62}%)`;
  }
  if (view === 'satellite') return 'rgba(255,255,255,0.02)';
  if (view === 'terrain') return 'rgba(255,255,255,0.02)';
  return politicalColor(c);
}
function applyView() {
  document.body.dataset.view = view;
  const vis = (id, on) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  vis('terrain', view === 'terrain');
  vis('satellite', view === 'satellite');
  map.setPaintProperty('sea', 'background-color', view === 'stats' ? '#eef2f6' : '#cfe5f5');
  map.setPaintProperty('line', 'line-color', view === 'satellite' ? '#ffffff' : view === 'terrain' ? '#7a3b3b' : '#ffffff');
  map.setPaintProperty('fill', 'fill-opacity', view === 'satellite' || view === 'terrain'
    ? ['case', ['boolean', ['feature-state', 'hover'], false], 0.25, 0.01]
    : ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.82]);
  for (const c of list) map.setFeatureState({ source: 'countries', id: c.id }, { fill: colorFor(c) });
}
$('#views').addEventListener('click', (e) => {
  const v = e.target.dataset.view; if (!v) return;
  view = v;
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  applyView();
});
$('#stat').addEventListener('change', () => { view = 'stats'; document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === 'stats')); applyView(); });

// ---------- hover + click ----------
let hoverId = null;
const tip = $('#tip');
map.on('mousemove', 'fill', (e) => {
  const f = e.features[0]; if (!f) return;
  map.getCanvas().style.cursor = 'pointer';
  if (hoverId && hoverId !== f.id) map.setFeatureState({ source: 'countries', id: hoverId }, { hover: false });
  hoverId = f.id; map.setFeatureState({ source: 'countries', id: hoverId }, { hover: true });
  const c = countries[f.id];
  tip.hidden = false; tip.textContent = `${c.flag} ${c.name}`;
  tip.style.left = e.point.x + 14 + 'px'; tip.style.top = e.point.y + 14 + 'px';
});
map.on('mouseleave', 'fill', () => {
  map.getCanvas().style.cursor = '';
  if (hoverId) map.setFeatureState({ source: 'countries', id: hoverId }, { hover: false });
  hoverId = null; tip.hidden = true;
});
map.on('click', 'fill', (e) => { if (e.features[0]) openCountry(e.features[0].id, 'overview', false); });

// bounds of a country (uses its largest polygon so overseas islands don't zoom us out to the whole world)
const boundsCache = {};
function boundsOf(id) {
  if (boundsCache[id]) return boundsCache[id];
  const f = borders.features.find((x) => x.properties.id === id);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best = null, bestArea = -1;
  for (const p of polys) {
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const a = (x1 - x0) * (y1 - y0);
    if (a > bestArea) { bestArea = a; best = [[x0, y0], [x1, y1]]; }
  }
  return (boundsCache[id] = best);
}
function flyTo(id) {
  const [[x0, y0], [x1, y1]] = boundsOf(id);
  const narrow = innerWidth < 700;
  map.fitBounds([[x0, y0], [x1, y1]], { padding: narrow ? 30 : { top: 60, bottom: 60, left: 60, right: 460 }, maxZoom: 6, duration: 900 });
}

// ---------- country name labels ----------
// Plain text on the map (no font files needed). Big countries are named first; small ones appear as you zoom in,
// and a label is hidden if it would overlap a bigger country's label.
const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; };
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return r[0];
  return [cx / (3 * a), cy / (3 * a)];
}
const labels = [];
for (const f of borders.features) {
  const c = countries[f.properties.id]; if (!c) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let ring = null, best = -1;
  for (const p of polys) { const a = Math.abs(ringArea(p[0])); if (a > best) { best = a; ring = p[0]; } }
  if (!ring) continue;
  const [lng, lat] = ringCentroid(ring);
  let x0 = Infinity, x1 = -Infinity;
  for (const pt of ring) { x0 = Math.min(x0, pt[0]); x1 = Math.max(x1, pt[0]); }
  const el = document.createElement('div');
  el.className = 'cl off'; el.textContent = c.name;
  new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
  labels.push({ el, name: c.name, lng, lat, wDeg: x1 - x0, vis: false, fs: 0 });
}
labels.sort((a, b) => b.wDeg - a.wDeg); // biggest first = highest priority
// ---- city names: only when zoomed in; capitals are bold with a ring marker ----
let labelsOn = true, labelSig = '';
const cityLayer = document.createElement('div');
cityLayer.id = 'cities';
map.getContainer().insertBefore(cityLayer, map.getContainer().querySelector('.maplibregl-control-container'));
const measure = document.createElement('canvas').getContext('2d');
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const CITY_FS = 11, CAP_FS = 12.5;
// the zoom level at which a city of this size starts to be named (bigger cities first)
const minZoomFor = (pop) => (pop >= 5e6 ? 3.6 : pop >= 2e6 ? 4.2 : pop >= 1e6 ? 4.8 : pop >= 5e5 ? 5.4 : pop >= 2.5e5 ? 6 : pop >= 1e5 ? 6.6 : pop >= 5e4 ? 7.4 : 8.2);
let cities = [];
fetch('/data/cities.json').then((r) => r.json()).then((rows) => {
  cities = rows.map(([name, lng, lat, pop, cap]) => ({ name, lng, lat, pop, cap: !!cap, minZ: cap ? 3.2 : minZoomFor(pop), w: 0, el: null, vis: false }));
  cities.sort((a, b) => (b.cap - a.cap) || (b.pop - a.pop)); // capitals first, then biggest
  labelSig = ''; updateLabels();
}).catch(() => {});

function updateLabels() {
  const z = map.getZoom(), pxPerDeg = (512 * Math.pow(2, z)) / 360;
  const cv = map.getCanvas(), vw = cv.clientWidth, vh = cv.clientHeight, cl = map.getCenter().lng;
  const wrap = (lng) => { while (lng - cl > 180) lng -= 360; while (lng - cl < -180) lng += 360; return lng; };
  const placed = [];
  const free = (x0, y0, x1, y1) => !placed.some((b) => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);

  // 1) country names (highest priority)
  for (const L of labels) {
    let vis = false, fs = L.fs || 11;
    if (labelsOn) {
      const pxW = L.wDeg * pxPerDeg;
      fs = pxW > 300 ? 15 : pxW > 110 ? 13 : 11;
      const w = L.name.length * fs * 0.58 + 8, h = fs + 5;
      if (pxW >= w * 0.8 || z >= 5) {
        const p = map.project([wrap(L.lng), L.lat]);
        if (p.x > -w && p.x < vw + w && p.y > -h && p.y < vh + h) {
          const x0 = p.x - w / 2, x1 = p.x + w / 2, y0 = p.y - h / 2, y1 = p.y + h / 2;
          if (free(x0, y0, x1, y1)) { placed.push([x0, y0, x1, y1]); vis = true; }
        }
      }
    }
    if (fs !== L.fs) { L.el.style.fontSize = fs + 'px'; L.fs = fs; }
    if (vis !== L.vis) { L.el.classList.toggle('off', !vis); L.vis = vis; }
  }

  // 2) capitals, then cities (drawn only if they fit without touching a name that is already placed)
  for (const c of cities) {
    let vis = false, x = 0, y = 0;
    if (labelsOn && z >= c.minZ) {
      const p = map.project([wrap(c.lng), c.lat]);
      if (p.x > -200 && p.x < vw + 200 && p.y > -30 && p.y < vh + 30) {
        const fs = c.cap ? CAP_FS : CITY_FS, h = c.cap ? 17.5 : 16, dot = c.cap ? 4 : 2.5;
        if (!c.w) { measure.font = `${c.cap ? 700 : 500} ${fs}px ${FONT}`; c.w = measure.measureText(c.name).width + (c.cap ? 15 : 12); }
        const x0 = p.x - dot, y0 = p.y - h / 2;
        if (free(x0, y0, x0 + c.w, y0 + h)) { placed.push([x0, y0, x0 + c.w, y0 + h]); vis = true; x = x0; y = y0; }
      }
    }
    if (vis) {
      if (!c.el) {
        c.el = document.createElement('div');
        c.el.className = 'cl city' + (c.cap ? ' cap' : '');
        c.el.textContent = c.name;
      }
      if (!c.vis) cityLayer.appendChild(c.el);
      c.el.style.transform = `translate(${x}px,${y}px)`;
    } else if (c.vis) c.el.remove();
    c.vis = vis;
  }
}
// redraw whenever the map has actually moved, zoomed or resized
map.on('render', () => {
  const c = map.getCenter(), cv = map.getCanvas();
  const sig = [map.getZoom().toFixed(3), c.lng.toFixed(4), c.lat.toFixed(4), cv.clientWidth, cv.clientHeight, labelsOn].join();
  if (sig !== labelSig) { labelSig = sig; updateLabels(); }
});
$('#names').addEventListener('click', () => { labelsOn = !labelsOn; $('#names').classList.toggle('on', labelsOn); labelSig = ''; updateLabels(); });
updateLabels();

// ---------- country panel ----------
let current = null;
const panel = $('#panel');
const TABS = ['overview', 'rank', 'news', 'geography', 'history'];
const newsCats = ['Politics', 'Business', 'Sport', 'Technology', 'Culture', 'Health'];
const places = ['Restaurants', 'Petrol stations', 'Hospitals', 'Hotels', 'Pharmacies', 'Banks'];
const link = (href, text) => `<a target="_blank" rel="noopener" href="${href}">${text}</a>`;
const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;

function openCountry(id, tab = 'overview', fly = true) {
  const c = countries[id]; if (!c) return;
  if (current && current !== id) map.setFeatureState({ source: 'countries', id: current }, { selected: false });
  current = id; map.setFeatureState({ source: 'countries', id }, { selected: true });
  history.replaceState(null, '', '#' + id);
  if (fly) flyTo(id);

  const city = c.capital || c.name;
  let h = `<div class="ph"><span class="flag">${c.flag}</span><h2>${c.name}</h2><button id="close" aria-label="Close">✕</button></div>
  <div class="tabs">${TABS.map((t) => `<button data-tab="${t}" class="${t === tab ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div><div class="body">`;

  if (tab === 'overview') {
    h += `<table>${row('Official name', c.official)}${row('Capital', c.capital || '—')}${row('Region', [c.region, c.subregion].filter(Boolean).join(' · '))}
      ${row('Population', fmt(c.population))}${row('Area', fmt(c.area) + ' km²')}${row('Languages', c.languages.join(', ') || '—')}${row('Currency', c.currencies.join(', ') || '—')}
      ${row('Government', c.government || '—')}</table>
      <div class="note">Population figures come from an older dataset (about 2018). They will be replaced with live data in a later phase.</div>`;
  }
  if (tab === 'rank') {
    const rk = (k, label) => (R[k].m[id] ? row(label, `#${R[k].m[id]} <span class="muted">of ${R[k].total}</span>`) : row(label, '—'));
    h += `<h3>Country rankings</h3><table>${rk('population', 'Population')}${rk('area', 'Size (area)')}${rk('density', 'Density')}</table>
      <h3>Top 10 stores, shops and clothing brands</h3>
      <div class="note">Brand rankings are the next phase. They need a curated list per country (see the plan, decision 2), so nothing is shown here instead of showing made-up lists.</div>
      <h3>User ranking</h3><div class="note">Needs accounts and a database (Phase 5).</div>`;
  }
  if (tab === 'news') {
    const chips = (q) => `<div class="chips">${newsCats.map((x) => link(`https://news.google.com/search?q=${enc(q + ' ' + x)}`, x)).join('')}</div>`;
    h += `<h3>${c.name} news</h3>${chips(c.name)}${c.capital ? `<h3>${c.capital} news</h3>${chips(c.capital)}` : ''}
      <h3>Trends</h3><div class="chips">${link(`https://trends.google.com/trending?geo=${c.iso2}`, `Trending in ${c.name}`)}</div>
      <div class="note">These open live news pages. Showing headlines inside this window needs a news service (Phase 4).</div>`;
  }
  if (tab === 'geography') {
    const nb = c.borders.map((b) => list.find((x) => x.id === b)).filter(Boolean);
    h += `<table>${row('Average elevation', c.elevation != null ? fmt(c.elevation) + ' m' : '—')}
      ${row('Average temperature', c.avgTemp != null ? fmt(c.avgTemp, 1) + ' °C' : '—')}${row('Landlocked', c.landlocked ? 'Yes' : 'No')}</table>
      <h3>Neighbours</h3>${nb.length ? `<div class="chips">${nb.map((n) => `<button data-go="${n.id}">${n.flag} ${n.name}</button>`).join('')}</div>` : '<p class="muted">No land borders.</p>'}
      <h3>Look at the land</h3><div class="chips">${link(`https://www.google.com/maps/search/${enc(c.name)}`, 'Open in Google Maps')}</div>
      <h3>Find places in ${city}</h3><div class="chips">${places.map((x) => link(`https://www.google.com/maps/search/${enc(x + ' in ' + city)}`, x)).join('')}</div>
      <h3>Compare with</h3><select id="cmp"><option value="">Choose a country…</option>${list.filter((x) => x.id !== id).sort((a, b) => a.name.localeCompare(b.name)).map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select><div id="cres"></div>`;
  }
  if (tab === 'history') {
    h += `<table>${row('Independence / founding', c.independence != null ? (c.independence < 0 ? -c.independence + ' BCE' : String(c.independence)) : '—')}${row('Religion', c.religion || '—')}${row('National dish', c.nationalDish || '—')}</table>
      <div class="chips">${link(`https://en.wikipedia.org/wiki/History_of_${enc(c.name.replace(/ /g, '_'))}`, `History of ${c.name}`)}${c.capital ? link(`https://en.wikipedia.org/wiki/${enc(c.capital.replace(/ /g, '_'))}#History`, `History of ${c.capital}`) : ''}</div>
      <div class="note">Written history timelines for each country and city are planned for Phase 6.</div>`;
  }
  panel.innerHTML = h + '</div>'; panel.hidden = false;
  panel.scrollTop = 0;

  $('#close').onclick = closePanel;
  panel.querySelector('.tabs').onclick = (e) => e.target.dataset.tab && openCountry(id, e.target.dataset.tab, false);
  panel.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => openCountry(b.dataset.go, 'geography')));
  const cmp = $('#cmp');
  if (cmp) cmp.onchange = () => {
    const o = countries[cmp.value]; if (!o) { $('#cres').innerHTML = ''; return; }
    const r = (l, a, b) => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
    $('#cres').innerHTML = `<table><tr><th></th><th>${c.flag} ${c.name}</th><th>${o.flag} ${o.name}</th></tr>
      ${r('Population', fmt(c.population), fmt(o.population))}${r('Area (km²)', fmt(c.area), fmt(o.area))}${r('Density (/km²)', fmt(c.density, 1), fmt(o.density, 1))}
      ${r('Capital', c.capital || '—', o.capital || '—')}${r('Avg elevation (m)', fmt(c.elevation), fmt(o.elevation))}${r('Avg temp (°C)', fmt(c.avgTemp, 1), fmt(o.avgTemp, 1))}</table>`;
  };
}
function closePanel() {
  panel.hidden = true;
  if (current) map.setFeatureState({ source: 'countries', id: current }, { selected: false });
  current = null; history.replaceState(null, '', location.pathname);
}

// ---------- search ----------
const input = $('#search'), results = $('#results');
let act = -1, matches = [];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
input.addEventListener('input', () => {
  const q = norm(input.value.trim()); act = -1;
  matches = q ? list.filter((c) => norm(c.name).includes(q) || (c.capital && norm(c.capital).includes(q))).slice(0, 8) : [];
  results.innerHTML = matches.map((c, i) => `<li data-i="${i}">${c.flag} ${c.name}${c.capital ? ` <span class="muted">· ${c.capital}</span>` : ''}</li>`).join('');
});
const pick = (c) => { input.value = ''; results.innerHTML = ''; openCountry(c.id); };
results.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) pick(matches[li.dataset.i]); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    act = (act + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % (matches.length || 1);
    [...results.children].forEach((li, i) => li.classList.toggle('act', i === act)); e.preventDefault();
  } else if (e.key === 'Enter' && matches.length) pick(matches[Math.max(act, 0)]);
});

// ---------- start ----------
map.on('load', () => {
  applyView();
  const id = location.hash.slice(1).toUpperCase();
  if (countries[id]) openCountry(id);
});
window.__app = { map, countries, openCountry, labels, get cities() { return cities; } }; // handy for testing
