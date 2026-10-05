// Header animations: sliding glow pill on the view tabs, click ripple, and a scan sweep across the map.
const views = document.querySelector('#views');
const pill = views.querySelector('.pill');
const scan = document.querySelector('#scan');

function syncPill(snap) {
  const on = views.querySelector('button.on');
  if (!on) return;
  if (snap) pill.classList.add('snap');
  pill.style.width = on.offsetWidth + 'px';
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
  if (snap) { pill.offsetWidth; pill.classList.remove('snap'); }
}
function sweep() {
  scan.classList.remove('go'); scan.offsetWidth; scan.classList.add('go');
}
syncPill(true);
document.fonts?.ready.then(() => syncPill(true));
window.addEventListener('resize', () => syncPill(true));
views.addEventListener('click', (e) => { if (e.target.closest('button')) { requestAnimationFrame(() => syncPill(false)); sweep(); } });
document.querySelector('#maptheme').addEventListener('change', sweep);

document.querySelector('header').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.4;
  const s = document.createElement('span');
  s.className = 'rip'; s.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 700);
});
