import * as maplibregl from 'maplibre-gl';
const workerUrl = '/maplibre/maplibre-gl-worker.mjs';
maplibregl.setWorkerUrl(workerUrl);
import 'maplibre-gl/dist/maplibre-gl.css';

const $ = (s) => document.querySelector(s);
const enc = encodeURIComponent;
const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('en', { maximumFractionDigits: d }));

const [borders, countries, tzData] = await Promise.all([
  fetch('/data/borders.geojson').then((r) => r.json()),
  fetch('/data/countries.json').then((r) => r.json()),
  fetch('/data/country-zones.json').then((r) => r.json()).catch(() => ({})),
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

// ---------- time zones: live clocks (the browser works out summer/winter time itself) ----------
const tzFmt = {};
function tzFormat(zone, kind) {
  const k = zone + '|' + kind;
  if (tzFmt[k] === undefined) {
    try {
      const o = { timeZone: zone, hourCycle: 'h23' };
      if (kind === 'hm') Object.assign(o, { hour: '2-digit', minute: '2-digit' });
      else if (kind === 'hms') Object.assign(o, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      else if (kind === 'day') Object.assign(o, { weekday: 'short', day: 'numeric', month: 'short' });
      else Object.assign(o, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
      tzFmt[k] = new Intl.DateTimeFormat('en-GB', o);
    } catch { tzFmt[k] = null; }
  }
  return tzFmt[k];
}
const tzText = (zone, kind, d = new Date()) => { const f = tzFormat(zone, kind); return f ? f.format(d) : '—'; };
function tzOffsetMin(zone, d = new Date()) { // minutes ahead of UTC right now
  const f = tzFormat(zone, 'parts'); if (!f) return 0;
  const p = {}; for (const x of f.formatToParts(d)) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}
const utcLabel = (min) => 'UTC' + (min < 0 ? '−' : '+') + Math.floor(Math.abs(min) / 60) + (Math.abs(min) % 60 ? ':' + String(Math.abs(min) % 60).padStart(2, '0') : '');
const myZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
const zoneCity = (z) => z.split('/').slice(1).join(' / ').replace(/_/g, ' ') || z;
function relText(zone) { // how far this zone is from the visitor's own clock
  const diff = tzOffsetMin(zone) - tzOffsetMin(myZone);
  if (diff === 0) return 'Same time as you';
  const a = Math.abs(diff), h = Math.floor(a / 60), mi = a % 60;
  return `${h ? h + ' h' : ''}${h && mi ? ' ' : ''}${mi ? mi + ' min' : ''} ${diff > 0 ? 'ahead of' : 'behind'} you`;
}
function localTimeRow(c) {
  const list = tzData[c.id]; if (!list) return '';
  const z = list[0];
  return `<tr><td>Local time</td><td><span class="clock" data-tz="${z}" data-k="hms">${tzText(z, 'hms')}</span>
    <div class="muted"><span data-tzday="${z}">${tzText(z, 'day')}</span> · ${utcLabel(tzOffsetMin(z))}${list.length > 1 ? ' · capital' : ''}<br>${relText(z)}</div></td></tr>`;
}
function zonesBlock(c) {
  const list = tzData[c.id]; if (!list || list.length < 2) return '';
  const rows = list.map((z) => [z, tzOffsetMin(z)]).sort((a, b) => a[1] - b[1])
    .map(([z, o]) => `<tr><td>${zoneCity(z)}</td><td class="clock" data-tz="${z}" data-k="hm">${tzText(z, 'hm')}</td><td class="muted">${utcLabel(o)}</td></tr>`).join('');
  return `<details class="tzs"><summary>All ${list.length} time zones</summary><table>${rows}</table></details>`;
}

// ---------- map ----------
const hueOf = (id) => ((id.charCodeAt(0) * 37 + id.charCodeAt(1) * 91 + id.charCodeAt(2) * 13) % 360);
const regionHue = { Africa: 28, Americas: 130, Asia: 345, Europe: 215, Oceania: 275, Antarctic: 190 };
const politicalColor = (c, dark) => `hsl(${(regionHue[c.region] ?? 0) + (hueOf(c.id) % 30) - 15},${dark ? 48 : 55}%,${dark ? 30 + (hueOf(c.id) % 12) : 58 + (hueOf(c.id) % 14)}%)`;

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
      movers: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, maxzoom: 8 },
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': '#03060a' } },
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
      { id: 'movers-fill', type: 'fill', source: 'movers', layout: { visibility: 'none' }, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.78 } },
      { id: 'movers-line', type: 'line', source: 'movers', layout: { visibility: 'none' }, paint: { 'line-color': '#111', 'line-width': 1.6 } },
    ],
  },
  center: [20, 25], zoom: 1.6, minZoom: 0.8, maxZoom: 10, dragRotate: false, attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
