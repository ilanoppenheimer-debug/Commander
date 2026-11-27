import { resolveExerciseTag } from './blockReport';
import { closeLastExercise } from './closeLastExercise';

// Which active blocks does a finished session belong to? No tag → no vote (an untagged
// exercise shouldn't orphan from its real block or cross-contaminate an unrelated
// parallel one). Resolution order is ex.tag (the import-time snapshot) first, live
// metadata as fallback — same precedence blockReport.js's resolveExerciseTag uses for
// display, so what gets attributed here agrees with what the report later shows.
// Pure: the caller fetches activeBlocks.
export const attributeBlocks = (activeBlocks, exercises) => {
  if (!activeBlocks || activeBlocks.length === 0) {
    return { blockIds: [], matchedBlocks: [], untaggedCount: 0 };
  }
  const exerciseTags = exercises.map(ex => resolveExerciseTag(ex));
  const untaggedCount = exerciseTags.filter(t => !t).length;
  const sessionTags = new Set(exerciseTags.filter(Boolean));
  const matchedBlocks = activeBlocks.filter(b =>
    (b.appliesTo || []).some(t => sessionTags.has(t))
  );
  return { blockIds: matchedBlocks.map(b => b.id), matchedBlocks, untaggedCount };
};

// The history entry written when a mission finishes. `now` is read once (ms epoch).
export const buildCompletedSession = ({ sessionName, exercises, session, blockIds, now = Date.now() }) => {
  const completedAt = new Date(now).toISOString();
  return {
    historyId: `hist-${now}`,
    name: sessionName || 'Entrenamiento Libre',
    completedAt,
    ...(session?.startTime ? {
      startTime: session.startTime,
      durationSec: Math.round((now - new Date(session.startTime).getTime()) / 1000),
    } : {}),
    exercises: closeLastExercise(exercises, completedAt), // the last exercise/group closes with the session
    routineId: session?.routineId ?? null,
    blockIds,
    sessionNum: session?.sessionNum ?? null,
  };
};

// Un ejercicio "se hizo" si tiene al menos una serie completada. Las series NO completadas dentro de un ejercicio
// que sí tiene completadas se conservan tal cual (como siempre); los ejercicios sin ninguna completada no se guardan.
export const hasCompletedSets = (ex) => (Array.isArray(ex?.sets) ? ex.sets : []).some((s) => s?.completed);

export const pruneUnperformedExercises = (exercises) =>
  (Array.isArray(exercises) ? exercises : []).filter(hasCompletedSets);
