import { normalizeExerciseName } from './exerciseName';
import { getExerciseMeta, getMeasurement } from '../constants/exerciseMetadata';

// Exercise VARIANT = normalized name + equipment (implement). Numbers (1RM, top set,
// placeholders, previous performance, PRs) are computed per variant. Read-only: nothing
// here writes or rewrites stored data.
//
// Matching rule for "current exercise = (name, equipment)" against a history exercise:
//   - names must be the same exercise (normalizeExerciseName);
//   - current equipment null/undefined ("sin definir") -> by name only (today's behavior,
//     so no history is lost);
//   - history equipment unknown (not stored and no metadata) -> counts for ANY implement;
//   - bodyweight is one variant: the added load (lastre) is just the set weight, nothing
//     else is separated;
//   - otherwise equipment must be equal.

// Time-measured exercises (measurement 'time': Plancha, Cardio, Handstand...) are NEVER
// split by implement: the implement is irrelevant to the hold/duration, so they stay one
// variant per name everywhere (placeholders, seconds, Coach context, block report, share).
export const isTimeMeasured = (name) => getMeasurement(name) === 'time';

// Equipment of a history exercise: the value saved on the session wins, the exercise
// metadata is the fallback for old sessions (same chain as sessionExport / Mode1List).
export const resolveHistoryEquipment = (ex) =>
  ex?.equipment || getExerciseMeta(ex?.name).equipment || null;

// Equipment of the exercise being worked on now: exactly what the implement selector
// shows (no metadata fallback), so "Sin definir" on screen = null = match by name only.
export const currentEquipment = (ex) => ex?.equipment || null;

export const equipmentMatches = (currentEquipment, historyEquipment) => {
  if (!currentEquipment) return true;
  if (!historyEquipment) return true;
  return currentEquipment === historyEquipment;
};

// Predicate factory: matchesVariant(historyEx) for a fixed (name, equipment). Metadata is
// only consulted for history exercises that have no equipment of their own.
export const makeVariantMatcher = (name, equipment) => {
  const key = normalizeExerciseName(name);
  const eq = isTimeMeasured(name) ? null : (equipment || null);
  return (histEx) => {
    if (!histEx?.name || key === '' || normalizeExerciseName(histEx.name) !== key) return false;
    if (!eq) return true;
    return equipmentMatches(eq, histEx.equipment || getExerciseMeta(histEx.name).equipment || null);
  };
};

export const matchesVariant = (histEx, name, equipment) => makeVariantMatcher(name, equipment)(histEx);

// Spanish label of an implement, used wherever a variant is printed.
export const EQUIPMENT_LABEL_ES = {
  barbell: 'barra', dumbbell: 'mancuerna', machine: 'máquina', cable: 'polea',
  smith: 'multipower', kettlebell: 'kettlebell', bodyweight: 'peso corporal',
  landmine: 'landmine', band: 'banda elástica', other: 'otro',
};

// "Curl de Bíceps · barra"; just the name when the implement is unknown.
export const variantLabel = (name, equipment) => {
  if (isTimeMeasured(name)) return name;
  const label = equipment ? (EQUIPMENT_LABEL_ES[equipment] || equipment) : null;
  return label ? `${name} · ${label}` : name;
};

// ── Variant grouping for REPORTS (Coach context, Enviar al Coach, block report) ──────
// Groups a set of history exercises into variants (normalized name + implement) and
// decides how each one is printed. Pure, read-only.
//   - equipment = what the exercise itself says, else the exercise metadata (history).
//   - An exercise with NO known implement joins the name's group when the name has exactly
//     one implement in this scope (nothing is lost, nothing is guessed); otherwise it
//     stays in its own implement-less group.
//   - A variant is printed "Nombre · implemento" ONLY when its name has more than one
//     variant in this scope; single-implement names print exactly as before.
export const createVariantIndex = (exercises) => {
  const eqByName = new Map();   // normalized name -> Set(equipment)
  const timeByName = new Map();
  const isTime = (norm, name) => { if (!timeByName.has(norm)) timeByName.set(norm, isTimeMeasured(name)); return timeByName.get(norm); };
  const nullNames = new Set();  // names that have at least one exercise without implement
  for (const ex of exercises) {
    if (!ex?.name) continue;
    const n = normalizeExerciseName(ex.name);
    if (isTime(n, ex.name)) continue;
    const eq = resolveHistoryEquipment(ex);
    if (eq) { if (!eqByName.has(n)) eqByName.set(n, new Set()); eqByName.get(n).add(eq); }
    else nullNames.add(n);
  }
  const keyOf = (ex) => {
    const norm = normalizeExerciseName(ex?.name);
    if (isTime(norm, ex?.name)) return { key: `${norm}|`, norm, equipment: null };
    let eq = resolveHistoryEquipment(ex);
    if (!eq) { const s = eqByName.get(norm); if (s && s.size === 1) eq = [...s][0]; }
    return { key: `${norm}|${eq || ''}`, norm, equipment: eq || null };
  };
  const variantCount = (norm) => {
    if (timeByName.get(norm)) return 1; // time-measured: one variant
    const size = eqByName.get(norm)?.size || 0;
    return size + (nullNames.has(norm) && size !== 1 ? 1 : 0);
  };
  const isMulti = (norm) => variantCount(norm) > 1;
  const labelFor = (name, equipment) =>
    (equipment && isMulti(normalizeExerciseName(name))) ? variantLabel(name, equipment) : name;
  return { keyOf, isMulti, labelFor };
};