map.touchZoomRotate.disableRotation();

// ---------- views ----------
let sizeMode = false;
let timeMode = false;
let view = 'political';
let mapTheme = 'dark';
try { if (localStorage.getItem('mapTheme') === 'light') mapTheme = 'light'; } catch {}
document.body.dataset.map = mapTheme;
const hook = () => window.__app?.statsHook;
const isDark = () => mapTheme === 'dark' || (view === 'stats' && !!hook()?.heat);

function colorFor(c) {
  if (view === 'stats') return hook()?.color(c) ?? '#333';
  if (view === 'satellite') return 'rgba(255,255,255,0.02)';
  if (view === 'terrain') return 'rgba(255,255,255,0.02)';
  return politicalColor(c, isDark());
}
function recolor() { for (const c of list) map.setFeatureState({ source: 'countries', id: c.id }, { fill: colorFor(c) }); updateStatLabels(); }
// Stats view: the number for each country, written under its name on the map
let statNums = false;
function updateStatLabels() {
  const h = hook(), on = view === 'stats' && !!h?.numbers;
  if (!on && !statNums) return;
  statNums = on;
  document.body.classList.toggle('statnums', on);
  for (const L of labels) {
    const t = on ? h.text(countries[L.id]) : '';
    if (t) {
      if (!L.sv) { L.sv = document.createElement('span'); L.sv.className = 'sv'; L.el.appendChild(L.sv); }
      if (L.sv.textContent !== t) L.sv.textContent = t;
    } else if (L.sv) { L.sv.remove(); L.sv = null; }
  }
  labelSig = ''; updateLabels();
}
function applyView() {
  const dark = isDark();
  document.body.classList.toggle('heat', view === 'stats' && !!hook()?.heat);
  document.body.dataset.view = view;
  document.body.dataset.map = mapTheme;
  const vis = (id, on) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  vis('terrain', view === 'terrain');
  vis('satellite', view === 'satellite');
  // dark terrain: the same map pictures, dimmed and desaturated
  map.setPaintProperty('terrain', 'raster-brightness-max', dark ? 0.42 : 1);
  map.setPaintProperty('terrain', 'raster-saturation', dark ? -0.35 : 0);
  map.setPaintProperty('terrain', 'raster-contrast', dark ? 0.2 : 0);
  map.setPaintProperty('sea', 'background-color', dark ? '#03060a' : view === 'stats' ? '#eef2f6' : '#cfe5f5');
  map.setPaintProperty('line', 'line-color', view === 'satellite' ? '#ffffff' : view === 'terrain' ? (dark ? '#52d6ff' : '#7a3b3b') : dark ? 'rgba(130,200,255,0.45)' : '#ffffff');
  map.setPaintProperty('selected', 'line-color', dark || view === 'satellite' ? '#52d6ff' : '#111');
  map.setPaintProperty('movers-line', 'line-color', dark ? '#e8f6ff' : '#111');
  map.setPaintProperty('fill', 'fill-opacity', view === 'satellite' || view === 'terrain'
    ? ['case', ['boolean', ['feature-state', 'hover'], false], 0.25, 0.01]
    : ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, dark ? 0.9 : 0.82]);
  recolor();
}
function setMapTheme(t) {
  mapTheme = t;
  try { localStorage.setItem('mapTheme', t); } catch {}
  $('#maptheme').value = t;
  applyView();
  window.dispatchEvent(new CustomEvent('maptheme-change'));
}
$('#maptheme').addEventListener('change', (e) => setMapTheme(e.target.value));
$('#maptheme').value = mapTheme;
$('#views').addEventListener('click', (e) => {
  const v = e.target.dataset.view; if (!v) return;
  view = v;
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  applyView();
  window.dispatchEvent(new CustomEvent('view-change', { detail: view }));
});
function setView(v) { document.querySelector(`#views button[data-view="${v}"]`)?.click(); }

