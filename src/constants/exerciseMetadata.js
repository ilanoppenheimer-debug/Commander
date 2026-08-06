export const MOVEMENT_PATTERNS = [
  { id: 'horizontal_push',  label: 'Empuje horizontal' },
  { id: 'vertical_push',    label: 'Empuje vertical' },
  { id: 'horizontal_pull',  label: 'Tracción horizontal' },
  { id: 'vertical_pull',    label: 'Tracción vertical' },
  { id: 'squat',            label: 'Sentadilla' },
  { id: 'hinge',            label: 'Bisagra de cadera' },
  { id: 'lunge',            label: 'Lunge / unilateral' },
  { id: 'isolation',        label: 'Aislación' },
  { id: 'core',             label: 'Core / abdominal' },
];

export const SCALE_3 = [
  { id: 'low',    label: 'Baja',  color: 'text-emerald-400' },
  { id: 'medium', label: 'Media', color: 'text-amber-400' },
  { id: 'high',   label: 'Alta',  color: 'text-red-400' },
];

export const MUSCLE_GROUP_OPTIONS = [
  { id: 'chest',     label: 'Pecho' },
  { id: 'back',      label: 'Espalda' },
  { id: 'legs',      label: 'Piernas' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'arms',      label: 'Brazos' },
  { id: 'core',      label: 'Core' },
  { id: 'cardio',    label: 'Cardio' },
  { id: 'other',     label: 'Otro' },
];

// In-memory store (backed by localStorage key 'ironCmdrExMeta')
const META_KEY = 'ironCmdrExMeta';

export function loadExerciseMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch { return {}; }
}

export function saveExerciseMeta(name, data) {
  const all = loadExerciseMeta();
  all[name] = { ...all[name], ...data };
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

export function getExerciseMeta(name) {
  return loadExerciseMeta()[name] || {};
}

export function toggleFavorite(name) {
  const meta = getExerciseMeta(name);
  saveExerciseMeta(name, { favorite: !meta.favorite });
  return !meta.favorite;
}

export function isFavorite(name) {
  return !!getExerciseMeta(name).favorite;
}

// Whitelist for the "Mis 1RM" list only — what's shown there, not the exercise itself.
// Not read by sessionExport.js, blocksMath.js, or computeExercise1RM: the export,
// history, and block matching stay untouched by this selection.
//
// tracked1RM is explicit tri-state: true (shown), false (explicitly hidden), or absent
// (never touched — the caller falls back to a display-only default). Absent must stay
// distinguishable from false, so callers can tell "never chose" from "chose to hide".
export function setTracked1RM(name, value) {
  saveExerciseMeta(name, { tracked1RM: value });
}

export function getTracked1RM(name) {
  return getExerciseMeta(name).tracked1RM; // undefined | true | false
}

export function hasAnyTracked1RMSelection() {
  const all = loadExerciseMeta();
  return Object.values(all).some(m => typeof m?.tracked1RM === 'boolean');
}
