// 3D Earth: a real spinning globe you can tilt, zoom and click, built with CesiumJS (the open-source 3D globe library).
// The library is big (about 4 MB), so it is only downloaded the first time someone opens 3D Earth.
// It loads from the official Cesium download site, with two backup copies on public code hosts.
// Optional: a free Cesium ion token in public/globe-config.json turns on real 3D mountains (see "3D Earth" in the README).
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const { countries } = app;
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const VER = '1.146';
const BASES = [
  `https://cesium.com/downloads/cesiumjs/releases/${VER}/Build/Cesium/`,
  `https://unpkg.com/cesium@${VER}.0/Build/Cesium/`,
  `https://cdn.jsdelivr.net/npm/cesium@${VER}.0/Build/Cesium/`,
];
const btn = $('#globebtn'), wrap = $('#globe'), view = $('#gl-view'), stat = $('#gl-stat');

let C = null, viewer = null, active = false, starting = null;
let cfg = { ionToken: '' };
let borders = null, ds = null, cityLabels = null, cityDots = null, countryLabels = null;
let selected = null, pinEntity = null, spinOn = true, spinHold = 0, style = 'satellite';
const shapes = {}; // country id -> { entity, sphere }

// ---------- loading the library ----------
const addScript = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { s.remove(); bad(new Error('blocked')); }; document.head.append(s); });
async function loadCesium() {
  if (window.Cesium) return window.Cesium;
  for (const base of BASES) {
    try {
      window.CESIUM_BASE_URL = base;
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'Widgets/widgets.css'; document.head.append(css);
      await addScript(base + 'Cesium.js');
      if (window.Cesium) return window.Cesium;
    } catch { /* try the next copy */ }
  }
  throw new Error('The 3D library could not be downloaded. Check your connection and try again.');
}
const say = (t, bad) => { stat.textContent = t || ''; stat.className = bad ? 'bad' : ''; stat.hidden = !t; };

// ---------- the map pictures wrapped around the globe ----------
async function imageryFor(name) {
  const tiles = (url, max, credit, extra = {}) => new C.UrlTemplateImageryProvider({ url, maximumLevel: max, credit, ...extra });
  if (name === 'satellite') return tiles('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 18, 'Imagery © Esri and contributors');
  if (name === 'streets') return tiles('https://tile.openstreetmap.org/{z}/{x}/{y}.png', 19, '© OpenStreetMap contributors');
  if (name === 'night') return tiles('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', 8, 'Night lights: NASA Black Marble (GIBS)');
  return C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl('Assets/Textures/NaturalEarthII')); // comes with the library
}
async function setStyle(name) {
  style = name;
  const layers = viewer.imageryLayers; layers.removeAll();
  try { layers.addImageryProvider(await imageryFor(name)); } catch { say('That picture layer is not reachable right now.', true); }
  viewer.scene.globe.baseColor = C.Color.fromCssColorString(name === 'night' ? '#02040a' : '#0a1b2a');
}

