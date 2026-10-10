// Teil 1: Trainingspläne

import { state, save, uid, plan, exercise, muscleName, MUSCLES } from '../store.js';
import { esc, icon, numInput, parseNum, fmtKg, confirmSheet, toast } from '../ui.js';
import { planVolume, volumeHints, itemHints, history } from '../logic.js';
import { rangeBars } from '../charts.js';
import { pickExercise, editExercise } from '../picker.js';
import { go, render, back } from '../app.js';

const dayOf = (p, dayId) => p?.days.find((d) => d.id === dayId);
const exCount = (p) => p.days.reduce((n, d) => n + d.items.length, 0);

function volumeSection(p) {
  const vol = planVolume(p);
  const hints = volumeHints(vol);
  const rows = MUSCLES.filter((m) => !m.optional || vol[m.id]).map((m) => {
    const v = vol[m.id] || 0;
    return { label: m.name, value: v, min: m.min, max: m.max, flag: v < m.min ? 'low' : v > m.max ? 'high' : '' };
  });
  return `
    <h2 class="section">Sätze pro Woche</h2>
    <div class="card">
      ${rangeBars(rows)}
      <p class="legend"><span class="key-bar"></span>geplante Sätze <span class="key-band"></span>Richtwert für Muskelaufbau</p>
    </div>
    ${hints.length
      ? `<div class="card hints">${hints.map((h) => `<div class="hint ${h.kind}">${icon.info}<span>${esc(h.text)}</span></div>`).join('')}</div>`
      : `<div class="card hints"><div class="hint ok">${icon.check}<span>Alle Muskelgruppen liegen im empfohlenen Bereich.</span></div></div>`}
    <p class="footnote">Nebenmuskeln zählen halb, z. B. der Trizeps bei der Brustpresse. Die Richtwerte (etwa 10 bis 20 Sätze pro Woche) stammen aus Übersichtsstudien zum Muskelaufbau.</p>`;
}

export const views = {
  plans() {
    return {
      title: 'Pläne',
      html: `
        <div class="group">
          ${state.plans
            .map(
              (p) => `<button class="row" data-act="openPlan" data-id="${p.id}">
                <div class="row-main"><div class="row-title">${esc(p.name)}</div>
                <div class="row-sub">${p.days.length} ${p.days.length === 1 ? 'Trainingstag' : 'Trainingstage'} · ${exCount(p)} Übungen</div></div>
                ${p.id === state.activePlanId ? '<span class="pill accent">Aktiv</span>' : ''}${icon.chevron}</button>`,
            )
            .join('') || '<p class="muted pad">Noch kein Plan angelegt.</p>'}
        </div>
        <button class="btn btn-tinted wide" data-act="newPlan">${icon.plus} Neuer Plan</button>
        <p class="footnote">Der aktive Plan erscheint beim Start eines Trainings. Tippe einen Plan an, um Trainingstage und Übungen zu bearbeiten.</p>`,
    };
  },

  plan({ planId }) {
    const p = plan(planId);
    if (!p) return null;
    const active = p.id === state.activePlanId;
    return {
      title: p.name || 'Plan',
      html: `
        <div class="group form">
          <label class="field"><span>Name</span><input type="text" value="${esc(p.name)}" data-in="planName" data-id="${p.id}" placeholder="Name des Plans"></label>
        </div>
        ${active ? '<p class="footnote">Dieser Plan ist aktiv.</p>' : `<button class="btn btn-tinted wide" data-act="activatePlan" data-id="${p.id}">Als aktiven Plan nutzen</button>`}

        <h2 class="section">Trainingstage</h2>
        <div class="group">
          ${p.days
            .map(
              (d) => `<button class="row" data-act="openDay" data-plan="${p.id}" data-id="${d.id}">
                <div class="row-main"><div class="row-title">${esc(d.name)}</div>
                <div class="row-sub">${d.items.length} Übungen · ${d.perWeek}× pro Woche</div></div>${icon.chevron}</button>`,
            )
            .join('')}
          <button class="row add" data-act="newDay" data-id="${p.id}">${icon.plus}<span>Trainingstag hinzufügen</span></button>
        </div>

        ${exCount(p) ? volumeSection(p) : ''}

        <button class="btn btn-plain danger wide spaced" data-act="deletePlan" data-id="${p.id}">Plan löschen</button>`,
    };
  },

  day({ planId, dayId }) {
    const p = plan(planId);
    const d = dayOf(p, dayId);
    if (!d) return null;
    return {
      title: d.name || 'Trainingstag',
      html: `
        <div class="group form">
          <label class="field"><span>Name</span><input type="text" value="${esc(d.name)}" data-in="dayName" data-plan="${p.id}" data-id="${d.id}" placeholder="z. B. Ganzkörper A"></label>
          <div class="field"><span>Pro Woche</span>
            <div class="stepper">
              <button data-act="perWeek" data-plan="${p.id}" data-id="${d.id}" data-d="-1" aria-label="weniger">−</button>
              <b>${d.perWeek}×</b>
              <button data-act="perWeek" data-plan="${p.id}" data-id="${d.id}" data-d="1" aria-label="mehr">+</button>
            </div>
          </div>
        </div>

        <h2 class="section">Übungen</h2>
        ${d.items.map((it, i) => itemCard(p, d, it, i)).join('') || '<p class="muted pad">Noch keine Übungen. Füge die erste hinzu.</p>'}
        <button class="btn btn-tinted wide" data-act="addItem" data-plan="${p.id}" data-id="${d.id}">${icon.plus} Übung hinzufügen</button>
        <p class="footnote">Empfehlung für Muskelaufbau: 2 bis 4 Sätze mit 8 bis 12 Wiederholungen. Schaffst du in allen Sätzen das obere Ende, schlägt die App im Training das nächste Gewicht vor.</p>
        <button class="btn btn-plain danger wide spaced" data-act="deleteDay" data-plan="${p.id}" data-id="${d.id}">Trainingstag löschen</button>`,
    };
  },
};

