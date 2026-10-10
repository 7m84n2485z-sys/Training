// Teil 3: Auswertung

import { state, exercise, muscleName, MUSCLES } from '../store.js';
import { esc, icon, fmtNum, fmtKg, fmtInt, fmtShort, fmtDate, fmtMin } from '../ui.js';
import { history, stagnations, actualVolume, volumeHints, weeklyFrequency, sessionStats } from '../logic.js';
import { lineChart, columnChart, rangeBars } from '../charts.js';
import { render } from '../app.js';

const METRICS = {
  weight: { label: 'Gewicht', unit: 'kg', sub: 'Höchstes Gewicht je Training', get: (h) => h.stats.topWeight },
  e1rm: { label: 'Maximalkraft', unit: 'kg', sub: 'Geschätztes Maximalgewicht für eine Wiederholung (Formel nach Epley)', get: (h) => Math.round(h.stats.best * 10) / 10 },
  volume: { label: 'Volumen', unit: 'kg', sub: 'Gewicht × Wiederholungen aller Sätze je Training', get: (h) => Math.round(h.stats.volume) },
};

const ui = { exerciseId: null, metric: 'weight' };

function trainedExercises() {
  const counts = new Map();
  for (const w of state.workouts) for (const en of w.entries) counts.set(en.exerciseId, (counts.get(en.exerciseId) || 0) + 1);
  return [...counts.keys()].map((id) => exercise(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function tilesHtml() {
  const now = Date.now();
  const last30 = state.workouts.filter((w) => w.startedAt > now - 30 * 86400000);
  const freq = weeklyFrequency(12);
  const thisWeek = freq.at(-1).count;
  const withDur = state.workouts.filter((w) => w.durationMin != null);
  const avgDur = withDur.length ? Math.round(withDur.reduce((s, w) => s + w.durationMin, 0) / withDur.length) : null;
  return `<div class="tiles">
    <div class="tile"><span>Diese Woche</span><b>${thisWeek} ${thisWeek === 1 ? 'Training' : 'Trainings'}</b></div>
    <div class="tile"><span>Letzte 30 Tage</span><b>${last30.length} ${last30.length === 1 ? 'Training' : 'Trainings'}</b></div>
    <div class="tile"><span>Dauer im Schnitt</span><b>${avgDur != null ? fmtMin(avgDur) : 'noch offen'}</b></div>
    <div class="tile"><span>Trainings gesamt</span><b>${state.workouts.length}</b></div>
  </div>`;
}

function recommendationsHtml() {
  const stag = stagnations();
  const vol = actualVolume(4);
  const hints = vol.count ? volumeHints(vol.map) : [];
  if (!stag.length && !hints.length) {
    return `<div class="card hints"><div class="hint ok">${icon.check}<span>Keine Stagnation und alle Muskelgruppen im Zielbereich. Weiter so.</span></div></div>`;
  }
  const tips = [...new Set(stag.map((s) => s.tip))];
  return `
    ${stag.length ? `<div class="advice">
      <div class="advice-head">${icon.warn}<div><b>Kein Fortschritt</b><span>${stag.length === 1 ? 'Diese Übung tritt' : 'Diese Übungen treten'} seit mindestens 3 Trainings auf der Stelle</span></div></div>
      <div class="group inset">${stag.map((s) => `<button class="row" data-act="statsPick" data-id="${s.exerciseId}"><div class="row-main"><div>${esc(exercise(s.exerciseId)?.name)}</div><div class="row-sub">seit ${s.stuck} Trainings bei ${fmtKg(s.weight)}</div></div>${icon.chevron}</button>`).join('')}</div>
      ${tips.map((t) => `<p>${esc(t)}</p>`).join('')}
      ${stag.some((s) => s.imported) ? '<p class="muted small">Die Wiederholungen aus Notion sind geschätzt. Mit echten Werten aus der App wird die Bewertung genauer.</p>' : ''}
    </div>` : ''}
    ${hints.length ? `<div class="advice">
      <div class="advice-head">${icon.info}<div><b>Trainingsumfang</b><span>Sätze pro Woche, ${esc(vol.label)}</span></div></div>
      ${hints.map((h) => `<p>${esc(h.text)}</p>`).join('')}
    </div>` : ''}`;
}

function exerciseSection() {
  const list = trainedExercises();
  if (!list.length) return '<p class="muted pad">Sobald du trainiert hast, siehst du hier deinen Verlauf.</p>';
  if (!list.find((e) => e.id === ui.exerciseId)) ui.exerciseId = list[0].id;
  const hist = history(ui.exerciseId);
  const m = METRICS[ui.metric];
  const first = hist[0], last = hist.at(-1);
  const bestW = Math.max(...hist.map((h) => h.stats.topWeight));
  const bestE = Math.max(...hist.map((h) => h.stats.best));
  const diff = last.stats.topWeight - first.stats.topWeight;
  return `
    <div class="card">
      <label class="select-row"><select data-ch="statsExercise" aria-label="Übung wählen">${list.map((e) => `<option value="${e.id}"${e.id === ui.exerciseId ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select>${icon.down}</label>
      <div class="segmented" role="tablist">${Object.entries(METRICS).map(([k, v]) => `<button class="${k === ui.metric ? 'on' : ''}" data-act="statsMetric" data-m="${k}">${v.label}</button>`).join('')}</div>
      <p class="chart-sub">${m.sub}</p>
      <div data-chart="exercise"></div>
      <div class="mini-facts">
        <div><span>Bestes Gewicht</span><b>${fmtKg(bestW)}</b></div>
        <div><span>Maximalkraft</span><b>${bestE ? fmtKg(Math.round(bestE * 2) / 2) : 'offen'}</b></div>
        <div><span>Seit Beginn</span><b>${diff > 0 ? '+' : ''}${fmtKg(diff)}</b></div>
      </div>
      <details class="table-view"><summary>Alle Werte anzeigen</summary>
        <table><thead><tr><th>Datum</th><th>Sätze</th><th>${m.label}</th></tr></thead>
        <tbody>${[...hist].reverse().map((h) => `<tr><td>${fmtDate(h.date)}</td><td>${h.sets.map((s) => `${fmtNum(s.weight)}×${s.reps}`).join(', ')}</td><td>${fmtNum(m.get(h))} kg</td></tr>`).join('')}</tbody></table>
      </details>
    </div>`;
}

function muscleSection() {
  const vol = actualVolume(4);
  if (!vol.count) return '<p class="muted pad">Sobald du trainiert hast, siehst du hier deine Sätze je Muskelgruppe.</p>';
  const rows = MUSCLES.filter((m) => !m.optional || vol.map[m.id]).map((m) => {
    const v = vol.map[m.id] || 0;
    return { label: m.name, value: v, min: m.min, max: m.max, flag: v < m.min ? 'low' : v > m.max ? 'high' : '' };
  });
  return `<div class="card">
    <p class="chart-sub">Sätze pro Woche, ${esc(vol.label)} (${vol.count} ${vol.count === 1 ? 'Training' : 'Trainings'})</p>
    ${rangeBars(rows)}
    <p class="legend"><span class="key-bar"></span>Sätze pro Woche <span class="key-band"></span>Richtwert</p>
  </div>`;
}

function frequencySection() {
  const freq = weeklyFrequency(12);
  const total = freq.reduce((s, b) => s + b.count, 0);
  return `<div class="card">
    <p class="chart-sub">Trainings pro Woche, letzte 12 Wochen · Schnitt ${fmtNum(Math.round((total / 12) * 10) / 10)} pro Woche</p>
    <div data-chart="freq"></div>
    <details class="table-view"><summary>Alle Werte anzeigen</summary>
      <table><thead><tr><th>Woche ab</th><th>Trainings</th><th>Dauer</th></tr></thead>
      <tbody>${[...freq].reverse().map((b) => `<tr><td>${fmtShort(b.start)}</td><td>${b.count}</td><td>${b.minutes ? fmtMin(b.minutes) : 'offen'}</td></tr>`).join('')}</tbody></table>
    </details>
  </div>`;
}

export const views = {
  stats() {
    return {
      title: 'Auswertung',
      html: `
        ${tilesHtml()}
        <h2 class="section">Empfehlungen</h2>
        ${recommendationsHtml()}
        <h2 class="section">Verlauf je Übung</h2>
        ${exerciseSection()}
        <h2 class="section">Muskelgruppen</h2>
        ${muscleSection()}
        <h2 class="section">Trainingshäufigkeit</h2>
        ${frequencySection()}`,
      mount(root) {
        const ex = root.querySelector('[data-chart="exercise"]');
        if (ex && ui.exerciseId) {
          const m = METRICS[ui.metric];
          const pts = history(ui.exerciseId).map((h) => ({ t: h.date, v: m.get(h), label: fmtDate(h.date) + (h.imported ? ' · Notion' : '') }));
          lineChart(ex, pts, { unit: m.unit, fmt: ui.metric === 'volume' ? fmtInt : fmtNum });
        }
        const fr = root.querySelector('[data-chart="freq"]');
        if (fr) {
          const freq = weeklyFrequency(12);
          columnChart(fr, freq.map((b, i) => ({ v: b.count, label: fmtShort(b.start), tip: `Woche ab ${fmtShort(b.start)}${b.minutes ? ' · ' + fmtMin(b.minutes) : ''}`, current: i === freq.length - 1 })), { unit: '' });
        }
      },
    };
  },
};

export const actions = {
  statsPick(t) {
    ui.exerciseId = t.dataset.id;
    render();
    document.querySelector('[data-chart="exercise"]')?.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  statsMetric(t) {
    ui.metric = t.dataset.m;
    const y = scrollY;
    render();
    scrollTo(0, y);
  },
};

export const inputs = {
  statsExercise(t) {
    ui.exerciseId = t.value;
    const y = scrollY;
    render();
    scrollTo(0, y);
  },
};
