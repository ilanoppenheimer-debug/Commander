export const FORMULAS = {
  epley: (w, r) => w * (1 + r / 30),
  brzycki: (w, r) => w * (36 / (37 - r)),
  hybrid: (w, r) => (FORMULAS.epley(w, r) + FORMULAS.brzycki(w, r)) / 2
};

export const calculate1RM = (weight, reps, rpe, formulaType = 'epley') => {
  const w = parseFloat(weight) || 0;
  const r = parseFloat(reps) || 0;
  const rpeVal = rpe ? parseFloat(rpe) : 10;
  const effectiveReps = r + (10 - rpeVal);
  if (effectiveReps <= 1) return w;
  return FORMULAS[formulaType](w, effectiveReps);
};

export const calculateTrainingWeight = (oneRM, targetReps, targetRPE) => {
  const rpeVal = targetRPE ? parseFloat(targetRPE) : 10;
  const effectiveReps = targetReps + (10 - rpeVal);
  return oneRM / (1 + effectiveReps / 30); 
};