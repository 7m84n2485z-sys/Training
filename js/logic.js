// Empfehlungen und Auswertungen (doppelte Progression, Stagnation, Volumen)

import { state, exercise, sortedWorkouts, MUSCLES } from './store.js';
import { fmtKg, fmtShort } from './ui.js';

const DAY = 86400000;

// Geschätzte Maximalkraft nach Epley, Wiederholungen auf 15 begrenzt
export const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + Math.min(r, 15) / 30) : 0);

export function sessionStats(sets) {
  const done = sets.filter((s) => s.done !== false && s.reps > 0);
  const topWeight = done.reduce((m, s) => Math.max(m, s.weight || 0), 0);
  const best = done.reduce((m, s) => Math.max(m, e1rm(s.weight, s.reps)), 0);
  const volume = done.reduce((m, s) => m + (s.weight || 0) * s.reps, 0);
  const reps = done.reduce((m, s) => m + s.reps, 0);
  // Für Übungen ohne Zusatzgewicht zählen die Wiederholungen
  const metric = best > 0 ? best : reps;
  return { sets: done.length, topWeight, best, volume, reps, metric };
}

// Alle Einheiten einer Übung, älteste zuerst
export function history(exerciseId, { before } = {}) {
  const out = [];
  for (const w of sortedWorkouts()) {
    if (before && w.startedAt >= before) continue;
    for (const en of w.entries) {
      if (en.exerciseId !== exerciseId) continue;
      const sets = en.sets.filter((s) => s.done !== false && s.reps > 0);
      if (sets.length) out.push({ date: w.startedAt, workout: w, sets, stats: sessionStats(sets), imported: !!w.imported });
    }
  }
  return out;
}

const fill = (n, v) => Array.from({ length: n }, () => v);

// Empfehlung für das nächste Training einer Übung
export function recommend(exerciseId, item, now = Date.now()) {
  const ex = exercise(exerciseId);
  const step = ex?.step || 2.5;
  const repMin = item?.repMin ?? 8;
  const repMax = item?.repMax ?? 12;
  const hist = history(exerciseId, { before: now });
  const last = hist.at(-1);
  const nSets = item?.sets ?? last?.sets.length ?? 3;

  if (!last) {
    const w = item?.weight ?? 0;
    return { type: 'start', weight: w, reps: fill(nSets, repMin), short: 'Erstes Mal', text: `Mit ${fmtKg(w)} starten und ${repMin} bis ${repMax} saubere Wiederholungen schaffen.` };
  }

  if (item && item.updatedAt > last.date && item.weight !== last.stats.topWeight) {
    return { type: 'plan', weight: item.weight, reps: fill(nSets, repMin), short: 'Planwert', text: `Neues Gewicht aus dem Plan: ${fmtKg(item.weight)}.` };
  }

  const W = last.stats.topWeight;
  const atW = last.sets.filter((s) => (s.weight || 0) === W);
  const gap = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(last.date).setHours(0, 0, 0, 0)) / DAY);

  if (gap > 14) {
    const w = Math.max(0, W - step);
    return { type: 'comeback', weight: w, reps: fill(nSets, repMin), short: 'Nach Pause', text: `${gap} Tage Pause: eine Stufe leichter mit ${fmtKg(w)} einsteigen und wieder hocharbeiten.` };
  }

  if (atW.length >= nSets && atW.every((s) => s.reps >= repMax)) {
    const w = W + step;
    return { type: 'increase', weight: w, reps: fill(nSets, repMin), short: `+${fmtKg(step)}`, text: `Alle Sätze mit ${repMax} Wiederholungen geschafft: Gewicht auf ${fmtKg(w)} erhöhen.` };
  }

  const below = atW.filter((s) => s.reps < repMin).length > atW.length / 2;
  if (below) {
    const prev = hist.at(-2);
    const prevBelow = prev && prev.stats.topWeight === W && prev.sets.filter((s) => s.reps < repMin).length > prev.sets.length / 2;
    if (prevBelow && W - step >= 0) {
      const w = W - step;
      return { type: 'decrease', weight: w, reps: fill(nSets, repMin), short: 'Leichter', text: `Zweimal unter ${repMin} Wiederholungen: eine Stufe leichter mit ${fmtKg(w)} für saubere Technik.` };
    }
    return { type: 'hold', weight: W, reps: fill(nSets, repMin), short: 'Halten', text: `Gewicht halten und mindestens ${repMin} saubere Wiederholungen schaffen.` };
  }

  const reps = Array.from({ length: nSets }, (_, i) => {
    const r = last.sets[i]?.reps ?? last.sets.at(-1).reps;
    return Math.min(repMax, Math.max(repMin, r + 1));
  });
  return { type: 'hold', weight: W, reps, short: 'Wdh. steigern', text: `Gewicht halten und je Satz eine Wiederholung mehr, bis alle Sätze ${repMax} schaffen.` };
}

// Übungen ohne Fortschritt seit mindestens drei Einheiten
export function stagnations() {
  const ids = new Set(state.workouts.flatMap((w) => w.entries.map((e) => e.exerciseId)));
  const out = [];
  for (const id of ids) {
    const all = history(id);
    // Nach einer Pause von mehr als 14 Tagen beginnt die Zählung neu
    let from = 0;
    for (let i = 1; i < all.length; i++) if (all[i].date - all[i - 1].date > 14 * DAY) from = i;
    const hist = all.slice(from);
    if (hist.length < 3) continue;
    let bestIdx = 0;
    hist.forEach((h, i) => {
      if (h.stats.metric > hist[bestIdx].stats.metric) bestIdx = i;
    });
    const stuck = hist.length - bestIdx;
    if (stuck < 3) continue;
    const last = hist.at(-1);
    let tip;
    if (stuck >= 5) tip = 'Eine Entlastungswoche mit etwa 10 % weniger Gewicht einlegen oder die Übung für einige Wochen tauschen.';
    else tip = 'Gewicht halten und die Wiederholungen Satz für Satz steigern, bis alle Sätze das obere Ende schaffen. Klappt das nicht, einen kleineren Gewichtsschritt wählen.';
    out.push({ exerciseId: id, stuck, weight: last.stats.topWeight, imported: hist.slice(bestIdx).every((h) => h.imported), tip, lastDate: last.date });
  }
  return out.sort((a, b) => b.stuck - a.stuck);
}

