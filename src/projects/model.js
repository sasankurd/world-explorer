// Project data model: shapes, limits, sanitising and small immutable update helpers.
// No DOM and no storage in here, so it can be tested in plain Node and reused if projects ever move to a server.

export const SCHEMA_VERSION = 1;
export const LIMITS = { projects: 100, places: 200, notes: 200, name: 80, description: 500, placeName: 120, placeNote: 500, note: 2000 };
export const VISIBILITY = {
  private: { label: 'Private', hint: 'Only you, on this device. Nothing is shared.' },
  link: { label: 'Can be shared as a link', hint: 'Lets you make a read-only snapshot link. It is a copy, not a live page.' },
};
export const BASES = ['political', 'terrain', 'satellite', 'osm', 'globe'];
export const PLACE_KINDS = ['country', 'city', 'place', 'point'];

// strip control characters, trim, and cap the length
export const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const inRange = (v, lo, hi) => num(v) !== null && v >= lo && v <= hi;
const time = (v, fallback) => (inRange(v, 0, 8.64e15) ? Math.round(v) : fallback);

let counter = 0;
export function newId(prefix = 'x') {
  const c = globalThis.crypto;
  if (c?.randomUUID) return prefix + '_' + c.randomUUID().replace(/-/g, '').slice(0, 16);
  counter += 1;
  return prefix + '_' + Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 8);
}
const validId = (v) => (typeof v === 'string' && /^[a-z]{1,3}_[A-Za-z0-9]{4,40}$/.test(v) ? v : null);

// ---------- map view and layers ----------
export function sanitizeView(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw.center;
  if (!Array.isArray(c) || !inRange(c[0], -540, 540) || !inRange(c[1], -85.1, 85.1) || !inRange(raw.zoom, 0, 22)) return null;
  return { center: [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5], zoom: Math.round(raw.zoom * 100) / 100 };
}
// the Statistics layer: which built-in statistic was showing ('' = layer off). Your own added statistics live in this browser only, so they are not saved here.
export const STAT_LABELS = { population: 'Population', growth: 'Population growth', density: 'Density', internet: 'Internet users', lifeexp: 'Age span', gdp: 'Economy', gdppc: 'Income per person', tourism: 'Tourists', milspend: 'Military spending', milgdp: 'Military % of economy', armed: 'Armed forces', area: 'Area', rel_christians: 'Religion: Christians', rel_muslims: 'Religion: Muslims', rel_unaffiliated: 'Religion: Unaffiliated', rel_hindus: 'Religion: Hindus', rel_buddhists: 'Religion: Buddhists', rel_folk: 'Religion: Folk religions', rel_other: 'Religion: Other religions', rel_jews: 'Religion: Jews' };
export function sanitizeLayers(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    base: BASES.includes(r.base) ? r.base : 'political',
    theme: r.theme === 'light' ? 'light' : 'dark',
    names: r.names !== false,
    times: r.times === true,
    flights: r.flights === true,
    trade: r.trade === true,
    stats: typeof r.stats === 'string' && Object.hasOwn(STAT_LABELS, r.stats) ? r.stats : '',
  };
}
export const defaultLayers = () => sanitizeLayers({});

// ---------- places and notes ----------
export function sanitizePlace(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lng = raw.lng, lat = raw.lat;
  if (!inRange(lng, -540, 540) || !inRange(lat, -90, 90)) return null;
  const name = cleanText(raw.name, LIMITS.placeName);
  if (!name) return null;
  const ref = typeof raw.ref === 'string' && /^[A-Z]{3}$/.test(raw.ref) ? raw.ref : '';
  return {
    id: validId(raw.id) || newId('pl'),
    name,
    kind: PLACE_KINDS.includes(raw.kind) ? raw.kind : 'point',
    ref, // the 3-letter country id for country places and for cities (their country)
    lng: Math.round(lng * 1e5) / 1e5,
    lat: Math.round(lat * 1e5) / 1e5,
    note: cleanText(raw.note, LIMITS.placeNote),
    addedAt: time(raw.addedAt, Date.now()),
  };
}
export function sanitizeNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = cleanText(raw.text, LIMITS.note);
  if (!text) return null;
  const created = time(raw.createdAt, Date.now());
  return { id: validId(raw.id) || newId('nt'), text, placeId: validId(raw.placeId) || '', createdAt: created, updatedAt: time(raw.updatedAt, created) };
}

// ---------- projects ----------
export function sanitizeProject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, LIMITS.name);
  if (!name) return null;
  const created = time(raw.createdAt, Date.now());
  const places = [], seen = new Set();
  for (const p of Array.isArray(raw.places) ? raw.places : []) {
    const s = sanitizePlace(p);
    if (s && !seen.has(s.id) && places.length < LIMITS.places) { seen.add(s.id); places.push(s); }
  }
  const notes = [], seenN = new Set();
  for (const n of Array.isArray(raw.notes) ? raw.notes : []) {
    const s = sanitizeNote(n);
    if (s && !seenN.has(s.id) && notes.length < LIMITS.notes) { seenN.add(s.id); notes.push(s.placeId && !seen.has(s.placeId) ? { ...s, placeId: '' } : s); }
  }
  return {
    id: validId(raw.id) || newId('pj'),
    name,
    description: cleanText(raw.description, LIMITS.description),
    visibility: raw.visibility === 'link' ? 'link' : 'private',
    places, notes,
    view: sanitizeView(raw.view),
    layers: sanitizeLayers(raw.layers),
    createdAt: created,
    updatedAt: time(raw.updatedAt, created),
  };
}

