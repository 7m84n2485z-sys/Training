// Einstellungen: Sicherung, Wiederherstellung, Hinweise

import { state, flush, replaceAll } from '../store.js';
import { sheet, esc, icon, fmtDateLong, confirmSheet, toast } from '../ui.js';
import { render } from '../app.js';
import { pushSupported, pushEnabled, isStandalone, enablePush, disablePush, sendTest, REMIND_MIN } from '../reminder.js';

const APP_VERSION = '1.1';

function reminderHtml() {
  if (!pushSupported()) return '<div class="card"><p class="muted">Erinnerungen sind auf diesem Gerät nicht verfügbar.</p></div>';
  if (!isStandalone()) return '<div class="card"><p class="muted">Erinnerungen funktionieren nur, wenn du Training vom Homescreen startest.</p></div>';
  return pushEnabled()
    ? `<div class="group">
        <div class="row static">${icon.check}<div class="row-main"><div>Erinnerung ist aktiv</div><div class="row-sub">Nach ${REMIND_MIN} Minuten ohne Eingabe</div></div></div>
        <button class="row" data-push-test>${icon.info}<div class="row-main"><div>Testnachricht senden</div><div class="row-sub">Kommt in wenigen Sekunden</div></div></button>
        <button class="row" data-push-off>${icon.close}<div class="row-main"><div>Erinnerung ausschalten</div></div></button>
      </div>`
    : `<div class="group">
        <button class="row" data-push-on>${icon.clock}<div class="row-main"><div>Erinnerung einschalten</div><div class="row-sub">Das iPhone fragt einmal nach der Erlaubnis für Mitteilungen</div></div></button>
      </div>`;
}

export async function exportData() {
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
      toast(`${n} ${n === 1 ? 'Training' : 'Trainings'} übernommen`);
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
     <h4 class="sheet-label">Erinnerung</h4>
     <div data-reminder>${reminderHtml()}</div>
     <p class="footnote">Hast du ${REMIND_MIN} Minuten nichts eingetragen, schickt die App eine Mitteilung. Reagierst du nicht, wird das Training 5 Minuten später automatisch gespeichert, mit der Dauer bis zu deiner letzten Eingabe.</p>
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
        const box = el.querySelector('[data-reminder]');
        box.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-push-on],[data-push-off],[data-push-test]');
          if (!b) return;
          try {
            if (b.matches('[data-push-on]')) { await enablePush(); toast('Erinnerung ist eingeschaltet'); }
            if (b.matches('[data-push-off]')) { await disablePush(); toast('Erinnerung ist ausgeschaltet'); }
            if (b.matches('[data-push-test]')) { await sendTest(); toast('Testnachricht ist unterwegs'); }
          } catch (err) {
            toast(err.message || 'Das hat nicht geklappt');
          }
          box.innerHTML = reminderHtml();
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
