// The two forms of the Projects feature: create / edit a project, and "Save to a project".
import { h } from '../workspace/dom.js';
import { modal } from '../workspace/dialog.js';
import { LIMITS, VISIBILITY, validateProjectInput } from './model.js';

let uid = 0;

function field(label, input, { hint = '', id }) {
  const err = h('p', { class: 'fld-err', id: id + '-err', hidden: '' });
  return { wrap: h('div', { class: 'fld' }, label ? h('label', { for: id }, label) : null, input, hint ? h('small', { class: 'fld-hint', id: id + '-hint' }, hint) : null, err), err, input };
}
const showErr = (f, msg) => {
  f.err.hidden = !msg; f.err.textContent = msg || '';
  if (msg) { f.input.setAttribute('aria-invalid', 'true'); f.input.setAttribute('aria-describedby', f.err.id); } else { f.input.removeAttribute('aria-invalid'); f.input.removeAttribute('aria-describedby'); }
};

// Create a new project, or edit one. Resolves with { project, warning } when saved.
export function projectDialog({ store, project = null, name = '' }) {
  const n = ++uid, editing = !!project;
  const nameIn = h('input', { id: 'pf-name-' + n, type: 'text', maxlength: LIMITS.name, autocomplete: 'off', placeholder: 'For example: My World Tour', 'data-autofocus': '' });
  const descIn = h('textarea', { id: 'pf-desc-' + n, rows: 3, maxlength: LIMITS.description, placeholder: 'What is this project about? (optional)' });
  nameIn.value = project?.name ?? name; descIn.value = project?.description ?? '';
  const fName = field('Project name', nameIn, { id: 'pf-name-' + n });
  const fDesc = field('Description (optional)', descIn, { id: 'pf-desc-' + n });
  const cur = project?.visibility || 'private';
  const radios = Object.entries(VISIBILITY).map(([k, v]) => h('label', { class: 'rad' },
    h('input', { type: 'radio', name: 'pf-vis-' + n, value: k, checked: k === cur ? '' : null }),
    h('span', {}, h('b', {}, v.label), h('small', {}, v.hint))));
  const vis = h('fieldset', { class: 'fld' }, h('legend', {}, 'Visibility'), ...radios);
  return modal({
    title: editing ? 'Edit project' : 'New project',
    submitLabel: editing ? 'Save changes' : 'Create project',
    content: h('div', {}, fName.wrap, fDesc.wrap, vis),
    onSubmit: (ctx) => {
      const input = { name: nameIn.value, description: descIn.value, visibility: vis.querySelector('input:checked')?.value };
      const v = validateProjectInput(input);
      showErr(fName, v.errors?.name); showErr(fDesc, v.errors?.description);
      if (!v.ok) { (v.errors.name ? nameIn : descIn).focus(); return false; }
      const r = editing ? store.edit(project.id, input) : store.create(input);
      if (!r.ok) { ctx.error(r.error || 'The project could not be saved.'); return false; }
      return { project: r.project || store.get(project.id), warning: r.warning || '' };
    },
  });
}

// "Save to a project". perform(projectId, { note }) does the actual save and returns { ok, error?, ... }.
// Resolves with { projectId, created, result } once it worked.
export function saveDialog({ store, title, summary, withNote = false, activeId = '', perform }) {
  const n = ++uid, projects = store.list();
  const start = projects.some((p) => p.id === activeId) ? activeId : projects[0]?.id || '__new';
  const noteIn = h('textarea', { id: 'sv-note-' + n, rows: 2, maxlength: LIMITS.placeNote, placeholder: 'Why does this place matter? (optional)' });
  const nameIn = h('input', { id: 'sv-new-' + n, type: 'text', maxlength: LIMITS.name, autocomplete: 'off', placeholder: 'New project name', 'aria-label': 'New project name' });
  const fNew = field('', nameIn, { id: 'sv-new-' + n });
  const newBox = h('div', { class: 'sv-new' }, fNew.wrap);
  const radios = projects.map((p) => h('label', { class: 'rad' },
    h('input', { type: 'radio', name: 'sv-to-' + n, value: p.id, checked: p.id === start ? '' : null }),
    h('span', {}, h('b', {}, p.name), h('small', {}, `${p.places.length} ${p.places.length === 1 ? 'place' : 'places'}`))));
  radios.push(h('label', { class: 'rad' },
    h('input', { type: 'radio', name: 'sv-to-' + n, value: '__new', checked: start === '__new' ? '' : null }),
    h('span', {}, h('b', {}, projects.length ? 'A new project…' : 'Create your first project'), h('small', {}, projects.length ? 'Start another project with this' : 'It is saved in this browser only'))));
  const group = h('fieldset', { class: 'fld' }, h('legend', {}, 'Save to'), ...radios);
  const sync = () => { newBox.hidden = group.querySelector('input:checked')?.value !== '__new'; if (!newBox.hidden && document.activeElement === document.body) nameIn.focus(); };
  group.addEventListener('change', () => { sync(); if (!newBox.hidden) nameIn.focus(); });
  sync();
  return modal({
    title, submitLabel: 'Save',
    content: h('div', {}, h('p', { class: 'wd-intro' }, summary), group, newBox, withNote ? h('div', { class: 'fld' }, h('label', { for: noteIn.id }, 'Note (optional)'), noteIn) : null),
    onSubmit: (ctx) => {
      let id = group.querySelector('input:checked')?.value, created = false;
      if (id === '__new') {
        const v = validateProjectInput({ name: nameIn.value, description: '', visibility: 'private' });
        showErr(fNew, v.errors?.name);
        if (!v.ok) { nameIn.focus(); return false; }
        const r = store.create(v.value);
        if (!r.ok) { ctx.error(r.error); return false; }
        id = r.project.id; created = true;
      }
      const result = perform(id, { note: noteIn.value });
      if (!result.ok) { ctx.error(result.error || 'It could not be saved.'); return false; }
      return { projectId: id, created, result };
    },
  });
}
