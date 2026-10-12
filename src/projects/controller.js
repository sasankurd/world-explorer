// Projects: connects the saved-project data (store.js) to the screens (views.js, forms.js), the map (pins, saved views)
// and the rest of the workspace. This is the only file in the feature that knows about all the others.
import { createStore } from './store.js';
import { createRecent } from './recent.js';
import { createPins } from './pins.js';
import { capture, restore, describeLayers } from './mapstate.js';
import * as M from './model.js';
import { encodeShare, decodeShare, shareUrl, MAX_PAYLOAD } from './share.js';
import { projectDialog, saveDialog } from './forms.js';
import { renderList, renderDetail } from './views.js';
import { renderPlace } from '../workspace/explore.js';
import { confirmDialog, textDialog, modal } from '../workspace/dialog.js';
import { toast } from '../workspace/toast.js';
import { $, h } from '../workspace/dom.js';

while (!window.__app || !window.__workspace) await new Promise((r) => setTimeout(r, 25));
const app = window.__app, ws = window.__workspace;
const mobile = matchMedia('(max-width: 700px)');
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = createStore();
const recent = createRecent();
const pins = createPins(app.map, { onSelect: (id) => selectPin(id) });

let activeId = '';            // the saved project whose pins are on the map
let workingShared = false;    // true when the pins on the map belong to a shared snapshot instead
let viewId = '';              // the project open in the Projects tab
let shared = null;            // a read-only project opened from a share link
let showingShared = false;
let focusPlace = '';
let currentCountry = '';
let globeNoted = false;

const working = () => (workingShared ? shared : activeId ? store.get(activeId) : null);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const warn = (r) => { if (r?.warning) toast(r.warning, { tone: 'bad' }); };

// ---------------------------------------------------------------- rendering
function renderProjects({ focus = '' } = {}) {
  const root = $('#sv-projects'), body = $('#side-body');
  const key = focus || (root.contains(document.activeElement) ? document.activeElement.dataset.key : '');
  const top = body.scrollTop;
  let node, screen;
  if (showingShared && shared) {
    screen = 'shared'; node = renderDetail(detailCtx(shared, true), shared, { readOnly: true, focusPlace });
  } else if (viewId && store.get(viewId)) {
    const p = store.get(viewId); screen = 'p:' + viewId; node = renderDetail(detailCtx(p, false), p, { focusPlace });
  } else { viewId = ''; screen = 'list'; node = renderList(listCtx()); }
  const same = root.dataset.screen === screen;
  root.dataset.screen = screen;
  root.replaceChildren(node);
  if (same) body.scrollTop = top; else if (!root.hidden) body.scrollTop = 0;
  const want = key === 'note-add' ? 'note-input' : key;
  if (want) (root.querySelector(`[data-key="${CSS.escape(want)}"]`) || root.querySelector('[data-key="heading"]'))?.focus({ preventScroll: true });
  const hl = root.querySelector('li.hl'); if (hl) hl.scrollIntoView({ block: 'nearest' });
  const n = store.state.status === 'ready' ? store.state.projects.length : 0;
  const badge = $('#projcount'); badge.textContent = n; badge.hidden = !n;
}

function renderChip() {
  const p = working(), chip = $('#projchip');
  chip.hidden = !p;
  if (p) $('#projchip-n').textContent = workingShared ? p.name + ' (shared, read-only)' : p.name;
}

function renderPins() {
  const p = working();
  if (p) pins.show(p.places); else pins.clear();
  pins.visible(!window.__globe?.active);
}

function renderAll() { renderProjects(); renderChip(); renderPins(); }

store.subscribe(() => {
  if (activeId && !store.get(activeId)) activeId = '';
  if (viewId && !store.get(viewId)) viewId = '';
  renderAll();
});

