// Distance & measure: a small window to measure the distance between two or more places.
// "Straight line" is the shortest way over the Earth (as a bird flies) and needs no internet.
// Walking, cycling and driving follow real roads, using the free OpenStreetMap routing servers.
// Trains have no free route service, so the train figure is an estimate (straight line plus a typical detour, at a typical speed).
import * as maplibregl from 'maplibre-gl';

while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app, map = app.map;
const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fmt = (n, d = 0) => Number(n).toLocaleString('en', { maximumFractionDigits: d });
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r, h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

const MODES = {
  line: { icon: '📏', name: 'Straight line', speed: 0 },
  foot: { icon: '🚶', name: 'Walk', speed: 5, detour: 1.25, url: 'routed-foot' },
  bike: { icon: '🚲', name: 'Bike', speed: 15, detour: 1.25, url: 'routed-bike' },
  car: { icon: '🚗', name: 'Car', speed: 70, detour: 1.3, url: 'routed-car' },
  train: { icon: '🚆', name: 'Train', speed: 95, detour: 1.2 },
};
let mode = 'line', unit = (() => { try { return localStorage.getItem('we-unit') || 'km'; } catch { return 'km'; } })();
let pts = [], adding = false, active = false, seq = 0;
const routes = new Map(); // "mode|a|b" -> { km, min, coords, est }

