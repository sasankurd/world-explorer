import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sharesOf, worldShares, seriesFor, biggest, pct, GROUPS, YEARS } from '../src/religion.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/religion.json', import.meta.url)));

test('shares add up to 1 and the biggest group is right for known countries', () => {
  for (const [id, want] of [['IRQ', 1], ['USA', 0], ['IND', 3], ['THA', 4], ['JPN', 2]]) {
    const s = sharesOf(data, id, 2010); assert.ok(s, id);
    assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.equal(biggest(s), want, id + ' → ' + GROUPS[biggest(s)].label);
  }
});
test('untrustworthy rows are left out instead of drawn', () => {
  assert.equal(sharesOf(data, 'AIA', 2010), null);      // sums to 800%: tiny numbers rounded by Pew
  assert.equal(sharesOf(data, 'XXX', 2010), null);
  assert.equal(sharesOf(null, 'IRQ', 2010), null);
});
test('world shares match the published Pew totals closely', () => {
  const w = worldShares(data, 2010);
  const pctOf = (k) => w[GROUPS.findIndex((g) => g.key === k)] * 100;
  assert.ok(Math.abs(pctOf('christians') - 31.4) < 1, 'christians ' + pctOf('christians'));
  assert.ok(Math.abs(pctOf('muslims') - 23.2) < 1, 'muslims');
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(pctOf('muslims') < worldShares(data, 2050)[1] * 100, 'muslim share is projected to grow');
});
test('a statistic series has values only in the five data years, in percent', () => {
  const s = seriesFor(data, 1);                          // Muslims
  assert.equal(s.step, 10); assert.equal(s.first, 2010); assert.equal(s.last, 2050);
  const a = s.v.IRQ; assert.ok(a[0] > 95 && a[0] <= 100); assert.equal(a[5], null); assert.ok(a[40] > 95);
  assert.equal(s.v.AIA, undefined);
});
test('percent labels stay honest for small values', () => {
  assert.equal(pct(0.0004), '<0.5%'); assert.equal(pct(0), '0%'); assert.equal(pct(0.5), '50%'); assert.equal(pct(0.034), '3.4%'); assert.equal(pct(0.999), '100%');
  assert.deepEqual(YEARS, [2010, 2020, 2030, 2040, 2050]);
});
