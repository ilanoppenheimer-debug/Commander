import { saveRoutine } from '../../db/repository';
import { db } from '../../db/database';
import { saveExerciseMeta, getExerciseMeta, getMeasurement } from '../../constants/exerciseMetadata';

/**
 * Converts a parsed routine + name resolutions into an app-storable routine.
 * replaceMode: 'new' | 'replace' | 'temporary'
 */
export const convertImportedToRoutine = async (parsedRoutine, mappings = {}, nameOverrides = {}, replaceMode = 'new') => {
  if (!parsedRoutine) return null;

  const exercises = (Array.isArray(parsedRoutine.exercises) ? parsedRoutine.exercises : []).map((impEx, idx) => {
    const resolvedName = nameOverrides[impEx.name] || mappings[impEx.name]?.exerciseName || impEx.name;
    return {
      id: impEx.id || `imp-ex-${Date.now()}-${idx}`,
      name: resolvedName,
      equipment: impEx.equipment || 'barbell',
      tag: impEx.tagSuggested || null,
      restSeconds: impEx.restSeconds || 90,
      notes: impEx.notes || '',
      decisionAdaptativa: impEx.decisionAdaptativa || null,
      unilateral: !!impEx.unilateral,
      _supersetGroup: impEx.supersetGroup || null, // consumed below, not persisted
      sets: (Array.isArray(impEx.sets) ? impEx.sets : []).map((s, si) => ({
        id: s.id || `set-${Date.now()}-${si}`,
        type: s.type || 'normal',
        weight: s.weight || '',
        reps: s.reps || '',
        rpe: s.rpe || '',
        completed: false,
        notes: s.notes || '',
        ...(s.restSeconds != null ? { restSeconds: s.restSeconds } : {}),
      })),
    };
  });

  // Translate the Coach's superset letter into the app's runtime model
  // (sessionStore.toggleSuperset): a generated id shared by ADJACENT exercises —
  // that's the only grouping the UI understands. Non-consecutive same-letter runs
  // were already flagged as a warning at parse time; here we just group whatever
  // consecutive runs exist, silently.
  let supersetRunCounter = 0;
  for (let i = 0; i < exercises.length; i++) {
    const g = exercises[i]._supersetGroup;
    if (g == null) continue;
    if (i > 0 && exercises[i - 1]._supersetGroup === g) {
      exercises[i].supersetId = exercises[i - 1].supersetId;
    } else {
      exercises[i].supersetId = `ss-imported-${Date.now()}-${supersetRunCounter++}`;
    }
  }
  for (const ex of exercises) delete ex._supersetGroup;

  const routineId = (replaceMode === 'replace' && parsedRoutine._replaceTargetId)
    ? parsedRoutine._replaceTargetId
    : parsedRoutine.id;

  const routine = {
    id: routineId,
    name: parsedRoutine.name,
    focus: parsedRoutine.focus || '',
    contextNotes: parsedRoutine.contextNotes || '',
    mesociclo: parsedRoutine.mesociclo || null,
    sessionNum: parsedRoutine.sessionNum || null,
    sessionTotal: parsedRoutine.sessionTotal || null,
    warmupNotes: Array.isArray(parsedRoutine.warmup) ? parsedRoutine.warmup.join('\n') : '',
    closingNotes: parsedRoutine.closingNotes || '',
    exercises,
    importedAt: parsedRoutine.importedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    duration: parsedRoutine.duration || null,
    isImported: true,
  };

  if (replaceMode === 'temporary') return routine;

  await saveRoutine(routine);
  return routine;
};

