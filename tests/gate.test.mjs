import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocked } from '../src/workspace/gate.js';

test('the map is locked until there is a project', () => {
  assert.equal(isLocked({ status: 'ready', count: 0 }), true);
  assert.equal(isLocked({ status: 'ready', count: 1 }), false);
  assert.equal(isLocked({ status: 'ready', count: 7 }), false);
  assert.equal(isLocked({}), true);
});
test('it stays locked while projects load or when they cannot be read', () => {
  assert.equal(isLocked({ status: 'loading', count: 3 }), true);
  assert.equal(isLocked({ status: 'error', count: 3 }), true);
});
test('a shared read-only project and the repair path can get in', () => {
  assert.equal(isLocked({ status: 'ready', count: 0, sharedOpen: true }), false);
  assert.equal(isLocked({ status: 'error', count: 0, bypass: true }), false);
});
