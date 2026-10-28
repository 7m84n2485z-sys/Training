// Teil 2: Training aufzeichnen

import { state, save, flush, uid, plan, activePlan, exercise, muscleName } from '../store.js';
import { esc, icon, numInput, parseNum, fmtNum, fmtKg, fmtInt, fmtDate, fmtDateLong, fmtMin, relDays, sheet, confirmSheet, toast } from '../ui.js';
import { recommend, history, personalRecords, workoutStats, sessionStats } from '../logic.js';
import { pickExercise } from '../picker.js';
import { touch, sync, cancel, lastActivity, idleMs, pushSupported, pushEnabled, isStandalone, enablePush, REMIND_MIN, END_MIN, isOldHome, NEW_HOME } from '../reminder.js';
import { exportData } from './settings.js';
import { go, render, back } from '../app.js';

const REC_ICON = { increase: icon.arrowUp, decrease: icon.arrowDown, comeback: icon.info, plan: icon.edit, start: icon.flame, hold: icon.arrowUp };

function lastText(exerciseId) {
  const last = history(exerciseId).at(-1);
  if (!last) return 'Noch nicht trainiert';
  const reps = last.sets.map((s) => s.reps);
  const same = reps.every((r) => r === reps[0]);
  return `Zuletzt ${relDays(last.date)}: ${same ? `${reps.length} × ${reps[0]}` : reps.join(' / ')} mit ${fmtKg(last.stats.topWeight)}${last.imported ? ' (Wdh. geschätzt)' : ''}`;
}

function makeEntry(exerciseId, item) {
  const rec = recommend(exerciseId, item);
  return {
    exerciseId,
    itemId: item?.id ?? null,
    repMin: item?.repMin ?? 8,
    repMax: item?.repMax ?? 12,
    rec: { type: rec.type, short: rec.short, text: rec.text },
    sets: rec.reps.map((r) => ({ weight: rec.weight, reps: r, done: false })),
  };
}

function start(planId, dayId) {
  const p = plan(planId);
  const d = p?.days.find((x) => x.id === dayId);
  state.active = {
    id: 'w_' + uid(),
    planId: p?.id ?? null,
    dayId: d?.id ?? null,
    title: d?.name ?? 'Freies Training',
    startedAt: Date.now(),
    lastActivity: Date.now(),
    entries: (d?.items ?? []).map((it) => makeEntry(it.exerciseId, it)),
  };
  flush();
  sync();
  render();
  scrollTo(0, 0);
}

// Umzugshinweis auf der alten Adresse bei GitHub Pages
function moveCard(workouts) {
  const last = workouts[0];
  return `<div class="card move">
    <div class="row-title">Training ist umgezogen</div>
    <p class="muted">Die App hat eine neue Adresse, dort gibt es auch die Erinnerung zum Beenden. So nimmst du alle Trainings, Pläne und Gewichte mit:</p>
    <ol>
      <li>Daten sichern und „In Dateien sichern“ wählen.
        <button class="btn btn-primary wide" data-act="moveExport">${icon.share} Daten sichern</button></li>
      <li>Neue Adresse in Safari öffnen und über Teilen „Zum Home-Bildschirm“ hinzufügen.
        <a class="btn btn-tinted wide" href="${NEW_HOME}" target="_blank" rel="noopener">Neue App öffnen</a></li>
      <li>In der neuen App „Sicherung einspielen“ tippen und die Datei auswählen.</li>
    </ol>
    <p class="footnote tight">Deine Sicherung enthält ${workouts.length} ${workouts.length === 1 ? 'Training' : 'Trainings'}${last ? `, das letzte vom ${fmtDate(last.startedAt)}` : ''}. Die neue App zeigt nach dem Einspielen dieselbe Zahl an. Erst dann diese alte App vom Homescreen löschen.</p>
  </div>`;
}

