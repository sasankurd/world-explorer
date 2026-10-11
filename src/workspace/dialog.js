// Modal windows built on the native <dialog> element: it traps focus, closes on Esc and puts focus back where it was.
import { h } from './dom.js';

let uid = 0;

// content: a Node, or a function (ctx) => Node.  onSubmit(ctx) may return false to keep the window open
// (after calling ctx.error('message')), or any value, which becomes the result of the promise.
// Closing with Cancel, Esc or a click outside resolves undefined.
export function modal({ title, intro = '', content = null, submitLabel = 'Save', cancelLabel = 'Cancel', danger = false, hideCancel = false, onSubmit, wide = false }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const id = 'wd-title-' + (++uid);
    let result, busy = false;
    const err = h('p', { class: 'wd-err', role: 'alert' });
    const ctx = { error: (m) => { err.textContent = m || ''; }, close: (v) => { result = v; dlg.close(); } };
    const submit = h('button', { type: 'submit', class: 'btn ' + (danger ? 'danger' : 'primary') }, submitLabel);
    const cancel = h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, cancelLabel);
    const form = h('form', { class: 'wd-form', novalidate: '' },
      h('h2', { id, class: 'wd-title' }, title),
      intro ? h('p', { class: 'wd-intro' }, intro) : null,
      typeof content === 'function' ? content(ctx) : content,
      err,
      h('div', { class: 'wd-actions' }, hideCancel ? null : cancel, submit));
    const dlg = h('dialog', { class: 'wd' + (wide ? ' wide' : ''), 'aria-labelledby': id }, form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true; submit.disabled = true; ctx.error('');
      try {
        const r = await onSubmit?.(ctx);
        if (r === false) return;
        result = r === undefined ? true : r; dlg.close();
      } catch { ctx.error('Something went wrong. Please try again.'); }
      finally { busy = false; submit.disabled = false; }
    });
    dlg.addEventListener('close', () => { dlg.remove(); try { opener?.focus?.(); } catch {} resolve(result); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    dlg.showModal();
    // for destructive questions the safe button gets focus first
    (dlg.querySelector('[data-autofocus]') || (danger ? cancel : submit)).focus?.();
  });
}

export const confirmDialog = ({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true }) =>
  modal({ title, content: h('p', { class: 'wd-intro' }, message), submitLabel: confirmLabel, cancelLabel, danger }).then((r) => r === true);

// one text box (single line or several), for renaming a place or editing a note
export function textDialog({ title, label, value = '', multiline = false, max = 500, submitLabel = 'Save', extra = null, onSubmit }) {
  const id = 'wd-in-' + (++uid);
  const input = multiline ? h('textarea', { id, rows: 5, maxlength: max, 'data-autofocus': '' }) : h('input', { id, type: 'text', maxlength: max, 'data-autofocus': '' });
  input.value = value;
  return modal({
    title, submitLabel,
    content: h('div', { class: 'fld' }, h('label', { for: id }, label), input, extra),
    onSubmit: (ctx) => onSubmit(input.value, ctx),
  });
}
