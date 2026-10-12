// Religion by country, 2010 (estimate) and 2020-2050 (projections), from Pew Research Center via datasets/world-religion-projections (CC BY 4.0).
// Input:  scripts/.cache/relpop.csv   (curl -o scripts/.cache/relpop.csv https://raw.githubusercontent.com/datasets/world-religion-projections/main/rounded_population.csv)
// Output: public/data/religion.json   { years:[2010,...], groups:[...], c:{ ISO3: { "2010": [share of each group in tenths of a percent], ..., t:{ "2010": total people } } } }
import fs from 'node:fs';
const GROUPS = ['Christians', 'Muslims', 'Unaffiliated', 'Hindus', 'Buddhists', 'Folk Religions', 'Other Religions', 'Jews'];
const countries = JSON.parse(fs.readFileSync('public/data/countries.json'));
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\bthe\b/g, '').trim();
const byName = new Map();
for (const c of Object.values(countries)) for (const n of [c.name, c.official]) if (n) byName.set(norm(n), c.id);
const ALIAS = { 'bahamas': 'BHS', 'brunei': 'BRN', 'burma myanmar': 'MMR', 'myanmar': 'MMR', 'cape verde': 'CPV', 'czech republic': 'CZE', 'czechia': 'CZE', 'democratic republic of the congo': 'COD', 'dr congo': 'COD', 'republic of the congo': 'COG', 'congo': 'COG', 'cote d ivoire': 'CIV', 'ivory coast': 'CIV', 'federated states of micronesia': 'FSM', 'micronesia': 'FSM', 'gambia': 'GMB', 'hong kong': 'HKG', 'macau': 'MAC', 'north korea': 'PRK', 'south korea': 'KOR', 'laos': 'LAO', 'macedonia': 'MKD', 'north macedonia': 'MKD', 'moldova': 'MDA', 'palestinian territories': 'PSE', 'palestine': 'PSE', 'russia': 'RUS', 'swaziland': 'SWZ', 'eswatini': 'SWZ', 'syria': 'SYR', 'taiwan': 'TWN', 'tanzania': 'TZA', 'timor leste': 'TLS', 'east timor': 'TLS', 'united states': 'USA', 'united kingdom': 'GBR', 'vietnam': 'VNM', 'venezuela': 'VEN', 'bolivia': 'BOL', 'iran': 'IRN', 'sao tome and principe': 'STP', 'saint vincent and the grenadines': 'VCT', 'saint lucia': 'LCA', 'saint kitts and nevis': 'KNA', 'reunion': 'REU', 'puerto rico': 'PRI', 'western sahara': 'ESH', 'kosovo': 'XKX', 'curacao': 'CUW', 'guadeloupe': 'GLP', 'martinique': 'MTQ', 'french guiana': 'GUF', 'french polynesia': 'PYF', 'new caledonia': 'NCL', 'guam': 'GUM', 'bermuda': 'BMU', 'cayman islands': 'CYM', 'aruba': 'ABW', 'channel islands': '', 'mayotte': 'MYT', 'us virgin islands': 'VIR', 'samoa': 'WSM', 'american samoa': 'ASM', 'isle of man': 'IMN', 'greenland': 'GRL', 'vatican city': 'VAT', 'turkey': 'TUR', 'bosnia herzegovina': 'BIH', 'republic of macedonia': 'MKD', 'st kitts and nevis': 'KNA', 'st lucia': 'LCA', 'st vincent and the grenadines': 'VCT', 'faeroe islands': 'FRO', 'falkland islands malvinas': 'FLK', 'u s virgin islands': 'VIR', 'tuvalu': 'TUV', 'turkiye': 'TUR' };
const txt = fs.readFileSync('scripts/.cache/relpop.csv', 'latin1').split(/\r?\n/).filter(Boolean);
const head = txt.shift().split(',').map((s) => s.trim());
const col = (n) => head.indexOf(n);
const out = {}, years = new Set(), miss = new Set();
for (const line of txt) {
  const f = line.split(',').map((s) => s.trim());
  const country = f[col('Country')]; if (!country || country === 'All Countries') continue;
  const key = norm(country); const id = ALIAS[key] !== undefined ? ALIAS[key] : byName.get(key);
  if (!id || !countries[id]) { miss.add(country); continue; }
  const y = f[col('Year')], total = Number(f[col('All Religions')]); if (!total) continue;
  years.add(+y);
  const shares = GROUPS.map((g) => Math.round(Number(f[col(g)]) / total * 1000));
  const e = (out[id] ||= { t: {} }); e[y] = shares; e.t[y] = total;
}
fs.writeFileSync('public/data/religion.json', JSON.stringify({ years: [...years].sort(), groups: GROUPS, source: 'Pew Research Center (via datasets/world-religion-projections, CC BY 4.0)', c: out }));
console.log('countries:', Object.keys(out).length, '· unmatched:', [...miss].join('; ') || 'none');