// ---------- hover + click ----------
let hoverId = null;
const tip = $('#tip');
map.on('mousemove', 'fill', (e) => {
  if (drag) return;
  const f = e.features[0]; if (!f) return;
  map.getCanvas().style.cursor = sizeMode && map.queryRenderedFeatures(e.point, { layers: ['movers-fill'] }).length ? 'grab' : 'pointer';
  if (hoverId && hoverId !== f.id) map.setFeatureState({ source: 'countries', id: hoverId }, { hover: false });
  hoverId = f.id; map.setFeatureState({ source: 'countries', id: hoverId }, { hover: true });
  const c = countries[f.id];
  tip.hidden = false; tip.textContent = `${c.flag} ${c.name}` + (view === 'stats' && hook() ? hook().tip(c) : tzData[c.id] ? ` · ${tzText(tzData[c.id][0], 'hm')}` : '');
  tip.style.left = e.point.x + 14 + 'px'; tip.style.top = e.point.y + 14 + 'px';
});
map.on('mouseleave', 'fill', () => {
  if (drag) return;
  map.getCanvas().style.cursor = '';
  if (hoverId) map.setFeatureState({ source: 'countries', id: hoverId }, { hover: false });
  hoverId = null; tip.hidden = true;
});
map.on('click', 'fill', (e) => {
  if (!e.features[0]) return;
  if (sizeMode) { if (!map.queryRenderedFeatures(e.point, { layers: ['movers-fill'] }).length) addMover(e.features[0].id); return; }
  openCountry(e.features[0].id, 'overview', false);
});

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
// room to leave around a country so the open panel does not cover it
function viewPadding() {
  const narrow = innerWidth < 700;
  if (sizeMode) return narrow ? { top: 30, bottom: Math.round(innerHeight * 0.46), left: 20, right: 20 } : { top: 60, bottom: 60, left: 400, right: 60 };
  return narrow ? 30 : { top: 60, bottom: 60, left: 60, right: 460 };
}
function flyTo(id) {
  const [[x0, y0], [x1, y1]] = boundsOf(id);
  map.fitBounds([[x0, y0], [x1, y1]], { padding: viewPadding(), maxZoom: 6, duration: 900 });
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
  labels.push({ id: c.id, tz: tzData[c.id] ? tzData[c.id][0] : null, tm: null, el, name: c.name, lng, lat, wDeg: x1 - x0, vis: false, fs: 0, sv: null });
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
  const showNames = labelsOn && !sizeMode;
  const free = (x0, y0, x1, y1) => !placed.some((b) => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);

  // 1) country names (highest priority)
  for (const L of labels) {
    let vis = false, fs = L.fs || 11;
    if (showNames) {
      const pxW = L.wDeg * pxPerDeg;
      fs = pxW > 300 ? 15 : pxW > 110 ? 13 : 11;
      const withSv = !!L.sv, withTime = !withSv && timeMode && L.tz;
      const w = Math.max(L.name.length, withTime ? 5 : 0, withSv ? L.sv.textContent.length * 0.92 : 0) * fs * 0.58 + 8, h = fs + 5 + (withTime || withSv ? Math.round(fs * 0.95) : 0);
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
    if (showNames && z >= c.minZ) {
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
  const sig = [map.getZoom().toFixed(3), c.lng.toFixed(4), c.lat.toFixed(4), cv.clientWidth, cv.clientHeight, labelsOn, sizeMode, timeMode].join();
  if (sig !== labelSig) { labelSig = sig; updateLabels(); }
});
$('#names').addEventListener('click', () => { labelsOn = !labelsOn; $('#names').classList.toggle('on', labelsOn); labelSig = ''; updateLabels(); });
updateLabels();

// ---------- country panel ----------
let current = null;
const panel = $('#panel');
const TABS = ['overview', 'trade', 'rank', 'news', 'geography', 'history'];
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
    h += `<table>${localTimeRow(c)}${row('Official name', c.official)}${row('Capital', c.capital || '—')}${row('Region', [c.region, c.subregion].filter(Boolean).join(' · '))}
      ${row('Population', fmt(c.population))}${row('Area', fmt(c.area) + ' km²')}${row('Languages', c.languages.join(', ') || '—')}${row('Currency', c.currencies.join(', ') || '—')}
      ${row('Government', c.government || '—')}</table>${zonesBlock(c)}
      <div id="trends"></div>
      <div class="note">The table above uses an older population figure (about 2018). The charts use newer World Bank data.</div>`;
  }
  if (tab === 'trade') {
    h += `<div id="tradebox"><p class="muted">Loading trade partners…</p></div>`;
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
  setTimeout(() => window.dispatchEvent(new CustomEvent('country-open', { detail: { id, tab } })), 0);

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
  window.dispatchEvent(new CustomEvent('country-close'));
}

// ---------- real size: hold and drag countries to compare their true sizes ----------
// A country is moved by turning the globe under it: every point keeps its distance and direction from the country's
// centre, so the real size and shape are kept exactly. This map (Mercator) only makes things LOOK bigger near the poles.
const RAD = Math.PI / 180;
const SIZE_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#6a4c93', '#1982c4', '#8ac926', '#ff6b9d', '#8d5524'];
const MAX_MOVERS = 8;
const EXAMPLES = [['AUS', 'GRL', 'Greenland on Australia'], ['BRA', 'RUS', 'Russia on Brazil'], ['IRQ', 'GBR', 'UK on Iraq']];
const movers = [];
let drag = null, moversFrame = 0, noteTimer = 0;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
const unmerc = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const shortArea = (a) => (a == null ? '' : a >= 1e6 ? (a / 1e6).toFixed(2) + ' M km²' : Math.round(a).toLocaleString('en') + ' km²');

// distance and direction of every point from the country's centre, stored once
function prepMover(id) {
  const f = borders.features.find((x) => x.properties.id === id);
  const L = labels.find((l) => l.id === id);
  if (!f || !L) return null;
  const lng0 = L.lng, lat0 = L.lat, sp = Math.sin(lat0 * RAD), cp = Math.cos(lat0 * RAD);
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly) => poly.map((ring) => {
    const a = new Float64Array(ring.length * 4);
    ring.forEach(([lo, la], i) => {
      const dl = (lo - lng0) * RAD, s = Math.sin(la * RAD), c = Math.cos(la * RAD);
      const hv = Math.sin(((la - lat0) * RAD) / 2) ** 2 + cp * c * Math.sin(dl / 2) ** 2;
      const d = 2 * Math.atan2(Math.sqrt(hv), Math.sqrt(1 - hv));
      const th = Math.atan2(Math.sin(dl) * c, cp * s - sp * c * Math.cos(dl));
      a[i * 4] = Math.sin(d); a[i * 4 + 1] = Math.cos(d); a[i * 4 + 2] = Math.sin(th); a[i * 4 + 3] = Math.cos(th);
    });
    return a;
  }));
  return { polys, lng0, lat0 };
}
// the same shape with its centre moved to (lng, lat)
function placeAt(m, lng, lat) {
  const sp = Math.sin(lat * RAD), cp = Math.cos(lat * RAD);
  return m.polys.map((poly) => poly.map((a) => {
    const n = a.length / 4, out = new Array(n);
    for (let i = 0; i < n; i++) {
      const sd = a[i * 4], cd = a[i * 4 + 1], st = a[i * 4 + 2], ct = a[i * 4 + 3];
      const s2 = Math.max(-1, Math.min(1, sp * cd + cp * sd * ct));
      out[i] = [lng + Math.atan2(st * sd * cp, cd - sp * s2) / RAD, Math.asin(s2) / RAD];
    }
    return out;
  }));
}

