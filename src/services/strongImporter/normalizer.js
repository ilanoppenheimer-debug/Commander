import { mapStrongExercise } from './exerciseDictionary';

const roundToQuarter = (n) => Math.round(n * 4) / 4;

/**
 * Deduplicates notes: if all sets share the same note, push it to workoutNotes
 * and clear per-set notes.
 */
function deduplicateNotes(sets, workoutNotes) {
  const setNotes = sets.map(s => s.notes || '');
  const uniqueNotes = new Set(setNotes.filter(Boolean));

  // All non-empty notes are the same → promote to workoutNotes
  if (uniqueNotes.size === 1) {
    const sharedNote = [...uniqueNotes][0];
    const resolvedWorkoutNotes = workoutNotes || sharedNote;
    return {
      workoutNotes: resolvedWorkoutNotes,
      sets: sets.map(s => ({ ...s, notes: '' })),
    };
  }

  return { workoutNotes: workoutNotes || '', sets };
}

/**
 * @param {object[]} parsedRows  — output of parseStrongCSV
 * @param {object}   customMappings — { "Strong Name": { name, equipment } }
 * @returns {object[]} normalized sessions
 */
export function normalizeStrongData(parsedRows, customMappings = {}) {
  // ── 1. Group rows by workoutId ───────────────────────────────────────────
  const workoutMap = new Map(); // workoutId → { meta, exerciseRows: Map<exerciseRaw, row[]> }

  for (const row of parsedRows) {
    if (!workoutMap.has(row.workoutId)) {
      workoutMap.set(row.workoutId, {
        workoutId: row.workoutId,
        date: row.date,
        workoutName: row.workoutName || 'Entrenamiento',
        durationSec: row.durationSec || 0,
        workoutNotes: row.workoutNotes || '',
        // ordered list of exercise names as they appear
        exerciseOrder: [],
        exerciseRows: new Map(),
      });
    }

    const workout = workoutMap.get(row.workoutId);

    // Track first appearance of each exercise to preserve order
    if (!workout.exerciseRows.has(row.exerciseRaw)) {
      workout.exerciseRows.set(row.exerciseRaw, []);
      workout.exerciseOrder.push(row.exerciseRaw);
    }
    workout.exerciseRows.get(row.exerciseRaw).push(row);
  }

  // ── 2. Build normalized sessions ─────────────────────────────────────────
  const sessions = [];

  for (const [workoutId, workout] of workoutMap) {
    const exercises = [];
    let exerciseIndex = 0;

    for (const exerciseRaw of workout.exerciseOrder) {
      const rows = workout.exerciseRows.get(exerciseRaw);

      // Resolve exercise mapping (custom overrides dictionary)
      const custom = customMappings[exerciseRaw];
      let mapped;
      if (custom?.ignore) continue;

      if (custom) {
        mapped = { name: custom.name, equipment: custom.equipment, originalName: exerciseRaw };
      } else {
        // Use weight of first set for split resolution
        const firstWeight = rows[0]?.weight || 0;
        mapped = mapStrongExercise(exerciseRaw, firstWeight);
      }

      // Sort sets by setOrder
      const sortedRows = [...rows].sort((a, b) => a.setOrder - b.setOrder);

      // Build sets
      const rawSets = sortedRows.map(row => {
        const reps = Math.round(row.reps);
        if (reps <= 0) return null; // discard

        return {
          weight: roundToQuarter(row.weight),
          reps,
          rpe:   row.rpe !== null ? row.rpe : 0,
          type:  'normal',
          notes: row.notes || '',
        };
      }).filter(Boolean);

      if (rawSets.length === 0) continue;

      // Deduplicate notes across sets
      const { workoutNotes: _, sets } = deduplicateNotes(rawSets, workout.workoutNotes);

      exercises.push({
        id:           `${workoutId}-${exerciseIndex}`,
        name:         mapped.name,
        equipment:    mapped.equipment,
        originalName: mapped.originalName,
        sets,
      });
      exerciseIndex++;
    }

    if (exercises.length === 0) continue;

    // Deduplicate workout-level notes (workout.workoutNotes may be repeated across rows)
    // Use first non-empty workoutNotes from the rows
    const firstNoteRow = parsedRows.find(r => r.workoutId === workoutId && r.workoutNotes);
    const resolvedWorkoutNotes = firstNoteRow?.workoutNotes || workout.workoutNotes || '';

    // Re-run note deduplication now that we have the real workoutNotes
    const finalExercises = exercises.map(ex => {
      const { workoutNotes: wn, sets } = deduplicateNotes(ex.sets, resolvedWorkoutNotes);
      return { ...ex, sets };
    });

    sessions.push({
      historyId:     `strong-import-${workoutId}`,
      name:          workout.workoutName,
      completedAt:   new Date(workout.date).toISOString(),
      durationSec:   workout.durationSec,
      workoutNotes:  resolvedWorkoutNotes,
      exercises:     finalExercises,
    });
  }

  // Sort by completedAt descending (newest first, matching app convention)
  sessions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  return sessions;
}

/**
 * Collects all unique exercise names from normalized sessions.
 */
export function collectCustomExercises(normalizedSessions, defaultExerciseDB) {
  const defaultSet = new Set(defaultExerciseDB.map(e => e.toLowerCase()));
  const custom = new Set();
  for (const session of normalizedSessions) {
    for (const ex of session.exercises || []) {
      if (ex.name && !defaultSet.has(ex.name.toLowerCase())) {
        custom.add(ex.name);
      }
    }
  }
  return [...custom];
}
