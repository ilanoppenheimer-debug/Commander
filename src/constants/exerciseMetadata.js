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

export function deleteExerciseMeta(name) {
  const all = loadExerciseMeta();
  delete all[name];
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

// Merge policy for renaming into an already-existing name — same "override wins"
// convention already used by every field below (tagOverride, equipmentOverride,
// muscleGroupOverride): a manually-confirmed value beats an absent or auto-assigned
// one. sourceMeta is the exercise being renamed AWAY from, targetMeta is the name being
// renamed INTO (already existing). Target wins by default (it's the identity that
// survives); source only wins a field where target has no override but source does.
// favorite is OR'd — silently losing a favorite mark on merge would be a regression.
// tracked1RM has no override flag of its own; the plain "target wins if present" default
// already gives the right tri-state behavior (true/false both count as explicit; only
// truly absent falls through to source).
export function mergeExerciseMeta(sourceMeta = {}, targetMeta = {}) {
  const merged = { ...sourceMeta, ...targetMeta };
  const overrideFields = [
    ['defaultTag',  'tagOverride',         'tagAssignedAt',         'tagAssignedBy'],
    ['equipment',   'equipmentOverride',   'equipmentAssignedAt',   'equipmentAssignedBy'],
    ['muscleGroup', 'muscleGroupOverride', 'muscleGroupAssignedAt', 'muscleGroupAssignedBy'],
  ];
  for (const [valueKey, overrideKey, atKey, byKey] of overrideFields) {
    const targetHasOverride = targetMeta?.[overrideKey] === true;
    const sourceHasOverride = sourceMeta?.[overrideKey] === true;
    if (!targetHasOverride && sourceHasOverride) {
      merged[valueKey] = sourceMeta[valueKey];
      merged[overrideKey] = sourceMeta[overrideKey];
      if (sourceMeta[atKey] != null) merged[atKey] = sourceMeta[atKey];
      if (sourceMeta[byKey] != null) merged[byKey] = sourceMeta[byKey];
    }
  }
  merged.favorite = !!(sourceMeta?.favorite || targetMeta?.favorite);
  return merged;
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

// Measurement type — tri-state: undefined (never configured — every exercise logged
// before this field existed, and any new one until someone touches it), 'reps' (explicit),
// or 'time' (isometric holds, cardio duration, etc). Absent must stay distinguishable from
// 'reps' so callers can fall back to today's default behavior (assume reps) without a
// migration ever having to backfill 'reps' onto existing data.
export function setMeasurement(name, value) {
  saveExerciseMeta(name, { measurement: value });
}

export function getMeasurement(name) {
  return getExerciseMeta(name).measurement; // undefined | 'reps' | 'time'
}

// Companion metric — only meaningful when measurement === 'time'. Tri-state: undefined
// (not configured), 'difficulty' (perceived effort) or 'hr' (heart rate).
export function setCompanion(name, value) {
  saveExerciseMeta(name, { companion: value });
}

export function getCompanion(name) {
  return getExerciseMeta(name).companion; // undefined | 'difficulty' | 'hr'
}

// Sort criterion for the "Mis 1RM" list — a display setting, not per-exercise data, so
// it lives under its own key rather than inside the per-name metadata object.
const SORT_1RM_KEY = 'ironCmdrExMeta1RMSort';

export function getSort1RMCriterion() {
  try { return localStorage.getItem(SORT_1RM_KEY) || '1rm'; } catch { return '1rm'; }
}

export function setSort1RMCriterion(criterion) {
  try { localStorage.setItem(SORT_1RM_KEY, criterion); } catch { /* non-blocking */ }
}
