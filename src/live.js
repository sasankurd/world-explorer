// Live layers: earthquakes (USGS) and fires and storms (NASA EONET), drawn on the flat map and on the 3D globe.
// Both feeds are free, need no key and update every few minutes. A toggle fetches only when it is switched on.
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const { map } = window.__app;
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUAKES = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const EVENTS = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300&category=wildfires,severeStorms,volcanoes';
const COLOR = { quake: '#ff6b57', fire: '#ff9f1a', storm: '#5fd0ff', volcano: '#c77dff' };
const KIND = { wildfires: 'fire', severeStorms: 'storm', volcanoes: 'volcano' };
const on = { quakes: false, events: false }, items = { quakes: [], events: [] };

const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function load(which) {
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
  const col = ['match', ['get', 'k'], 'quake', COLOR.quake, 'fire', COLOR.fire, 'storm', COLOR.storm, COLOR.volcano];
  map.addLayer({ id: 'live-glow', type: 'circle', source: 'live', paint: { 'circle-radius': ['*', ['get', 'r'], 2], 'circle-color': col, 'circle-opacity': 0.22, 'circle-blur': 0.6 } });
  map.addLayer({ id: 'live-pts', type: 'circle', source: 'live', paint: { 'circle-radius': ['get', 'r'], 'circle-color': col, 'circle-opacity': 0.9, 'circle-stroke-color': '#000', 'circle-stroke-width': 1 } });
  map.on('click', 'live-pts', (e) => { const p = e.features[0]?.properties; if (p) chip(p.t, p.s, p.k); });
  map.on('mouseenter', 'live-pts', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'live-pts', () => { map.getCanvas().style.cursor = ''; });
}
const shown = () => [...(on.quakes ? items.quakes : []), ...(on.events ? items.events : [])];
function draw2d() {
  const go = () => { ensure2d(); map.getSource('live').setData({ type: 'FeatureCollection', features: shown().map((i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { k: i.k, r: i.r, t: i.t, s: i.s } })) }); };
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
    h3.setInputAction((m) => { const p = v.scene.pick(m.position); if (p?.id?.live) chip(p.id.t, p.id.s, p.id.k); }, C.ScreenSpaceEventType.LEFT_CLICK);
  }
  pts3.removeAll();
  for (const i of shown()) pts3.add({ id: { live: 1, ...i }, position: C.Cartesian3.fromDegrees(i.lon, i.lat, 2000), pixelSize: i.r * 1.5, color: C.Color.fromCssColorString(COLOR[i.k]).withAlpha(0.9), outlineColor: C.Color.BLACK.withAlpha(0.6), outlineWidth: 1 });
}

// ---------- the small info chip ----------
const el = document.createElement('div'); el.id = 'live-chip'; el.hidden = true; document.body.append(el);
function chip(t, s, k) { el.innerHTML = `<i style="background:${COLOR[k]}"></i><span><b>${esc(t)}</b><small>${esc(s)}</small></span><button type="button" aria-label="Close">✕</button>`; el.hidden = false; }
el.addEventListener('click', (e) => { if (e.target.closest('button')) el.hidden = true; });

// ---------- toggles ----------
const rows = { quakes: $('#live-quakes'), events: $('#live-events') };
const note = { quakes: rows.quakes.querySelector('small').textContent, events: rows.events.querySelector('small').textContent };
async function refresh(which) {
  const small = rows[which].querySelector('small');
  try { await load(which); small.textContent = `${items[which].length} showing now`; } catch { small.textContent = 'Could not load right now. Try again in a moment.'; }
  draw2d(); draw3d();
}
for (const which of Object.keys(rows)) {
  rows[which].addEventListener('click', () => {
    on[which] = !on[which]; rows[which].classList.toggle('on', on[which]); rows[which].setAttribute('aria-pressed', String(on[which]));
    if (!on[which]) { rows[which].querySelector('small').textContent = note[which]; if (!shown().length) el.hidden = true; draw2d(); draw3d(); } else refresh(which);
  });
}
setInterval(() => { for (const w of Object.keys(on)) if (on[w]) refresh(w); }, 300000);
window.addEventListener('globe-change', () => { if (shown().length) draw3d(); });
window.__live = { on, items };
