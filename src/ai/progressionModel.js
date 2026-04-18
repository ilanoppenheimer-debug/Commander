const roundToIncrement = (weight, increment = 2.5) => {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  return Math.round(weight / increment) * increment;
};

export const suggestNextSet = ({ lastSet, targetRPE = 8, targetReps = null, increment = 2.5 }) => {
  if (!lastSet) return null;

  const w = parseFloat(lastSet.weight) || 0;
  const r = parseFloat(lastSet.reps) || 0;
  const rpe = parseFloat(lastSet.rpe) || 0;

  if (w <= 0 || r <= 0 || rpe <= 0) return null;

  const target = parseFloat(targetRPE) || 8;
  const diff = rpe - target;

  let weightMultiplier = 1;
  let reason = "Mantener carga";
  let nextReps = targetReps || r;

  if (diff <= -2) {
    weightMultiplier = 1.05;
    reason = `RPE ${rpe} bajo el objetivo ${target}. Subir carga.`;
  } else if (diff <= -1) {
    weightMultiplier = 1.025;
    reason = `RPE ${rpe} ligero. Subir ligero.`;
  } else if (diff >= 2) {
    weightMultiplier = 0.9;
    reason = `RPE ${rpe} muy alto. Bajar carga.`;
  } else if (diff >= 1) {
    weightMultiplier = 0.95;
    reason = `RPE ${rpe} sobre objetivo. Bajar ligero.`;
  }

  const suggestedWeight = roundToIncrement(w * weightMultiplier, increment);

  return {
    weight: suggestedWeight,
    reps: Math.max(1, Math.round(nextReps)),
    reason,
    shouldStop: diff >= 3 && rpe >= 9.5,
  };
};

export const getLastFilledSet = (sets) => {
  if (!Array.isArray(sets)) return null;
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i];
    if (!s) continue;
    const w = parseFloat(s.weight) || 0;
    const r = parseFloat(s.reps) || 0;
    if (w > 0 && r > 0) return s;
  }
  return null;
};
