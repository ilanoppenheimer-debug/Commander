import { normalizeExerciseName } from '../utils/exerciseName';
import { getFamilyEntry, familyGroup, FAMILY_NAMES, tableUnilateralOf } from './exerciseFamilies';

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
  // The exercise's own metadata first; a variant of the families table with no metadata
  // (new time variants: Plancha Lateral, Front Lever *, Cardio...) falls back to the table.
  return getExerciseMeta(name).measurement ?? getFamilyEntry(name)?.measurement; // undefined | 'reps' | 'time'
}

// Family of an exercise, for GROUPING only (selector, search, reports by family). Never written
// to the history. Order: the family the athlete chose (metadata.family) -> the families table ->
// the exercise's own name (a family of one).
export function resolveFamily(name) {
  return getExerciseMeta(name).family || getFamilyEntry(name)?.family || String(name ?? '');
}

// Muscle group an exercise is shown / classified under, and where it comes from. READ ONLY.
// The group belongs to the FAMILY, not to the variant:
//  - If the family the exercise resolves to has a group in the families table, that group rules —
//    whatever the exercise's own metadata.muscleGroup says (it is not deleted: it is simply not read
//    while the family has a table group, so the change can be undone by reading it again).
//  - Otherwise (a family of the athlete's own) the exercise's metadata.muscleGroup, which the form writes
//    to every variant of the family at once.
// Never inferred from words in the name. Returns { group, source } with source in
// 'familia' | 'metadata' | null.
export function resolveMuscleGroup(name) {
  const fam = familyGroup(resolveFamily(name));
  if (fam) return { group: fam, source: 'familia' };
  const own = getExerciseMeta(name).muscleGroup;
  return own ? { group: own, source: 'metadata' } : { group: undefined, source: null };
}

// Matches a family typed by someone else (the Coach's `familia:`) against the families that already
// exist — the table's and the athlete's own — ignoring case and accents. { name, isNew }: `name` is the
// existing spelling when there is a match, otherwise the text as given (a new family).
export function matchFamily(text) {
  const typed = String(text ?? '').trim();
  if (!typed) return { name: '', isNew: false };
  const key = normalizeExerciseName(typed);
  const own = Object.values(loadExerciseMeta()).map(m => m?.family).filter(f => typeof f === 'string' && f.trim());
  const found = [...FAMILY_NAMES, ...own].find(f => normalizeExerciseName(f) === key);
  return found ? { name: found, isNew: false } : { name: typed, isNew: true };
}

// Unilateral = one side at a time (dumbbells moved together are bilateral). Spec of an exercise:
// true (always), [implements] (only with those) or false.
//  1. The athlete's own override, metadata.unilateral (true | [implements] | false), always rules.
//  2. A variant of the families table: the table is the default. The old `bilateral` mark is ignored
//     (it used another definition).
//  3. Any other exercise (the athlete's own): the inherited `bilateral:false` reads as unilateral.
// Nothing is migrated or deleted.
export function unilateralSpec(name) {
  const meta = getExerciseMeta(name);
  const own = meta.unilateral;
  if (own === true || own === false) return own;
  if (Array.isArray(own)) return [...own];
  if (getFamilyEntry(name)) return tableUnilateralOf(name);
  return meta.bilateral === false;
}

// Is this exercise, done with this implement, unilateral? `equipment` null/undefined = no implement known.
export function isUnilateral(name, equipment) {
  const spec = unilateralSpec(name);
  return Array.isArray(spec) ? !!equipment && spec.includes(equipment) : spec === true;
}

// What the families table alone says for this implement (no override).
export const tableIsUnilateral = (name, equipment) => {
  const spec = tableUnilateralOf(name);
  return Array.isArray(spec) ? !!equipment && spec.includes(equipment) : spec === true;
};

// Drops fields from EVERY spelling key of an exercise (they resolve as one). Touches nothing else.
export function clearMetaFields(name, fields) {
  const all = loadExerciseMeta();
  let changed = false;
  for (const k of groupKeysOf(all, name)) {
    if (!fields.some(f => all[k]?.[f] !== undefined)) continue;
    const next = { ...all[k] };
    for (const f of fields) delete next[f];
    all[k] = { ...next, updatedAt: Date.now() };
    changed = true;
  }
  if (changed) localStorage.setItem(META_KEY, JSON.stringify(all));
  return changed;
}

// Default muscle group from the family (the athlete's choice or the table), or undefined. It is only a
// default: the exercise's own metadata.muscleGroup, when there is one, always wins over it.
export function familyDefaultGroup(name) {
  return familyGroup(resolveFamily(name));
}

// Companion metric — only meaningful when measurement === 'time'. Tri-state: undefined
// (not configured), 'difficulty' (perceived effort) or 'hr' (heart rate).
export function setCompanion(name, value) {
  saveExerciseMeta(name, { companion: value });
}

export function getCompanion(name) {
  return getExerciseMeta(name).companion; // undefined | 'difficulty' | 'hr'
}

// How the hold timer of a timed set is shown for this exercise: 'timer' (counts down
// from the set's targetSeconds, then "+N") or 'stopwatch' (counts up). Optional, absent
// until the athlete picks one — the caller falls back to 'timer' when a set has a target.
export function setTimedMode(name, value) {
  saveExerciseMeta(name, { timedMode: value });
}

export function getTimedMode(name) {
  return getExerciseMeta(name).timedMode; // undefined | 'timer' | 'stopwatch'
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
