import { normalizeExerciseName } from './exerciseName';
import { getExerciseMeta } from '../constants/exerciseMetadata';

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
  const eq = equipment || null;
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
  const label = equipment ? (EQUIPMENT_LABEL_ES[equipment] || equipment) : null;
  return label ? `${name} · ${label}` : name;
};