// Übersicht ohne laufendes Training
function overview() {
  const p = activePlan();
  const workouts = [...state.workouts].sort((a, b) => b.startedAt - a.startedAt);
  const lastOfDay = (dayId) => workouts.find((w) => w.dayId === dayId);
  const fresh = !workouts.length && state.plans.every((x) => x.days.every((d) => !d.items.length));
  return {
    title: 'Training',
    html: `
      ${isOldHome ? moveCard(workouts) : ''}
      ${fresh ? `<div class="card welcome">
        <div class="row-title">Willkommen</div>
        <p class="muted">Lege unter Pläne deine Übungen an oder spiele eine Sicherung ein, um mit deinen bisherigen Daten zu starten.</p>
        <button class="btn btn-tinted wide" data-act="openSettings">${icon.download} Sicherung einspielen</button>
      </div>` : ''}
      ${!fresh && pushSupported() && isStandalone() && !pushEnabled() && !state.settings.pushHintDone ? `<div class="card welcome">
        <div class="row-title">Erinnerung einschalten</div>
        <p class="muted">Vergisst du, ein Training zu beenden, bekommst du nach ${REMIND_MIN} Minuten ohne Eingabe eine Mitteilung. Reagierst du nicht, endet das Training 5 Minuten später automatisch.</p>
        <div class="btn-row"><button class="btn btn-tinted" data-act="pushHintLater">Später</button><button class="btn btn-primary" data-act="pushHintEnable">Einschalten</button></div>
      </div>` : ''}
      ${p ? `<h2 class="section first">${esc(p.name)}</h2>
        ${p.days.map((d) => {
          const lw = lastOfDay(d.id);
          return `<div class="card start-card">
            <div><div class="start-title">${esc(d.name)}</div>
            <div class="row-sub">${d.items.length} Übungen${lw ? ` · zuletzt ${relDays(lw.startedAt)}` : ''}</div></div>
            <button class="btn btn-primary" data-act="startDay" data-plan="${p.id}" data-id="${d.id}" ${d.items.length ? '' : 'disabled'}>${icon.play} Starten</button>
          </div>`;
        }).join('')}` : '<div class="card"><p class="muted">Lege unter Pläne einen Trainingsplan an, dann erscheint er hier.</p></div>'}
      <button class="btn btn-tinted wide" data-act="startFree">${icon.plus} Freies Training</button>

      <h2 class="section">Letzte Trainings</h2>
      ${workouts.length ? `<div class="group">${workouts.slice(0, 30).map((w) => {
        const s = workoutStats(w);
        return `<button class="row" data-act="openWorkout" data-id="${w.id}">
          <div class="row-main"><div class="row-title">${esc(w.title)}</div>
          <div class="row-sub">${fmtDate(w.startedAt)} · ${w.durationMin != null ? fmtMin(w.durationMin) + ' · ' : ''}${s.sets} Sätze${w.imported ? ' · aus Notion' : ''}</div></div>${icon.chevron}</button>`;
      }).join('')}</div>` : '<p class="muted pad">Noch keine Trainings aufgezeichnet.</p>'}`,
  };
}

function setRow(ei, si, s) {
  const a = (f) => `data-in="set" data-f="${f}" data-e="${ei}" data-s="${si}"`;
  return `<div class="set${s.done ? ' done' : ''}" data-set="${ei}-${si}">
    <span class="set-no">${si + 1}</span>
    <span class="set-field">${numInput(a('weight'), s.weight, { label: `Satz ${si + 1} Gewicht` })}<em>kg</em></span>
    <span class="set-field">${numInput(a('reps'), s.reps, { decimal: false, label: `Satz ${si + 1} Wiederholungen` })}<em>Wdh.</em></span>
    <button class="check" data-act="toggleSet" data-e="${ei}" data-s="${si}" aria-label="Satz ${si + 1} erledigt">${icon.check}</button>
  </div>`;
}

