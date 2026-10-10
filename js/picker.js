// Übungsauswahl und Übung bearbeiten als Sheet

import { state, save, uid, exercise, MUSCLES, muscleName } from './store.js';
import { sheet, esc, icon, numInput, parseNum } from './ui.js';

const muscleOptions = (sel) => MUSCLES.map((m) => `<option value="${m.id}"${m.id === sel ? ' selected' : ''}>${m.name}</option>`).join('');

export function pickExercise(onPick, { exclude = [] } = {}) {
  let filter = '';
  let query = '';
  sheet(
    `<div class="sheet-head"><button class="btn-text" data-close>Abbrechen</button><h3>Übung hinzufügen</h3><span class="sheet-head-gap"></span></div>
     <label class="search">${icon.search}<input type="search" placeholder="Suchen" data-q autocomplete="off"></label>
     <div class="chips no-drag" data-filters>
       <button class="chip on" data-f="">Alle</button>
       <button class="chip" data-f="own">Eigene</button>
       ${MUSCLES.map((m) => `<button class="chip" data-f="${m.id}">${m.name}</button>`).join('')}
     </div>
     <div class="pick-list" data-list></div>
     <button class="btn btn-tinted wide" data-new>${icon.plus} Eigene Übung anlegen</button>`,
    {
      tall: true,
      onMount: (el, close) => {
        const list = el.querySelector('[data-list]');
        const draw = () => {
          const q = query.trim().toLowerCase();
          const items = state.exercises
            .filter((e) => !filter || (filter === 'own' ? e.custom : e.muscle === filter))
            .filter((e) => !q || e.name.toLowerCase().includes(q) || muscleName(e.muscle).toLowerCase().includes(q))
            .sort((a, b) => (b.custom - a.custom) || a.name.localeCompare(b.name, 'de'));
          list.innerHTML = items.length
            ? `<div class="group">${items
                .map((e) => `<button class="row" data-pick="${e.id}"><div class="row-main"><div>${esc(e.name)}</div><div class="row-sub">${muscleName(e.muscle)}${e.custom ? ' · eigene' : ''}</div></div>${exclude.includes(e.id) ? '<span class="pill">im Plan</span>' : icon.plus}</button>`)
                .join('')}</div>`
            : `<p class="muted center pad">Keine Übung gefunden. Lege sie unten als eigene Übung an.</p>`;
        };
        draw();
        el.querySelector('[data-q]').addEventListener('input', (e) => { query = e.target.value; draw(); });
        el.querySelector('[data-filters]').addEventListener('click', (e) => {
          const c = e.target.closest('[data-f]');
          if (!c) return;
          filter = c.dataset.f;
          el.querySelectorAll('[data-f]').forEach((n) => n.classList.toggle('on', n === c));
          draw();
        });
        list.addEventListener('click', (e) => {
          const r = e.target.closest('[data-pick]');
          if (!r) return;
          close();
          onPick(r.dataset.pick);
        });
        el.querySelector('[data-new]').addEventListener('click', () => {
          close();
          setTimeout(() => editExercise(null, (id) => onPick(id), query.trim()), 330);
        });
      },
    },
  );
}

// Neue Übung anlegen (id = null) oder bestehende bearbeiten
export function editExercise(id, onDone, presetName = '') {
  const ex = id ? exercise(id) : { name: presetName, muscle: 'brust', secondary: [], step: 2.5, custom: true };
  sheet(
    `<div class="sheet-head"><button class="btn-text" data-close>Abbrechen</button><h3>${id ? 'Übung bearbeiten' : 'Eigene Übung'}</h3><button class="btn-text strong" data-save>Sichern</button></div>
     <div class="group form">
       <label class="field"><span>Name</span><input type="text" data-name value="${esc(ex.name)}" placeholder="z. B. Brustpresse" autocomplete="off"></label>
       <label class="field"><span>Muskelgruppe</span><select data-muscle>${muscleOptions(ex.muscle)}</select></label>
       <label class="field"><span>Gewichtsschritt</span><span class="field-num">${numInput('data-step', ex.step, { label: 'Gewichtsschritt' })}<em>kg</em></span></label>
     </div>
     <p class="footnote">Der Gewichtsschritt ist die kleinste Erhöhung an diesem Gerät. Die App empfiehlt Steigerungen in genau diesem Schritt.</p>
     <div class="group form">
       <div class="field col"><span>Nebenmuskeln (zählen halb)</span>
         <div class="chips wrap" data-sec>${MUSCLES.map((m) => `<button type="button" class="chip${ex.secondary?.includes(m.id) ? ' on' : ''}" data-m="${m.id}">${m.name}</button>`).join('')}</div>
       </div>
     </div>`,
    {
      onMount: (el, close) => {
        const sec = new Set(ex.secondary || []);
        el.querySelector('[data-sec]').addEventListener('click', (e) => {
          const c = e.target.closest('[data-m]');
          if (!c) return;
          sec.has(c.dataset.m) ? sec.delete(c.dataset.m) : sec.add(c.dataset.m);
          c.classList.toggle('on');
        });
        if (!id) setTimeout(() => el.querySelector('[data-name]').focus(), 350);
        el.querySelector('[data-save]').addEventListener('click', () => {
          const name = el.querySelector('[data-name]').value.trim();
          if (!name) return el.querySelector('[data-name]').focus();
          const muscle = el.querySelector('[data-muscle]').value;
          const step = parseNum(el.querySelector('[data-step]').value) || 2.5;
          const secondary = [...sec].filter((m) => m !== muscle);
          let target = id ? exercise(id) : null;
          if (target) Object.assign(target, { name, muscle, step, secondary });
          else {
            target = { id: 'x_' + uid(), name, muscle, secondary, step, custom: true };
            state.exercises.push(target);
          }
          save();
          close();
          onDone?.(target.id);
        });
      },
    },
  );
}

