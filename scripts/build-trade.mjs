// Builds public/data/trade.json: each country's top export and import partners (goods, 2023).
// Source: World Bank WITS (CC BY 4.0), via a public copy of the data on GitHub:
//   git clone --depth 1 --filter=blob:none --no-checkout https://github.com/solankivedant/WorldTradeWeb scripts/.cache/WorldTradeWeb
//   (then check out data/processed/bilateral.json and totals.json)
// Format: { year, c: { USA: { x: [total, [[partner, value], ...]], m: [...] } } }
import fs from 'node:fs';
const dir = 'scripts/.cache/WorldTradeWeb/data/processed/';
const countries = JSON.parse(fs.readFileSync('public/data/countries.json', 'utf8'));
const ALIAS = { XKX: 'UNK' };
const fix = (c) => ALIAS[c] || c;
const bil = JSON.parse(fs.readFileSync(dir + 'bilateral.json', 'utf8'));
const totals = JSON.parse(fs.readFileSync(dir + 'totals.json', 'utf8'));
const by = {};
for (const r of bil) {
  const a = fix(r.r), p = fix(r.p);
  if (!countries[a] || !countries[p] || a === p || !(r.v > 0)) continue;
  const f = r.f === 'x' ? 'x' : 'm';
  (((by[a] ??= { x: {}, m: {} })[f])[p] = ((by[a][f][p]) || 0) + r.v);
}
// countries that report nothing themselves: use their partners' records (a partner's imports from X are X's exports to it)
const mir = {};
for (const r of bil) {
  const a = fix(r.r), p = fix(r.p);
  if (by[p] || !countries[p] || !countries[a] || a === p || !(r.v > 0)) continue;
  const f = r.f === 'm' ? 'x' : 'm'; // flip the direction
  (((mir[p] ??= { x: {}, m: {} })[f])[a] = ((mir[p][f][a]) || 0) + r.v);
}
const c = {};
for (const [id, d] of Object.entries({ ...mir, ...by })) {
  const out = {};
  for (const f of ['x', 'm']) {
    const list = Object.entries(d[f]).sort((a, b) => b[1] - a[1]);
    const t = (by[id] && totals[id]?.['2023']?.[f]) || list.reduce((s, e) => s + e[1], 0);
    out[f] = [Math.round(t), list.slice(0, 7).map(([p, v]) => [p, Math.round(v)])];
  }
  if (!by[id]) out.mirror = 1;
  c[id] = out;
}
fs.writeFileSync('public/data/trade.json', JSON.stringify({ year: 2023, c }));
console.log(Object.keys(c).length, 'countries,', Math.round(fs.statSync('public/data/trade.json').size / 1024), 'KB');
