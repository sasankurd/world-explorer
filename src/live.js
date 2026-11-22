// Live layers: earthquakes (USGS), fires and storms (NASA EONET) and satellites (CelesTrak orbits), drawn on the flat map and on the 3D globe.
// All feeds are free and need no key. A toggle fetches only when it is switched on.
// satellite.js: its main entry also pulls in a WebAssembly build we do not need, so the plain JavaScript files are imported directly
import { json2satrec } from '../node_modules/satellite.js/dist/io.js';
import { propagate, gstime } from '../node_modules/satellite.js/dist/propagation.js';
import { eciToGeodetic, degreesLong, degreesLat } from '../node_modules/satellite.js/dist/transforms.js';
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const { map } = window.__app;
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUAKES = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const EVENTS = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300&category=wildfires,severeStorms,volcanoes';
const SATS = ['stations', 'visual'].map((g) => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`); // the space stations and about 150 of the brightest satellites
const COLOR = { quake: '#ff6b57', fire: '#ff9f1a', storm: '#5fd0ff', volcano: '#c77dff', sat: '#1fb5ff', cctv: '#b6ff5c', clash: '#ff3b3b', drone: '#ffc233', missile: '#ff4fd8' };
const KIND = { wildfires: 'fire', severeStorms: 'storm', volcanoes: 'volcano' };
const on = { quakes: false, events: false, sats: false, cctv: false, conflict: false }, items = { quakes: [], events: [], sats: [], cctv: [], conflict: [] };
// news-based conflict reports (GDELT, no key): one search per kind, each result is a place with the articles that mention it
const GDELT = (q) => `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(q + ' sourcelang:eng')}&format=geojson&timespan=1d&maxpoints=250`;
const CONFLICT_Q = '(airstrike OR shelling OR bombing OR explosion OR clashes OR drone OR drones OR missile OR rocket OR "armed attack")';
const ICON = { clash: 'Fighting reported', drone: 'Drone activity reported', missile: 'Missile or rocket reported' };
let satRecs = [], satFetched = 0;

const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// where each satellite is right now, worked out from its orbit (SGP4, a standard orbit formula)
function placeSats() {
  const now = new Date(), g = gstime(now), out = [];
  for (const { name, rec } of satRecs) {
    const p = propagate(rec, now); if (!p || !p.position) continue; // a decayed orbit gives no position
    const d = eciToGeodetic(p.position, g), v = Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z);
    out.push({ k: 'sat', lon: degreesLong(d.longitude), lat: degreesLat(d.latitude), h: d.height * 1000, r: 3.5, t: name, s: `Altitude ${Math.round(d.height)} km · ${v.toFixed(1)} km/s` });
  }
  items.sats = out;
}
// public traffic cameras from three official open feeds; one that fails does not stop the others
const get = (u) => fetch(u, { signal: AbortSignal.timeout(20000) }); // a slow feed gives up after 20 s and the others still show
// DATEX II (the European traffic data standard) camera lists: find each latitude, then the smallest block around it that holds a picture link
function parseDatex(xml, label, credit) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml'), out = [];
  for (const la of doc.getElementsByTagNameNS('*', 'latitude')) {
    let n = la.parentElement, link = null;
    while (n && !(link = [...n.getElementsByTagName('*')].find((e) => !e.children.length && /^https?:\/\/\S+$/i.test(e.textContent.trim())))) n = n.parentElement;
    if (!n || n.getElementsByTagNameNS('*', 'latitude').length !== 1) continue; // a block with several cameras means we went too far
    const lon = n.getElementsByTagNameNS('*', 'longitude')[0], name = [...n.getElementsByTagName('*')].find((e) => !e.children.length && /name|descri|identif|^id$/i.test(e.localName) && e.textContent.trim() && !/^https?:/i.test(e.textContent.trim()));
    if (lon) out.push({ lon: +lon.textContent, lat: +la.textContent, t: name?.textContent.trim() || 'Camera', s: `${label} · ${credit}`, img: link.textContent.trim() });
  }
  return out;
}
const CAMS = [
  ['Germany', async () => { // Autobahn GmbH open API: one request per motorway, a few at a time
    const roads = (await (await get('https://verkehr.autobahn.de/o/autobahn')).json()).roads || [], out = new Map();
    for (let i = 0; i < roads.length; i += 10) await Promise.all(roads.slice(i, i + 10).map(async (r) => {
      try { for (const c of (await (await get(`https://verkehr.autobahn.de/o/autobahn/${r.replace(/\//g, '')}/services/webcam`)).json()).webcam || []) if (c.imageurl && c.coordinate) out.set(c.identifier, { lon: +c.coordinate.long, lat: +c.coordinate.lat, t: c.title, s: `Germany · Autobahn ${r}`, img: c.imageurl }); } catch { /* one road failing is fine */ }
    }));
    return [...out.values()];
  }],
  ['Spain', () => get('https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml').then((r) => r.text()).then((x) => parseDatex(x, 'Spain', 'DGT'))],
  ['London', () => get('https://api.tfl.gov.uk/Place/Type/JamCam').then((r) => r.json()).then((a) => a.flatMap((c) => { const prop = (k) => c.additionalProperties?.find((q) => q.key === k)?.value, img = prop('imageUrl'); return img && c.lat ? [{ lon: c.lon, lat: c.lat, t: c.commonName, s: 'London · TfL JamCam', img, vid: prop('videoUrl') }] : []; }))],
  ['Singapore', () => get('https://api.data.gov.sg/v1/transport/traffic-images').then((r) => r.json()).then((j) => (j.items?.[0]?.cameras || []).map((c) => ({ lon: c.location.longitude, lat: c.location.latitude, t: `Camera ${c.camera_id}`, s: 'Singapore · LTA', img: c.image })))],
  ['Finland', () => get('https://tie.digitraffic.fi/api/weathercam/v1/stations').then((r) => r.json()).then((j) => j.features.flatMap((f) => { const id = f.properties.presets?.find((q) => q.inCollection !== false)?.id; return id ? [{ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], t: String(f.properties.name || f.id).replace(/_/g, ' '), s: 'Finland · Fintraffic road cameras', img: `https://weathercam.digitraffic.fi/${id}.jpg` }] : []; }))],
  ['New York', () => get('https://webcams.nyctmc.org/api/cameras').then((r) => r.json()).then((a) => a.filter((c) => c.isOnline !== false && c.latitude).map((c) => ({ lon: c.longitude, lat: c.latitude, t: c.name, s: 'New York · NYC DOT', img: c.imageUrl || `https://webcams.nyctmc.org/api/cameras/${c.id}/image`, vid: c.videoUrl })))],
];
let camNames = [];
async function loadCams() {
  const res = await Promise.allSettled(CAMS.map(([, f]) => f()));
  camNames = CAMS.filter((_, i) => res[i].status === 'fulfilled' && res[i].value.length).map(([n]) => n);
  items.cctv = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter((c) => /^https:\/\//.test(c.img)).map((c) => ({ ...c, k: 'cctv', r: 4 }));
  if (!items.cctv.length) throw new Error('no cameras');
}
async function load(which) {
  if (which === 'conflict') { // one request (GDELT asks for few), sorted into kinds by the words in each place's headlines
    const ask = async (u) => { const r = await get(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
    const viaSite = () => ask(`/api/conflict?q=${encodeURIComponent(CONFLICT_Q)}`), direct = () => ask(GDELT(CONFLICT_Q)); // the site's own step first, GDELT directly as a backup
    let j; try { j = await viaSite(); } catch { try { j = await direct(); } catch { await sleep(6000); j = await direct(); } }
    items.conflict = (j.features || []).map((f) => {
      const d = new DOMParser().parseFromString(f.properties.html || '', 'text/html'), heads = [...d.querySelectorAll('a')].map((a) => a.textContent.trim()).filter(Boolean);
      const n = { missile: 0, drone: 0, clash: 0 }; for (const h of heads) n[/missile|rocket|ballistic/i.test(h) ? 'missile' : /drone|uav/i.test(h) ? 'drone' : 'clash']++;
      const k = n.missile >= n.drone && n.missile >= n.clash && n.missile ? 'missile' : n.drone >= n.clash && n.drone ? 'drone' : 'clash';
      return { k, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], r: 9, t: (f.properties.name || 'Unknown place').slice(0, 70), s: `${ICON[k]} · ${(heads[0] || 'see news').slice(0, 110)} · last 24 h` };
    });
    if (!items.conflict.length) throw new Error('no reports');
    return;
  }
  if (which === 'cctv') { if (!items.cctv.length) await loadCams(); return; }
  if (which === 'sats') {
    if (!satRecs.length || Date.now() - satFetched > 7200000) { // CelesTrak asks for no more than one download every two hours
      const seen = new Set(); satRecs = [];
      for (const u of SATS) for (const o of await (await fetch(u)).json()) { if (seen.has(o.NORAD_CAT_ID)) continue; seen.add(o.NORAD_CAT_ID); try { satRecs.push({ name: o.OBJECT_NAME, rec: json2satrec(o) }); } catch { /* skip a bad record */ } }
      satFetched = Date.now();
    }
    return placeSats();
  }
  if (which === 'quakes') {
    const j = await (await fetch(QUAKES)).json();
    items.quakes = j.features.map((f) => { const m = f.properties.mag ?? 0; return { k: 'quake', lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], r: 3 + Math.max(0, m - 2) * 2.2, t: `Magnitude ${m.toFixed(1)}`, s: `${f.properties.place || 'Unknown place'} · ${ago(f.properties.time)}` }; });
  } else {
    const j = await (await fetch(EVENTS)).json();
    items.events = j.events.flatMap((e) => {
      const g = [...e.geometry].reverse().find((x) => x.type === 'Point'); // storms list a track; the newest point is where it is now
      const k = KIND[e.categories[0]?.id]; if (!g || !k) return [];
      return [{ k, lon: g.coordinates[0], lat: g.coordinates[1], r: k === 'storm' ? 8 : 5.5, t: e.title, s: `${e.categories[0].title} · ${ago(Date.parse(g.date))}` }];
    });
  }
}

// on the 3D Track globe the icons hover above the surface with a soft shadow left on the ground
function float(on) {
  if (!map.getLayer('live-pts')) return;
  map.setLayoutProperty('live-sat', 'symbol-height-offset', on ? ['get', 'h'] : 0); // real altitude only on the globe
  const t = on ? [0, -16] : [0, 0];
  for (const id of ['live-glow', 'live-pts']) { map.setPaintProperty(id, 'circle-translate', t); map.setPaintProperty(id, 'circle-translate-anchor', 'viewport'); }
  map.setPaintProperty('live-ground', 'circle-opacity', on ? 0.55 : 0);
}
window.addEventListener('track-layer', (e) => float(e.detail));

// ---------- flat map ----------
function ensure2d() {
  if (map.getSource('live')) return;
  map.addSource('live', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const col = ['match', ['get', 'k'], 'quake', COLOR.quake, 'fire', COLOR.fire, 'storm', COLOR.storm, 'sat', COLOR.sat, 'cctv', COLOR.cctv, COLOR.volcano];
  map.addLayer({ id: 'live-ground', type: 'circle', source: 'live', paint: { 'circle-radius': ['*', ['get', 'r'], 0.9], 'circle-color': '#000', 'circle-opacity': 0, 'circle-blur': 0.8 } }); // shadow on the ground, shown only while icons float
  map.addLayer({ id: 'live-glow', type: 'circle', source: 'live', filter: ['!', ['in', ['get', 'k'], ['literal', ['sat', 'clash', 'drone', 'missile']]]], paint: { 'circle-radius': ['*', ['get', 'r'], 2], 'circle-color': col, 'circle-opacity': 0.22, 'circle-blur': 0.6 } });
  map.addLayer({ id: 'live-pts', type: 'circle', source: 'live', filter: ['!', ['in', ['get', 'k'], ['literal', ['sat', 'clash', 'drone', 'missile']]]], paint: { 'circle-radius': ['get', 'r'], 'circle-color': col, 'circle-opacity': 0.9, 'circle-stroke-color': '#000', 'circle-stroke-width': 1 } });
  // satellites are symbols so they can sit at their real height above the globe (symbol-height-offset, in metres)
  const c = Object.assign(document.createElement('canvas'), { width: 48, height: 48 }), x = c.getContext('2d'), g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
  g.addColorStop(0, '#fff'); g.addColorStop(0.18, COLOR.sat); g.addColorStop(0.4, 'rgba(31,181,255,.35)'); g.addColorStop(1, 'rgba(31,181,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 48, 48);
  if (!map.hasImage('sat-dot')) map.addImage('sat-dot', x.getImageData(0, 0, 48, 48));
  map.addLayer({ id: 'live-sat', type: 'symbol', source: 'live', filter: ['==', ['get', 'k'], 'sat'], layout: { 'icon-image': 'sat-dot', 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-height-offset': 0 } });
  map.on('click', 'live-sat', (e) => { const p = e.features[0]?.properties; if (p) chip(p.t, p.s, p.k); });
  map.on('mouseenter', 'live-sat', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'live-sat', () => { map.getCanvas().style.cursor = ''; });
  // conflict markers: a dark badge with a coloured rim and a simple pictogram (explosion, drone, rocket)
  for (const k of ['clash', 'drone', 'missile']) {
    const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), c2 = cv.getContext('2d'); c2.translate(32, 32);
    c2.fillStyle = 'rgba(10,10,16,.92)'; c2.strokeStyle = COLOR[k]; c2.lineWidth = 4; c2.beginPath(); c2.arc(0, 0, 27, 0, 7); c2.fill(); c2.stroke();
    c2.fillStyle = c2.strokeStyle = COLOR[k]; c2.lineWidth = 3.5; c2.lineCap = 'round'; c2.lineJoin = 'round';
    if (k === 'clash') { c2.beginPath(); for (let a = 0; a < 16; a++) { const r = a % 2 ? 7 : 17, t = a * Math.PI / 8; c2.lineTo(Math.cos(t) * r, Math.sin(t) * r); } c2.closePath(); c2.fill(); }
    else if (k === 'drone') { c2.beginPath(); c2.moveTo(-11, -11); c2.lineTo(11, 11); c2.moveTo(11, -11); c2.lineTo(-11, 11); c2.stroke(); for (const [x, y] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { c2.beginPath(); c2.arc(x, y, 5, 0, 7); c2.fill(); } c2.beginPath(); c2.arc(0, 0, 5, 0, 7); c2.fill(); }
    else { c2.rotate(Math.PI / 4); c2.beginPath(); c2.moveTo(0, -18); c2.quadraticCurveTo(7, -8, 6, 8); c2.lineTo(-6, 8); c2.quadraticCurveTo(-7, -8, 0, -18); c2.fill(); c2.beginPath(); c2.moveTo(-6, 4); c2.lineTo(-12, 14); c2.lineTo(-6, 11); c2.moveTo(6, 4); c2.lineTo(12, 14); c2.lineTo(6, 11); c2.fill(); c2.beginPath(); c2.moveTo(0, 12); c2.lineTo(0, 19); c2.stroke(); }
    if (!map.hasImage('cf-' + k)) map.addImage('cf-' + k, c2.getImageData(0, 0, 64, 64));
  }
  map.addLayer({ id: 'live-conf', type: 'symbol', source: 'live', filter: ['in', ['get', 'k'], ['literal', ['clash', 'drone', 'missile']]], layout: { 'icon-image': ['concat', 'cf-', ['get', 'k']], 'icon-size': 0.55, 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
  map.on('click', 'live-conf', (e) => { const p = e.features[0]?.properties; if (p) chip(p.t, p.s, p.k); });
  map.on('mouseenter', 'live-conf', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'live-conf', () => { map.getCanvas().style.cursor = ''; });
  float(window.__app?.trackOn);
  map.on('click', 'live-pts', (e) => { const p = e.features[0]?.properties; if (p) chip(p.t, p.s, p.k, p.i, p.v); });
  map.on('mouseenter', 'live-pts', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'live-pts', () => { map.getCanvas().style.cursor = ''; });
}
const shown = () => [...(on.quakes ? items.quakes : []), ...(on.events ? items.events : []), ...(on.sats ? items.sats : []), ...(on.cctv ? items.cctv : []), ...(on.conflict ? items.conflict : [])];
function draw2d() {
  const go = () => { ensure2d(); map.getSource('live').setData({ type: 'FeatureCollection', features: shown().map((i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { k: i.k, r: i.r, h: i.h || 0, t: i.t, s: i.s, i: i.img || '', v: i.vid || '' } })) }); };
  if (map.isStyleLoaded()) go(); else map.once('idle', go);
}

// ---------- 3D globe ----------
let pts3 = null, h3 = null, shown3 = null;
async function draw3d() {
  const G = window.__globe; if (!G?.active) return;
  for (let i = 0; i < 300 && !(G.ready && window.Cesium); i++) await sleep(200);
  const C = window.Cesium, v = G.viewer; if (!C || !v) return;
  if (!pts3) {
    pts3 = v.scene.primitives.add(new C.PointPrimitiveCollection());
    h3 = new C.ScreenSpaceEventHandler(v.canvas);
    h3.setInputAction((m) => { const p = v.scene.pick(m.position); if (p?.id?.live) chip(p.id.t, p.id.s, p.id.k, p.id.img, p.id.vid); }, C.ScreenSpaceEventType.LEFT_CLICK);
  }
  pts3.removeAll();
  for (const i of shown()) pts3.add({ id: { live: 1, ...i }, position: C.Cartesian3.fromDegrees(i.lon, i.lat, i.h ?? 2000), pixelSize: i.r * 1.5, color: C.Color.fromCssColorString(COLOR[i.k]).withAlpha(0.9), outlineColor: C.Color.BLACK.withAlpha(0.6), outlineWidth: 1 });
}

// ---------- the small info chip ----------
const el = document.createElement('div'); el.id = 'live-chip'; el.hidden = true; document.body.append(el);
function chip(t, s, k, img, vid) {
  if (img && /^https:\/\//.test(img)) return openCam(t, s, img, vid); // cameras open in their own window
  el.innerHTML = `<i style="background:${COLOR[k]}"></i><span><b>${esc(t)}</b><small>${esc(s)}</small></span><button type="button" aria-label="Close">✕</button>`; el.hidden = false;
}
el.addEventListener('click', (e) => { if (e.target.closest('button')) el.hidden = true; });

// ---------- toggles ----------
const rows = { quakes: $('#live-quakes'), events: $('#live-events'), sats: $('#live-sats'), cctv: $('#live-cctv'), conflict: $('#live-conflict') };
const note = Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, r.querySelector('small').textContent]));
async function refresh(which) {
  const small = rows[which].querySelector('small');
  try { await load(which); small.textContent = which === 'sats' ? `${items[which].length} satellites right now` : which === 'conflict' ? `${items[which].length} reports in the last 24 h` : which === 'cctv' ? `${items[which].length} cameras · ${camNames.join(', ')}` : `${items[which].length} showing now`; } catch { small.textContent = 'Could not load right now. Try again in a moment.'; }
  draw2d(); draw3d();
}
for (const which of Object.keys(rows)) {
  rows[which].addEventListener('click', () => {
    on[which] = !on[which]; rows[which].classList.toggle('on', on[which]); rows[which].setAttribute('aria-pressed', String(on[which]));
    if (!on[which]) { rows[which].querySelector('small').textContent = note[which]; if (!shown().length) el.hidden = true; draw2d(); draw3d(); } else refresh(which);
  });
}
setInterval(() => { for (const w of ['quakes', 'events', 'conflict']) if (on[w]) refresh(w); }, 300000);
setInterval(() => { if (on.sats && satRecs.length) { placeSats(); draw2d(); draw3d(); } }, 4000); // satellites move fast, so their dots are moved every few seconds
window.addEventListener('globe-change', () => { if (shown().length) draw3d(); });
window.__live = { on, items };

// opening the Live tab switches the map to 3D Track, with a short gold "scan" wipe hiding the change
{
  const warp = document.createElement('div'); warp.id = 'warp'; document.body.append(warp);
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const toTrack = () => {
    const app = window.__app, mt = window.__maptype; if (!mt || app.trackOn) return;
    const swap = () => { mt.set('track'); map.easeTo({ zoom: Math.min(map.getZoom(), 2), duration: calm.matches ? 0 : 1600 }); };
    if (calm.matches) return swap();
    warp.classList.remove('go'); void warp.offsetWidth; warp.classList.add('go');
    setTimeout(swap, 420); setTimeout(() => warp.classList.remove('go'), 1300);
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tab-live,#topnav [data-tab="live"]')) return;
    setTimeout(() => { if (window.__workspace.isOpen && window.__workspace.tab === 'live') { toTrack(); for (const r of Object.values(rows)) if (r.getAttribute('aria-pressed') !== 'true') r.click(); } }, 0); // opening Live also switches every layer on // only when the click opened Live, not when it closed it
  });
}

// ---------- camera windows: drag by the title bar, resize from the corner, up to 5 at once ----------
const wins = new Map(); let topZ = 45;
const front = (w) => { w.style.zIndex = ++topZ; };
// plays a camera's video in the window: MP4 directly, HLS streams (.m3u8) natively in Safari or through hls.js elsewhere
async function playVideo(body, im, vid, poster, keep) {
  const v = document.createElement('video'); Object.assign(v, { muted: true, autoplay: true, loop: true, controls: true, playsInline: true, poster });
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  const fail = () => { v.remove(); body.append(im); }; // no video: fall back to the still picture
  v.addEventListener('error', fail, { once: true });
  im.replaceWith(v);
  try {
    if (!/\.m3u8(\?|$)/i.test(vid) || v.canPlayType('application/vnd.apple.mpegurl')) v.src = vid;
    else { const Hls = (await import('hls.js')).default; if (!Hls.isSupported()) return fail(); const h = new Hls(); keep(h); h.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) fail(); }); h.loadSource(vid); h.attachMedia(v); }
    v.play().catch(() => {}); // autoplay can be refused; the controls still let the user press play
  } catch { fail(); }
}
function openCam(t, s, img, vid) {
  if (wins.has(img)) return front(wins.get(img));
  if (wins.size >= 5) wins.get(wins.keys().next().value).querySelector('button').click(); // the oldest makes room
  const w = document.createElement('div'), n = wins.size; w.className = 'cam-win';
  w.innerHTML = `<div class="cw-bar"><span><b>${esc(t)}</b><small>${esc(s)}</small></span><button type="button" aria-label="Close camera">✕</button></div><div class="cw-body"><img alt="${esc(t)}" referrerpolicy="no-referrer"></div><i class="cw-grip" aria-hidden="true"></i>`;
  const im = w.querySelector('img'), body = w.querySelector('.cw-body'); im.src = img; im.onerror = () => { body.textContent = 'Picture not available right now'; };
  let hls = null, timer = 0;
  if (vid && /^https:\/\//.test(vid)) playVideo(body, im, vid, img, (h) => { hls = h; }); // live video where the camera has it, otherwise the picture stays
  else timer = img.includes('?') ? 0 : setInterval(() => { im.src = `${img}?t=${Date.now()}`; }, 15000); // refresh the picture (only where the link carries no signature)
  w.style.left = Math.max(8, Math.min(innerWidth - 340, 440 + n * 28)) + 'px'; w.style.top = 90 + n * 28 + 'px';
  document.body.append(w); wins.set(img, w); front(w);
  w.addEventListener('pointerdown', () => front(w));
  w.querySelector('button').addEventListener('click', () => { clearInterval(timer); hls?.destroy(); w.remove(); wins.delete(img); });
  const track = (el, move) => el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; e.preventDefault(); el.setPointerCapture(e.pointerId);
    const r = w.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    const mv = (m) => move(r, m.clientX - x0, m.clientY - y0), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
  track(w.querySelector('.cw-bar'), (r, dx, dy) => { w.style.left = Math.max(0, Math.min(innerWidth - 60, r.left + dx)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 40, r.top + dy)) + 'px'; });
  track(w.querySelector('.cw-grip'), (r, dx, dy) => { w.style.width = Math.max(220, Math.min(innerWidth - r.left, r.width + dx)) + 'px'; w.style.height = Math.max(170, Math.min(innerHeight - r.top, r.height + dy)) + 'px'; });
}