const dist = (k) => (unit === 'mi' ? (k * 0.621371 < 0.19 ? `${fmt(k * 3280.84)} ft` : `${fmt(k * 0.621371, k < 10 ? 2 : 1)} mi`) : (k < 1 ? `${fmt(k * 1000)} m` : `${fmt(k, k < 10 ? 2 : 1)} km`));
const dur = (min) => { min = Math.round(min); if (min < 1) return '< 1 min'; const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60; return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`; };

// ---------- the window ----------
const host = $('#cityfloat') || document.querySelector('main');
const win = document.createElement('section'); win.id = 'measure'; win.hidden = true; win.setAttribute('aria-label', 'Distance and measure');
win.innerHTML = `<header><span class="g" aria-hidden="true">⠿</span><b>📐 Distance &amp; measure</b><button type="button" data-a="x" title="Close" aria-label="Close">✕</button></header>
  <div class="ms-body">
  <div class="ms-modes" role="group" aria-label="How do you travel">${Object.entries(MODES).map(([k, m]) => `<button type="button" data-m="${k}" title="${m.name}"><span>${m.icon}</span><small>${m.name}</small></button>`).join('')}</div>
  <div class="ms-add"><input type="search" id="ms-find" placeholder="Add a place: city or address…" autocomplete="off" aria-label="Add a place"><ul class="cc-res" id="ms-res"></ul></div>
  <div class="ms-tools"><button type="button" id="ms-pick" aria-pressed="false">📍 Click the map to add points</button><button type="button" id="ms-unit" title="Switch kilometres and miles"></button><button type="button" id="ms-clear" title="Remove all points">🗑</button></div>
  <ol id="ms-pts" class="ms-pts"></ol>
  <div id="ms-out" class="ms-out"></div>
  </div>`;
host.append(win);
win.style.left = '70px'; win.style.top = '16px';
let z = 30;
(function drag() {
  const h = $('header', win); let on = false, sx, sy, ox, oy; h.style.touchAction = 'none';
  h.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; on = true; sx = e.clientX; sy = e.clientY; ox = win.offsetLeft; oy = win.offsetTop; h.setPointerCapture(e.pointerId); win.style.zIndex = ++z; });
  h.addEventListener('pointermove', (e) => { if (!on) return; const p = win.parentElement; win.style.left = Math.max(0, Math.min(p.clientWidth - 80, ox + e.clientX - sx)) + 'px'; win.style.top = Math.max(0, Math.min(p.clientHeight - 40, oy + e.clientY - sy)) + 'px'; });
  h.addEventListener('pointerup', () => { on = false; }); h.addEventListener('pointercancel', () => { on = false; });
})();

// ---------- the line and the numbered markers on the map ----------
const SRC = 'measure-src';
function ensureLayers() {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'measure-casing', type: 'line', source: SRC, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': 7, 'line-opacity': 0.5 } });
  map.addLayer({ id: 'measure-line', type: 'line', source: SRC, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['case', ['get', 'est'], '#ffd166', '#52d6ff'], 'line-width': 3.5, 'line-dasharray': ['case', ['get', 'est'], ['literal', [2, 1.6]], ['literal', [1, 0]]] } });
}
const markers = [];
function draw() {
  if (!map.isStyleLoaded() && !map.getSource(SRC)) { map.once('idle', draw); return; }
  ensureLayers();
  const feats = [];
  for (let i = 1; i < pts.length; i++) {
    const r = routes.get(key(i - 1, i));
    const coords = mode !== 'line' && r?.coords ? r.coords : arc(pts[i - 1], pts[i]);
    feats.push({ type: 'Feature', properties: { est: mode === 'train' || (mode !== 'line' && !r?.coords) }, geometry: { type: 'LineString', coordinates: coords } });
  }
  map.getSource(SRC).setData({ type: 'FeatureCollection', features: feats });
  markers.splice(0).forEach((m) => m.remove());
  pts.forEach((p, i) => {
    const el = document.createElement('div'); el.className = 'ms-pin'; el.textContent = String.fromCharCode(65 + i); el.title = p.name;
    markers.push(new maplibregl.Marker({ element: el, draggable: true }).setLngLat([p.lng, p.lat]).addTo(map));
    markers[i].on('dragend', () => { const l = markers[i].getLngLat(); pts[i] = { name: `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`, lat: l.lat, lng: l.lng }; update(); });
  });
}
// a curved line on the globe (shortest path), cut into small steps so it looks right on the flat map
function arc(a, b) {
  const r = Math.PI / 180, d = km(a, b), n = Math.max(2, Math.min(80, Math.ceil(d / 100))), out = [];
  const [p1, l1, p2, l2] = [a.lat * r, a.lng * r, b.lat * r, b.lng * r], dd = d / 6371;
  if (!dd) return [[a.lng, a.lat], [b.lng, b.lat]];
  let prev = a.lng;
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * dd) / Math.sin(dd), B = Math.sin(f * dd) / Math.sin(dd);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z2 = A * Math.sin(p1) + B * Math.sin(p2);
    let lng = Math.atan2(y, x) / r; const lat = Math.atan2(z2, Math.hypot(x, y)) / r;
    while (lng - prev > 180) lng -= 360; while (lng - prev < -180) lng += 360; prev = lng; out.push([lng, lat]);
  }
  return out;
}

// ---------- the numbers ----------
const key = (i, j) => `${mode}|${pts[i].lat.toFixed(4)},${pts[i].lng.toFixed(4)}|${pts[j].lat.toFixed(4)},${pts[j].lng.toFixed(4)}`;
async function route(i, j) {
  const k = key(i, j); if (routes.has(k)) return routes.get(k);
  const m = MODES[mode], a = pts[i], b = pts[j], straight = km(a, b);
  const est = { km: straight * (m.detour || 1), min: (straight * (m.detour || 1) / m.speed) * 60, est: true };
  if (!m.url) { routes.set(k, est); return est; }
  try {
    const u = `https://routing.openstreetmap.de/${m.url}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const r = await fetch(u); if (!r.ok) throw new Error(); const j2 = await r.json(); const x = j2.routes?.[0]; if (!x) throw new Error();
    const res = { km: x.distance / 1000, min: x.duration / 60, coords: x.geometry.coordinates, est: false };
    routes.set(k, res); return res;
  } catch { return { ...est, failed: true }; } // not stored, so it tries again later
}
async function update() {
  const mine = ++seq;
  renderPoints(); draw();
  const out = $('#ms-out', win);
  if (pts.length < 2) { out.innerHTML = '<p class="muted">Add at least two places to see the distance.</p>'; return; }
  out.innerHTML = '<p class="muted">Working it out…</p>';
  const legs = []; for (let i = 1; i < pts.length; i++) legs.push(mode === 'line' ? { km: km(pts[i - 1], pts[i]), est: false } : await route(i - 1, i));
  if (mine !== seq) return;
  const m = MODES[mode], tot = legs.reduce((s, l) => s + l.km, 0), mins = legs.reduce((s, l) => s + (l.min || 0), 0), anyEst = mode !== 'line' && legs.some((l) => l.est), failed = legs.some((l) => l.failed);
  const straightTot = pts.slice(1).reduce((s, p, i) => s + km(pts[i], p), 0);
  out.innerHTML = `<div class="ms-total"><div><small>${m.icon} ${m.name}${pts.length > 2 ? ' · total' : ''}</small><b>${dist(tot)}</b></div>${mode !== 'line' ? `<div><small>Travel time</small><b>${dur(mins)}</b></div>` : ''}</div>
    ${pts.length > 2 ? `<ul class="ms-legs">${legs.map((l, i) => `<li><span>${String.fromCharCode(65 + i)} → ${String.fromCharCode(66 + i)}</span><b>${dist(l.km)}</b>${mode !== 'line' ? `<em>${dur(l.min)}</em>` : ''}</li>`).join('')}</ul>` : ''}
    ${mode !== 'line' ? `<p class="muted ms-sub">Straight line: ${dist(straightTot)}</p>` : ''}
    ${anyEst ? `<p class="ms-warn">${mode === 'train' ? 'Train figures are an estimate: there is no free train-route service, so this uses the straight line plus a typical detour at about 95 km/h.' : failed ? 'Could not reach the road-route service, so this is an estimate (straight line plus a typical detour).' : 'Estimate.'}</p>` : ''}`;
  // redraw once the real road shapes arrived
  draw();
}
function renderPoints() {
  $('#ms-pts', win).innerHTML = pts.map((p, i) => `<li><span class="ms-l">${String.fromCharCode(65 + i)}</span><i title="${esc(p.name)}">${esc(p.name)}</i><span class="ms-b"><button type="button" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" data-dn="${i}" ${i < pts.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button type="button" data-rm="${i}" aria-label="Remove">✕</button></span></li>`).join('');
  win.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  $('#ms-unit', win).textContent = unit === 'km' ? 'km' : 'mi';
}
const addPoint = (p) => { if (pts.length >= 10) pts.shift(); pts.push({ name: p.name, lat: +p.lat, lng: +p.lng }); update(); };

