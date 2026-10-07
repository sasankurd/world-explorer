// Builds public/data/cities.json: [name, lng, lat, population, isCapital, countryId (all cities where known)]
//
// Sources
//  - Natural Earth "populated places" (public domain). Downloaded once into scripts/.cache/
//  - GeoNames via the "all-the-cities" package, ONLY as a fallback to find where some capitals are.
//    Install it without touching package.json:  npm install --no-save all-the-cities
//
// Run with:  node scripts/build-cities.mjs
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';
const cache = 'scripts/.cache/places.geojson';
if (!fs.existsSync(cache)) {
  fs.mkdirSync('scripts/.cache', { recursive: true });
  const r = await fetch(NE_URL);
  if (!r.ok) throw new Error('Could not download Natural Earth places: HTTP ' + r.status);
  fs.writeFileSync(cache, Buffer.from(await r.arrayBuffer()));
}
const countries = Object.values(JSON.parse(fs.readFileSync('public/data/countries.json', 'utf8')));
const NE = JSON.parse(fs.readFileSync(cache, 'utf8')).features
  .map((f) => ({ ...f.properties, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], used: false }))
  .filter((p) => !/station|historic/i.test(p.featurecla));

let GN = [];
try { GN = require('all-the-cities'); } catch { console.warn('all-the-cities not installed: some small capitals may be missing'); }

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const dist = (a, b) => Math.hypot((a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat);

// ---- capitals: name from our country data, location from the sources ----
const capitals = [], missing = [];
for (const c of countries) {
  if (!c.capital) continue;
  const want = norm(c.capital);
  const neIn = NE.filter((p) => p.adm0_a3 === c.id || p.iso_a2 === c.iso2);
  const nameHit = (p) => [p.name, p.nameascii, ...(p.namealt || '').split(/[;,]/)].some((n) => norm(n) === want);
  let hit = neIn.filter(nameHit).sort((a, b) => b.pop_max - a.pop_max)[0];
  let entry = null;
  if (hit) { hit.used = true; entry = { id: c.id, name: c.capital, lng: hit.lng, lat: hit.lat, pop: hit.pop_max }; }
  if (!entry) {
    const g = GN.filter((x) => x.country === c.iso2 && norm(x.name) === want).sort((a, b) => b.population - a.population)[0];
    if (g) {
      entry = { id: c.id, name: c.capital, lng: g.loc.coordinates[0], lat: g.loc.coordinates[1], pop: g.population };
      // the same city may be in the Natural Earth list under another spelling: drop that duplicate
      for (const p of neIn) if (dist(p, entry) < 0.25) p.used = true;
    }
  }
  if (!entry) { // last resort: whatever Natural Earth flags as this country's capital
    const p = neIn.filter((q) => q.adm0cap == 1)[0];
    if (p) { p.used = true; entry = { id: c.id, name: c.capital, lng: p.lng, lat: p.lat, pop: p.pop_max }; }
  }
  if (entry) capitals.push(entry); else missing.push(`${c.name}: ${c.capital}`);
}

// ---- other cities ----
const IQ_FIX = { Irbil: 'Erbil' };
const clean = (p) => {
  let n = p.name;
  if (p.iso_a2 === 'IQ') n = IQ_FIX[n] || n.replace(/^(Al|An|Ar|As|Ad|Ash|At|Az) /, '');
  return n;
};
const others = NE.filter((p) => !p.used && (p.pop_max >= 50000 || (/Admin-1.*capital/.test(p.featurecla) && p.pop_max >= 10000)))
  .map((p) => ({ name: clean(p), lng: p.lng, lat: p.lat, pop: Math.max(p.pop_max, 20000), id: countries.find((c) => c.id === p.adm0_a3 || c.iso2 === p.iso_a2)?.id }));

const r2 = (n) => Math.round(n * 100) / 100;
const out = [
  ...capitals.map((c) => [c.name, r2(c.lng), r2(c.lat), c.pop || 0, 1, c.id]), // 6th value = country id (capitals only)
  ...others.map((c) => (c.id ? [c.name, r2(c.lng), r2(c.lat), c.pop, 0, c.id] : [c.name, r2(c.lng), r2(c.lat), c.pop, 0])),
];
fs.writeFileSync('public/data/cities.json', JSON.stringify(out));
console.log('capitals', capitals.length, '| other cities', others.length, '| file KB', Math.round(fs.statSync('public/data/cities.json').size / 1024));
console.log('capitals with no location found:', missing.join(' | ') || 'none');
const iq = out.filter((c) => Math.abs(c[1] - 44) < 4 && Math.abs(c[2] - 35) < 3 && c[3] > 300000).map((c) => c[0]);
console.log('Iraq-area cities >300k:', iq.join(', '));
