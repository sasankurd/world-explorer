// Live flights: planes moving on the map, with where each one is going and when it should land.
// Positions: OpenSky Network (free, anonymous). Route (from and to airports) and airline: adsbdb.com.
// The landing time is an estimate worked out here: distance left divided by the plane's ground speed.
import * as maplibregl from 'maplibre-gl';

while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const { map, countries } = app;
const $ = (s) => document.querySelector(s);
const btn = $('#flightbtn'), wrap = $('#flights'), card = $('#flightcard'), stat = $('#fl-stat');

const OPENSKY = 'https://opensky-network.org/api/states/all';
const ADSBDB = 'https://api.adsbdb.com/v0/callsign/';
const MIN_GAP = 12000;   // OpenSky's free service updates every 10 s; we never ask more often than this
const EVERY = 25000;     // how often we ask while the layer is on
const DRAW_EVERY = 1500; // how often planes are moved on the map

let on = false, planes = new Map(), selected = null, lastCall = 0, lastBox = null, timer = 0, drawTimer = 0, busyUntil = 0, polling = false;
const routes = new Map(); // callsign -> Promise<route|null>
let markers = [];

// ---------- small maths helpers ----------
const R = 6371, rad = Math.PI / 180;
function dist(a, b) { // great-circle distance in km, points are [lng, lat]
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a, b) {
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad);
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
function advance(p, km, brg) { // where you end up after travelling km on a bearing
  const d = km / R, t = brg * rad, la = p[1] * rad, lo = p[0] * rad;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(t));
  const lo2 = lo + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [((lo2 / rad + 540) % 360) - 180, la2 / rad];
}
function arcPts(a, b, n = 48) { // points along the great circle from a to b, as a line that does not jump over the date line
  const d = dist(a, b) / R; if (d < 1e-6) return [a, b];
  const f = (t) => {
    const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(a[1] * rad) * Math.cos(a[0] * rad) + B * Math.cos(b[1] * rad) * Math.cos(b[0] * rad);
    const y = A * Math.cos(a[1] * rad) * Math.sin(a[0] * rad) + B * Math.cos(b[1] * rad) * Math.sin(b[0] * rad);
    const z = A * Math.sin(a[1] * rad) + B * Math.sin(b[1] * rad);
    return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad];
  };
  const out = []; let prev = null;
  for (let i = 0; i <= n; i++) {
    const p = f(i / n);
    if (prev !== null) while (p[0] - prev > 180) p[0] -= 360; // keep the longitudes continuous
    if (prev !== null) while (p[0] - prev < -180) p[0] += 360;
    prev = p[0]; out.push(p);
  }
  return out;
}

// ---------- time helpers (the browser knows summer/winter time) ----------
function zoneOffsetMin(zone, d) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const p = {}; for (const x of f.formatToParts(d)) p[x.type] = x.value;
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  } catch { return 0; }
}
const hm = (d, zone) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(zone ? { timeZone: zone } : {}) }).format(d);
const dayOf = (d, zone) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(zone ? { timeZone: zone } : {}) }).format(d);
function zoneFor(airport) { // the time zone at an airport: its country's zone, or the best fit when the country has several
  const c = Object.values(countries).find((x) => x.iso2 === airport.country_iso_name);
  const list = c && app.tzData[c.id]; if (!list || !list.length) return null;
  if (list.length === 1) return { zone: list[0], exact: true };
  const want = airport.longitude / 15 * 60, now = new Date();
  const best = list.map((z) => [z, Math.abs(zoneOffsetMin(z, now) - want)]).sort((a, b) => a[1] - b[1])[0][0];
  return { zone: best, exact: false };
}
function span(min) {
  const m = Math.max(0, Math.round(min)), h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

// ---------- the plane picture (drawn in code so no image file is needed) ----------
function planeImage(fill, edge) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.beginPath();
  [[32, 3], [36, 22], [60, 38], [60, 44], [36, 36], [35, 52], [44, 58], [44, 62], [32, 58], [20, 62], [20, 58], [29, 52], [28, 36], [4, 44], [4, 38], [28, 22]].forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
  x.closePath(); x.fillStyle = fill; x.fill(); x.lineWidth = 3; x.strokeStyle = edge; x.lineJoin = 'round'; x.stroke();
  return x.getImageData(0, 0, 64, 64);
}
const iconFor = () => (app.isDark() ? 'plane-dark' : 'plane-light');