// ---------- building the globe ----------
async function build() {
  say('Loading 3D Earth…');
  try { cfg = { ...cfg, ...(await (await fetch('/globe-config.json')).json()) }; } catch {}
  C = await loadCesium();
  if (cfg.ionToken) C.Ion.defaultAccessToken = cfg.ionToken;
  viewer = new C.Viewer(view, {
    baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, shouldAnimate: true,
  });
  const sc = viewer.scene;
  sc.globe.enableLighting = false; sc.globe.showGroundAtmosphere = true; sc.skyAtmosphere.show = true; sc.highDynamicRange = false;
  sc.screenSpaceCameraController.minimumZoomDistance = 120; sc.screenSpaceCameraController.maximumZoomDistance = 4.2e7;
  sc.globe.depthTestAgainstTerrain = false;
  if (cfg.ionToken) { try { sc.setTerrain(C.Terrain.fromWorldTerrain()); $('#gl-terrain-row').hidden = false; } catch {} }
  viewer.clock.currentTime = C.JulianDate.now(); viewer.clock.multiplier = 1;
  await setStyle(style);

  // slow turning until you touch the globe
  viewer.clock.onTick.addEventListener(() => { if (spinOn && !spinHold && active) viewer.camera.rotate(C.Cartesian3.UNIT_Z, -0.0016); });
  const hold = () => { spinHold = 1; };
  viewer.canvas.addEventListener('pointerdown', hold); viewer.canvas.addEventListener('wheel', hold, { passive: true });
  home(0);

  // country borders; a click picks a country
  borders = await (await fetch('/data/borders.geojson')).json();
  say('Drawing borders…');
  // border lines (one cheap batch) and, for picking a country, a plain "which border is this point inside?" check
  const lines = viewer.scene.primitives.add(new C.PolylineCollection()); ds = lines;
  const flat3 = (ring) => ring.flatMap(([x, y]) => [x, y, 1500]);
  const lineMat = C.Material.fromType('Color', { color: C.Color.fromCssColorString('#52d6ff').withAlpha(0.85) });
  for (const f of borders.features) {
    const id = f.properties?.id; if (!countries[id]) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    const parts = [], pts = [];
    for (const poly of polys) {
      let x0 = 181, x1 = -181, y0 = 91, y1 = -91;
      for (const [x, y] of poly[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      parts.push({ poly, bb: [x0, y0, x1, y1] });
      const outer = C.Cartesian3.fromDegreesArray(poly[0].flatMap(([x, y]) => [x, y]));
      for (let i = 0; i < outer.length; i += 3) pts.push(outer[i]); // a sample is enough for the camera
      for (const ring of poly) lines.add({ positions: C.Cartesian3.fromDegreesArrayHeights(flat3(ring)), width: 1.6, material: lineMat });
    }
    if (pts.length) shapes[id] = { parts, sphere: C.BoundingSphere.fromPoints(pts) };
  }
  const h = new C.ScreenSpaceEventHandler(viewer.canvas);
  h.setInputAction((m) => {
    const hit = viewer.camera.pickEllipsoid(m.position, viewer.scene.globe.ellipsoid);
    if (!hit) { choose(null); clearPin(); return; }
    const cg = C.Cartographic.fromCartesian(hit), id = countryAt(C.Math.toDegrees(cg.longitude), C.Math.toDegrees(cg.latitude));
    if (id) choose(id, true); else { choose(null); clearPin(); }
  }, C.ScreenSpaceEventType.LEFT_CLICK);
  addLabels();
  say('');
  applyToggles();
}

// capital and city names that appear as you come closer
async function addLabels() {
  const rows = await (await fetch('/data/cities.json')).json();
  cityLabels = viewer.scene.primitives.add(new C.LabelCollection()); cityDots = viewer.scene.primitives.add(new C.PointPrimitiveCollection());
  countryLabels = viewer.scene.primitives.add(new C.LabelCollection());
  const near = (pop, cap) => (cap ? 1.1e7 : pop >= 3e6 ? 6e6 : pop >= 1e6 ? 3.2e6 : pop >= 4e5 ? 1.6e6 : pop >= 1.5e5 ? 8e5 : 4e5);
  for (const [name, lng, lat, pop, cap] of rows) {
    if (!cap && pop < 5e4) continue;
    const pos = C.Cartesian3.fromDegrees(lng, lat, 0), d = new C.DistanceDisplayCondition(0, near(pop, cap));
    cityDots.add({ position: pos, pixelSize: cap ? 6 : 4, color: cap ? C.Color.WHITE : C.Color.fromCssColorString('#9fe8ff'), outlineColor: C.Color.BLACK.withAlpha(0.7), outlineWidth: 1, distanceDisplayCondition: d });
    cityLabels.add({ position: pos, text: name, font: `${cap ? 'bold 14' : '12'}px "Space Grotesk", sans-serif`, fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(7, -2), horizontalOrigin: C.HorizontalOrigin.LEFT, verticalOrigin: C.VerticalOrigin.CENTER, distanceDisplayCondition: new C.DistanceDisplayCondition(0, near(pop, cap) * 0.7) });
  }
  for (const [id, s] of Object.entries(shapes)) {
    const c = countries[id]; const r = s.sphere.radius;
    if (r < 2.2e5) continue; // tiny countries are named when you come close
    countryLabels.add({ position: C.Cartesian3.multiplyByScalar(C.Cartesian3.normalize(s.sphere.center, new C.Cartesian3()), C.Ellipsoid.WGS84.maximumRadius + 1000, new C.Cartesian3()), text: c.name.toUpperCase(), font: '600 13px "Space Grotesk", sans-serif', fillColor: C.Color.fromCssColorString('#d9f4ff'), outlineColor: C.Color.BLACK.withAlpha(0.9), outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, horizontalOrigin: C.HorizontalOrigin.CENTER, scale: Math.min(1.25, 0.8 + r / 4e6), distanceDisplayCondition: new C.DistanceDisplayCondition(r * 1.2, r * 14 + 6e6) });
  }
  applyToggles();
}

// ---------- choosing a country ----------
const HI = () => C.Color.fromCssColorString('#52d6ff').withAlpha(0.3);
const inRing = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
function countryAt(x, y) {
  for (const [id, s] of Object.entries(shapes)) for (const { poly, bb } of s.parts) {
    if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
    if (inRing(poly[0], x, y) && !poly.slice(1).some((r) => inRing(r, x, y))) return id;
  }
  return null;
}
let glow = [];
function setGlow(id) {
  for (const e of glow) viewer.entities.remove(e); glow = [];
  if (!id) return;
  for (const { poly } of shapes[id].parts) {
    const ring = (r) => C.Cartesian3.fromDegreesArray(r.flatMap(([x, y]) => [x, y]));
    glow.push(viewer.entities.add({ polygon: { hierarchy: new C.PolygonHierarchy(ring(poly[0]), poly.slice(1).map((r) => new C.PolygonHierarchy(ring(r)))), material: HI() } }));
  }
}
function choose(id, open) {
  selected = id; setGlow(id);
  if (!id) { app.closePanel?.(); return; }
  spinOn = false; syncSwitch('#gl-spin', false);
  if (open) { app.openCountry(id, 'overview', false); flyCountry(id); }
}
function flyCountry(id) {
  const s = shapes[id]; if (!s) return;
  const r = Math.max(s.sphere.radius, 1.2e5);
  viewer.camera.flyToBoundingSphere(s.sphere, { duration: 1.4, offset: new C.HeadingPitchRange(0, -C.Math.PI_OVER_TWO, r * 2.9) });
}
function home(duration = 1.6) {
  viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(44, 28, 2.1e7), duration, orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0 } });
}