// ---------------------------------------------------------------- opening things on the map
const hideLanding = () => { if (document.body.classList.contains('landing')) window.__landing?.hide(); };
function openPlace(r) {
  hideLanding();
  if (r.kind === 'country' && app.countries[r.ref]) return app.openCountry(r.ref);
  app.goTo(r.name, r.lng, r.lat, r.kind === 'city' ? 10 : 12, null, { kind: r.kind, ref: r.ref });
}
function closeDetails() { app.closePanel(); $('#pdetail').hidden = true; app.clearPin(); }

function fitPlaces(project) {
  const L = window.__layout || {}, pts = project.places;
  if (!pts.length || window.__globe?.active) return;
  const duration = reduceMotion() ? 0 : 1100;
  if (pts.length === 1) return app.map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 6, duration, offset: mobile.matches ? [0, -(L.bottom || 0) / 2] : [(L.left || 0) / 2, 0] });
  const xs = pts.map((p) => p.lng), ys = pts.map((p) => p.lat);
  app.map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: 80, bottom: (L.bottom || 0) + 40, left: (L.left || 0) + 50, right: 60 }, maxZoom: 8, duration });
}

// Puts a project on the map: its layers and view are restored, its places become pins.
async function showOnMap(project, { transient = false, view = true } = {}) {
  activeId = transient ? '' : project.id; workingShared = transient;
  hideLanding(); closeDetails();
  renderChip(); renderPins(); renderProjects();
  if (mobile.matches) ws.close(); // phones: give the whole screen back to the map
  if (!view) return; // only the pins were wanted, the caller moves the map itself
  if (project.view) {
    const r = await restore(project);
    r.warnings.forEach((w) => toast(w, { tone: 'warn' }));
  } else fitPlaces(project);
  toast(`“${project.name}” is on the map` + (project.places.length ? ` with ${plural(project.places.length, 'pin')}.` : '.'));
  if (window.__globe?.active && project.places.length && !globeNoted) { globeNoted = true; toast('Pins are shown on the flat map. Switch to the 2D map to see them.', { tone: 'warn' }); }
}

function selectPin(id) {
  const p = working(); if (!p) return;
  focusPlace = id;
  if (workingShared) { showingShared = true; } else { viewId = p.id; showingShared = false; }
  ws.setTab('projects'); renderProjects({ focus: 'heading' });
  pins.select(id);
}

// ---------------------------------------------------------------- saving
const preferred = () => (workingShared ? '' : activeId || viewId);

function afterSave(r, label) {
  const p = store.get(r.projectId);
  const dup = r.result.duplicate;
  toast(dup ? `${label} is already in “${p.name}”.` : `Saved ${label} to “${p.name}”.`, { action: { label: 'View project', fn: () => { viewId = p.id; showingShared = false; ws.setTab('projects'); renderProjects({ focus: 'heading' }); } } });
  warn(r.result);
}

async function savePlace(place) {
  const r = await saveDialog({
    store, title: 'Save to a project', summary: place.name, withNote: true, activeId: preferred(),
    perform: (id, { note }) => store.update(id, (p) => M.addPlace(p, { ...place, note })),
  });
  if (r) afterSave(r, `“${place.name}”`);
}

const viewSummary = (cap) => { const d = describeLayers(cap.layers); return `The map as it is now (position and zoom), with: ${[d.base, d.theme + ' theme', ...d.on].join(', ')}.`; };
async function saveViewTo(chooser) {
  const cap = capture();
  cap.caveats.forEach((c) => toast(c, { tone: 'warn' }));
  const r = await saveDialog({
    store, title: 'Save this map view', summary: viewSummary(cap), activeId: preferred(),
    perform: (id) => store.update(id, (p) => M.setViewAndLayers(p, cap.view, cap.layers)),
  });
  if (r) afterSave(r, 'the map view');
}

// ---------------------------------------------------------------- project actions
async function newProject(name = '') {
  const r = await projectDialog({ store, name: typeof name === 'string' ? name : '' });
  if (!r) return;
  viewId = r.project.id; showingShared = false;
  ws.setTab('projects'); renderProjects({ focus: 'heading' });
  toast(`Created “${r.project.name}”. Save places and map views into it from the map.`);
  warn(r);
}