function entryCard(en, ei) {
  const ex = exercise(en.exerciseId);
  const doneAll = en.sets.length && en.sets.every((s) => s.done);
  return `<div class="card entry${doneAll ? ' complete' : ''}" data-entry="${ei}">
    <div class="item-head">
      <div><div class="row-title">${esc(ex?.name ?? 'Übung')}</div>
      <div class="row-sub">${muscleName(ex?.muscle)} · Ziel ${en.repMin} bis ${en.repMax} Wdh.</div></div>
      <button class="icon-btn danger" data-act="removeEntry" data-e="${ei}" aria-label="Übung entfernen">${icon.trash}</button>
    </div>
    <div class="rec rec-${en.rec.type}">${REC_ICON[en.rec.type] ?? icon.info}<div><b>${esc(en.rec.short)}</b> ${esc(en.rec.text)}</div></div>
    <div class="last">${esc(lastText(en.exerciseId))}</div>
    <div class="sets">${en.sets.map((s, si) => setRow(ei, si, s)).join('')}</div>
    <div class="entry-foot">
      <button class="btn-text" data-act="addSet" data-e="${ei}">${icon.plus} Satz</button>
      ${en.sets.length > 1 ? `<button class="btn-text muted" data-act="removeSet" data-e="${ei}">Letzten Satz entfernen</button>` : ''}
    </div>
  </div>`;
}

const isComplete = (en) => en.sets.length > 0 && en.sets.every((s) => s.done);

function progress(a) {
  const all = a.entries.flatMap((e) => e.sets);
  return { done: all.filter((s) => s.done).length, total: all.length };
}

function activeView() {
  const a = state.active;
  const pr = progress(a);
  return {
    title: a.title,
    html: `
      <div class="live-bar glass">
        <div class="live-clock">${icon.clock}<b data-clock></b></div>
        <div class="live-progress" data-progress>${pr.done} von ${pr.total} Sätzen</div>
        <button class="btn btn-primary small" data-act="finish">Beenden</button>
      </div>
      ${entriesHtml(a)}
      <button class="btn btn-tinted wide" data-act="addEntry">${icon.plus} Übung hinzufügen</button>
      <button class="btn btn-plain danger wide spaced" data-act="discard">Training verwerfen</button>`,
  };
}

function entriesHtml(a) {
  if (!a.entries.length) return '<p class="muted pad">Füge deine erste Übung hinzu.</p>';
  const list = a.entries.map((en, i) => ({ en, i }));
  const open = list.filter((x) => !isComplete(x.en));
  const done = list.filter((x) => isComplete(x.en));
  return `${open.map((x) => entryCard(x.en, x.i)).join('')}
    ${!open.length ? `<div class="card hints"><div class="hint ok">${icon.check}<span>Alle Übungen erledigt. Tippe oben auf Beenden.</span></div></div>` : ''}
    ${done.length ? `<h2 class="section done-head">Erledigt <span>${done.length}</span></h2>${done.map((x) => entryCard(x.en, x.i)).join('')}` : ''}`;
}

