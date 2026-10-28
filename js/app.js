// Einstieg: Navigation, Tab Leiste, Ereignisse

import { state } from './store.js';
import { icon, esc, fmtClock } from './ui.js';
import * as plans from './views/plans.js';
import * as train from './views/train.js';
import * as stats from './views/stats.js';
import * as settings from './views/settings.js';
import { checkIdle } from './views/train.js';
import { sync, idleMs, REMIND_MIN } from './reminder.js';

const TABS = [
  { id: 'plans', label: 'Pläne', icon: icon.plans },
  { id: 'train', label: 'Training', icon: icon.train },
  { id: 'stats', label: 'Auswertung', icon: icon.stats },
];

const views = { ...plans.views, ...train.views, ...stats.views };
const actions = { ...plans.actions, ...train.actions, ...stats.actions, ...settings.actions };
const inputs = { ...plans.inputs, ...train.inputs, ...stats.inputs };

const nav = {
  tab: 'train',
  stacks: { plans: [{ name: 'plans' }], train: [{ name: 'train' }], stats: [{ name: 'stats' }] },
};

const $main = document.getElementById('view');
const $top = document.getElementById('topbar');
const $tabs = document.getElementById('tabbar');

export function go(name, params = {}) {
  const stack = nav.stacks[nav.tab];
  stack.at(-1).scroll = scrollY;
  stack.push({ name, params });
  render();
  scrollTo(0, 0);
}

export function back() {
  const stack = nav.stacks[nav.tab];
  if (stack.length > 1) stack.pop();
  render();
  scrollTo(0, stack.at(-1).scroll || 0);
}

export function backToRoot() {
  const stack = nav.stacks[nav.tab];
  stack.length = 1;
  render();
  scrollTo(0, 0);
}

function switchTab(id) {
  if (id === nav.tab) {
    if (nav.stacks[id].length > 1) backToRoot();
    else scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  nav.stacks[nav.tab].at(-1).scroll = scrollY;
  nav.tab = id;
  render();
  scrollTo(0, nav.stacks[id].at(-1).scroll || 0);
}

export function render() {
  const stack = nav.stacks[nav.tab];
  let route = stack.at(-1);
  // Gelöschte Inhalte: zurück zur Übersicht
  let v = views[route.name](route.params || {});
  while (!v && stack.length > 1) {
    stack.pop();
    route = stack.at(-1);
    v = views[route.name](route.params || {});
  }
  route.title = v.title;
  const prev = stack.at(-2);
  const root = stack.length === 1;

  $top.innerHTML = `
    <div class="top-side">${prev ? `<button class="top-back" data-act="back">${icon.back}<span>${esc(prev.title)}</span></button>` : ''}</div>
    <div class="top-title">${esc(v.title)}</div>
    <div class="top-side right">${v.right ?? ''}${root ? `<button class="icon-btn glass-btn" data-act="openSettings" aria-label="Einstellungen">${icon.gear}</button>` : ''}</div>`;

  $main.innerHTML = `${v.large === false ? '' : `<h1 class="large-title">${esc(v.largeTitle ?? v.title)}</h1>`}${v.subtitle ? `<p class="subtitle">${esc(v.subtitle)}</p>` : ''}${v.html}`;
  v.mount?.($main);
  renderTabs();
  onScroll();
}

function renderTabs() {
  $tabs.innerHTML = TABS.map((t) => {
    const live = t.id === 'train' && state.active && nav.tab !== 'train';
    return `<button class="tab${t.id === nav.tab ? ' on' : ''}${live ? ' live' : ''}" data-tab="${t.id}" aria-label="${t.label}">
      ${t.icon}<span>${live ? `<b data-clock></b>` : t.label}</span></button>`;
  }).join('');
  tick();
}

function onScroll() {
  $top.classList.toggle('scrolled', scrollY > 36);
}
addEventListener('scroll', onScroll, { passive: true });

// Laufende Trainingsuhr
function tick() {
  if (!state.active) return;
  const txt = fmtClock(Date.now() - state.active.startedAt);
  document.querySelectorAll('[data-clock]').forEach((n) => (n.textContent = txt));
}
setInterval(tick, 1000);

// Vergessenes Training erkennen und den Server aktuell halten
setInterval(checkIdle, 15000);
document.addEventListener('visibilitychange', () => {
  if (!state.active) return;
  if (document.visibilityState === 'hidden') return sync({ keepalive: true });
  if (idleMs() < REMIND_MIN * 60000) sync();
  checkIdle();
});

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) return switchTab(tab.dataset.tab);
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'back') return back();
  const fn = actions[t.dataset.act];
  if (fn) {
    e.preventDefault();
    fn(t, e);
  }
});

const onInput = (e) => {
  const t = e.target.closest('[data-in]');
  if (t) inputs[t.dataset.in]?.(t, e);
};
document.addEventListener('input', onInput);
document.addEventListener('change', (e) => {
  const t = e.target.closest('[data-ch]');
  if (t) inputs[t.dataset.ch]?.(t, e);
});

// Zahlenfelder beim Antippen komplett markieren
document.addEventListener('focusin', (e) => {
  if (e.target.matches('input.num')) setTimeout(() => e.target.select(), 0);
});

// Enter schließt die Tastatur
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
});

let lastWidth = innerWidth;
addEventListener('resize', () => {
  if (Math.abs(innerWidth - lastWidth) > 40 && !document.activeElement?.matches('input')) {
    lastWidth = innerWidth;
    render();
  }
});

if (location.hash === '#stats' || location.hash === '#plans') nav.tab = location.hash.slice(1);
render();
checkIdle();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker', e));
}
