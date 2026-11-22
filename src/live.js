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
const COLOR = { quake: '#ff6b57', fire: '#ff9f1a', storm: '#5fd0ff', volcano: '#c77dff', sat: '#1fb5ff', cctv: '#b6ff5c' };
const KIND = { wildfires: 'fire', severeStorms: 'storm', volcanoes: 'volcano' };
const on = { quakes: false, events: false, sats: false, cctv: false }, items = { quakes: [], events: [], sats: [], cctv: [] };
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
  ['London', () => get('https://api.tfl.gov.uk/Place/Type/JamCam').then((r) => r.json()).then((a) => a.flatMap((c) => { const img = c.additionalProperties?.find((q) => q.key === 'imageUrl')?.value; return img && c.lat ? [{ lon: c.lon, lat: c.lat, t: c.commonName, s: 'London · TfL JamCam', img }] : []; }))],
  ['Singapore', () => get('https://api.data.gov.sg/v1/transport/traffic-images').then((r) => r.json()).then((j) => (j.items?.[0]?.cameras || []).map((c) => ({ lon: c.location.longitude, lat: c.location.latitude, t: `Camera ${c.camera_id}`, s: 'Singapore · LTA', img: c.image })))],
  ['Finland', () => get('https://tie.digitraffic.fi/api/weathercam/v1/stations').then((r) => r.json()).then((j) => j.features.flatMap((f) => { const id = f.properties.presets?.find((q) => q.inCollection !== false)?.id; return id ? [{ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], t: String(f.properties.name || f.id).replace(/_/g, ' '), s: 'Finland · Fintraffic road cameras', img: `https://weathercam.digitraffic.fi/${id}.jpg` }] : []; }))],
  ['New York', () => get('https://webcams.nyctmc.org/api/cameras').then((r) => r.json()).then((a) => a.filter((c) => c.isOnline !== false && c.latitude).map((c) => ({ lon: c.longitude, lat: c.latitude, t: c.name, s: 'New York · NYC DOT', img: c.imageUrl || `https://webcams.nyctmc.org/api/cameras/${c.id}/image` })))],
];
let camNames = [];
async function loadCams() {
  const res = await Promise.allSettled(CAMS.map(([, f]) => f()));
  camNames = CAMS.filter((_, i) => res[i].status === 'fulfilled' && res[i].value.length).map(([n]) => n);
  items.cctv = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter((c) => /^https:\/\//.test(c.img)).map((c) => ({ ...c, k: 'cctv', r: 4 }));
  if (!items.cctv.length) throw new Error('no cameras');
}
async function load(which) {
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

// ---------- flat map ----------
function ensure2d() {
  if (map.getSource('live')) return;
  map.addSource('live', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const col = ['match', ['get', 'k'], 'quake', COLOR.quake, 'fire', COLOR.fire, 'storm', COLOR.storm, 'sat', COLOR.sat, 'cctv', COLOR.cctv, COLOR.volcano];
  map.addLayer({ id: 'live-glow', type: 'circle', source: 'live', paint: { 'circle-radius': ['*', ['get', 'r'], 2], 'circle-color': col, 'circle-opacity': 0.22, 'circle-blur': 0.6 } });
  map.addLayer({ id: 'live-pts', type: 'circle', source: 'live', paint: { 'circle-radius': ['get', 'r'], 'circle-color': col, 'circle-opacity': 0.9, 'circle-stroke-color': '#000', 'circle-stroke-width': 1 } });
  map.on('click', 'live-pts', (e) => { const p = e.features[0]?.properties; if (p) chip(p.t, p.s, p.k, p.i); });
  map.on('mouseenter', 'live-pts', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'live-pts', () => { map.getCanvas().style.cursor = ''; });
}
const shown = () => [...(on.quakes ? items.quakes : []), ...(on.events ? items.events : []), ...(on.sats ? items.sats : []), ...(on.cctv ? items.cctv : [])];
function draw2d() {
  const go = () => { ensure2d(); map.getSource('live').setData({ type: 'FeatureCollection', features: shown().map((i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { k: i.k, r: i.r, t: i.t, s: i.s, i: i.img || '' } })) }); };
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
    h3.setInputAction((m) => { const p = v.scene.pick(m.position); if (p?.id?.live) chip(p.id.t, p.id.s, p.id.k, p.id.img); }, C.ScreenSpaceEventType.LEFT_CLICK);
  }
  pts3.removeAll();
  for (const i of shown()) pts3.add({ id: { live: 1, ...i }, position: C.Cartesian3.fromDegrees(i.lon, i.lat, i.h ?? 2000), pixelSize: i.r * 1.5, color: C.Color.fromCssColorString(COLOR[i.k]).withAlpha(0.9), outlineColor: C.Color.BLACK.withAlpha(0.6), outlineWidth: 1 });
}

// ---------- the small info chip ----------
const el = document.createElement('div'); el.id = 'live-chip'; el.hidden = true; document.body.append(el);
function chip(t, s, k, img) { el.innerHTML = `<i style="background:${COLOR[k]}"></i><span>${img && /^https:\/\//.test(img) ? `<img src="${esc(img)}" alt="Camera picture" referrerpolicy="no-referrer">` : ''}<b>${esc(t)}</b><small>${esc(s)}</small></span><button type="button" aria-label="Close">✕</button>`; el.hidden = false; }
el.addEventListener('click', (e) => { if (e.target.closest('button')) el.hidden = true; });

// ---------- toggles ----------
const rows = { quakes: $('#live-quakes'), events: $('#live-events'), sats: $('#live-sats'), cctv: $('#live-cctv') };
const note = { quakes: rows.quakes.querySelector('small').textContent, events: rows.events.querySelector('small').textContent };
async function refresh(which) {
  const small = rows[which].querySelector('small');
  try { await load(which); small.textContent = which === 'sats' ? `${items[which].length} satellites right now` : which === 'cctv' ? `${items[which].length} cameras · ${camNames.join(', ')}` : `${items[which].length} showing now`; } catch { small.textContent = 'Could not load right now. Try again in a moment.'; }
  draw2d(); draw3d();
}
for (const which of Object.keys(rows)) {
  rows[which].addEventListener('click', () => {
    on[which] = !on[which]; rows[which].classList.toggle('on', on[which]); rows[which].setAttribute('aria-pressed', String(on[which]));
    if (!on[which]) { rows[which].querySelector('small').textContent = note[which]; if (!shown().length) el.hidden = true; draw2d(); draw3d(); } else refresh(which);
  });
}
setInterval(() => { for (const w of ['quakes', 'events']) if (on[w]) refresh(w); }, 300000);
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
    setTimeout(() => { if (window.__workspace.isOpen && window.__workspace.tab === 'live') toTrack(); }, 0); // only when the click opened Live, not when it closed it
  });
}