// ---------- the search box also flies the globe ----------
function clearPin() { if (pinEntity) { viewer.entities.remove(pinEntity); pinEntity = null; } }
function goTo(name, lng, lat, bb) {
  clearPin();
  pinEntity = viewer.entities.add({ position: C.Cartesian3.fromDegrees(lng, lat, 0), point: { pixelSize: 13, color: C.Color.fromCssColorString('#52d6ff'), outlineColor: C.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: 1e7 }, label: { text: name, font: '600 14px "Space Grotesk", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -24), disableDepthTestDistance: 1e7 } });
  spinOn = false; syncSwitch('#gl-spin', false);
  if (bb && bb[1] - bb[0] > 0.0005) viewer.camera.flyTo({ destination: C.Rectangle.fromDegrees(bb[2], bb[0], bb[3], bb[1]), duration: 1.6 });
  else viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(lng, lat, 220000), duration: 1.8, orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0 } });
}

// ---------- the little control panel ----------
const syncSwitch = (sel, on) => { const b = $(sel); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); } };
const isOn = (sel) => $(sel).classList.contains('on');
function applyToggles() {
  if (!viewer) return;
  if (ds) ds.show = isOn('#gl-borders');
  if (cityLabels) { cityLabels.show = isOn('#gl-cities'); cityDots.show = isOn('#gl-cities'); }
  if (countryLabels) countryLabels.show = isOn('#gl-names');
  spinOn = isOn('#gl-spin');
  viewer.scene.globe.enableLighting = isOn('#gl-sun');
  viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.requestRender?.();
}
wrap.addEventListener('click', (e) => {
  const sw = e.target.closest('.switch'); if (sw) { sw.classList.toggle('on'); sw.setAttribute('aria-checked', String(sw.classList.contains('on'))); if (sw.id === 'gl-spin') spinHold = 0; applyToggles(); }
  if (e.target.closest('#gl-home')) { spinHold = 0; home(); }
  if (e.target.closest('#gl-x')) toggle(false);
});
$('#gl-style').addEventListener('change', (e) => viewer && setStyle(e.target.value));
$('#gl-terrain').addEventListener('click', (e) => {
  const on = e.currentTarget.classList.toggle('on'); e.currentTarget.setAttribute('aria-checked', String(on));
  viewer.scene.verticalExaggeration = on ? 2.2 : 1;
});

// ---------- open and close ----------
async function toggle(on) {
  on = on ?? !active;
  if (on === active) return;
  active = on; document.body.classList.toggle('globeon', on); wrap.hidden = !on;
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', on ? b === btn : b.dataset.view === app.view)); // the tab bar shows 3D Earth as the current view
  window.dispatchEvent(new CustomEvent('globe-change'));
  if (!on) { viewer?.useDefaultRenderLoop && (viewer.useDefaultRenderLoop = false); return; }
  if (viewer) { viewer.useDefaultRenderLoop = true; viewer.resize(); spinHold = 0; return; }
  if (!starting) starting = build().catch((err) => { say(err.message || 'Could not start 3D Earth.', true); starting = null; });
  await starting;
}
btn.addEventListener('click', () => toggle(true));
$('#views').addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b && b !== btn && active) toggle(false); }); // picking Map, Terrain, Satellite or Stats leaves the globe
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active && !e.target.closest('input,select')) { if (pinEntity) clearPin(); } });
window.__globe = { get active() { return active; }, get ready() { return !!viewer; }, get viewer() { return viewer; }, toggle, goTo, flyCountry, choose, get shapes() { return shapes; } };
