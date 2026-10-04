import { Marker } from 'maplibre-gl';

// Floating live clocks and an approximate UTC-offset guide for the map.
while (!window.__app) await new Promise((resolve) => setTimeout(resolve, 25));
const { map } = window.__app;
const panel = document.querySelector('#timepanel');
const panelOpen = document.querySelector('#timepanel-open');
const panelClose = document.querySelector('#timepanel-close');
function setPanelOpen(open) {
  panel.hidden = !open;
  panelOpen.hidden = open;
  panelOpen.setAttribute('aria-expanded', String(open));
}
panelOpen.addEventListener('click', () => setPanelOpen(true));
panelClose.addEventListener('click', () => setPanelOpen(false));
const localClock = document.querySelector('#local-clock');
const utcClock = document.querySelector('#utc-clock');
const localZone = document.querySelector('#local-zone');
const toggle = document.querySelector('#timezone-toggle');
const countryTimeToggle = document.querySelector('#country-time-toggle');
const format = (date, options) => new Intl.DateTimeFormat(undefined, options).format(date);
function updateClocks() {
  const now = new Date();
  localClock.textContent = format(now, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  utcClock.textContent = format(now, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
  localZone.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
}
updateClocks();
setInterval(updateClocks, 1000);

const guides = [];
const lineFeatures = [];
for (let lng = -180; lng <= 180; lng += 15) {
  lineFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lng, -80], [lng, 80]] } });
}
for (let i = 0; i < 24; i++) {
  const lng = -172.5 + i * 15;
  const offset = Math.round(lng / 15);
  const label = offset === 0 ? 'UTC' : `UTC${offset > 0 ? '+' : '−'}${Math.abs(offset)}`;
  const el = document.createElement('div');
  el.className = 'timezone-label';
  el.textContent = label;
  const marker = new Marker({ element: el, anchor: 'center' }).setLngLat([lng, 2]).addTo(map);
  guides.push({ marker, el });
}
let enabled = false;
function setEnabled(on) {
  enabled = on;
  toggle.classList.toggle('on', on);
  toggle.setAttribute('aria-pressed', String(on));
  toggle.textContent = on ? 'Hide time zones on map' : 'Show time zones on map';
  for (const { el } of guides) el.hidden = !on;
  if (map.getLayer('timezone-lines')) map.setLayoutProperty('timezone-lines', 'visibility', on ? 'visible' : 'none');
}
function setupTimezoneLayer() {
  if (!map.getSource('timezone-lines')) {
    map.addSource('timezone-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
    map.addLayer({ id: 'timezone-lines', type: 'line', source: 'timezone-lines', layout: { visibility: 'none' }, paint: { 'line-color': '#1565c0', 'line-width': 1, 'line-opacity': 0.48, 'line-dasharray': [3, 2] } });
  }
  setEnabled(false);
}
if (map.loaded()) setupTimezoneLayer();
else map.once('load', setupTimezoneLayer);
toggle.addEventListener('click', () => setEnabled(!enabled));
countryTimeToggle.addEventListener('click', () => window.__app.setTimeMode(!window.__app.timeMode)); // times come from main.js