// Writes whichever metadata fields the Coach's YAML declared for this exercise onto
// its GLOBAL metadata entry — respects each field's own manual-override flag
// (tagOverride / equipmentOverride / muscleGroupOverride), same pattern for all
// three. Runs for EVERY exercise in an import, matched or not — a Coach
// re-declaring a tag for an exercise that already existed must actually update it,
// not just for brand-new ones (this was the bug: only new exercises got synced).
//
// muscleGroup has no source here: the Coach's YAML contract doesn't declare it
// (that's a user-picked field, set only via CreateExerciseModal). Left out on
// purpose — nothing to sync, not an oversight. Add here if the contract ever grows
// a field for it.
export const syncExerciseMetadataFromImport = (importedEx) => {
  const name = importedEx?.name;
  if (!name) return;
  const existing = getExerciseMeta(name);

  if (importedEx.tagSuggested && !existing?.tagOverride) {
    saveExerciseMeta(name, {
      defaultTag: importedEx.tagSuggested,
      tagAssignedAt: new Date().toISOString(),
      tagAssignedBy: 'coach-import',
    });
  }

  if (importedEx.equipment && !existing?.equipmentOverride) {
    saveExerciseMeta(name, {
      equipment: importedEx.equipment,
      equipmentAssignedAt: new Date().toISOString(),
      equipmentAssignedBy: 'coach-import',
    });
  }
};

/**
 * Creates a custom exercise row in Dexie for a brand-new (unmatched) exercise.
 * Metadata sync (tag/equipment) is a separate step — see syncExerciseMetadataFromImport,
 * called for ALL exercises in the import, not just new ones.
 */
export const createExerciseFromImport = async (importedEx) => {
  const name = importedEx.name;
  try {
    await db.customExercises.put({ name });
  } catch { /* might already exist */ }

  return name;
};

const isRealNumericReps = (v) => /^\d+$/.test(String(v || '').trim());

/**
 * Detects a mismatch (or a first-time-configurable case) between an exercise's already
 * -configured measurement and what this import's sets actually contain. Pure — reads
 * exerciseMetadata via getMeasurement, never writes it. The wizard shows these notices
 * and lets the athlete confirm or correct (via TagPicker) before anything is applied in
 * handleImport/handleStartNow — detecting and applying are deliberately separate steps.
 *
 * - measurement undefined + a set carries parser.js's `_rawReps` (a duration-shaped
 *   value like "25s" that failed to parse as reps) -> type 'auto', detected 'time'.
 * - measurement already 'time', but a set parsed a real numeric reps value (parsing
 *   succeeded, no `_rawReps` involved) -> type 'conflict', detected 'reps'.
 * - measurement already 'reps', but a set carries `_rawReps` -> type 'conflict'
 *   (inverse direction), detected 'time'.
 * Anything else (measurement 'reps' + normal numeric reps, or no signal at all) — no
 * notice, today's behavior is untouched.
 */
export const detectMeasurementSignals = (parsedExercises) => {
  if (!Array.isArray(parsedExercises)) return [];
  const notices = [];

  for (const ex of parsedExercises) {
    const name = ex?.name;
    if (!name) continue;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];

    const rawRepsSet = sets.find(s => s?._rawReps);
    const numericRepsSet = sets.find(s => isRealNumericReps(s?.reps));
    const current = getMeasurement(name);

    if (current == null && rawRepsSet) {
      notices.push({
        exerciseName: name,
        type: 'auto',
        measurementDetected: 'time',
        rawSample: rawRepsSet._rawReps,
      });
    } else if (current === 'time' && numericRepsSet) {
      notices.push({
        exerciseName: name,
        type: 'conflict',
        measurementDetected: 'reps',
        currentMeasurement: 'time',
        rawSample: numericRepsSet.reps,
      });
    } else if (current === 'reps' && rawRepsSet) {
      notices.push({
        exerciseName: name,
        type: 'conflict',
        measurementDetected: 'time',
        currentMeasurement: 'reps',
        rawSample: rawRepsSet._rawReps,
      });
    }
  }

  return notices;
};

/**
 * Finds an existing routine with the same name (normalized).
 * Returns the existing routine object or null.
 */
export const findExistingTemplate = async (importedRoutine) => {
  if (!importedRoutine?.name) return null;
  const normalized = importedRoutine.name.toLowerCase().trim();
  try {
    const all = await db.routines.toArray();
    return all.find(r => r.name && r.name.toLowerCase().trim() === normalized) || null;
  } catch { return null; }
};
