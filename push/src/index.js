// Erinnerungsserver für Training (Cloudflare Worker mit Durable Object)
// Die App selbst liefert Cloudflare als statische Dateien aus, hier landen nur Anfragen an /api/*.
//
// Die App meldet nach jeder Eingabe den Zeitpunkt der letzten Aktivität.
// Nach 30 Minuten ohne Meldung kommt eine Push Nachricht, nach 35 Minuten die zweite.
// Gespeichert werden nur die Push Adresse des iPhones und dieser Zeitpunkt.

import { DurableObject } from 'cloudflare:workers';
import { sendPush } from './webpush.js';

const REMIND_MS = 30 * 60000;
const END_MS = 35 * 60000;

// Nur bekannte Push Dienste annehmen
const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

function validSubscription(sub) {
  try {
    const url = new URL(sub.endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(url.hostname)) && sub.keys?.p256dh && sub.keys?.auth;
  } catch {
    return false;
  }
}

const MESSAGES = {
  test: { title: 'Training', body: 'Mitteilungen funktionieren. So erinnere ich dich, wenn du vergisst, dein Training zu beenden.', tag: 'training-test' },
  remind: { title: 'Training noch aktiv?', body: 'Seit 30 Minuten keine Eingabe. Tippe hier, um dein Training zu beenden. Sonst wird es in 5 Minuten automatisch gespeichert.', tag: 'training-idle' },
  end: { title: 'Training gespeichert', body: 'Dein Training wurde automatisch beendet. Die Dauer zählt bis zu deiner letzten Eingabe.', tag: 'training-idle' },
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    // Nur Anfragen aus der App selbst annehmen
    if (req.method !== 'POST') return new Response('Training Erinnerung', { status: 405 });
    if (req.headers.get('Origin') !== url.origin) return new Response('Nicht erlaubt', { status: 403 });

    let body;
    try {
      body = JSON.parse(await req.text());
    } catch {
      return new Response('Ungültige Anfrage', { status: 400 });
    }
    const sub = body.subscription;
    if (!validSubscription(sub)) return new Response('Ungültige Push Adresse', { status: 400 });

    const stub = env.REMINDER.get(env.REMINDER.idFromName(sub.endpoint));
    const path = url.pathname.slice(4);
    if (path === '/schedule') await stub.schedule(sub, Number(body.last));
    else if (path === '/cancel') await stub.cancel();
    else if (path === '/test') {
      const status = await stub.test(sub);
      if (status >= 300) return new Response(`Push Dienst antwortet ${status}`, { status: 502 });
    } else return new Response('Unbekannt', { status: 404 });
    return new Response('ok', {});
  },
};

export class Reminder extends DurableObject {
  async schedule(sub, last) {
    const now = Date.now();
    if (!Number.isFinite(last) || last > now) last = now;
    await this.ctx.storage.put({ sub, last, stage: 'remind' });
    await this.ctx.storage.setAlarm(Math.max(last + REMIND_MS, now + 1000));
  }

  async cancel() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async test(sub) {
    return sendPush(this.env, sub, MESSAGES.test);
  }

  async alarm() {
    const data = await this.ctx.storage.get(['sub', 'last', 'stage']);
    const sub = data.get('sub');
    if (!sub) return;
    const stage = data.get('stage');
    const status = await sendPush(this.env, sub, MESSAGES[stage === 'remind' ? 'remind' : 'end']);
    // Abgelaufene Push Adresse oder zweite Nachricht verschickt: aufräumen
    if (status === 404 || status === 410 || stage !== 'remind') return this.cancel();
    await this.ctx.storage.put('stage', 'end');
    await this.ctx.storage.setAlarm(Math.max(data.get('last') + END_MS, Date.now() + 1000));
  }
}
