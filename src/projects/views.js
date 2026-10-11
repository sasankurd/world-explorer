// Screens inside the Projects tab: the list of projects, and one project's contents.
// These functions only build DOM and call the callbacks they are given; they never touch storage or the map themselves.
import { h, icon } from '../workspace/dom.js';
import { ago, LIMITS, VISIBILITY } from './model.js';
import { thumbSvg } from './thumb.js';
import { describeLayers } from './mapstate.js';

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const btn = (label, onclick, { kind = '', key = '', disabled = false, title = '', ic = '' } = {}) =>
  h('button', { type: 'button', class: 'btn ' + kind, onclick, 'data-key': key || null, disabled: disabled ? '' : null, title: title || null }, ic ? icon(ic) : null, label);

export const EXAMPLES = ['My World Tour', 'Countries I’ve Visited', 'Climate Case Studies'];

// ---------------------------------------------------------------- list
export function renderList(c) {
  const st = c.store.state, root = h('div', { class: 'pj' });
  root.append(h('div', { class: 'pj-head' }, h('div', {}, h('h2', { class: 'sv-h', tabindex: '-1', 'data-key': 'heading' }, 'Your projects'), h('p', { class: 'pj-sub' }, 'Saved map workspaces: places, notes, layers and a map view.')),
    btn('New project', c.onNew, { kind: 'primary', key: 'new', ic: 'plus' })));

  if (st.status === 'loading') {
    root.append(h('div', { class: 'pj-cards', role: 'status', 'aria-label': 'Loading your projects' }, skeleton(), skeleton()));
    return root;
  }
  if (st.status === 'error') {
    root.append(h('div', { class: 'state bad', role: 'alert' },
      h('b', {}, 'Your projects could not be opened'), h('p', {}, st.error?.message || 'Something went wrong while reading them.'),
      h('div', { class: 'row' },
        btn('Try again', c.onRetry, { key: 'retry' }),
        st.error?.newer ? null : btn('Keep a copy and start fresh', c.onReset, { kind: 'danger', key: 'reset' })),
      st.error?.newer ? null : h('small', {}, 'Starting fresh keeps the damaged data under a separate name in this browser; nothing is erased.')));
    return root;
  }

  if (!st.persistent) root.append(h('div', { class: 'state warn', role: 'status' }, h('b', {}, 'Not being saved'),
    h('p', {}, st.lastSaveError || 'This browser is not letting the site save anything (private mode or blocked storage). Projects last only until you close this tab. Use Export to keep a copy.')));

  const list = c.store.list();
  if (!list.length) {
    root.append(h('div', { class: 'empty' },
      h('div', { class: 'empty-art', 'aria-hidden': 'true' }, icon('folder', 'ic big')),
      h('h3', {}, 'No projects yet'),
      h('p', {}, 'A project keeps the places you care about, your notes and the way the map looked, together in one place.'),
      btn('Create your first project', c.onNew, { kind: 'primary', key: 'new2', ic: 'plus' }),
      h('p', { class: 'ex-l' }, 'Ideas to start with'),
      h('div', { class: 'chips' }, EXAMPLES.map((n) => h('button', { type: 'button', class: 'chip', onclick: () => c.onNew(n) }, n)))));
  } else {
    root.append(h('div', { class: 'pj-cards' }, list.map((p) => card(c, p))));
  }

  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: '', 'aria-label': 'Choose a backup file to import', onchange: (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) c.onImport(f); } });
  root.append(h('div', { class: 'pj-foot' },
    h('p', {}, h('b', {}, 'Saved on this device only. '), 'Projects live in this browser. They are not backed up online and do not sync to other devices or browsers, even if you are signed in.'),
    h('div', { class: 'row' },
      btn('Export backup', c.onExport, { ic: 'download', disabled: !list.length, key: 'export' }),
      btn('Import backup', () => file.click(), { ic: 'upload', key: 'import' }), file)));
  return root;
}

const skeleton = () => h('div', { class: 'pj-card skel', 'aria-hidden': 'true' }, h('div', { class: 'pj-thumb' }), h('div', { class: 'pj-meta' }, h('i', {}), h('i', { class: 's' })));

