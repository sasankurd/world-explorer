// For every country: which country, empire or people held its capital in each history snapshot.
// Output: public/data/history/country-timeline.json  { ISO3: [[year, name, ruler, partOf, wikiTitle], ...] }  (only years where something was recorded)
import fs from 'node:fs';
const dir = 'public/data/history/';
const idx = JSON.parse(fs.readFileSync(dir + 'index.json'));
const cities = JSON.parse(fs.readFileSync('public/data/cities.json'));
const borders = JSON.parse(fs.readFileSync('public/data/borders.geojson'));
const pts = {};
for (const c of cities) if (c[4] && !pts[c[5]]) pts[c[5]] = [c[1], c[2]];
for (const f of borders.features) {            // countries without a listed capital: middle of the biggest piece
  const id = f.properties.id; if (pts[id]) continue;
  const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
  let best = null, ba = -1;
  for (const p of polys) { const xs = p[0].map((q) => q[0]), ys = p[0].map((q) => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), a = (x1 - x0) * (y1 - y0); if (a > ba) { ba = a; best = [(x0 + x1) / 2, (y0 + y1) / 2, p]; } }
  pts[id] = [best[0], best[1]];
}
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h));
const inGeom = (x, y, g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).some((p) => inPoly(x, y, p));
const out = {}; const ids = Object.keys(pts);
for (const id of ids) out[id] = [];
for (const s of idx) {
  const d = JSON.parse(fs.readFileSync(dir + s.file));
  const feats = d.features.filter((f) => f.properties.n && f.properties.h >= 0);
  for (const id of ids) {
    const [x, y] = pts[id];
    // the smallest shape that holds the point (a province inside an empire wins over the empire)
    let hit = null; for (const f of feats) if (inGeom(x, y, f.geometry) && (!hit || f.properties.ar < hit.properties.ar)) hit = f;
    if (hit) { const p = hit.properties; out[id].push([s.year, p.n, p.s || '', p.p || '', p.u || '']); }
  }
}
fs.writeFileSync(dir + 'country-timeline.json', JSON.stringify(out));
const n = Object.values(out).filter((a) => a.length).length;
console.log('countries with records:', n, 'of', ids.length, '· Iraq:', out.IRQ?.length, 'France:', out.FRA?.length);
