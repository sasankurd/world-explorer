// Builds public/data/timezones.json: { COUNTRY_ID: [mainZone, ...otherZones] }
//  - mainZone is the time zone of the capital city (found from the capital's location)
//  - otherZones lists only zones whose clock actually differs (winter and summer), so the US has ~6, not 29
// Needs two helper packages, installed WITHOUT touching package.json:
//    npm install --no-save tz-lookup countries-and-timezones
// Run after build-data.mjs and build-cities.mjs:   node scripts/build-timezones.mjs
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tzlookup = require('tz-lookup');
const ct = require('countries-and-timezones');

const countries = Object.values(JSON.parse(fs.readFileSync('public/data/countries.json', 'utf8')));
const cities = JSON.parse(fs.readFileSync('public/data/cities.json', 'utf8'));
const capLoc = {};
for (const r of cities) if (r[4] === 1 && r[5]) capLoc[r[5]] = [r[1], r[2]];

const valid = (z) => { try { new Intl.DateTimeFormat('en', { timeZone: z }); return true; } catch { return false; } };
const y = new Date().getUTCFullYear();
const offset = (zone, date) => { // minutes ahead of UTC
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(date)) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 60000);
};
const sig = (z) => offset(z, new Date(Date.UTC(y, 0, 15))) + '|' + offset(z, new Date(Date.UTC(y, 6, 15)));

// pass 1: each country's main zone (its capital's)
const mains = {}, notes = [];
for (const c of countries) {
  const zones = (ct.getCountry(c.iso2)?.timezones || []).filter(valid);
  let main = null;
  const loc = capLoc[c.id] || (c.latlng && [c.latlng[1], c.latlng[0]]);
  if (loc) { try { const z = tzlookup(loc[1], loc[0]); if (valid(z)) main = z; } catch { /* fall through */ } }
  if (!main) main = zones[0];
  if (!main) { notes.push(`${c.name}: no time zone found`); continue; }
  if (!capLoc[c.id]) notes.push(`${c.name}: used country centre (${main})`);
  mains[c.id] = main;
}
// a zone that is some OTHER country's main zone (e.g. Asia/Tokyo is Japan's, but the package also lists it under Australia) is dropped
const mainOf = {};
for (const [id, z] of Object.entries(mains)) (mainOf[z] = mainOf[z] || new Set()).add(id);

// pass 2: the list of zones whose clocks really differ (winter and summer)
const out = {};
for (const c of countries) {
  const main = mains[c.id]; if (!main) continue;
  const seen = new Set([sig(main)]), list = [main];
  for (const z of (ct.getCountry(c.iso2)?.timezones || []).filter(valid)) {
    if (mainOf[z] && !mainOf[z].has(c.id)) continue;
    const s = sig(z); if (!seen.has(s)) { seen.add(s); list.push(z); }
  }
  out[c.id] = list;
}
fs.writeFileSync('public/data/timezones.json', JSON.stringify(out));
const multi = Object.entries(out).filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([k, v]) => `${k}:${v.length}`);
console.log('countries with a time zone:', Object.keys(out).length, '| KB', Math.round(fs.statSync('public/data/timezones.json').size / 1024));
console.log('most zones:', multi.join(', '));
console.log('notes:', notes.join(' | ') || 'none');
for (const id of ['IRQ', 'USA', 'RUS', 'BRA', 'KAZ', 'CHN', 'IND', 'AUS']) console.log(id, JSON.stringify(out[id]));
