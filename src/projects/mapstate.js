// Reads the current map view and layers so a project can save them, and puts them back when a project is opened.
// It uses the same buttons and hooks as the rest of the site, so nothing here draws on the map by itself.
import { STAT_LABELS } from './model.js';
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isOn = (sel) => !!$(sel)?.classList.contains('on');

export function capture() {
  const app = window.__app, g = window.__globe;
  let center = null, zoom = 0;
  if (g?.active && g.viewer && window.Cesium) { // on the 3D globe, the camera position stands in for the map centre
    try { const C = window.Cesium, c = g.viewer.camera.positionCartographic; center = [C.Math.toDegrees(c.longitude), C.Math.toDegrees(c.latitude)]; zoom = clamp(Math.log2(4e7 / Math.max(c.height, 1)), 0.8, 18); } catch { center = null; }
  }
  if (!center) { const c = app.map.getCenter(); center = [wrap(c.lng), clamp(c.lat, -85, 85)]; zoom = app.map.getZoom(); }
  const cur = window.__maptype?.current;
  const base = g?.active ? 'globe' : ['political', 'terrain', 'satellite', 'osm'].includes(cur) ? cur : 'political';
  const caveats = [];
  const S = window.__stats;
  if (window.__history?.active) caveats.push('The Historical maps layer is not saved. The project keeps the normal map instead.');
  else if (app.statsOn && S?.mode === 'heat') caveats.push('The People heat layer is not saved.');
  else if (app.statsOn && S?.mode === 'stat' && !Object.hasOwn(STAT_LABELS, S.key)) caveats.push('Statistics you added yourself are not saved, because they exist only in this browser.');
  return {
    view: { center, zoom },
    layers: { base, theme: app.mapTheme, names: isOn('#names'), times: !!app.timeMode, flights: isOn('#flightbtn'), trade: isOn('#tradebtn'), stats: app.statsOn && !window.__history?.active && S?.mode === 'stat' && Object.hasOwn(STAT_LABELS, S.key) ? S.key : '' },
    caveats,
  };
}

// Applies the saved layers, then moves the map. Returns { ok, warnings }.
export async function restore(project) {
  const app = window.__app, L = project.layers, warnings = [];
  const mt = window.__maptype;
  if (mt && L.base !== mt.current) mt.set(L.base);
  if (L.base === 'globe') { // 3D Earth is downloaded the first time it is used, so wait for it
    const g = window.__globe;
    for (let i = 0; i < 80 && !g?.ready; i++) await sleep(250);
    if (!g?.ready) { mt?.set('political'); warnings.push('3D Earth could not start, so the flat map is shown instead.'); }
  }
  if (app.mapTheme !== L.theme) { const sel = $('#maptheme'); sel.value = L.theme; sel.dispatchEvent(new Event('change')); }
  if (!!app.timeMode !== L.times) app.setTimeMode(L.times);
  if (isOn('#names') !== L.names) $('#names').click();
  for (const [id, want, label] of [['#flightbtn', L.flights, 'Live flights'], ['#tradebtn', L.trade, 'Trade lines']]) {
    if (isOn(id) !== want) $(id)?.click();
    if (want && !isOn(id)) warnings.push(`${label} could not be switched on.`);
  }
  if (L.stats) { if (window.__stats) window.__stats.show(L.stats); else warnings.push('Statistics could not be switched on.'); }
  else if (app.statsOn) app.setStats(false);
  const v = project.view;
  if (v) {
    const g = window.__globe;
    if (g?.active && g.ready && window.Cesium) {
      try { const C = window.Cesium; g.viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(v.center[0], v.center[1], clamp(4e7 / Math.pow(2, v.zoom), 2e5, 2.2e7)), duration: reduce() ? 0 : 1.6, orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0 } }); } catch { warnings.push('The saved position could not be shown on the globe.'); }
    } else app.map.flyTo({ center: v.center, zoom: v.zoom, duration: reduce() ? 0 : 1200, essential: false });
  }
  return { ok: true, warnings };
}

export const describeLayers = (L) => {
  const base = { political: 'Map', terrain: 'Terrain', satellite: 'Satellite', osm: 'OpenStreetMap', globe: '3D Earth' }[L.base];
  const on = [L.flights && 'Live flights', L.trade && 'Trade lines', L.times && 'Country times', L.stats && STAT_LABELS[L.stats]].filter(Boolean);
  return { base, theme: L.theme === 'light' ? 'Light' : 'Dark', on };
};