function card(c, p) {
  const th = h('div', { class: 'pj-thumb', 'aria-hidden': 'true' });
  th.innerHTML = thumbSvg(p); // thumbSvg builds the markup from numbers and sanitised text only
  const active = c.activeId === p.id;
  return h('article', { class: 'pj-card' + (active ? ' working' : ''), 'data-id': p.id },
    th,
    h('div', { class: 'pj-meta' },
      h('h3', {}, p.name, active ? h('span', { class: 'badge' }, 'On the map') : null),
      p.description ? h('p', { class: 'pj-desc' }, p.description) : null,
      h('p', { class: 'pj-stats' }, plural(p.places.length, 'place'), ' · ', plural(p.notes.length, 'note'), ' · ', p.view ? 'map view saved' : 'no map view'),
      h('p', { class: 'pj-when' }, 'Updated ', h('time', { datetime: new Date(p.updatedAt).toISOString() }, ago(p.updatedAt)), ' · ', VISIBILITY[p.visibility].label)),
    h('div', { class: 'pj-act' },
      h('button', { type: 'button', class: 'btn primary', 'data-key': 'open-' + p.id, onclick: () => c.onOpenDetail(p.id), 'aria-label': `Open project ${p.name}` }, 'Open'),
      h('button', { type: 'button', class: 'btn', onclick: () => c.onShowOnMap(p.id), 'aria-label': `Show ${p.name} on the map`, title: 'Restore its map view, pins and layers' }, 'Show on map')));
}

