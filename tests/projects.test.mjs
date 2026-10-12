// Unit tests for the Projects data layer. Run with: npm test  (uses Node's built-in test runner, no extra packages)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject, validateProjectInput, sanitizeProject, sanitizeLayers, sanitizeView, addPlace, updatePlace, removePlace,
  addNote, updateNote, removeNote, setViewAndLayers, ago, LIMITS,
} from '../src/projects/model.js';
import { createStore } from '../src/projects/store.js';
import { encodeShare, decodeShare, MAX_PAYLOAD } from '../src/projects/share.js';
import { createRecent } from '../src/projects/recent.js';

const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m };
};
const mk = (name = 'Trip') => { const r = createProject({ name, description: 'd', visibility: 'private' }, 1000); assert.ok(r.ok); return r.value; };
const iraq = { name: 'Iraq', kind: 'country', ref: 'IRQ', lng: 43.7, lat: 33.0 };

test('a project needs a name and respects length limits', () => {
  assert.equal(validateProjectInput({ name: '   ' }).ok, false);
  assert.equal(validateProjectInput({ name: 'x'.repeat(LIMITS.name + 1) }).errors.name.includes('under'), true);
  const v = validateProjectInput({ name: '  My World Tour ', description: undefined, visibility: 'weird' });
  assert.deepEqual(v.value, { name: 'My World Tour', description: '', visibility: 'private' });
  assert.equal(validateProjectInput({ name: 'a', visibility: 'link' }).value.visibility, 'link');
});

test('control characters are stripped from text', () => {
  const v = validateProjectInput({ name: 'A\u0000B\u0007C' });
  assert.equal(v.value.name, 'ABC');
});

test('places: add, de-duplicate, edit, remove', () => {
  let p = mk();
  let r = addPlace(p, iraq, 2000); assert.ok(r.ok && !r.duplicate); p = r.project;
  assert.equal(p.updatedAt, 2000);
  r = addPlace(p, { ...iraq, lng: 44, lat: 34 }, 3000); assert.ok(r.duplicate, 'same country is not added twice'); assert.equal(r.project.updatedAt, 2000);
  r = addPlace(p, { name: 'Erbil', kind: 'city', ref: 'IRQ', lng: 44.01, lat: 36.19 }, 3000); assert.ok(r.ok && !r.duplicate); p = r.project;
  assert.equal(p.places.length, 2);
  const id = p.places[1].id;
  r = updatePlace(p, id, { name: 'Hawler', note: 'visit the citadel' }, 4000); assert.equal(r.project.places[1].name, 'Hawler'); p = r.project;
  assert.equal(updatePlace(p, id, { name: '   ' }).ok, false);
  r = removePlace(p, id, 5000); assert.equal(r.project.places.length, 1);
  assert.equal(removePlace(r.project, id).ok, false);
});

test('places with bad coordinates or no name are refused', () => {
  const p = mk();
  assert.equal(addPlace(p, { name: 'x', lng: 999, lat: 0 }).ok, false);
  assert.equal(addPlace(p, { name: '', lng: 1, lat: 1 }).ok, false);
  assert.equal(addPlace(p, { name: 'x', lng: NaN, lat: 1 }).ok, false);
});

test('place limit is enforced', () => {
  let p = mk();
  for (let i = 0; i < LIMITS.places; i++) p = addPlace(p, { name: 'p' + i, lng: i / 10, lat: (i % 80) - 40 + i / 1000 }).project;
  assert.equal(p.places.length, LIMITS.places);
  assert.equal(addPlace(p, { name: 'one more', lng: 100.5, lat: 10.5 }).ok, false);
});

test('notes: add, edit, remove, and unlink when their place is removed', () => {
  let p = addPlace(mk(), iraq).project;
  const pid = p.places[0].id;
  let r = addNote(p, '  Visit in spring ', pid, 10); assert.ok(r.ok); p = r.project;
  assert.equal(p.notes[0].text, 'Visit in spring'); assert.equal(p.notes[0].placeId, pid);
  assert.equal(addNote(p, '   ').ok, false);
  r = updateNote(p, p.notes[0].id, 'Visit in autumn', 20); assert.equal(r.project.notes[0].text, 'Visit in autumn'); assert.equal(r.project.notes[0].updatedAt, 20); p = r.project;
  assert.equal(updateNote(p, p.notes[0].id, '').ok, false);
  p = removePlace(p, pid).project; assert.equal(p.notes[0].placeId, '');
  p = removeNote(p, p.notes[0].id).project; assert.equal(p.notes.length, 0);
});

test('a note cannot point at a place that is not in the project', () => {
  const r = addNote(mk(), 'hello', 'pl_doesnotexist');
  assert.equal(r.project.notes[0].placeId, '');
});