function itemCard(p, d, it, i) {
  const ex = exercise(it.exerciseId);
  const hints = itemHints(it);
  const a = (field) => `data-in="item" data-f="${field}" data-plan="${p.id}" data-day="${d.id}" data-id="${it.id}"`;
  return `<div class="card item">
    <div class="item-head">
      <button class="item-name" data-act="editExercise" data-ex="${it.exerciseId}">
        <div class="row-title">${esc(ex?.name ?? 'Unbekannte Übung')}</div>
        <div class="row-sub">${muscleName(ex?.muscle)} · Schritt ${fmtKg(ex?.step ?? 2.5)} ${icon.edit}</div>
      </button>
      <div class="item-tools">
        <button class="icon-btn" data-act="moveItem" data-plan="${p.id}" data-day="${d.id}" data-id="${it.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="nach oben">${icon.up}</button>
        <button class="icon-btn" data-act="moveItem" data-plan="${p.id}" data-day="${d.id}" data-id="${it.id}" data-d="1" ${i === d.items.length - 1 ? 'disabled' : ''} aria-label="nach unten">${icon.down}</button>
        <button class="icon-btn danger" data-act="removeItem" data-plan="${p.id}" data-day="${d.id}" data-id="${it.id}" aria-label="entfernen">${icon.trash}</button>
      </div>
    </div>
    <div class="item-fields">
      <label><span>Sätze</span>${numInput(a('sets'), it.sets, { decimal: false, label: 'Sätze' })}</label>
      <label><span>Wdh. von</span>${numInput(a('repMin'), it.repMin, { decimal: false, label: 'Wiederholungen von' })}</label>
      <label><span>bis</span>${numInput(a('repMax'), it.repMax, { decimal: false, label: 'Wiederholungen bis' })}</label>
      <label><span>Gewicht kg</span>${numInput(a('weight'), it.weight, { label: 'Gewicht in kg' })}</label>
    </div>
    <div class="item-hints" data-hints="${it.id}">${hints.map((h) => `<div class="hint low small">${icon.info}<span>${esc(h)}</span></div>`).join('')}</div>
  </div>`;
}

