// 3D terrain on the flat map: real mountains and valleys, with the map tilted. Free height tiles (AWS open data, no key).
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const { map } = window.__app;
const row = document.querySelector('#terrainrow');
let on = false;
row.addEventListener('click', () => {
  on = !on; row.classList.toggle('on', on); row.setAttribute('aria-pressed', String(on));
  if (on) {
    if (!map.getSource('dem')) map.addSource('dem', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Terrain: Mapzen, AWS Open Data' });
    map.setTerrain({ source: 'dem', exaggeration: 1.6 }); map.dragRotate.enable(); map.easeTo({ pitch: 55, duration: 900 });
  } else { map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); map.once('moveend', () => { if (!on) { map.setTerrain(null); map.dragRotate.disable(); } }); }
});