test('view and layers are validated', () => {
  assert.equal(sanitizeView({ center: [200, 10], zoom: 3 }) !== null, true);
  assert.equal(sanitizeView({ center: [0, 95], zoom: 3 }), null);
  assert.equal(sanitizeView({ center: [0, 0], zoom: 99 }), null);
  assert.equal(sanitizeView('x'), null);
  assert.deepEqual(sanitizeLayers({ base: 'nonsense', flights: 'yes', theme: 'light' }), { base: 'political', theme: 'light', names: true, times: false, flights: false, trade: false, stats: '' });
  const r = setViewAndLayers(mk(), { center: [43.7, 33], zoom: 5.234 }, { base: 'satellite', flights: true });
  assert.equal(r.project.view.zoom, 5.23); assert.equal(r.project.layers.base, 'satellite'); assert.equal(r.project.layers.flights, true);
  assert.equal(setViewAndLayers(mk(), null, {}).ok, false);
});

test('sanitizeProject repairs or drops bad data', () => {
  assert.equal(sanitizeProject(null), null);
  assert.equal(sanitizeProject({ name: '' }), null);
  const p = sanitizeProject({ name: 'X', places: [{ name: 'ok', lng: 1, lat: 2 }, { name: 'bad', lng: 'a', lat: 2 }, 7], notes: [{ text: 'hi', placeId: 'pl_unknownid' }, { text: '' }], visibility: 'public', layers: { base: 'osm' } });
  assert.equal(p.places.length, 1); assert.equal(p.notes.length, 1); assert.equal(p.notes[0].placeId, ''); assert.equal(p.visibility, 'private'); assert.equal(p.layers.base, 'osm');
});

test('ago() phrases', () => {
  const n = 10_000_000;
  assert.equal(ago(n - 5000, n), 'just now'); assert.equal(ago(n - 5 * 60000, n), '5 minutes ago');
  assert.equal(ago(n - 3 * 3600000, n), '3 hours ago'); assert.equal(ago(n - 86400000, n), 'yesterday');
});

test('store: create, persist, reload and sort by last update', () => {
  const s = memory(); const a = createStore({ storage: s, now: () => 1 }); a.init();
  assert.equal(a.state.status, 'ready'); assert.deepEqual(a.list(), []);
  const r = a.create({ name: 'My World Tour' }); assert.ok(r.ok && r.saved);
  let t = 5; const b = createStore({ storage: s, now: () => t++ }); b.init();
  assert.equal(b.list()[0].name, 'My World Tour');
  b.create({ name: 'Second' }); b.update(r.project.id, (p) => addPlace(p, iraq, 9999));
  assert.equal(b.list()[0].name, 'My World Tour', 'the most recently changed project comes first');
});

test('store: edit and remove, with undo through restore', () => {
  const st = createStore({ storage: memory() }); st.init();
  const p = st.create({ name: 'A' }).project;
  assert.equal(st.edit(p.id, { name: '' }).ok, false);
  assert.equal(st.edit(p.id, { name: 'B', description: 'x', visibility: 'link' }).ok, true);
  assert.equal(st.get(p.id).visibility, 'link');
  const gone = st.get(p.id); assert.ok(st.remove(p.id).ok); assert.equal(st.list().length, 0);
  assert.equal(st.remove(p.id).ok, false);
  assert.ok(st.restore(gone).ok); assert.equal(st.list().length, 1);
});

test('store: a change made in another tab is not overwritten', () => {
  const s = memory(); const t1 = createStore({ storage: s }), t2 = createStore({ storage: s }); t1.init(); t2.init();
  t1.create({ name: 'From tab 1' }); t2.create({ name: 'From tab 2' });
  assert.deepEqual(t2.list().map((p) => p.name).sort(), ['From tab 1', 'From tab 2']);
});

test('store: damaged data gives an error state, is not overwritten, and can be reset with a backup copy', () => {
  const s = memory({ 'we-projects-v1': '{not json' }); const st = createStore({ storage: s }); st.init();
  assert.equal(st.state.status, 'error');
  assert.equal(st.create({ name: 'x' }).ok, false);
  assert.equal(s.getItem('we-projects-v1'), '{not json');
  assert.ok(st.resetDamaged().ok); assert.equal(st.state.status, 'ready');
  assert.equal([...s._m.keys()].some((k) => k.startsWith('we-projects-v1-damaged-')), true);
});

test('store: data from a newer version is refused, not overwritten', () => {
  const raw = JSON.stringify({ v: 99, projects: [] }); const s = memory({ 'we-projects-v1': raw });
  const st = createStore({ storage: s }); st.init();
  assert.equal(st.state.status, 'error'); assert.equal(st.state.error.newer, true); assert.equal(st.create({ name: 'x' }).ok, false); assert.equal(s.getItem('we-projects-v1'), raw);
});

test('store: when saving fails the change stays in memory and a warning is returned', () => {
  const s = memory(); s.setItem = () => { throw new Error('QuotaExceededError'); };
  const st = createStore({ storage: s }); st.init();
  const r = st.create({ name: 'Unsaved' });
  assert.equal(r.ok, true); assert.equal(r.saved, false); assert.match(r.warning, /could not save/i);
  assert.equal(st.list().length, 1); assert.equal(st.state.persistent, false);
});

test('store: with no storage at all it still works for the session and says so', () => {
  const st = createStore({ storage: null }); st.init();
  assert.equal(st.state.status, 'ready'); assert.equal(st.state.persistent, false);
  const r = st.create({ name: 'Temp' }); assert.equal(r.ok, true); assert.equal(r.saved, false);
});

