// Small messages at the bottom of the map. They are announced to screen readers (the container is a live region)
// and can carry one action, such as "Undo".
const host = () => document.getElementById('toasts');
export function toast(text, { action, tone = 'info', ms = 6000 } = {}) {
  const box = host(); if (!box) return () => {};
  const el = document.createElement('div');
  el.className = 'toast ' + tone;
  const t = document.createElement('span'); t.textContent = text; el.append(t);
  let timer = 0;
  const close = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 180); };
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
    b.addEventListener('click', () => { close(); action.fn(); }); el.append(b);
  }
  const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', 'Dismiss message'); x.textContent = '✕'; x.addEventListener('click', close); el.append(x);
  while (box.children.length >= 3) box.firstElementChild.remove();
  box.append(el);
  if (ms) timer = setTimeout(close, tone === 'bad' ? Math.max(ms, 9000) : ms);
  return close;
}
window.__toast = toast;