// Checks what a person typed in the create/edit form. Returns the cleaned values or a message per field.
export function validateProjectInput(input) {
  const name = cleanText(input?.name, LIMITS.name + 1), errors = {};
  if (!name) errors.name = 'Give the project a name.';
  else if (name.length > LIMITS.name) errors.name = `Keep the name under ${LIMITS.name} characters.`;
  const description = cleanText(input?.description, LIMITS.description + 1);
  if (description.length > LIMITS.description) errors.description = `Keep the description under ${LIMITS.description} characters.`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, description, visibility: input?.visibility === 'link' ? 'link' : 'private' } };
}

export function createProject(input, now = Date.now()) {
  const v = validateProjectInput(input);
  if (!v.ok) return v;
  return { ok: true, value: { id: newId('pj'), ...v.value, places: [], notes: [], view: null, layers: defaultLayers(), createdAt: now, updatedAt: now } };
}

// ---------- immutable updates (each one stamps updatedAt) ----------
const touch = (p, patch, now) => ({ ...p, ...patch, updatedAt: now });
const samePlace = (a, b) => (a.kind === b.kind && a.ref && a.ref === b.ref && (a.kind === 'country' || a.name === b.name)) || (Math.abs(a.lng - b.lng) < 1e-4 && Math.abs(a.lat - b.lat) < 1e-4);

export function addPlace(project, raw, now = Date.now()) {
  const place = sanitizePlace({ ...raw, id: undefined, addedAt: now });
  if (!place) return { ok: false, error: 'That place has no usable name or position.' };
  const dup = project.places.find((p) => samePlace(p, place));
  if (dup) return { ok: true, project, place: dup, duplicate: true };
  if (project.places.length >= LIMITS.places) return { ok: false, error: `A project can hold up to ${LIMITS.places} places.` };
  return { ok: true, project: touch(project, { places: [...project.places, place] }, now), place, duplicate: false };
}
export function updatePlace(project, id, patch, now = Date.now()) {
  const cur = project.places.find((p) => p.id === id);
  if (!cur) return { ok: false, error: 'That place is no longer in the project.' };
  const next = sanitizePlace({ ...cur, name: patch.name ?? cur.name, note: patch.note ?? cur.note });
  if (!next) return { ok: false, error: 'A place needs a name.' };
  return { ok: true, project: touch(project, { places: project.places.map((p) => (p.id === id ? { ...next, id } : p)) }, now) };
}
export function removePlace(project, id, now = Date.now()) {
  if (!project.places.some((p) => p.id === id)) return { ok: false, error: 'That place is no longer in the project.' };
  return { ok: true, project: touch(project, { places: project.places.filter((p) => p.id !== id), notes: project.notes.map((n) => (n.placeId === id ? { ...n, placeId: '' } : n)) }, now) };
}
export function addNote(project, text, placeId = '', now = Date.now()) {
  const note = sanitizeNote({ text, placeId: project.places.some((p) => p.id === placeId) ? placeId : '', createdAt: now, updatedAt: now });
  if (!note) return { ok: false, error: 'Write something first.' };
  if (project.notes.length >= LIMITS.notes) return { ok: false, error: `A project can hold up to ${LIMITS.notes} notes.` };
  return { ok: true, project: touch(project, { notes: [...project.notes, note] }, now), note };
}
export function updateNote(project, id, text, now = Date.now()) {
  const cur = project.notes.find((n) => n.id === id);
  if (!cur) return { ok: false, error: 'That note is no longer in the project.' };
  const next = sanitizeNote({ ...cur, text, updatedAt: now });
  if (!next) return { ok: false, error: 'A note cannot be empty. Delete it instead.' };
  return { ok: true, project: touch(project, { notes: project.notes.map((n) => (n.id === id ? { ...next, id } : n)) }, now) };
}
export function removeNote(project, id, now = Date.now()) {
  if (!project.notes.some((n) => n.id === id)) return { ok: false, error: 'That note is no longer in the project.' };
  return { ok: true, project: touch(project, { notes: project.notes.filter((n) => n.id !== id) }, now) };
}
export function setViewAndLayers(project, view, layers, now = Date.now()) {
  const v = sanitizeView(view);
  if (!v) return { ok: false, error: 'The map view could not be read.' };
  return { ok: true, project: touch(project, { view: v, layers: sanitizeLayers(layers) }, now) };
}

// a short sentence like "Updated 3 hours ago"
export function ago(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return m === 1 ? '1 minute ago' : m + ' minutes ago';
  const h = Math.round(m / 60); if (h < 24) return h === 1 ? '1 hour ago' : h + ' hours ago';
  const d = Math.round(h / 24); if (d < 30) return d === 1 ? 'yesterday' : d + ' days ago';
  return new Date(ts).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}