function sizeNote(text) {
  const el = $('#mmsg'); if (!el) return;
  el.textContent = text; el.hidden = false;
  clearTimeout(noteTimer); noteTimer = setTimeout(() => { el.hidden = true; }, 4000);
}
function addMover(id, quiet) {
  const c = countries[id]; if (!c) return null;
  if (id === 'ATA') { sizeNote('Antarctica wraps around the South Pole, so it cannot be moved.'); return null; }
  const have = movers.find((x) => x.id === id);
  if (have) { sizeNote(`${have.name} is already on the map. Hold and drag it.`); return have; }
  if (movers.length >= MAX_MOVERS) { sizeNote(`You can compare up to ${MAX_MOVERS} countries at once. Remove one first.`); return null; }
  const prep = prepMover(id); if (!prep) return null;
  const el = document.createElement('div');
  el.className = 'tl'; el.textContent = c.name;
  const sub = document.createElement('span'); sub.textContent = shortArea(c.area); el.appendChild(sub);
  const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([prep.lng0, prep.lat0]).addTo(map);
  const m = { id, name: c.name, area: c.area, color: SIZE_COLORS.find((col) => !movers.some((x) => x.color === col)), ...prep, lng: prep.lng0, lat: prep.lat0, marker };
  m.geom = placeAt(m, m.lng, m.lat);
  movers.push(m);
  if (!quiet) { pushMovers(); renderSizePanel(); }
  return m;
}
function removeMover(id) {
  const i = movers.findIndex((x) => x.id === id); if (i < 0) return;
  movers[i].marker.remove(); movers.splice(i, 1); pushMovers();
}
function clearMovers() { movers.forEach((x) => x.marker.remove()); movers.length = 0; pushMovers(); renderSizePanel(); }
function resetMovers() { for (const m of movers) { m.lng = m.lng0; m.lat = m.lat0; m.geom = placeAt(m, m.lng, m.lat); } pushMovers(); }
function fitMovers() {
  if (!movers.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const mv of movers) { // main body of each country only, so far-away islands do not zoom the view out
    let best = null, bestA = -1;
    for (const poly of mv.geom) {
      let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
      for (const [lo, la] of poly[0]) { a0 = Math.min(a0, lo); a1 = Math.max(a1, lo); b0 = Math.min(b0, la); b1 = Math.max(b1, la); }
      if ((a1 - a0) * (b1 - b0) > bestA) { bestA = (a1 - a0) * (b1 - b0); best = [a0, b0, a1, b1]; }
    }
    x0 = Math.min(x0, best[0]); y0 = Math.min(y0, best[1]); x1 = Math.max(x1, best[2]); y1 = Math.max(y1, best[3]);
  }
  map.fitBounds([[x0, y0], [x1, y1]], { padding: viewPadding(), maxZoom: 6, duration: 900 });
}
function compare(a, b) { // a stays where it is, b is dropped on top of it
  clearMovers();
  const A = addMover(a, true), B = addMover(b, true);
  if (A && B) { B.lng = A.lng0; B.lat = A.lat0; B.geom = placeAt(B, B.lng, B.lat); }
  pushMovers(); renderSizePanel(); fitMovers();
}

