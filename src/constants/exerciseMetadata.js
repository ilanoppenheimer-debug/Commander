import { normalizeExerciseName } from '../utils/exerciseName';

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

// ── Identity-aware storage ────────────────────────────────────────────────────
// The blob is keyed by the literal name that was saved, so "Remo en punta" and "Remo en
// Punta" can both exist as keys. They are one exercise (normalizeExerciseName), so READS
// resolve every key of the group into one object; WRITES go to one key and stamp it with
// updatedAt. Stored keys are never merged or deleted by this layer.

// Fields that carry provenance: [value, override flag, assigned-at, assigned-by].
const PROVENANCE_FIELDS = [
  ['defaultTag',  'tagOverride',         'tagAssignedAt',         'tagAssignedBy'],
  ['equipment',   'equipmentOverride',   'equipmentAssignedAt',   'equipmentAssignedBy'],
  ['muscleGroup', 'muscleGroupOverride', 'muscleGroupAssignedAt', 'muscleGroupAssignedBy'],
];
const PROVENANCE_KEYS = new Set(PROVENANCE_FIELDS.flat());

const groupKeysOf = (all, name) => {
  const target = normalizeExerciseName(name);
  return target === '' ? [] : Object.keys(all).filter(k => normalizeExerciseName(k) === target);
};

const stamp = (meta) => Number(meta?.updatedAt) || 0;

// Per field: user-manual beats coach-import/auto; ties go to the most recent assignment,
// then to the most recently written key. Fields without provenance (measurement,
// companion, tracked1RM...) take the value of the most recently written key that has it,
// so an explicit tracked1RM:false on any spelling survives; favorite is OR'd.
const resolveGroup = (all, keys) => {
  const metas = keys.map(k => all[k] || {});
  const resolved = {};

  for (const [valueKey, overrideKey, atKey, byKey] of PROVENANCE_FIELDS) {
    const holders = metas.filter(m => m[valueKey] != null);
    if (holders.length === 0) continue;
    const isManual = (m) => m[overrideKey] === true || m[byKey] === 'user-manual';
    holders.sort((a, b) =>
      (isManual(b) - isManual(a))
      || String(b[atKey] || '').localeCompare(String(a[atKey] || ''))
      || (stamp(b) - stamp(a)));
    const winner = holders[0];
    for (const k of [valueKey, overrideKey, atKey, byKey]) if (winner[k] !== undefined) resolved[k] = winner[k];
  }

  const otherFields = new Set(metas.flatMap(m => Object.keys(m)).filter(k => !PROVENANCE_KEYS.has(k) && k !== 'favorite' && k !== 'updatedAt'));
  const newestFirst = [...metas].sort((a, b) => stamp(b) - stamp(a));
  for (const field of otherFields) {
    const holder = newestFirst.find(m => m[field] !== undefined);
    if (holder) resolved[field] = holder[field];
  }
  if (metas.some(m => m.favorite)) resolved.favorite = true;
  return resolved;
};

export function saveExerciseMeta(name, data) {
  const all = loadExerciseMeta();
  const keys = groupKeysOf(all, name);
  const key = all[name] !== undefined
    ? name
    : (keys.length > 0 ? [...keys].sort((a, b) => stamp(all[b]) - stamp(all[a]))[0] : name);
  all[key] = { ...all[key], ...data, updatedAt: Date.now() };
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

// Exact-key accessors for the rename flow, which must act on a literal spelling.
export const getRawExerciseMeta = (name) => loadExerciseMeta()[name] || {};
export function writeRawExerciseMeta(name, meta) {
  const all = loadExerciseMeta();
  all[name] = { ...meta, updatedAt: Date.now() };
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

// Full replace, not merge — used by backup restore, where the backup IS the snapshot to
// return to, same semantics as Dexie's clear()+bulkPut() for the rest of a restore.
export function replaceAllExerciseMeta(all) {
  try { localStorage.setItem(META_KEY, JSON.stringify(all || {})); } catch { /* non-blocking */ }
}

export function getExerciseMeta(name) {
  const all = loadExerciseMeta();
  const keys = groupKeysOf(all, name);
  if (keys.length === 0) return {};
  if (keys.length === 1) return all[keys[0]] || {};
  return resolveGroup(all, keys);
}

// Exact key only (used after a rename moved the data elsewhere).
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