// ---------------------------------------------------------------- one project
export function renderDetail(c, p, { readOnly = false, focusPlace = '' } = {}) {
  const root = h('div', { class: 'pj pj-detail' });
  const active = c.activeId === p.id;
  root.append(h('div', { class: 'pj-back' }, btn(readOnly ? 'Close shared project' : 'All projects', c.onBack, { ic: 'back', key: 'back' })));

  if (readOnly) root.append(h('div', { class: 'state info', role: 'note' }, h('b', {}, 'Shared with you · read-only'),
    h('p', {}, 'This is a copy that came from a link. You can look around, or save your own copy to edit. Changes you make to your copy do not affect the person who shared it.')));

  root.append(h('div', { class: 'pj-title' },
    h('h2', { class: 'sv-h', tabindex: '-1', 'data-key': 'heading' }, p.name),
    h('p', { class: 'pj-when' }, readOnly ? 'Snapshot' : [`Updated `, h('time', { datetime: new Date(p.updatedAt).toISOString() }, ago(p.updatedAt)), ' · ', VISIBILITY[p.visibility].label]),
    p.description ? h('p', { class: 'pj-desc full' }, p.description) : null));

  const primary = h('div', { class: 'row' },
    btn(active ? 'Show on map again' : 'Open on map', c.onShowOnMap, { kind: 'primary', key: 'map', ic: 'pin', title: 'Restore its map view, pins, notes and layers' }),
    readOnly ? btn('Save a copy to my projects', c.onSaveCopy, { key: 'copy', ic: 'bookmark' }) : null);
  root.append(primary);
  if (!readOnly) root.append(h('div', { class: 'row sub' },
    btn('Edit details', c.onEdit, { key: 'edit' }),
    btn('Share link', c.onShare, { key: 'share', ic: 'share', disabled: p.visibility !== 'link', title: p.visibility === 'link' ? 'Make a read-only link' : 'Edit the project and set Visibility to "Can be shared as a link" first' }),
    btn('Delete project', c.onDelete, { kind: 'danger-text', key: 'delete' })));
  if (!readOnly && p.visibility !== 'link') root.append(h('p', { class: 'hint' }, 'Sharing is off. Choose “Edit details” and set Visibility to “Can be shared as a link” to make a read-only link.'));

  // ----- map view
  const view = h('section', { class: 'pj-sec', 'aria-labelledby': 'pj-v-h' }, h('h3', { id: 'pj-v-h' }, 'Map view and layers'));
  if (p.view) {
    const d = describeLayers(p.layers), [lng, lat] = p.view.center;
    view.append(h('p', { class: 'pj-line' }, `Zoom ${p.view.zoom.toFixed(1)} near ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`),
      h('p', { class: 'pj-line muted' }, [d.base, d.theme + ' theme', ...d.on].join(' · ')));
  } else view.append(h('p', { class: 'muted' }, readOnly ? 'No map view was saved.' : 'No map view saved yet. Move the map the way you like it, then press the button below.'));
  if (!readOnly) view.append(btn(p.view ? 'Replace with the current map view' : 'Save the current map view', c.onSaveView, { key: 'saveview', ic: 'bookmark' }));
  root.append(view);

  // ----- places
  const places = h('section', { class: 'pj-sec', 'aria-labelledby': 'pj-p-h' }, h('h3', { id: 'pj-p-h' }, `Places (${p.places.length})`));
  if (!p.places.length) places.append(h('p', { class: 'muted' }, readOnly ? 'No places in this project.' : 'No places yet. Search for a place or click a country on the map, then press “Save”.'));
  else places.append(h('ul', { class: 'pj-list' }, p.places.map((pl) => h('li', { class: focusPlace === pl.id ? 'hl' : '', 'data-id': pl.id },
    h('div', { class: 'pl-main' }, h('b', {}, pl.name), h('small', {}, [({ country: 'Country', city: 'City', place: 'Place', point: 'Map point' })[pl.kind], pl.note].filter(Boolean).join(' · '))),
    h('div', { class: 'pl-act' },
      h('button', { type: 'button', class: 'lnk', onclick: () => c.onShowPlace(pl), 'aria-label': `Show ${pl.name} on the map` }, 'Show'),
      readOnly ? null : h('button', { type: 'button', class: 'lnk', 'data-key': 'pe-' + pl.id, onclick: () => c.onEditPlace(pl), 'aria-label': `Edit ${pl.name}` }, 'Edit'),
      readOnly ? null : h('button', { type: 'button', class: 'lnk bad', onclick: () => c.onRemovePlace(pl), 'aria-label': `Remove ${pl.name} from this project` }, 'Remove'))))));
  if (!readOnly) places.append(btn('Find a place to add', c.onFindPlace, { key: 'find', ic: 'plus' }));
  root.append(places);

  // ----- notes
  const notes = h('section', { class: 'pj-sec', 'aria-labelledby': 'pj-n-h' }, h('h3', { id: 'pj-n-h' }, `Notes (${p.notes.length})`));
  if (!p.notes.length) notes.append(h('p', { class: 'muted' }, readOnly ? 'No notes in this project.' : 'No notes yet. Write down what you want to remember.'));
  else notes.append(h('ul', { class: 'pj-list notes' }, p.notes.map((n) => {
    const pl = p.places.find((x) => x.id === n.placeId);
    return h('li', { 'data-id': n.id },
      h('p', { class: 'nt-text' }, n.text),
      h('div', { class: 'pl-act' },
        h('small', {}, pl ? `About ${pl.name} · ` : '', ago(n.updatedAt)),
        readOnly ? null : h('button', { type: 'button', class: 'lnk', 'data-key': 'ne-' + n.id, onclick: () => c.onEditNote(n), 'aria-label': 'Edit this note' }, 'Edit'),
        readOnly ? null : h('button', { type: 'button', class: 'lnk bad', onclick: () => c.onRemoveNote(n), 'aria-label': 'Remove this note' }, 'Remove')));
  })));
  if (!readOnly) {
    const ta = h('textarea', { id: 'nt-new', rows: 3, maxlength: LIMITS.note, 'data-key': 'note-input', placeholder: 'Write a note…' });
    const sel = h('select', { id: 'nt-about', 'aria-label': 'What the note is about' }, h('option', { value: '' }, 'About the whole project'), p.places.map((pl) => h('option', { value: pl.id }, 'About ' + pl.name)));
    const msg = h('p', { class: 'fld-err', role: 'alert', hidden: '' });
    notes.append(h('form', { class: 'nt-form', novalidate: '', onsubmit: (e) => { e.preventDefault(); const r = c.onAddNote(ta.value, sel.value); if (r && !r.ok) { msg.hidden = false; msg.textContent = r.error; ta.focus(); } } },
      h('label', { for: 'nt-new' }, 'Add a note'), ta, p.places.length ? sel : null, msg, h('button', { type: 'submit', class: 'btn', 'data-key': 'note-add' }, 'Add note')));
  }
  root.append(notes);
  return root;
}
