// Einstellungen: Sicherung, Wiederherstellung, Hinweise

import { state, flush, replaceAll } from '../store.js';
import { sheet, esc, icon, fmtDateLong, confirmSheet, toast } from '../ui.js';
import { render } from '../app.js';

const APP_VERSION = '1.0';

async function exportData() {
  flush();
  const date = new Date().toISOString().slice(0, 10);
  const name = `training-sicherung-${date}.json`;
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Training Sicherung' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    state.settings.lastBackup = Date.now();
    flush();
    return true;
  } catch (e) {
    if (e.name !== 'AbortError') toast('Sicherung fehlgeschlagen');
    return false;
  }
}

function importData(file, close) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const n = Array.isArray(data.workouts) ? data.workouts.length : 0;
      const ok = await confirmSheet({
        title: 'Sicherung wiederherstellen?',
        message: `Die Sicherung enthält ${n} Trainings. Alle aktuellen Daten auf diesem iPhone werden dadurch ersetzt.`,
        confirm: 'Ersetzen',
      });
      if (!ok) return;
      replaceAll(data);
      close();
      render();
      toast('Sicherung wiederhergestellt');
    } catch (e) {
      toast(e.message || 'Datei konnte nicht gelesen werden');
    }
  };
  reader.readAsText(file);
}

function openSettings() {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const last = state.settings?.lastBackup;
  const size = new Blob([localStorage.getItem('training.v1') || '']).size;
  sheet(
    `<div class="sheet-head"><span class="sheet-head-gap"></span><h3>Einstellungen</h3><button class="btn-text strong" data-close>Fertig</button></div>
     <h4 class="sheet-label">Datensicherung</h4>
     <div class="group">
       <button class="row" data-export>${icon.share}<div class="row-main"><div>Daten sichern</div><div class="row-sub">${last ? 'Zuletzt am ' + esc(fmtDateLong(last)) : 'Noch nie gesichert'}</div></div></button>
       <label class="row">${icon.download}<div class="row-main"><div>Sicherung wiederherstellen</div><div class="row-sub">Datei auswählen</div></div><input type="file" accept="application/json,.json" data-import hidden></label>
     </div>
     <p class="footnote">Deine Daten liegen nur auf diesem iPhone. Sichere sie regelmäßig, am besten mit „In Dateien sichern“ in iCloud Drive. Wenn du die App vom Homescreen löschst, sind die Daten sonst weg.</p>
     ${standalone ? '' : `<h4 class="sheet-label">Auf den Homescreen</h4>
     <div class="card"><p>In Safari unten auf ${icon.share} „Teilen“ tippen, dann „Zum Home-Bildschirm“. Danach startet Training wie eine App im Vollbild und funktioniert auch ohne Internet.</p></div>`}
     <h4 class="sheet-label">Info</h4>
     <div class="group">
       <div class="row static"><div class="row-main">Trainings</div><span class="muted">${state.workouts.length}</span></div>
       <div class="row static"><div class="row-main">Pläne</div><span class="muted">${state.plans.length}</span></div>
       <div class="row static"><div class="row-main">Speicher</div><span class="muted">${Math.max(1, Math.round(size / 1024))} KB</span></div>
       <div class="row static"><div class="row-main">Version</div><span class="muted">${APP_VERSION}</span></div>
     </div>`,
    {
      tall: true,
      onMount: (el, close) => {
        el.querySelector('[data-export]').addEventListener('click', async () => {
          if (await exportData()) {
            el.querySelector('[data-export] .row-sub').textContent = 'Zuletzt am ' + fmtDateLong(Date.now());
          }
        });
        el.querySelector('[data-import]').addEventListener('change', (e) => {
          const f = e.target.files[0];
          if (f) importData(f, close);
          e.target.value = '';
        });
      },
    },
  );
}

export const actions = { openSettings };