// ---------- searching for places ----------
let timer = 0, items = [];
$('#ms-find', win).addEventListener('input', () => {
  const q = $('#ms-find', win).value.trim(), out = $('#ms-res', win); clearTimeout(timer);
  if (q.length < 2) { out.innerHTML = ''; return; }
  const n = norm(q);
  const local = (app.cities || []).filter((c) => norm(c.name).includes(n)).sort((a, b) => (norm(b.name).startsWith(n) - norm(a.name).startsWith(n)) || b.pop - a.pop).slice(0, 5)
    .map((c) => ({ name: `${c.name}, ${app.countries[c.cc]?.name || ''}`.replace(/, $/, ''), lat: c.lat, lng: c.lng }));
  const draw2 = (list, note) => { items = list; out.innerHTML = list.map((c, i) => `<li data-i="${i}">📍 <b>${esc(c.name)}</b></li>`).join('') + (note ? `<li class="note">${esc(note)}</li>` : ''); };
  draw2(local, q.length > 2 ? 'Searching the world…' : '');
  if (q.length < 3) return;
  timer = setTimeout(async () => {
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`); const j = await r.json();
      const on = (j.results || []).map((x) => ({ name: [x.name, x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lng: x.longitude })).filter((x) => !local.some((l) => km(l, x) < 15));
      if ($('#ms-find', win).value.trim() === q) draw2([...local, ...on], local.length + on.length ? '' : 'No place found.');
    } catch { if ($('#ms-find', win).value.trim() === q) draw2(local, local.length ? '' : 'Could not search online right now.'); }
  }, 350);
});
$('#ms-res', win).addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (!li) return; const c = items[li.dataset.i]; clearTimeout(timer); $('#ms-res', win).innerHTML = ''; $('#ms-find', win).value = ''; addPoint(c); fit(); });
$('#ms-find', win).addEventListener('keydown', (e) => { if (e.key === 'Enter' && items.length) { e.preventDefault(); const c = items[0]; clearTimeout(timer); $('#ms-res', win).innerHTML = ''; $('#ms-find', win).value = ''; addPoint(c); fit(); } });
function fit() { if (!pts.length) return; if (pts.length === 1) { map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: Math.max(map.getZoom(), 6) }); return; } const b = new maplibregl.LngLatBounds(); pts.forEach((p) => b.extend([p.lng, p.lat])); map.fitBounds(b, { padding: { top: 100, bottom: 100, left: 120, right: 120 }, maxZoom: 12, duration: 900 }); }

// ---------- clicks ----------
const setPick = (on) => { adding = on; window.__measuring = active && on; const b = $('#ms-pick', win); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); map.getCanvas().style.cursor = on ? 'crosshair' : ''; };
map.on('click', (e) => { if (!active || !adding) return; addPoint({ name: `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`, lat: e.lngLat.lat, lng: e.lngLat.lng }); });
win.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.a === 'x') setOpen(false);
  if (b.dataset.m) { mode = b.dataset.m; update(); }
  if (b.id === 'ms-pick') setPick(!adding);
  if (b.id === 'ms-unit') { unit = unit === 'km' ? 'mi' : 'km'; try { localStorage.setItem('we-unit', unit); } catch {} window.dispatchEvent(new CustomEvent('units-change', { detail: { dist: unit, temp: window.__units?.temp || 'C' } })); if (window.__units) window.__units.dist = unit; update(); }
  if (b.id === 'ms-clear') { pts = []; update(); }
  if (b.dataset.rm != null) { pts.splice(+b.dataset.rm, 1); update(); }
  if (b.dataset.up != null) { const i = +b.dataset.up; [pts[i - 1], pts[i]] = [pts[i], pts[i - 1]]; update(); }
  if (b.dataset.dn != null) { const i = +b.dataset.dn; [pts[i + 1], pts[i]] = [pts[i], pts[i + 1]]; update(); }
});

// ---------- the switch in the Layers menu ----------
const btn = $('#measurebtn');
function setOpen(on) {
  active = on; win.hidden = !on; btn.classList.toggle('on', on); win.style.zIndex = ++z;
  if (on) { setPick(true); update(); } else { setPick(false); markers.splice(0).forEach((m) => m.remove()); if (map.getSource(SRC)) map.getSource(SRC).setData({ type: 'FeatureCollection', features: [] }); }
}
btn.addEventListener('click', () => setOpen(!active));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active && !win.hidden && document.activeElement?.id !== 'ms-find' && !document.querySelector('#gamewin:not([hidden])')) { if (adding) setPick(false); } });
window.addEventListener('units-change', (e) => { if (e.detail.dist !== unit) { unit = e.detail.dist; update(); } });
renderPoints();
window.__measure = { open: () => setOpen(true), close: () => setOpen(false), add: addPoint, setMode(m) { mode = m; update(); }, get points() { return pts; } };
