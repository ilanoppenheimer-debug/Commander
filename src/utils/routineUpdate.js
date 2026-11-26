import { db } from '../db/database';
import { sameExercise } from './exerciseName';
import { stripRuntimeFields } from './runtimeFields';

// "Actualizar plantilla" desde una sesión. Una sola fuente de verdad: planRoutineUpdate (pura) calcula tanto la
// lista de cambios que muestra el modal como los ejercicios que se guardan.
//
// Qué se actualiza: SOLO peso y reps de los sets completados (y se agregan los sets / ejercicios nuevos con sets
// completados). Todo lo demás de la plantilla queda como está: lo del Coach (notes, decisionAdaptativa, tag,
// planned, plannedRpe, targetSeconds, restSeconds, type, rpe prescrito) y los sets / ejercicios que esta sesión no
// tocó. El RPE que registraste en la sesión NO se copia a la plantilla.
//
// Cada ejercicio de la sesión se empareja con UN ejercicio distinto de la plantilla: primero por id (la sesión
// copia los ids al iniciar) y después por nombre entre los que quedaron sin emparejar. Así un ejercicio repetido en
// la sesión no duplica el de la plantilla (antes lo agregaba una vez por cada repetición).

const completedSetsOf = (ex) =>
  (Array.isArray(ex?.sets) ? ex.sets : []).filter((s) => s?.completed && s.weight && s.reps);

const matchExercises = (routineExs, sessionExs) => {
  const matchOf = new Map(); // índice en sessionExs -> índice en routineExs
  const used = new Set();
  sessionExs.forEach((se, si) => {
    if (se?.id == null) return;
    const ri = routineExs.findIndex((re, i) => !used.has(i) && re?.id != null && re.id === se.id);
    if (ri >= 0) { matchOf.set(si, ri); used.add(ri); }
  });
  sessionExs.forEach((se, si) => {
    if (matchOf.has(si)) return;
    const ri = routineExs.findIndex((re, i) => !used.has(i) && (sameExercise(re?.name, se?.name) || (re?.exerciseId != null && re.exerciseId === se?.exerciseId)));
    if (ri >= 0) { matchOf.set(si, ri); used.add(ri); }
  });
  return matchOf;
};

export const planRoutineUpdate = (routine, session) => {
  const changes = [];
  if (!routine || !session) return { changes, exercises: Array.isArray(routine?.exercises) ? routine.exercises : [] };

  const routineExs = Array.isArray(routine.exercises) ? routine.exercises : [];
  const sessionExs = Array.isArray(session.exercises) ? session.exercises : [];
  const matchOf = matchExercises(routineExs, sessionExs);
  const next = routineExs.slice();
  const added = [];
  const stamp = Date.now();

  sessionExs.forEach((sessionEx, si) => {
    const completed = completedSetsOf(sessionEx);
    const ri = matchOf.get(si);

    if (ri === undefined) {
      if (completed.length === 0) return;
      changes.push({ type: 'add_exercise', exercise: sessionEx, sets: completed });
      const [clean] = stripRuntimeFields([{ ...sessionEx, sets: completed }]);
      added.push({ ...clean, sets: clean.sets.map((s) => ({ ...s, weight: Number(s.weight), reps: Number(s.reps) })) });
      return;
    }
    if (completed.length === 0) return;

    const routineEx = routineExs[ri];
    const routineSets = Array.isArray(routineEx.sets) ? routineEx.sets : [];
    const newSets = routineSets.slice();
    completed.forEach((cs, i) => {
      const rs = routineSets[i];
      if (!rs) {
        changes.push({ type: 'add_set', exerciseName: sessionEx.name, set: cs });
        const last = routineSets[routineSets.length - 1];
        newSets.push({
          id: `set-upd-${stamp}-${si}-${i}`, type: cs.type || 'normal', weight: Number(cs.weight), reps: Number(cs.reps),
          rpe: '', notes: '', completed: false, ...(last?.restSeconds != null ? { restSeconds: last.restSeconds } : {}),
        });
        return;
      }
      const wChanged = Number(rs.weight) !== Number(cs.weight);
      const rChanged = Number(rs.reps) !== Number(cs.reps);
      if (wChanged || rChanged) {
        changes.push({
          type: 'update_set', exerciseName: sessionEx.name, setIndex: i,
          before: { weight: rs.weight, reps: rs.reps, rpe: rs.rpe },
          after: { weight: cs.weight, reps: cs.reps, rpe: rs.rpe }, // el RPE de la plantilla no cambia
        });
        newSets[i] = { ...rs, weight: Number(cs.weight), reps: Number(cs.reps) };
      }
    });
    next[ri] = { ...routineEx, sets: newSets };
  });

  return { changes, exercises: [...next, ...added] };
};

export const diffRoutineVsSession = (routine, session) => planRoutineUpdate(routine, session).changes;

export const updateRoutineFromSession = async (routineId, session) => {
  if (!routineId || !session) return { ok: false, reason: 'invalid-args' };

  try {
    const { createAutoBackup } = await import('../services/backupService');
    await createAutoBackup('pre-routine-update-from-session');
  } catch (e) {
    console.warn('[update routine] backup failed:', e);
  }

  // Si quedaran filas repetidas con ese routineId, se usa la de mayor _id (la misma que actualiza saveRoutine).
  const rows = await db.routines.where('routineId').equals(routineId).toArray();
  const routine = rows.reduce((best, r) => (!best || r._id > best._id ? r : best), null);
  if (!routine) return { ok: false, reason: 'routine-not-found' };

  const { exercises } = planRoutineUpdate(routine, session);
  const updated = { ...routine, exercises, lastUpdatedAt: new Date().toISOString() };
  await db.routines.put(updated);
  return { ok: true, routine: updated };
};