async function editProject(p) {
  const r = await projectDialog({ store, project: p });
  if (r) { toast('Changes saved.'); warn(r); }
}

async function deleteProject(p) {
  const ok = await confirmDialog({
    title: `Delete “${p.name}”?`,
    message: `This removes the project with its ${plural(p.places.length, 'place')} and ${plural(p.notes.length, 'note')} from this browser. You can undo for a few seconds afterwards.`,
    confirmLabel: 'Delete project',
  });
  if (!ok) return;
  const copy = JSON.parse(JSON.stringify(p));
  const r = store.remove(p.id);
  if (!r.ok) return toast(r.error, { tone: 'bad' });
  viewId = ''; renderProjects({ focus: 'heading' });
  toast(`Deleted “${p.name}”.`, { ms: 10000, action: { label: 'Undo', fn: () => { const u = store.restore(copy); toast(u.ok ? `Restored “${p.name}”.` : u.error, { tone: u.ok ? 'info' : 'bad' }); } } });
}

async function shareProject(p) {
  const r = await encodeShare(p);
  if (!r.ok) return void modal({ title: 'Too big to share as a link', content: h('p', { class: 'wd-intro' }, r.error), submitLabel: 'OK', hideCancel: true });
  const url = shareUrl(r.payload);
  const input = h('input', { type: 'text', readonly: '', value: url, 'aria-label': 'Read-only share link', 'data-autofocus': '' });
  const status = h('p', { class: 'ok', role: 'status' });
  const copy = h('button', { type: 'button', class: 'btn', onclick: async () => {
    try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied.'; }
    catch { input.select(); status.textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected link.'; }
  } }, 'Copy link');
  modal({
    title: 'Share a read-only link', submitLabel: 'Done', hideCancel: true, wide: true,
    content: h('div', {},
      h('p', { class: 'wd-intro' }, `Anyone you give this link to can open a read-only copy of “${p.name}”: its places, notes, map view and layers.`),
      input, h('div', { class: 'row' }, copy), status,
      h('ul', { class: 'ul' },
        h('li', {}, 'It is a snapshot made now. Later changes to your project are not included.'),
        h('li', {}, 'The project itself is stored inside the link. Nothing is uploaded, so there is nothing to switch off: anyone who has the link can read it, and it cannot be taken back.'),
        h('li', {}, `Large projects do not fit in a link (limit about ${MAX_PAYLOAD.toLocaleString('en')} characters). This one uses ${r.payload.length.toLocaleString('en')}.`))),
  });
}

async function saveViewInto(p) {
  const cap = capture();
  cap.caveats.forEach((c) => toast(c, { tone: 'warn' }));
  const r = store.update(p.id, (x) => M.setViewAndLayers(x, cap.view, cap.layers));
  if (!r.ok) return toast(r.error, { tone: 'bad' });
  toast('Map view saved to this project.'); warn(r);
  if (activeId === p.id) renderChip();
}

function editPlace(pl, p) {
  const nameIn = h('input', { id: 'ep-name', type: 'text', maxlength: M.LIMITS.placeName, 'data-autofocus': '' }); nameIn.value = pl.name;
  const noteIn = h('textarea', { id: 'ep-note', rows: 4, maxlength: M.LIMITS.placeNote }); noteIn.value = pl.note;
  return modal({
    title: 'Edit place', submitLabel: 'Save changes',
    content: h('div', {}, h('div', { class: 'fld' }, h('label', { for: 'ep-name' }, 'Name'), nameIn), h('div', { class: 'fld' }, h('label', { for: 'ep-note' }, 'Note (optional)'), noteIn)),
    onSubmit: (ctx) => { const r = store.update(p.id, (x) => M.updatePlace(x, pl.id, { name: nameIn.value, note: noteIn.value })); if (!r.ok) { ctx.error(r.error); return false; } warn(r); },
  });
}
async function removePlace(pl, p) {
  const ok = await confirmDialog({ title: `Remove “${pl.name}”?`, message: 'The place and its pin are removed from this project. Notes written about it stay, as notes about the whole project.', confirmLabel: 'Remove place' });
  if (!ok) return;
  const r = store.update(p.id, (x) => M.removePlace(x, pl.id)); if (!r.ok) toast(r.error, { tone: 'bad' }); else warn(r);
}
function editNote(n, p) {
  return textDialog({ title: 'Edit note', label: 'Note', value: n.text, multiline: true, max: M.LIMITS.note,
    onSubmit: (v, ctx) => { const r = store.update(p.id, (x) => M.updateNote(x, n.id, v)); if (!r.ok) { ctx.error(r.error); return false; } warn(r); } });
}
async function removeNote(n, p) {
  const ok = await confirmDialog({ title: 'Remove this note?', message: n.text.length > 120 ? n.text.slice(0, 117) + '…' : n.text, confirmLabel: 'Remove note' });
  if (!ok) return;
  const r = store.update(p.id, (x) => M.removeNote(x, n.id)); if (!r.ok) toast(r.error, { tone: 'bad' }); else warn(r);
}

function exportAll() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `world-explorer-projects-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup file downloaded.');
}
async function importFile(file) {
  if (file.size > 5e6) return toast('That file is too large to be a World Explorer backup.', { tone: 'bad' });
  let text; try { text = await file.text(); } catch { return toast('The file could not be read.', { tone: 'bad' }); }
  const r = store.importJson(text);
  if (!r.ok) return toast(r.error, { tone: 'bad' });
  toast(`Imported ${plural(r.imported, 'project')}.` + (r.skipped ? ` ${plural(r.skipped, 'item')} could not be used.` : '')); warn(r);
}
async function resetDamaged() {
  const ok = await confirmDialog({ title: 'Start fresh?', message: 'The damaged data is kept in this browser under a separate name, then the list starts empty.', confirmLabel: 'Keep a copy and start fresh', danger: false });
  if (!ok) return;
  const r = store.resetDamaged(); toast(r.ok ? 'Started fresh. The old data was kept aside.' : r.error, { tone: r.ok ? 'info' : 'bad' });
}

function saveSharedCopy() {
  if (!shared) return;
  const r = store.restore({ ...shared, id: undefined, visibility: 'private' });
  if (!r.ok) return toast(r.error || 'The copy could not be saved.', { tone: 'bad' });
  const id = r.project.id;
  if (workingShared) { workingShared = false; activeId = id; }
  shared = null; showingShared = false; viewId = id;
  history.replaceState(null, '', location.pathname + location.search);
  renderAll(); renderProjects({ focus: 'heading' });
  toast('Saved a copy to your projects. You can edit it now.'); warn(r);
}
function closeShared() {
  if (workingShared) { workingShared = false; }
  shared = null; showingShared = false;
  history.replaceState(null, '', location.pathname + location.search);
  renderAll(); renderProjects({ focus: 'heading' });
  window.dispatchEvent(new Event('gate-check'));   // without a project of your own, closing a shared one goes back to the front page
}

// ---------------------------------------------------------------- what the views call
function listCtx() {
  return {
    store, activeId,
    onNew: newProject,
    onOpenDetail: (id) => { viewId = id; showingShared = false; focusPlace = ''; renderProjects({ focus: 'heading' }); },
    onShowOnMap: (id) => { const p = store.get(id); if (p) showOnMap(p); },
    onExport: exportAll, onImport: importFile,
    onRetry: () => { store.reload(); },
    onReset: resetDamaged,
  };
}
function detailCtx(p, readOnly) {
  return {
    activeId: workingShared ? '' : activeId,
    onBack: () => { if (readOnly) return closeShared(); const id = viewId; viewId = ''; focusPlace = ''; renderProjects({ focus: 'open-' + id }); },
    onShowOnMap: () => showOnMap(p, { transient: readOnly }),
    onSaveCopy: saveSharedCopy,
    onEdit: () => editProject(p), onShare: () => shareProject(p), onDelete: () => deleteProject(p),
    onSaveView: () => saveViewInto(p),
    onShowPlace: async (pl) => {
      const isOn = readOnly ? workingShared : activeId === p.id;
      if (!isOn) await showOnMap(p, { transient: readOnly, view: false }); // pins first, then fly to this one place
      openPlace(pl); if (mobile.matches) ws.close();
    },
    onEditPlace: (pl) => editPlace(pl, p), onRemovePlace: (pl) => removePlace(pl, p),
    onEditNote: (n) => editNote(n, p), onRemoveNote: (n) => removeNote(n, p),
    onAddNote: (text, placeId) => store.update(p.id, (x) => M.addNote(x, text, placeId)),
    onFindPlace: () => { ws.open(); $('#search').focus(); },
  };
}

// ---------------------------------------------------------------- events from the map and the rest of the site
window.addEventListener('country-open', (e) => {
  const id = e.detail?.id, c = app.countries[id]; if (!c) return;
  currentCountry = id;
  $('#pdetail').hidden = true;
  if (e.detail.tab === 'overview' || !e.detail.tab) { recent.push({ kind: 'country', name: c.name, ref: id, lat: c.latlng?.[0] ?? 0, lng: c.latlng?.[1] ?? 0 }); }
});
window.addEventListener('country-close', () => { currentCountry = ''; });

window.addEventListener('place-select', (e) => {
  const pl = e.detail; if (!pl || !Number.isFinite(pl.lng)) return;
  app.closePanel();
  recent.push(pl);
  const box = $('#pdetail');
  renderPlace(box, pl, {
    onSave: () => savePlace({ kind: pl.kind, name: pl.name, ref: pl.ref, lng: pl.lng, lat: pl.lat }),
    onClose: () => { box.hidden = true; app.clearPin(); },
    onCountry: () => app.openCountry(pl.ref),
  });
  box.hidden = false;
});
window.addEventListener('place-clear', () => { $('#pdetail').hidden = true; });

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-save="country"]'); if (!b) return;
  const c = app.countries[currentCountry];
  if (!c || !c.latlng) return toast('This country has no map position to save.', { tone: 'bad' });
  savePlace({ kind: 'country', name: c.name, ref: c.id, lat: c.latlng[0], lng: c.latlng[1] });
});

$('#mapbar-save').addEventListener('click', () => saveViewTo());
$('#projchip-open').addEventListener('click', () => { if (workingShared) showingShared = true; else { viewId = activeId; showingShared = false; } ws.setTab('projects'); renderProjects({ focus: 'heading' }); });
$('#projchip-close').addEventListener('click', () => { activeId = ''; workingShared = false; renderAll(); toast('Pins removed from the map. The project is still saved.'); });
window.addEventListener('globe-change', () => { pins.visible(!window.__globe?.active); });

// ---------------------------------------------------------------- start
renderProjects(); // the Projects tab shows its loading state first
requestAnimationFrame(() => store.init());

window.__projects = { store, recent, create: newProject, showOnMap, openDetail: (id) => { viewId = id; showingShared = false; ws.setTab('projects'); renderProjects({ focus: 'heading' }); }, get activeId() { return activeId; }, get sharedOpen() { return !!shared && showingShared; } };

// a read-only project opened from a share link
if (window.__shareHash) {
  decodeShare(window.__shareHash).then((r) => {
    if (!r.ok) return toast(r.error, { tone: 'bad', ms: 12000 });
    shared = r.project; showingShared = true; hideLanding();
    ws.setTab('projects'); renderProjects({ focus: 'heading' });
    toast('Opened a shared project. It is read-only: you can look around or save your own copy.', { ms: 9000 });
  });
}
