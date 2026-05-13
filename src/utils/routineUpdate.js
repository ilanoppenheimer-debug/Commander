import { db } from '../db/database';

export const diffRoutineVsSession = (routine, session) => {
  const changes = [];
  if (!routine || !session) return changes;

  const routineExs = Array.isArray(routine.exercises) ? routine.exercises : [];
  const sessionExs = Array.isArray(session.exercises) ? session.exercises : [];

  for (const sessionEx of sessionExs) {
    const routineEx = routineExs.find(re =>
      re.name === sessionEx.name || re.exerciseId === sessionEx.exerciseId
    );

    const completedSets = (sessionEx.sets || []).filter(s => s.completed && s.weight && s.reps);

    if (!routineEx) {
      if (completedSets.length > 0) {
        changes.push({ type: 'add_exercise', exercise: sessionEx, sets: completedSets });
      }
      continue;
    }

    const routineSets = Array.isArray(routineEx.sets) ? routineEx.sets : [];

    for (let i = 0; i < completedSets.length; i++) {
      const sessionSet = completedSets[i];
      const routineSet = routineSets[i];

      if (!routineSet) {
        changes.push({ type: 'add_set', exerciseName: sessionEx.name, set: sessionSet });
        continue;
      }

      const wChanged = Number(routineSet.weight) !== Number(sessionSet.weight);
      const rChanged = Number(routineSet.reps) !== Number(sessionSet.reps);
      const rpeChanged = routineSet.rpe != null && sessionSet.rpe != null
        && Number(routineSet.rpe) !== Number(sessionSet.rpe);

      if (wChanged || rChanged || rpeChanged) {
        changes.push({
          type: 'update_set',
          exerciseName: sessionEx.name,
          setIndex: i,
          before: { weight: routineSet.weight, reps: routineSet.reps, rpe: routineSet.rpe },
          after:  { weight: sessionSet.weight,  reps: sessionSet.reps,  rpe: sessionSet.rpe },
        });
      }
    }
  }

  return changes;
};

export const updateRoutineFromSession = async (routineId, session) => {
  if (!routineId || !session) return { ok: false, reason: 'invalid-args' };

  try {
    const { createAutoBackup } = await import('../services/backupService');
    await createAutoBackup('pre-routine-update-from-session');
  } catch (e) {
    console.warn('[update routine] backup failed:', e);
  }

  const routine = await db.routines.where('routineId').equals(routineId).first();
  if (!routine) return { ok: false, reason: 'routine-not-found' };

  const updatedExercises = [];
  const sessionExs = Array.isArray(session.exercises) ? session.exercises : [];
  const handledNames = new Set();

  for (const sessionEx of sessionExs) {
    const existingEx = (routine.exercises || []).find(re =>
      re.name === sessionEx.name || re.exerciseId === sessionEx.exerciseId
    );

    const sessionSets = (Array.isArray(sessionEx.sets) ? sessionEx.sets : [])
      .filter(s => s.completed && s.weight && s.reps);

    if (sessionSets.length === 0) {
      if (existingEx) {
        updatedExercises.push(existingEx);
        handledNames.add(existingEx.name);
      }
      continue;
    }

    if (existingEx) {
      const newSets = sessionSets.map((s, i) => ({
        weight: Number(s.weight),
        reps:   Number(s.reps),
        rpe:    s.rpe != null ? Number(s.rpe) : (existingEx.sets?.[i]?.rpe ?? 0),
        type:   existingEx.sets?.[i]?.type || s.type || 'normal',
        rest:   existingEx.sets?.[i]?.rest || existingEx.sets?.[0]?.rest || 90,
      }));
      updatedExercises.push({ ...existingEx, sets: newSets });
      handledNames.add(existingEx.name);
    } else {
      updatedExercises.push({
        exerciseId: sessionEx.exerciseId,
        name:       sessionEx.name,
        equipment:  sessionEx.equipment || 'barbell',
        sets: sessionSets.map(s => ({
          weight: Number(s.weight),
          reps:   Number(s.reps),
          rpe:    s.rpe != null ? Number(s.rpe) : 0,
          type:   s.type || 'normal',
          rest:   90,
        })),
      });
      handledNames.add(sessionEx.name);
    }
  }

  for (const routineEx of (routine.exercises || [])) {
    if (!handledNames.has(routineEx.name)) {
      updatedExercises.push(routineEx);
    }
  }

  const updated = {
    ...routine,
    exercises:     updatedExercises,
    lastUpdatedAt: new Date().toISOString(),
  };

  await db.routines.put(updated);
  return { ok: true, routine: updated };
};
