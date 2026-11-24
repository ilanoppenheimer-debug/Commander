// Counts sets that actually happened (completed, or has real reps/weight typed) —
// same criterion the session export already uses. Pure, no side effects.
export const countSessionSets = (session) => {
  let n = 0;
  for (const ex of (session?.exercises || [])) {
    for (const s of (ex?.sets || [])) {
      if (s?.completed || parseFloat(s?.reps) > 0 || parseFloat(s?.weight) > 0) n++;
    }
  }
  return n;
};