function pushMovers() {
  moversFrame = 0;
  if (drag) drag.m.geom = placeAt(drag.m, drag.m.lng, drag.m.lat);
  const order = drag ? movers.filter((x) => x !== drag.m).concat(drag.m) : movers; // the one you hold is drawn on top
  map.getSource('movers').setData({
    type: 'FeatureCollection',
    features: order.map((x) => ({ type: 'Feature', properties: { id: x.id, color: x.color }, geometry: { type: 'MultiPolygon', coordinates: x.geom } })),
  });
  for (const x of movers) x.marker.setLngLat([x.lng, x.lat]);
  renderRows();
}
const schedulePush = () => { if (!moversFrame) moversFrame = requestAnimationFrame(pushMovers); };

function startDrag(e) {
  const f = e.features && e.features[0]; if (!f) return;
  const m = movers.find((x) => x.id === f.properties.id); if (!m) return;
  e.preventDefault(); // keeps the map itself from panning
  drag = { m, cLng: e.lngLat.lng, cLat: e.lngLat.lat, lng0: m.lng, lat0: m.lat };
  map.getCanvas().style.cursor = 'grabbing';
}
function moveDrag(e) {
  if (!drag) return;
  drag.m.lng = drag.lng0 + (e.lngLat.lng - drag.cLng);
  drag.m.lat = Math.max(-84, Math.min(84, unmerc(merc(drag.lat0) + merc(e.lngLat.lat) - merc(drag.cLat))));
  schedulePush();
}
function endDrag() {
  if (!drag) return;
  drag = null; map.getCanvas().style.cursor = '';
  pushMovers();
}
map.on('mousedown', 'movers-fill', startDrag);
map.on('touchstart', 'movers-fill', (e) => { if (e.points.length === 1) startDrag(e); });
map.on('mousemove', moveDrag);
map.on('touchmove', moveDrag);
map.on('mouseup', endDrag);
map.on('touchend', endDrag);
window.addEventListener('mouseup', endDrag);