export const actions = {
  openPlan: (t) => go('plan', { planId: t.dataset.id }),
  openDay: (t) => go('day', { planId: t.dataset.plan, dayId: t.dataset.id }),
  newPlan() {
    const p = { id: 'p_' + uid(), name: 'Neuer Plan', days: [{ id: 'd_' + uid(), name: 'Trainingstag A', perWeek: 1, items: [] }] };
    state.plans.push(p);
    if (!plan(state.activePlanId)) state.activePlanId = p.id;
    save();
    go('plan', { planId: p.id });
  },
  activatePlan(t) {
    state.activePlanId = t.dataset.id;
    save();
    render();
    toast('Plan ist jetzt aktiv');
  },
  async deletePlan(t) {
    const p = plan(t.dataset.id);
    const ok = await confirmSheet({ title: `„${p.name}“ löschen?`, message: 'Der Plan wird entfernt. Deine bisherigen Trainings bleiben erhalten.', confirm: 'Plan löschen' });
    if (!ok) return;
    state.plans = state.plans.filter((x) => x !== p);
    if (state.activePlanId === p.id) state.activePlanId = state.plans[0]?.id ?? null;
    save();
    back();
  },
  newDay(t) {
    const p = plan(t.dataset.id);
    const letter = String.fromCharCode(65 + p.days.length);
    const d = { id: 'd_' + uid(), name: `Trainingstag ${letter}`, perWeek: 1, items: [] };
    p.days.push(d);
    save();
    go('day', { planId: p.id, dayId: d.id });
  },
  async deleteDay(t) {
    const p = plan(t.dataset.plan);
    const d = dayOf(p, t.dataset.id);
    const ok = await confirmSheet({ title: `„${d.name}“ löschen?`, message: 'Der Trainingstag und seine Übungsliste werden entfernt.', confirm: 'Trainingstag löschen' });
    if (!ok) return;
    p.days = p.days.filter((x) => x !== d);
    save();
    back();
  },
  perWeek(t) {
    const d = dayOf(plan(t.dataset.plan), t.dataset.id);
    d.perWeek = Math.min(7, Math.max(1, d.perWeek + Number(t.dataset.d)));
    save();
    render();
  },
  addItem(t) {
    const d = dayOf(plan(t.dataset.plan), t.dataset.id);
    pickExercise(
      (exerciseId) => {
        const last = history(exerciseId).at(-1);
        d.items.push({ id: uid(), exerciseId, sets: 3, repMin: 8, repMax: 12, weight: last?.stats.topWeight ?? 0, updatedAt: 0 });
        save();
        render();
        requestAnimationFrame(() => scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      },
      { exclude: d.items.map((i) => i.exerciseId) },
    );
  },
  moveItem(t) {
    const d = dayOf(plan(t.dataset.plan), t.dataset.day);
    const i = d.items.findIndex((x) => x.id === t.dataset.id);
    const j = i + Number(t.dataset.d);
    if (j < 0 || j >= d.items.length) return;
    [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    save();
    render();
  },
  async removeItem(t) {
    const d = dayOf(plan(t.dataset.plan), t.dataset.day);
    const it = d.items.find((x) => x.id === t.dataset.id);
    const ok = await confirmSheet({ title: `${exercise(it.exerciseId)?.name ?? 'Übung'} entfernen?`, message: 'Die Übung wird aus diesem Trainingstag entfernt. Der Verlauf bleibt erhalten.', confirm: 'Entfernen' });
    if (!ok) return;
    d.items = d.items.filter((x) => x !== it);
    save();
    render();
  },
  editExercise: (t) => editExercise(t.dataset.ex, () => render()),
};

export const inputs = {
  planName(t) {
    plan(t.dataset.id).name = t.value;
    save();
    document.querySelector('.top-title').textContent = t.value;
  },
  dayName(t) {
    dayOf(plan(t.dataset.plan), t.dataset.id).name = t.value;
    save();
    document.querySelector('.top-title').textContent = t.value;
  },
  item(t) {
    const it = dayOf(plan(t.dataset.plan), t.dataset.day)?.items.find((x) => x.id === t.dataset.id);
    if (!it || t.value.trim() === '') return;
    const f = t.dataset.f;
    const v = parseNum(t.value);
    if (f === 'weight') {
      it.weight = Math.max(0, v);
      it.updatedAt = Date.now();
    } else {
      it[f] = Math.max(f === 'sets' ? 1 : 1, Math.round(v));
    }
    save();
    const box = document.querySelector(`[data-hints="${it.id}"]`);
    if (box) box.innerHTML = itemHints(it).map((h) => `<div class="hint low small">${icon.info}<span>${esc(h)}</span></div>`).join('');
  },
};
