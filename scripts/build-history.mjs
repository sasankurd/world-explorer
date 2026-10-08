// Builds public/data/history/*.json: the world's borders and names in 53 snapshots, from 123,000 BC to 2010.
//
// Source: "Historical Basemaps" by Andre Ourednik (github.com/aourednik/historical-basemaps), licence GPL-3.0.
// The files are downloaded once into scripts/.cache/history/ (or set HB_DIR to a folder that already holds
// the repository's geojson files). Shapes are simplified a little so each snapshot loads fast.
//
// Run with:  node scripts/build-history.mjs
import fs from 'fs';
import path from 'path';

const RAW = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/';
const cache = process.env.HB_DIR || 'scripts/.cache/history';
const out = 'public/data/history';
fs.mkdirSync(cache, { recursive: true }); fs.mkdirSync(out, { recursive: true });

async function get(file) {
  const f = path.join(cache, path.basename(file));
  if (!fs.existsSync(f)) {
    const r = await fetch(RAW + file);
    if (!r.ok) throw new Error(`Could not download ${file}: HTTP ${r.status}`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const TOL = 0.04; // simplification, in degrees (about 4 km)
const r2 = (n) => Math.round(n * 100) / 100;
// Douglas-Peucker: drops points that lie within TOL of a straight line between their neighbours
function simplify(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let far = -1, fd = tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (!len) d = Math.hypot(px - ax, py - ay);
      else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)); d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const bboxOf = (ring) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
const area = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return a / 2; };
const inside = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const edgeDist = (ring, x, y) => { let m = 1e9; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, ay] = ring[j], [bx, by] = ring[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0; m = Math.min(m, Math.hypot(x - (ax + t * dx), y - (ay + t * dy))); } return m; };
// a good spot for a name: the point inside the biggest piece that is furthest from its edge
function labelSpot(ring) {
  const [x0, y0, x1, y1] = bboxOf(ring); let best = null, bd = -1;
  const N = 14;
  for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
    const x = x0 + ((x1 - x0) * i) / N, y = y0 + ((y1 - y0) * j) / N;
    if (!inside(ring, x, y)) continue;
    const d = edgeDist(ring, x, y); if (d > bd) { bd = d; best = [x, y]; }
  }
  return best || [(x0 + x1) / 2, (y0 + y1) / 2];
}
// the same name always gets the same colour: the hue comes from who ruled the area (so colonies share their ruler's colour)
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
const wiki = (u) => (typeof u === 'string' && /^https:\/\/en\.wikipedia\.org\/wiki\/[^\s"<>]+$/.test(u) ? u.slice('https://en.wikipedia.org/wiki/'.length) : undefined);

const index = await get('index.json');
const years = [];
let total = 0;
for (const { year, filename } of index.years) {
  const gj = await get('geojson/' + filename);
  const feats = [], unclaimed = [];
  let id = 0;
  for (const f of gj.features) {
    if (!f.geometry) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const kept = [];
    for (const poly of polys) {
      const rings = [];
      for (let k = 0; k < poly.length; k++) {
        const ring = simplify(poly[k].map(([x, y]) => [r2(x), r2(y)]), TOL);
        if (ring.length < 4) continue;
        const [x0, y0, x1, y1] = bboxOf(ring);
        if (k === 0 && Math.max(x1 - x0, y1 - y0) < TOL * 1.5) break; // a speck
        rings.push(ring);
      }
      if (rings.length) kept.push(rings);
    }
    if (!kept.length) continue;
    const p = f.properties || {};
    if (!p.NAME) { unclaimed.push(...kept); continue; }
    // biggest piece decides where the name goes
    let big = kept[0][0], bigA = 0, tot = 0;
    for (const rings of kept) { const a = Math.abs(area(rings[0])); tot += a; if (a > bigA) { bigA = a; big = rings[0]; } }
    const [bx0, by0, bx1, by1] = bboxOf(big), [lx, ly] = labelSpot(big);
    const subj = p.SUBJECTO || p.NAME;
    const props = { n: p.NAME, h: hash(subj) % 360, v: (hash(p.NAME) % 100) / 100, b: p.BORDERPRECISION || 1, lx: r2(lx), ly: r2(ly), bw: r2(bx1 - bx0), bh: r2(by1 - by0), ar: Math.round(tot * Math.cos((ly * Math.PI) / 180) * 100) / 100, i: id };
    if (p.SUBJECTO && p.SUBJECTO !== p.NAME) props.s = p.SUBJECTO;
    if (p.PARTOF && p.PARTOF !== p.NAME && p.PARTOF !== p.SUBJECTO) props.p = p.PARTOF;
    const u = wiki(p.weblinks) || wiki(p.weblnks) || wiki(p.INFO_UR); if (u) props.u = u;
    feats.push({ type: 'Feature', id: id++, properties: props, geometry: { type: 'MultiPolygon', coordinates: kept } });
  }
  // everything without a name is land nobody is recorded as ruling: one shape for the lot
  if (unclaimed.length) feats.unshift({ type: 'Feature', id: id++, properties: { h: -1, v: 0, b: 1, i: -1 }, geometry: { type: 'MultiPolygon', coordinates: unclaimed } });
  const file = `${year < 0 ? 'bc' + -year : year}.json`;
  const text = JSON.stringify({ type: 'FeatureCollection', features: feats });
  fs.writeFileSync(path.join(out, file), text); total += text.length;
  years.push({ year, file, n: feats.length - (unclaimed.length ? 1 : 0) });
  console.log(String(year).padStart(8), file.padEnd(14), String(feats.length).padStart(5), 'shapes', Math.round(text.length / 1024) + ' KB');
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(years));
console.log('snapshots', years.length, '| total MB', (total / 1048576).toFixed(1));