// ---- the side panel ----
function stretchNote(m) {
  const k = 1 / Math.pow(Math.cos(Math.min(84, Math.abs(m.lat)) * RAD), 2); // how much Mercator inflates areas here
  return k >= 1.15 ? `Drawn about ${k.toFixed(1)}× bigger than real at this latitude` : 'Close to its real size here';
}
function rowHtml(m, i) {
  let vs = '';
  if (i > 0 && movers[0].area && m.area) {
    const r = m.area / movers[0].area;
    vs = (r >= 1 ? `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}× bigger than ` : `${(1 / r).toFixed(1)}× smaller than `) + esc(movers[0].name) + '. ';
  }
  return `<div class="mrow"><i style="background:${m.color}"></i><div class="t"><b>${esc(m.name)}</b> <span class="muted">${esc(shortArea(m.area))}</span>
    <small>${vs}${stretchNote(m)}</small></div><button data-rm="${m.id}" aria-label="Remove ${esc(m.name)}">✕</button></div>`;
}
function renderRows() {
  const el = $('#mrows'); if (!el) return;
  el.innerHTML = movers.length ? movers.map(rowHtml).join('') : '<p>No countries yet. Click one on the map, search for one, or try an example above.</p>';
}
function renderSizePanel() {
  $('#sizepanel').innerHTML = `<div class="mh"><h2>Real size</h2><button id="mclose" aria-label="Close">✕</button></div>
    <p>Click a country to add it, then <b>hold and drag</b> it anywhere. This map stretches countries near the poles, so a country dragged toward the equator shrinks to its true size.</p>
    <div class="chips">${EXAMPLES.map(([a, b, t]) => `<button data-ex="${a}-${b}">${t}</button>`).join('')}</div>
    <div id="mmsg" class="note" hidden></div><div id="mrows"></div>
    <div class="chips"><button id="mreset">Reset positions</button><button id="mclear">Clear all</button></div>`;
  renderRows();
}
$('#sizepanel').addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.rm) removeMover(t.dataset.rm);
  else if (t.dataset.ex) { const [a, b] = t.dataset.ex.split('-'); compare(a, b); }
  else if (t.id === 'mreset') resetMovers();
  else if (t.id === 'mclear') clearMovers();
  else if (t.id === 'mclose') setSizeMode(false);
});
function setSizeMode(on) {
  if (on && timeMode) setTimeMode(false);
  sizeMode = on;
  $('#sizebtn').classList.toggle('on', on);
  $('#sizepanel').hidden = !on;
  if (on) closePanel();
  for (const id of ['movers-fill', 'movers-line']) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  for (const x of movers) x.marker.getElement().style.display = on ? '' : 'none';
  if (on) renderSizePanel();
  labelSig = ''; updateLabels();
}
$('#sizebtn').addEventListener('click', () => setSizeMode(!sizeMode));

