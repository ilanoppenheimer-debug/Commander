// The last exercise of a session is rarely closed by hand ("FINALIZAR EJERCICIO") — the
// athlete just taps "FINALIZAR MISIÓN". Without a finishedAt its time can't be measured, so
// at save time the session's own completedAt closes it.
//
// Only the LAST exercise (or the last superset group, closed as a unit like
// finishSupersetGroup does), and only when it has at least one completed set and no close
// of its own. Any other unclosed exercise stays as it is: no estimate. Pure — returns a new
// array (and new objects only for the exercises it stamps).
export const closeLastExercise = (exercises, completedAt) => {
  const list = Array.isArray(exercises) ? exercises : [];
  const last = list[list.length - 1];
  if (!last || !completedAt) return list;

  const members = last.supersetId ? list.filter(e => e?.supersetId === last.supersetId) : [last];
  if (members.some(e => e?.finishedAt)) return list;
  const hasCompletedSet = members.some(e => (Array.isArray(e?.sets) ? e.sets : []).some(s => s?.completed));
  if (!hasCompletedSet) return list;

  return list.map(e => (members.includes(e) ? { ...e, finishedAt: completedAt } : e));
};
