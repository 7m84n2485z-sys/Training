// Datenhaltung: alles liegt als JSON im localStorage des iPhones.

const KEY = 'training.v1';
const VERSION = 1;

export const MUSCLES = [
  { id: 'brust', name: 'Brust', min: 10, max: 20 },
  { id: 'ruecken', name: 'Rücken', min: 10, max: 20 },
  { id: 'schultern', name: 'Schultern', min: 8, max: 20 },
  { id: 'beine', name: 'Beine', min: 10, max: 20 },
  { id: 'bizeps', name: 'Bizeps', min: 6, max: 16 },
  { id: 'trizeps', name: 'Trizeps', min: 6, max: 16 },
  { id: 'bauch', name: 'Bauch', min: 4, max: 16, optional: true },
  { id: 'unterer_ruecken', name: 'Unterer Rücken', min: 4, max: 12, optional: true },
  { id: 'waden', name: 'Waden', min: 4, max: 16, optional: true },
];

export const muscleName = (id) => MUSCLES.find((m) => m.id === id)?.name ?? 'Sonstige';

// [id, Name, Muskelgruppe, Nebenmuskeln]
const DEFAULT_EXERCISES = [
  ['brustpresse', 'Brustpresse', 'brust', ['trizeps', 'schultern']],
  ['butterfly', 'Butterfly', 'brust', []],
  ['bankdruecken', 'Bankdrücken', 'brust', ['trizeps', 'schultern']],
  ['schraegbank_kh', 'Schrägbankdrücken Kurzhantel', 'brust', ['schultern', 'trizeps']],
  ['kabel_crossover', 'Kabelzug Crossover', 'brust', []],
  ['latzug', 'Latzug', 'ruecken', ['bizeps']],
  ['rudern_maschine', 'Rudern Maschine', 'ruecken', ['bizeps']],
  ['rudern_kabel', 'Rudern Kabelzug sitzend', 'ruecken', ['bizeps']],
  ['klimmzuege', 'Klimmzüge', 'ruecken', ['bizeps']],
  ['kh_rudern', 'Kurzhantelrudern einarmig', 'ruecken', ['bizeps']],
  ['pullover', 'Pullover Maschine', 'ruecken', []],
  ['schulterpresse', 'Schulterpresse', 'schultern', ['trizeps']],
  ['seitheben_kh', 'Seitheben Kurzhantel', 'schultern', []],
  ['seitheben_maschine', 'Seitheben Maschine', 'schultern', []],
  ['reverse_butterfly', 'Reverse Butterfly', 'schultern', ['ruecken']],
  ['face_pulls', 'Face Pulls', 'schultern', ['ruecken']],
  ['beinpresse', 'Beinpresse', 'beine', []],
  ['beinstrecker', 'Beinstrecker', 'beine', []],
  ['beinbeuger', 'Beinbeuger', 'beine', []],
  ['kniebeuge', 'Kniebeuge', 'beine', ['unterer_ruecken']],
  ['ausfallschritte', 'Ausfallschritte', 'beine', []],
  ['hip_thrust', 'Hip Thrust', 'beine', []],
  ['abduktor', 'Abduktorenmaschine', 'beine', []],
  ['adduktor', 'Adduktorenmaschine', 'beine', []],
  ['rum_kreuzheben', 'Rumänisches Kreuzheben', 'beine', ['unterer_ruecken']],
  ['wadenheben', 'Wadenheben', 'waden', []],
  ['bizepscurl_maschine', 'Bizepscurl Maschine', 'bizeps', []],
  ['bizepscurl_kh', 'Bizepscurl Kurzhantel', 'bizeps', []],
  ['hammercurl', 'Hammercurl', 'bizeps', []],
  ['bizepscurl_kabel', 'Bizepscurl Kabel', 'bizeps', []],
  ['dips', 'Dips', 'trizeps', ['brust', 'schultern']],
  ['trizeps_maschine', 'Trizepsdrücken Maschine', 'trizeps', []],
  ['trizeps_kabel', 'Trizepsdrücken Kabel', 'trizeps', []],
  ['french_press', 'French Press', 'trizeps', []],
  ['crunches', 'Crunches', 'bauch', []],
  ['bauchmaschine', 'Bauchmaschine', 'bauch', []],
  ['beinheben', 'Beinheben hängend', 'bauch', []],
  ['kabelcrunch', 'Kabelcrunch', 'bauch', []],
  ['hyperextension', 'Hyperextension', 'unterer_ruecken', ['beine']],
  ['rueckenstrecker', 'Rückenstrecker Maschine', 'unterer_ruecken', []],
];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const toExercise = ([id, name, muscle, secondary]) => ({ id, name, muscle, secondary, step: 2.5, custom: false });

// Erster Start: Übungsliste und ein leerer Plan. Eigene Daten kommen per Sicherungsdatei.
function seed() {
  const plan = { id: 'p_start', name: 'Mein Plan', days: [{ id: 'd_start', name: 'Ganzkörper', perWeek: 2, items: [] }] };
  return {
    version: VERSION,
    exercises: DEFAULT_EXERCISES.map(toExercise),
    plans: [plan],
    activePlanId: plan.id,
    workouts: [],
    active: null,
    settings: { lastBackup: null },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.version === VERSION) return data;
    }
  } catch (e) {
    console.error('Laden fehlgeschlagen', e);
  }
  return seed();
}

export const state = load();

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(timer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
  }
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());

// Beim ersten Start sofort sichern, damit Startdaten erhalten bleiben
if (!localStorage.getItem(KEY)) flush();

// Daten dauerhaft halten, soweit der Browser das erlaubt
navigator.storage?.persist?.().catch(() => {});

export function replaceAll(data) {
  if (!data || data.version !== VERSION || !Array.isArray(data.workouts) || !Array.isArray(data.plans)) {
    throw new Error('Die Datei ist keine gültige Sicherung dieser App.');
  }
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, data);
  flush();
}

export const exercise = (id) => state.exercises.find((e) => e.id === id);
export const plan = (id) => state.plans.find((p) => p.id === id);
export const activePlan = () => plan(state.activePlanId) ?? state.plans[0];
export const sortedWorkouts = () => [...state.workouts].sort((a, b) => a.startedAt - b.startedAt);