function addSets(map, exerciseId, sets) {
  const ex = exercise(exerciseId);
  if (!ex) return;
  map[ex.muscle] = (map[ex.muscle] || 0) + sets;
  for (const m of ex.secondary || []) map[m] = (map[m] || 0) + sets * 0.5;
}

// Geplante Sätze pro Woche und Muskelgruppe (Nebenmuskeln zählen halb)
export function planVolume(plan) {
  const map = {};
  for (const d of plan?.days || []) for (const it of d.items) addSets(map, it.exerciseId, it.sets * (d.perWeek || 1));
  return map;
}

// Tatsächliche Sätze pro Woche im Schnitt der letzten Wochen.
// Gab es zuletzt kein Training, zählen die Wochen bis zum letzten Training.
export function actualVolume(weeks = 4, now = Date.now()) {
  if (!state.workouts.length) return { map: {}, weeks: 0, count: 0, label: '' };
  const times = state.workouts.map((w) => w.startedAt);
  const lastT = Math.max(...times);
  const fallback = lastT < now - weeks * 7 * DAY;
  const end = fallback ? lastT : now;
  const from = end - weeks * 7 * DAY;
  const ws = state.workouts.filter((w) => w.startedAt > from && w.startedAt <= end);
  const first = Math.min(...ws.map((w) => w.startedAt));
  const span = Math.max(1, Math.min(weeks, Math.round((weekStart(end) - weekStart(first)) / (7 * DAY)) + 1));
  const map = {};
  for (const w of ws) for (const en of w.entries) addSets(map, en.exerciseId, en.sets.filter((s) => s.done !== false).length);
  for (const k in map) map[k] /= span;
  const wk = span === 1 ? 'Woche' : `${span} Wochen`;
  const label = fallback ? `Schnitt der ${span === 1 ? 'Woche' : wk} bis zum letzten Training am ${fmtShort(lastT)}` : `Schnitt der letzten ${wk}`;
  return { map, weeks: span, count: ws.length, label };
}

export function volumeHints(map) {
  const hints = [];
  for (const m of MUSCLES) {
    const v = map[m.id] || 0;
    if (m.optional && v === 0) continue;
    if (v < m.min) hints.push({ muscle: m, value: v, kind: 'low', text: `${m.name}: ${fmtNum(v)} Sätze pro Woche, empfohlen sind mindestens ${m.min}.` });
    else if (v > m.max) hints.push({ muscle: m, value: v, kind: 'high', text: `${m.name}: ${fmtNum(v)} Sätze pro Woche, mehr als ${m.max} bringt meist kaum zusätzlichen Fortschritt.` });
  }
  return hints;
}

export function itemHints(it) {
  const out = [];
  if (it.repMin < 5 || it.repMax > 20) out.push('Für Muskelaufbau sind 6 bis 15 Wiederholungen ideal, 8 bis 12 ist ein guter Standard.');
  if (it.repMax - it.repMin < 2) out.push('Ein Bereich von mindestens 3 Wiederholungen (z. B. 8 bis 12) macht die Steigerung leichter.');
  if (it.sets < 2) out.push('Mit 2 bis 4 Sätzen pro Übung wächst der Muskel zuverlässiger.');
  if (it.sets > 5) out.push('Mehr als 5 Sätze pro Übung bringen selten mehr, lieber auf eine zweite Übung verteilen.');
  return out;
}

const fmtNum = (v) => (Math.round(v * 2) / 2).toLocaleString('de-DE');

// Neue Bestleistungen eines Trainings gegenüber allen früheren Einheiten
export function personalRecords(workout) {
  const out = [];
  for (const en of workout.entries) {
    const prev = history(en.exerciseId, { before: workout.startedAt });
    if (!prev.length) continue;
    const s = sessionStats(en.sets);
    const bestPrev = Math.max(...prev.map((h) => h.stats.best));
    const topPrev = Math.max(...prev.map((h) => h.stats.topWeight));
    if (s.topWeight > topPrev) out.push({ exerciseId: en.exerciseId, kind: 'weight', value: s.topWeight });
    else if (s.best > bestPrev + 0.01) out.push({ exerciseId: en.exerciseId, kind: 'e1rm', value: s.best });
  }
  return out;
}

export function workoutStats(w) {
  let sets = 0, volume = 0, reps = 0;
  for (const en of w.entries) {
    const s = sessionStats(en.sets);
    sets += s.sets; volume += s.volume; reps += s.reps;
  }
  return { sets, volume, reps, exercises: w.entries.length };
}

// Montag als Wochenbeginn
export function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function weeklyFrequency(weeks = 12, now = Date.now()) {
  const start = weekStart(now) - (weeks - 1) * 7 * DAY;
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: start + i * 7 * DAY, count: 0, minutes: 0 }));
  for (const w of state.workouts) {
    const i = Math.floor((weekStart(w.startedAt) - start) / (7 * DAY) + 0.01);
    if (i >= 0 && i < weeks) {
      buckets[i].count++;
      buckets[i].minutes += w.durationMin || 0;
    }
  }
  return buckets;
}
