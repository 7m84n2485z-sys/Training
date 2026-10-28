// Erinnerung bei Inaktivität: Push Nachricht über den Server unter /api (Code in push/),
// zusätzlich prüft die App beim Öffnen selbst, ob ein Training vergessen wurde.

import { state, save, flush } from './store.js';

// Die alte Adresse bei GitHub Pages hat keinen Server, dort erscheint ein Umzugshinweis
export const NEW_HOME = 'https://training.flightsim-tools.workers.dev/';
export const isOldHome = location.hostname.endsWith('github.io');
const API = isOldHome ? '' : '/api';
const VAPID_PUBLIC = 'BEkunK64AzzCyfI0MTUOcZUCPaTzutzbN-qQrqvOP6b_hPlYPx8-6km7D5FVISnyB78HqCCkvqt6P987jdNBaiY';

export const REMIND_MIN = 30;
export const END_MIN = 35;

export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
export const pushSupported = () => !!API && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushEnabled = () => pushSupported() && !!state.settings.push && Notification.permission === 'granted';

const b64uToBytes = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

// text/plain hält die Anfrage einfach (kein CORS Vorabcheck), auch beim Schließen der App
function post(path, body, keepalive = false) {
  return fetch(API + path, { method: 'POST', keepalive, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) });
}

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Mitteilungen sind nicht erlaubt. Du kannst sie in den iPhone Einstellungen unter Mitteilungen freigeben.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC) }));
  state.settings.push = sub.toJSON();
  flush();
  if (state.active) sync();
}

export async function disablePush() {
  cancel();
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch (e) {
    console.warn(e);
  }
  state.settings.push = null;
  flush();
}

export async function sendTest() {
  const res = await post('/test', { subscription: state.settings.push });
  if (!res.ok) throw new Error('Der Server hat nicht geantwortet.');
}

export const lastActivity = (a = state.active) => a?.lastActivity ?? a?.startedAt ?? Date.now();
export const idleMs = () => Date.now() - lastActivity();

let lastSync = 0;

// Jede Eingabe im Training zählt als Aktivität
export function touch() {
  if (!state.active) return;
  state.active.lastActivity = Date.now();
  save();
  if (Date.now() - lastSync > 60000) sync();
}

// Server auf den Stand der letzten Eingabe bringen
export function sync({ keepalive = false } = {}) {
  if (!pushEnabled() || !state.active) return;
  lastSync = Date.now();
  post('/schedule', { subscription: state.settings.push, last: lastActivity() }, keepalive).catch(() => {});
}

export function cancel() {
  if (!pushEnabled()) return;
  post('/cancel', { subscription: state.settings.push }, true).catch(() => {});
}