function ensureLayers() {
  if (map.getSource('planes')) return;
  const empty = { type: 'FeatureCollection', features: [] };
  map.addImage('plane-dark', planeImage('#7fe3ff', '#02131c'));
  map.addImage('plane-light', planeImage('#0a4a8a', '#ffffff'));
  map.addSource('planes', { type: 'geojson', data: empty });
  map.addSource('flightroute', { type: 'geojson', data: empty });
  map.addSource('plane-sel', { type: 'geojson', data: empty });
  map.addLayer({ id: 'route-left', type: 'line', source: 'flightroute', filter: ['==', ['get', 'k'], 'rest'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffb347', 'line-width': 2, 'line-dasharray': [1.5, 2], 'line-opacity': 0.95 } });
  map.addLayer({ id: 'route-done', type: 'line', source: 'flightroute', filter: ['==', ['get', 'k'], 'done'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#52d6ff', 'line-width': 2.6, 'line-opacity': 0.9 } });
  map.addLayer({ id: 'plane-ring', type: 'circle', source: 'plane-sel', paint: { 'circle-radius': 16, 'circle-color': 'rgba(255,255,255,0)', 'circle-stroke-color': '#ffb347', 'circle-stroke-width': 2 } });
  map.addLayer({
    id: 'planes', type: 'symbol', source: 'planes',
    layout: {
      'icon-image': iconFor(), 'icon-rotate': ['get', 'hd'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.2, 3, 0.3, 6, 0.46, 9, 0.62],
    },
  });
  map.on('mouseenter', 'planes', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'planes', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'planes', (e) => { const f = e.features[0]; if (f) select(f.properties.id); });
  map.on('click', (e) => { // click on empty map: drop the selection
    if (selected && !map.queryRenderedFeatures(e.point, { layers: ['planes'] }).length) deselect();
  });
}
function setTheme() { if (map.getLayer('planes')) map.setLayoutProperty('planes', 'icon-image', iconFor()); }
window.addEventListener('maptheme-change', setTheme);
window.addEventListener('view-change', setTheme);

// ---------- where a plane is right now (moved on from its last report) ----------
function nowPos(p, t = Date.now()) {
  const dt = Math.min(150, Math.max(0, t / 1000 - p.t0));
  if (!(p.v > 0) || dt <= 0) return [p.lng, p.lat];
  return advance([p.lng, p.lat], (p.v * dt) / 1000, p.hd);
}
function draw() {
  if (!on || !map.getSource('planes')) return;
  const t = Date.now(), feats = [];
  for (const p of planes.values()) {
    const pos = nowPos(p, t);
    feats.push({ type: 'Feature', properties: { id: p.id, hd: p.hd }, geometry: { type: 'Point', coordinates: pos } });
  }
  map.getSource('planes').setData({ type: 'FeatureCollection', features: feats });
  if (selected && planes.has(selected)) {
    const pos = nowPos(planes.get(selected), t);
    map.getSource('plane-sel').setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pos } });
    drawRoute();
  }
}

// ---------- asking OpenSky ----------
const say = (t, bad) => { stat.textContent = t; stat.classList.toggle('bad', !!bad); };
function boxNow() {
  const b = map.getBounds(), w = b.getEast() - b.getWest();
  if (w >= 340 || map.getZoom() < 2.2) return null; // whole world
  const clampLat = (v) => Math.max(-90, Math.min(90, v));
  let west = b.getWest(), east = b.getEast();
  if (west < -180 || east > 180) return null; // across the date line: ask for everything
  return { lamin: clampLat(b.getSouth()).toFixed(2), lamax: clampLat(b.getNorth()).toFixed(2), lomin: west.toFixed(2), lomax: east.toFixed(2) };
}
function covered(box) { // is the new view inside what we already asked for?
  if (!lastBox) return false;
  if (lastBox === 'world') return true;
  if (!box) return false;
  return +box.lamin >= +lastBox.lamin && +box.lamax <= +lastBox.lamax && +box.lomin >= +lastBox.lomin && +box.lomax <= +lastBox.lomax;
}
async function poll(force) {
  if (!on || polling || document.hidden) return;
  const now = Date.now();
  if (now < busyUntil) return;
  if (!force && now - lastCall < MIN_GAP) return;
  polling = true; lastCall = now;
  const box = boxNow();
  // ask for a slightly bigger area than the screen so small pans do not need a new request
  let url = OPENSKY, asked = 'world';
  if (box) {
    const padLat = (+box.lamax - +box.lamin) * 0.25, padLng = (+box.lomax - +box.lomin) * 0.25;
    asked = { lamin: Math.max(-90, +box.lamin - padLat), lamax: Math.min(90, +box.lamax + padLat), lomin: Math.max(-180, +box.lomin - padLng), lomax: Math.min(180, +box.lomax + padLng) };
    url += '?' + new URLSearchParams(Object.fromEntries(Object.entries(asked).map(([k, v]) => [k, (+v).toFixed(2)])));
  }
  try {
    const r = await fetch(url);
    if (r.status === 429) {
      const wait = +r.headers.get('X-Rate-Limit-Retry-After-Seconds') || 3600;
      busyUntil = Date.now() + wait * 1000;
      say(`OpenSky's free daily limit is used up. Try again in about ${span(wait / 60)}. Planes shown are the last ones received.`, true);
      return;
    }
    if (!r.ok) throw new Error('OpenSky answered ' + r.status);
    const j = await r.json();
    const next = new Map();
    for (const s of j.states || []) {
      if (s[8] || s[5] == null || s[6] == null) continue; // on the ground, or no position
      next.set(s[0], { id: s[0], call: (s[1] || '').trim(), country: s[2], t0: s[3] || j.time, lng: s[5], lat: s[6], alt: s[13] ?? s[7], v: s[9] || 0, hd: s[10] || 0, vr: s[11] || 0 });
    }
    if (selected && !next.has(selected) && planes.has(selected)) next.set(selected, planes.get(selected)); // keep the one you are following
    planes = next; lastBox = asked;
    say(`${planes.size.toLocaleString('en')} planes in the air${box ? ' in this area' : ' worldwide'} · updated ${hm(new Date())}`);
    draw();
    if (selected && !planes.has(selected)) deselect();
  } catch (e) {
    say(`Could not load live flights (${e.message}). Check your connection; the free service sometimes pauses.`, true);
  } finally { polling = false; }
}
function startTimers() {
  clearInterval(timer); clearInterval(drawTimer);
  timer = setInterval(() => poll(false), EVERY);
  drawTimer = setInterval(() => { draw(); if (selected) renderCard(false); }, DRAW_EVERY);
}
let moveT = 0;
map.on('moveend', () => {
  if (!on) return;
  clearTimeout(moveT);
  moveT = setTimeout(() => { if (!covered(boxNow())) poll(false); }, 1500);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && on) poll(false); });

// ---------- route and airline from adsbdb ----------
function getRoute(call) {
  if (!call) return Promise.resolve(null);
  if (routes.has(call)) return routes.get(call);
  const p = fetch(ADSBDB + encodeURIComponent(call)).then(async (r) => {
    if (!r.ok) return null; // 404 = unknown flight number
    const j = await r.json(); const f = j?.response?.flightroute;
    return f && f.origin && f.destination ? f : null;
  }).catch(() => undefined);
  const q = p.then((v) => { if (v === undefined) routes.delete(call); return v ?? null; });
  routes.set(call, q);
  return q;
}

// ---------- selecting a plane ----------
let route = null, routeState = 'idle'; // idle | loading | found | none
function select(id) {
  if (!planes.has(id)) return;
  selected = id; route = null; routeState = 'loading';
  clearMarkers(); wrap.hidden = false; card.hidden = false;
  renderCard(true);
  const p = planes.get(id);
  getRoute(p.call).then((f) => {
    if (selected !== id) return;
    route = f; routeState = f ? 'found' : 'none';
    if (f) addMarkers(f);
    renderCard(true); drawRoute();
  });
  draw();
}
function deselect() {
  selected = null; route = null; routeState = 'idle'; card.hidden = true; clearMarkers();
  for (const s of ['plane-sel', 'flightroute']) map.getSource(s)?.setData({ type: 'FeatureCollection', features: [] });
}
function clearMarkers() { markers.forEach((m) => m.remove()); markers = []; }
function addMarkers(f) {
  for (const [a, cls] of [[f.origin, 'from'], [f.destination, 'to']]) {
    const el = document.createElement('div'); el.className = 'apt ' + cls; el.textContent = a.iata_code || a.icao_code;
    el.title = `${a.name}, ${a.municipality}`;
    markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([a.longitude, a.latitude]).addTo(map));
  }
}
function drawRoute() {
  const src = map.getSource('flightroute'); if (!src || !selected || !planes.has(selected)) return;
  if (!route) { src.setData({ type: 'FeatureCollection', features: [] }); return; }
  const pos = nowPos(planes.get(selected)), o = [route.origin.longitude, route.origin.latitude], d = [route.destination.longitude, route.destination.latitude];
  const line = (k, pts) => ({ type: 'Feature', properties: { k }, geometry: { type: 'LineString', coordinates: pts } });
  src.setData({ type: 'FeatureCollection', features: [line('done', arcPts(o, pos, 40)), line('rest', arcPts(pos, d, 40))] });
}

// ---------- the flight card ----------
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ft = (m) => Math.round((m * 3.28084) / 100) * 100;
let cardFor = null;
function renderCard(full) {
  const p = planes.get(selected); if (!p) return;
  const pos = nowPos(p), now = new Date();
  const kmh = Math.round(p.v * 3.6), kt = Math.round(p.v * 1.94384);
  const climb = p.vr > 1 ? 'climbing' : p.vr < -1 ? 'descending' : 'level';
  let top = '', body = '';
  const f = route;
  const title = f?.airline?.name ? `${esc(f.airline.name)} <span class="muted">${esc(p.call)}</span>` : esc(p.call || p.id.toUpperCase());
  if (routeState === 'loading') top = '<p class="muted">Looking up where this flight is going…</p>';
  else if (!f) top = `<p class="muted">The route for ${esc(p.call || 'this flight')} is not known (private, military or very new flights are often missing), so there is no landing time.</p>`;
  else {
    const o = f.origin, d = f.destination;
    const left = dist(pos, [d.longitude, d.latitude]), total = dist([o.longitude, o.latitude], [d.longitude, d.latitude]), flown = dist([o.longitude, o.latitude], pos);
    const pct = Math.max(2, Math.min(100, Math.round((flown / Math.max(1, flown + left)) * 100)));
    const mins = p.v > 50 ? (left * 1000) / p.v / 60 : null;
    const eta = mins == null ? null : new Date(now.getTime() + mins * 60000);
    const z = zoneFor(d);
    top = `<div class="fl-route"><div><b>${esc(o.iata_code || o.icao_code)}</b><small>${esc(o.municipality || o.name)}</small></div><span class="fl-arrow">✈</span><div class="r"><b>${esc(d.iata_code || d.icao_code)}</b><small>${esc(d.municipality || d.name)}</small></div></div>
      <div class="fl-bar" role="img" aria-label="${pct}% of the way"><i style="width:${pct}%"></i></div>
      <div class="fl-km"><span>${Math.round(flown).toLocaleString('en')} km flown</span><span>${Math.round(left).toLocaleString('en')} km to go</span></div>
      ${eta ? `<div class="fl-eta"><div class="big">Lands about ${hm(eta)} <small>${dayOf(eta) === dayOf(now) ? 'today' : dayOf(eta)}, your time</small></div>
        <div class="muted">in ${span(mins)}${z ? ` · ${hm(eta, z.zone)} at ${esc(d.municipality || d.name)}${z.exact ? '' : ' (nearest time zone)'}` : ''}</div></div>` : '<p class="muted">Landing time unavailable: the plane is not reporting a speed.</p>'}
      <div class="note">Estimated from the distance left and the current speed. Air traffic control, wind and holding patterns can change it by several minutes.</div>`;
  }
  body = `<div class="fl-stats"><div><small>Height</small><b>${p.alt != null ? ft(p.alt).toLocaleString('en') + ' ft' : '—'}</b></div><div><small>Speed</small><b>${kmh.toLocaleString('en')} km/h</b><em>${kt} knots</em></div><div><small>Heading</small><b>${Math.round(p.hd)}°</b><em>${climb}</em></div></div>
    <div class="muted fl-foot">Registered in ${esc(p.country || 'unknown')} · aircraft code ${esc(p.id.toUpperCase())}</div>`;
  const key = `${selected}|${routeState}`;
  if (full || cardFor !== key) {
    card.innerHTML = `<div class="fl-head"><h3>${title}</h3><button type="button" id="fl-x" aria-label="Close" title="Close">✕</button></div><div id="fl-top"></div><div id="fl-body"></div>`;
    $('#fl-x').onclick = deselect; cardFor = key;
  }
  $('#fl-top').innerHTML = top; $('#fl-body').innerHTML = body;
}

// ---------- the button and the "find a flight" box ----------
function setOn(v) {
  on = v; btn.classList.toggle('on', on);
  if (on) {
    ensureLayers(); wrap.hidden = false; say('Loading live flights…');
    poll(true); startTimers();
  } else {
    clearInterval(timer); clearInterval(drawTimer); deselect(); wrap.hidden = true; planes = new Map(); lastBox = null;
    for (const s of ['planes']) map.getSource(s)?.setData({ type: 'FeatureCollection', features: [] });
  }
}
btn.addEventListener('click', () => setOn(!on));
$('#fl-find').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#fl-q').value.trim().toUpperCase().replace(/\s+/g, ''); if (!q) return;
  const hit = [...planes.values()].find((p) => p.call.toUpperCase() === q || p.id.toUpperCase() === q) || [...planes.values()].find((p) => p.call.toUpperCase().startsWith(q));
  if (!hit) { say(`"${q}" is not among the planes loaded for this view. Zoom out or move the map, then try again.`, true); return; }
  select(hit.id); map.flyTo({ center: nowPos(hit), zoom: Math.max(map.getZoom(), 4.5), duration: 1200 });
});
window.__flights = { get planes() { return planes; }, select, poll, setOn, get on() { return on; }, get selected() { return selected; } };
