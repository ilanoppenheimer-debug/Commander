import { saveRoutine } from '../../db/repository';
import { db } from '../../db/database';
import { saveExerciseMeta, getExerciseMeta } from '../../constants/exerciseMetadata';

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
      restSeconds: impEx.restSeconds || 90,
      notes: impEx.notes || '',
      decisionAdaptativa: impEx.decisionAdaptativa || null,
      unilateral: !!impEx.unilateral,
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

/**
 * Creates a custom exercise in Dexie and seeds localStorage metadata.
 */
export const createExerciseFromImport = async (importedEx) => {
  const name = importedEx.name;
  try {
    await db.customExercises.put({ name });
  } catch { /* might already exist */ }

  const existing = getExerciseMeta(name);

  if (importedEx.tagSuggested && !existing?.defaultTag) {
    saveExerciseMeta(name, {
      defaultTag: importedEx.tagSuggested,
      tagAssignedAt: new Date().toISOString(),
    });
  }

  // Same override pattern as muscleGroup: a manual choice in CreateExerciseModal
  // (equipmentOverride: true) wins over anything the Coach's YAML says. Otherwise
  // the import writes freely — later imports correct earlier ones.
  if (importedEx.equipment && !existing?.equipmentOverride) {
    saveExerciseMeta(name, {
      equipment: importedEx.equipment,
      equipmentAssignedAt: new Date().toISOString(),
      equipmentAssignedBy: 'coach-import',
    });
  }

  return name;
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
