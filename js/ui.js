// Hilfsfunktionen für Oberfläche, Formatierung und Dialoge

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
export const fmtNum = (v) => nf.format(Math.round((v || 0) * 100) / 100);
export const fmtKg = (v) => `${fmtNum(v)} kg`;
export const fmtInt = (v) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v || 0);
export const parseNum = (s) => {
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};

export const fmtDate = (t, opts = { weekday: 'short', day: '2-digit', month: '2-digit' }) => new Date(t).toLocaleDateString('de-DE', opts);
export const fmtDateLong = (t) => new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtShort = (t) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
export const fmtMin = (min) => {
  if (min == null) return 'ohne Dauer';
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
};

export function relDays(t) {
  const d = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
  if (d === 0) return 'heute';
  if (d === 1) return 'gestern';
  return `vor ${d} Tagen`;
}

// SF Symbols ähnliche Symbole als SVG
const p = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icon = {
  plans: p('<rect x="5" y="3.5" width="14" height="18" rx="3"/><path d="M9 3.5V2.5h6v1M9 9.5h6M9 13.5h6M9 17.5h3.5"/>'),
  train: p('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  stats: p('<path d="M4 20h16M7 16v-4M12 16V7M17 16v-6"/>'),
  gear: p('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: p('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2.6"'),
  chevron: p('<path d="M9 5l7 7-7 7"/>', 'stroke-width="2.4"'),
  plus: p('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  check: p('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="3"'),
  close: p('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2.4"'),
  trash: p('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>'),
  up: p('<path d="M6 15l6-6 6 6"/>', 'stroke-width="2.4"'),
  down: p('<path d="M6 9l6 6 6-6"/>', 'stroke-width="2.4"'),
  arrowUp: p('<path d="M12 19V5M6 11l6-6 6 6"/>', 'stroke-width="2.4"'),
  arrowDown: p('<path d="M12 5v14M6 13l6 6 6-6"/>', 'stroke-width="2.4"'),
  pause: p('<path d="M8 5v14M16 5v14"/>', 'stroke-width="2.6"'),
  play: p('<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>'),
  info: p('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>'),
  warn: p('<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>'),
  trophy: p('<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 21h8M9.5 18h5"/>'),
  clock: p('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  search: p('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'),
  edit: p('<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>'),
  flame: p('<path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.6 3-5.6 3.5-9.3 2 1 3.5 3 3.5 5 1-1 1.5-2.2 1.5-3.5 2.5 2 4.5 4.6 4.5 7.8 0 3.5-2.5 6.2-6.5 6.2z"/>'),
  share: p('<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v7.5h14V12"/>'),
  download: p('<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'),
};

// Bottom Sheet im Glas Stil
export function sheet(html, { onMount, onClose, tall = false } = {}) {
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-close></div><div class="sheet glass-strong${tall ? ' tall' : ''}" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  root.appendChild(wrap);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => wrap.classList.add('open'));
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('open');
    setTimeout(() => {
      wrap.remove();
      if (!root.children.length) document.body.classList.remove('sheet-open');
    }, 320);
    onClose?.(result);
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  // Nach unten wischen schließt das Sheet
  const el = wrap.querySelector('.sheet');
  let y0 = null, dy = 0;
  el.querySelector('.grabber').parentElement.addEventListener('touchstart', (e) => {
    if (el.scrollTop > 0 || e.target.closest('input,textarea,select,.no-drag')) return;
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (y0 == null) return;
    el.style.transform = '';
    if (dy > 110) close();
    y0 = null;
  });
  onMount?.(el, close);
  return close;
}

// Aktionsblatt zur Bestätigung, liefert true oder false
export function confirmSheet({ title, message = '', confirm = 'Löschen', destructive = true }) {
  return new Promise((resolve) => {
    let result = false;
    sheet(
      `<div class="confirm">
        <h3>${esc(title)}</h3>
        ${message ? `<p class="muted">${esc(message)}</p>` : ''}
        <button class="btn ${destructive ? 'btn-danger' : 'btn-primary'} wide" data-ok>${esc(confirm)}</button>
        <button class="btn btn-plain wide" data-close>Abbrechen</button>
      </div>`,
      {
        onMount: (el, close) => el.querySelector('[data-ok]').addEventListener('click', () => { result = true; close(); }),
        onClose: () => resolve(result),
      },
    );
  });
}

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast glass-strong';
  t.textContent = text;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 2400);
}

// Einheitliches Zahlenfeld mit Dezimalkomma
export const numInput = (attrs, value, { decimal = true, label = '' } = {}) =>
  `<input class="num" type="text" inputmode="${decimal ? 'decimal' : 'numeric'}" enterkeyhint="done" autocomplete="off" value="${esc(fmtNum(value))}" aria-label="${esc(label)}" ${attrs}>`;