// ---------- Time zones button (left side of the map) ----------
let lastTimeKey = '';
function updateTimeLabels(force) { // the clock under each country name (changes once a minute)
  const key = Math.floor(Date.now() / 60000) + '|' + timeMode;
  if (!force && key === lastTimeKey) return;
  lastTimeKey = key;
  for (const L of labels) {
    if (!L.tz) continue;
    if (timeMode) {
      if (!L.tm) { L.tm = document.createElement('span'); L.tm.className = 'tm'; L.el.appendChild(L.tm); }
      L.tm.textContent = tzText(L.tz, 'hm');
    } else if (L.tm) { L.tm.remove(); L.tm = null; }
  }
}
function setTimeMode(on) {
  if (on && sizeMode) setSizeMode(false);
  timeMode = on;
  document.body.classList.toggle('timemode', on);
  const tt = $('#country-time-toggle');
  if (tt) { tt.classList.toggle('on', on); tt.setAttribute('aria-pressed', String(on)); tt.textContent = on ? 'Hide country times' : 'Show country times'; }
  if (on && !labelsOn) { labelsOn = true; $('#names').classList.add('on'); }
  updateTimeLabels(true); labelSig = ''; updateLabels();
}
setInterval(() => { // every second: clocks in the country window
  document.querySelectorAll('[data-tz]').forEach((el) => { el.textContent = tzText(el.dataset.tz, el.dataset.k || 'hm'); });
  document.querySelectorAll('[data-tzday]').forEach((el) => { el.textContent = tzText(el.dataset.tzday, 'day'); });
  updateTimeLabels();
}, 1000);

// ---------- search ----------
const input = $('#search'), results = $('#results');
let act = -1, matches = [];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
input.addEventListener('input', () => {
  const q = norm(input.value.trim()); act = -1;
  matches = q ? list.filter((c) => norm(c.name).includes(q) || (c.capital && norm(c.capital).includes(q))).slice(0, 8) : [];
  results.innerHTML = matches.map((c, i) => `<li data-i="${i}">${c.flag} ${c.name}${c.capital ? ` <span class="muted">· ${c.capital}</span>` : ''}</li>`).join('');
});
const pick = (c) => {
  input.value = ''; results.innerHTML = '';
  if (sizeMode) { if (addMover(c.id)) flyTo(c.id); return; }
  openCountry(c.id);
};
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
window.__app = { map, countries, list, recolor, applyView, setView, isDark, openCountry, labels, addMover, movers, setTimeMode, get timeMode() { return timeMode; }, tzData, tzText, get cities() { return cities; }, get view() { return view; }, get mapTheme() { return mapTheme; }, statsHook: null }; // handy for testing
map.on('load', () => setTimeMode(true)); // live country times are on by default