test('store: export then import adds copies and never overwrites', () => {
  const a = createStore({ storage: memory() }); a.init();
  const p = a.create({ name: 'Climate Case Studies' }).project; a.update(p.id, (x) => addPlace(x, iraq));
  const text = a.exportJson();
  const b = createStore({ storage: memory() }); b.init();
  const r = b.importJson(text); assert.ok(r.ok); assert.equal(r.imported, 1);
  assert.equal(b.list()[0].places.length, 1); assert.notEqual(b.list()[0].id, p.id);
  assert.ok(b.importJson(text).ok); assert.equal(b.list().length, 2);
  assert.equal(b.importJson('nope').ok, false); assert.equal(b.importJson(JSON.stringify({ projects: [] })).ok, false);
});

test('store: project count limit', () => {
  const st = createStore({ storage: memory() }); st.init();
  for (let i = 0; i < LIMITS.projects; i++) assert.ok(st.create({ name: 'p' + i }).ok);
  assert.equal(st.create({ name: 'one more' }).ok, false);
});

test('share: a project survives a round trip as a copy with fresh ids', async () => {
  let p = mk('Shared trip'); p = addPlace(p, iraq).project; p = addNote(p, 'Bring a hat', p.places[0].id).project; p = addNote(p, 'General note').project;
  p = setViewAndLayers(p, { center: [43.7, 33], zoom: 5 }, { base: 'terrain', flights: true }).project;
  const enc = await encodeShare(p); assert.ok(enc.ok, enc.error);
  const dec = await decodeShare(enc.payload); assert.ok(dec.ok);
  const q = dec.project;
  assert.equal(q.name, 'Shared trip'); assert.equal(q.places.length, 1); assert.equal(q.notes.length, 2);
  assert.equal(q.notes[0].placeId, q.places[0].id); assert.equal(q.notes[1].placeId, '');
  assert.equal(q.layers.base, 'terrain'); assert.equal(q.layers.flights, true); assert.deepEqual(q.view.center, [43.7, 33]);
  assert.notEqual(q.id, p.id); assert.equal(q.visibility, 'private');
});

test('share: damaged, hostile and oversized links are refused', async () => {
  for (const bad of ['', 'z.', 'z.!!!notbase64', 'q.abcd', 'z.AAAA', 'j.' + Buffer.from('{"v":2}').toString('base64url'), 'j.' + Buffer.from('[]').toString('base64url'), 'x'.repeat(MAX_PAYLOAD + 5), null, 42]) {
    const r = await decodeShare(bad); assert.equal(r.ok, false, String(bad).slice(0, 20));
  }
  // a tiny payload that expands to a huge one must be stopped by the size cap
  const { deflateRawSync } = await import('node:zlib');
  const bomb = 'z.' + deflateRawSync(Buffer.from('"' + 'a'.repeat(4e6) + '"')).toString('base64url');
  assert.equal((await decodeShare(bomb)).ok, false);
});

test('share: markup in a shared link is kept as plain text, ready to be shown with textContent', async () => {
  const evil = '<img src=x onerror=alert(1)>';
  const payload = 'j.' + Buffer.from(JSON.stringify({ v: 1, n: evil, d: evil, p: [[evil, 10, 10, 'point', '', evil]], t: [[evil, 0]], w: null, l: {} })).toString('base64url');
  const r = await decodeShare(payload); assert.ok(r.ok);
  assert.equal(r.project.name, evil); // stored as text; the screens never put it in innerHTML unescaped (see ui.js esc())
  assert.equal(r.project.visibility, 'private');
});

test('share: too-big projects explain what to do', async () => {
  let p = mk('Big');
  for (let i = 0; i < LIMITS.places; i++) p = addPlace(p, { name: 'Place number ' + i + ' ' + Math.random().toString(36).slice(2), lng: (i * 7.3) % 170, lat: ((i * 3.1) % 80) - 40, note: Math.random().toString(36).repeat(8) }).project;
  const r = await encodeShare(p); assert.equal(r.ok, false); assert.match(r.error, /too big/);
});

test('recent activity keeps the latest few, newest first, without duplicates', () => {
  let t = 0; const rc = createRecent({ storage: memory(), max: 3, now: () => ++t });
  for (const n of ['A', 'B', 'C', 'A', 'D']) rc.push({ kind: 'point', name: n, lng: 1, lat: 1 });
  assert.deepEqual(rc.list().map((r) => r.name), ['D', 'A', 'C']);
  rc.push({ kind: 'point', name: '', lng: 1, lat: 1 }); assert.equal(rc.list().length, 3);
});

test('the statistics layer is saved only for built-in statistics', () => {
  assert.equal(sanitizeLayers({ stats: 'rel_muslims' }).stats, 'rel_muslims');
  assert.equal(sanitizeLayers({ stats: 'c_my_own' }).stats, '');
  assert.equal(sanitizeLayers({ stats: '<img onerror=x>' }).stats, '');
  assert.equal(sanitizeLayers({}).stats, '');
});