// Neu sortieren mit Gleitanimation, danach zur ersten offenen Übung
function reorder() {
  const before = new Map([...document.querySelectorAll('.entry')].map((n) => [n.dataset.entry, n.getBoundingClientRect().top]));
  render();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Ziel vor der Animation messen, sonst verfälscht die Verschiebung die Position
  const first = document.querySelector('.entry:not(.complete)');
  const target = first ? Math.max(0, first.getBoundingClientRect().top + scrollY - 140) : null;
  document.querySelectorAll('.entry').forEach((n) => {
    const top = before.get(n.dataset.entry);
    if (top == null || reduce) return;
    const dy = top - n.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
  });
  if (target != null) setTimeout(() => scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' }), 120);
}

function updateProgress() {
  const n = document.querySelector('[data-progress]');
  if (n) {
    const pr = progress(state.active);
    n.textContent = `${pr.done} von ${pr.total} Sätzen`;
  }
}

function workoutView({ id }) {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return null;
  const s = workoutStats(w);
  return {
    title: w.title,
    subtitle: fmtDateLong(w.startedAt),
    html: `
      <div class="tiles">
        <div class="tile"><span>Dauer</span><b>${w.durationMin != null ? fmtMin(w.durationMin) : 'unbekannt'}</b></div>
        <div class="tile"><span>Sätze</span><b>${s.sets}</b></div>
        <div class="tile"><span>Volumen</span><b>${fmtInt(s.volume)} kg</b></div>
        <div class="tile"><span>Anstrengung</span><b>${w.rpe ? w.rpe + ' von 10' : 'keine Angabe'}</b></div>
      </div>
      ${w.imported ? '<p class="footnote">Aus Notion übernommen. Dort waren nur Gewichte notiert, die Wiederholungen sind mit 10 geschätzt.</p>' : ''}
      ${w.entries.map((en) => {
        const ex = exercise(en.exerciseId);
        const st = sessionStats(en.sets);
        return `<div class="card">
          <div class="row-title">${esc(ex?.name ?? 'Übung')}</div>
          <div class="row-sub">${muscleName(ex?.muscle)} · Volumen ${fmtInt(st.volume)} kg</div>
          <div class="set-list">${en.sets.map((x, i) => `<div><span>Satz ${i + 1}</span><b>${fmtKg(x.weight)} × ${x.reps}</b></div>`).join('')}</div>
        </div>`;
      }).join('')}
      <button class="btn btn-plain danger wide spaced" data-act="deleteWorkout" data-id="${w.id}">Training löschen</button>`,
  };
}

export const views = {
  train: () => (state.active ? activeView() : overview()),
  workout: workoutView,
};

// Endzeit: bei längerer Pause zählt die letzte Eingabe, nicht die Uhrzeit
function suggestedMinutes(a) {
  const end = Date.now() - lastActivity(a) > 10 * 60000 ? lastActivity(a) : Date.now();
  return Math.max(1, Math.round((end - a.startedAt) / 60000));
}

function finishSheet() {
  const a = state.active;
  const minutes = suggestedMinutes(a);
  const clock = Math.max(1, Math.round((Date.now() - a.startedAt) / 60000));
  let rpe = null;
  sheet(
    `<div class="sheet-head"><button class="btn-text" data-close>Zurück</button><h3>Training beenden</h3><span class="sheet-head-gap"></span></div>
     <div class="group form">
       <label class="field"><span>Dauer</span><span class="field-num">${numInput('data-dur', minutes, { decimal: false, label: 'Dauer in Minuten' })}<em>min</em></span></label>
     </div>
     <p class="footnote">${minutes < clock ? `Die Uhr lief ${fmtMin(clock)}. Vorgeschlagen ist die Dauer bis zu deiner letzten Eingabe.` : `Die Uhr lief ${fmtMin(clock)}. Korrigiere die Dauer, falls nötig.`}</p>
     <h4 class="sheet-label">Wie anstrengend war das Training?</h4>
     <div class="rpe" data-rpe>${Array.from({ length: 10 }, (_, i) => `<button data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
     <div class="rpe-scale"><span>sehr leicht</span><span>maximal</span></div>
     <button class="btn btn-primary wide" data-save>Speichern</button>`,
    {
      onMount: (el, close) => {
        el.querySelector('[data-rpe]').addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b) return;
          rpe = Number(b.dataset.v);
          el.querySelectorAll('[data-rpe] button').forEach((n) => n.classList.toggle('on', n === b));
        });
        el.querySelector('[data-save]').addEventListener('click', () => {
          const dur = Math.max(1, Math.round(parseNum(el.querySelector('[data-dur]').value))) || minutes;
          close();
          if (state.active) saveWorkout(dur, rpe);
        });
      },
    },
  );
}

function saveWorkout(durationMin, rpe, { auto = false } = {}) {
  const a = state.active;
  const w = {
    id: a.id,
    planId: a.planId,
    dayId: a.dayId,
    title: a.title,
    startedAt: a.startedAt,
    endedAt: a.startedAt + durationMin * 60000,
    durationMin,
    rpe,
    autoEnded: auto || undefined,
    entries: a.entries
      .map((en) => ({ exerciseId: en.exerciseId, sets: en.sets.filter((s) => s.done && s.reps > 0).map(({ weight, reps }) => ({ weight, reps, done: true })) }))
      .filter((en) => en.sets.length),
  };
  const prevSame = [...state.workouts].filter((x) => x.dayId && x.dayId === w.dayId).sort((x, y) => y.startedAt - x.startedAt)[0];
  const prs = personalRecords(w);
  state.workouts.push(w);

  // Plan automatisch auf den letzten Stand bringen und Ziele fürs nächste Mal berechnen
  const p = plan(a.planId);
  const day = p?.days.find((d) => d.id === a.dayId);
  const next = [];
  for (const en of w.entries) {
    const src = a.entries.find((x) => x.exerciseId === en.exerciseId);
    const item = day?.items.find((it) => it.id === src?.itemId);
    if (!item) continue;
    const from = item.weight;
    item.weight = sessionStats(en.sets).topWeight;
    const rec = recommend(en.exerciseId, item, Date.now() + 1);
    next.push({ exerciseId: en.exerciseId, from, to: item.weight, rec });
  }

  cancel();
  state.active = null;
  flush();
  render();
  scrollTo(0, 0);
  summarySheet(w, prevSame, prs, next);
}

const repsText = (reps) => (reps.every((r) => r === reps[0]) ? `${reps.length} × ${reps[0]}` : reps.join(' / '));

function summarySheet(w, prev, prs, next) {
  const s = workoutStats(w);
  let cmp = '';
  if (prev) {
    const ps = workoutStats(prev);
    if (ps.volume > 0) {
      const d = Math.round(((s.volume - ps.volume) / ps.volume) * 100);
      cmp = `<div class="hint ${d >= 0 ? 'ok' : 'low'}">${d >= 0 ? icon.arrowUp : icon.arrowDown}<span>Volumen ${d >= 0 ? '+' : ''}${d} % gegenüber dem letzten ${esc(prev.title)} (${fmtDate(prev.startedAt)})</span></div>`;
    }
  }
  const changed = next.filter((n) => n.to !== n.from).length;
  sheet(
    `<div class="summary">
       <div class="summary-badge">${icon.check}</div>
       <h3>${w.autoEnded ? 'Training automatisch beendet' : 'Stark, Training gespeichert'}</h3>
       <p class="muted">${esc(w.title)} · ${fmtDate(w.startedAt)}</p>
     </div>
     ${w.autoEnded ? `<div class="card hints"><div class="hint low">${icon.clock}<span>Nach ${REMIND_MIN} Minuten ohne Eingabe und ohne Reaktion auf die Erinnerung wurde dein Training gespeichert. Die Dauer zählt bis zu deiner letzten Eingabe.</span></div></div>` : ''}
     <div class="tiles">
       <div class="tile"><span>Dauer</span><b>${fmtMin(w.durationMin)}</b></div>
       <div class="tile"><span>Sätze</span><b>${s.sets}</b></div>
       <div class="tile"><span>Volumen</span><b>${fmtInt(s.volume)} kg</b></div>
       <div class="tile"><span>Übungen</span><b>${s.exercises}</b></div>
     </div>
     ${cmp ? `<div class="card hints">${cmp}</div>` : ''}
     ${prs.length ? `<h4 class="sheet-label">Neue Bestleistungen</h4><div class="group">${prs.map((r) => `<div class="row static">${icon.trophy}<div class="row-main"><div>${esc(exercise(r.exerciseId)?.name)}</div><div class="row-sub">${r.kind === 'weight' ? `Höchstes Gewicht: ${fmtKg(r.value)}` : `Geschätzte Maximalkraft: ${fmtKg(Math.round(r.value * 2) / 2)}`}</div></div></div>`).join('')}</div>` : ''}
     ${next.length ? `<h4 class="sheet-label">Nächstes Training</h4>
       <div class="group">${next.map((n) => `<div class="row static next-row">
         <span class="next-icon ${n.rec.type}">${n.rec.type === 'increase' ? icon.arrowUp : n.rec.type === 'decrease' ? icon.arrowDown : icon.check}</span>
         <div class="row-main"><div>${esc(exercise(n.exerciseId)?.name)}</div><div class="row-sub">${fmtKg(n.rec.weight)} · ${repsText(n.rec.reps)} Wdh.</div></div>
         ${n.rec.type === 'increase' ? `<span class="pill accent">${esc(n.rec.short)}</span>` : ''}
       </div>`).join('')}</div>
       <p class="footnote">Der Plan ist automatisch auf deinem neuen Stand${changed ? `, ${changed} ${changed === 1 ? 'Gewicht wurde' : 'Gewichte wurden'} angepasst` : ''}. Diese Werte stehen beim nächsten Training schon drin.</p>` : ''}
     <button class="btn btn-primary wide" data-close>Fertig</button>`,
    { tall: true },
  );
}

// Vergessenes Training: nach 30 Minuten fragen, nach 35 Minuten automatisch beenden
let idleClose = null;

function autoFinish() {
  const a = state.active;
  idleClose?.();
  idleClose = null;
  if (!progress(a).done) {
    cancel();
    state.active = null;
    flush();
    render();
    toast('Training ohne erledigte Sätze verworfen');
    return;
  }
  const minutes = Math.max(1, Math.round((lastActivity(a) - a.startedAt) / 60000));
  saveWorkout(minutes, null, { auto: true });
}

function idleSheet() {
  const left = () => Math.max(0, Math.ceil((END_MIN * 60000 - idleMs()) / 60000));
  idleClose = sheet(
    `<div class="confirm">
       <div class="summary-badge soft">${icon.clock}</div>
       <h3>Training noch aktiv?</h3>
       <p class="muted">Seit ${REMIND_MIN} Minuten keine Eingabe. Ohne Reaktion wird dein Training in <b data-left>${left()}</b> ${left() === 1 ? 'Minute' : 'Minuten'} automatisch gespeichert.</p>
       <button class="btn btn-primary wide" data-end>Training beenden</button>
       <button class="btn btn-plain wide" data-go>Weiter trainieren</button>
     </div>`,
    {
      onMount: (el, close) => {
        el.querySelector('[data-end]').addEventListener('click', () => { close(); finishSheet(); });
        el.querySelector('[data-go]').addEventListener('click', () => { close(); touch(); sync(); });
      },
      onClose: () => { idleClose = null; },
    },
  );
}

export function checkIdle() {
  if (!state.active || document.visibilityState !== 'visible') return;
  const idle = idleMs();
  if (idle >= END_MIN * 60000) autoFinish();
  else if (idle >= REMIND_MIN * 60000) {
    if (!idleClose && !document.querySelector('.sheet-wrap')) idleSheet();
  } else if (idleClose) {
    idleClose();
  }
}

let reorderTimer = null;

export const actions = {
  async moveExport() {
    if (await exportData()) toast('Sicherung erstellt');
  },
  pushHintLater() {
    state.settings.pushHintDone = true;
    save();
    render();
  },
  async pushHintEnable() {
    try {
      await enablePush();
      toast('Erinnerung ist eingeschaltet');
    } catch (e) {
      toast(e.message);
    }
    state.settings.pushHintDone = true;
    save();
    render();
  },
  startDay: (t) => start(t.dataset.plan, t.dataset.id),
  startFree: () => start(null, null),
  openWorkout: (t) => go('workout', { id: t.dataset.id }),
  toggleSet(t) {
    const en = state.active.entries[Number(t.dataset.e)];
    const s = en.sets[Number(t.dataset.s)];
    // Werte aus den Feldern übernehmen, falls noch nicht gespeichert
    const row = t.closest('.set');
    row.querySelectorAll('input').forEach((inp) => {
      if (inp.value.trim() !== '') s[inp.dataset.f] = inp.dataset.f === 'reps' ? Math.round(parseNum(inp.value)) : parseNum(inp.value);
    });
    const wasComplete = isComplete(en);
    s.done = !s.done;
    touch();
    row.classList.toggle('done', s.done);
    t.closest('.entry').classList.toggle('complete', isComplete(en));
    updateProgress();
    // Übung komplett oder wieder offen: neu sortieren
    if (wasComplete !== isComplete(en)) {
      clearTimeout(reorderTimer);
      reorderTimer = setTimeout(reorder, 550);
    }
  },
  addSet(t) {
    const en = state.active.entries[Number(t.dataset.e)];
    const last = en.sets.at(-1) ?? { weight: 0, reps: en.repMin };
    en.sets.push({ weight: last.weight, reps: last.reps, done: false });
    touch();
    render();
  },
  removeSet(t) {
    const en = state.active.entries[Number(t.dataset.e)];
    if (en.sets.length > 1) en.sets.pop();
    touch();
    render();
  },
  async removeEntry(t) {
    const i = Number(t.dataset.e);
    const en = state.active.entries[i];
    const ok = await confirmSheet({ title: `${exercise(en.exerciseId)?.name ?? 'Übung'} entfernen?`, message: 'Die Übung und ihre Sätze werden aus diesem Training entfernt.', confirm: 'Entfernen' });
    if (!ok) return;
    state.active.entries.splice(i, 1);
    touch();
    render();
  },
  addEntry() {
    pickExercise(
      (exerciseId) => {
        state.active.entries.push(makeEntry(exerciseId, null));
        touch();
        render();
        requestAnimationFrame(() => document.querySelector(`[data-entry="${state.active.entries.length - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      },
      { exclude: state.active.entries.map((e) => e.exerciseId) },
    );
  },
  async finish() {
    if (!progress(state.active).done) {
      const ok = await confirmSheet({ title: 'Noch kein Satz abgehakt', message: 'Ohne erledigte Sätze wird nichts gespeichert. Training verwerfen?', confirm: 'Verwerfen' });
      if (ok) { cancel(); state.active = null; flush(); render(); }
      return;
    }
    finishSheet();
  },
  async discard() {
    const ok = await confirmSheet({ title: 'Training verwerfen?', message: 'Alle Eingaben dieses Trainings gehen verloren.', confirm: 'Verwerfen' });
    if (!ok) return;
    cancel();
    state.active = null;
    flush();
    render();
  },
  async deleteWorkout(t) {
    const ok = await confirmSheet({ title: 'Training löschen?', message: 'Das Training verschwindet auch aus der Auswertung.', confirm: 'Löschen' });
    if (!ok) return;
    state.workouts = state.workouts.filter((w) => w.id !== t.dataset.id);
    save();
    back();
  },
};

export const inputs = {
  set(t) {
    if (!state.active || t.value.trim() === '') return;
    const en = state.active.entries[Number(t.dataset.e)];
    const si = Number(t.dataset.s);
    const s = en.sets[si];
    const f = t.dataset.f;
    const v = f === 'reps' ? Math.max(0, Math.round(parseNum(t.value))) : Math.max(0, parseNum(t.value));
    const old = s[f];
    s[f] = v;
    // Gewicht in folgende offene Sätze mit gleichem Wert übernehmen
    if (f === 'weight') {
      for (let j = si + 1; j < en.sets.length; j++) {
        const n = en.sets[j];
        if (n.done || n.weight !== old) continue;
        n.weight = v;
        const inp = document.querySelector(`[data-set="${t.dataset.e}-${j}"] input[data-f="weight"]`);
        if (inp) inp.value = fmtNum(v);
      }
    }
    touch();
  },
};
