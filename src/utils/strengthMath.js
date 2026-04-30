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

// ── Tabla RPE de Tuchscherer/RTS ───────────────────────────────────────────
// Filas: reps (1-12), Columnas: RPE (6-10 en steps de 0.5), Valor: % de 1RM

export const RPE_CHART = {
  1:  { 6: 0.860, 6.5: 0.875, 7: 0.890, 7.5: 0.905, 8: 0.920, 8.5: 0.940, 9: 0.955, 9.5: 0.975, 10: 1.000 },
  2:  { 6: 0.840, 6.5: 0.855, 7: 0.870, 7.5: 0.885, 8: 0.900, 8.5: 0.920, 9: 0.930, 9.5: 0.950, 10: 0.965 },
  3:  { 6: 0.815, 6.5: 0.830, 7: 0.845, 7.5: 0.860, 8: 0.875, 8.5: 0.890, 9: 0.905, 9.5: 0.925, 10: 0.940 },
  4:  { 6: 0.795, 6.5: 0.810, 7: 0.825, 7.5: 0.840, 8: 0.855, 8.5: 0.870, 9: 0.885, 9.5: 0.900, 10: 0.920 },
  5:  { 6: 0.775, 6.5: 0.790, 7: 0.805, 7.5: 0.825, 8: 0.840, 8.5: 0.855, 9: 0.870, 9.5: 0.890, 10: 0.905 },
  6:  { 6: 0.760, 6.5: 0.775, 7: 0.790, 7.5: 0.805, 8: 0.820, 8.5: 0.835, 9: 0.850, 9.5: 0.870, 10: 0.890 },
  7:  { 6: 0.740, 6.5: 0.755, 7: 0.770, 7.5: 0.785, 8: 0.800, 8.5: 0.820, 9: 0.835, 9.5: 0.850, 10: 0.870 },
  8:  { 6: 0.725, 6.5: 0.740, 7: 0.760, 7.5: 0.770, 8: 0.785, 8.5: 0.800, 9: 0.815, 9.5: 0.835, 10: 0.850 },
  9:  { 6: 0.710, 6.5: 0.725, 7: 0.740, 7.5: 0.755, 8: 0.770, 8.5: 0.785, 9: 0.800, 9.5: 0.820, 10: 0.835 },
  10: { 6: 0.690, 6.5: 0.710, 7: 0.725, 7.5: 0.740, 8: 0.755, 8.5: 0.770, 9: 0.785, 9.5: 0.805, 10: 0.820 },
  11: { 6: 0.675, 6.5: 0.690, 7: 0.710, 7.5: 0.725, 8: 0.740, 8.5: 0.755, 9: 0.770, 9.5: 0.790, 10: 0.805 },
  12: { 6: 0.660, 6.5: 0.675, 7: 0.690, 7.5: 0.710, 8: 0.725, 8.5: 0.740, 9: 0.755, 9.5: 0.775, 10: 0.790 },
};

/**
 * Estima 1RM dado peso, reps, RPE.
 * Usa tabla RPE (RTS) si RPE disponible, fallback Epley.
 */
export const estimate1RM = (weight, reps, rpe = null) => {
  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  if (!w || w <= 0 || !r || r < 1) return null;

  if (rpe !== null && rpe !== undefined && rpe !== '') {
    const rpeNum = parseFloat(rpe);
    if (rpeNum >= 6 && rpeNum <= 10 && r >= 1 && r <= 12) {
      const rpeRounded = Math.round(rpeNum * 2) / 2;
      const repsClamped = Math.min(Math.max(r, 1), 12);
      const factor = RPE_CHART[repsClamped]?.[rpeRounded];
      if (factor && factor > 0) return w / factor;
    }
  }

  // Fallback Epley
  return w * (1 + r / 30);
};

/**
 * Calcula peso de trabajo dado un 1RM, reps objetivo y RPE objetivo.
 */
export const calcWorkWeight = (oneRM, targetReps, targetRpe) => {
  const orm = parseFloat(oneRM);
  const reps = parseInt(targetReps, 10);
  const rpe = parseFloat(targetRpe);

  if (!orm || orm <= 0) return null;
  if (!reps || reps < 1 || reps > 12) return null;
  if (!rpe || rpe < 6 || rpe > 10) return null;

  const rpeRounded = Math.round(rpe * 2) / 2;
  const factor = RPE_CHART[reps]?.[rpeRounded];
  if (!factor) return null;

  return orm * factor;
};

/**
 * Determina si un set es predictivo del 1RM real.
 * exerciseMaxWeight: peso máximo histórico del ejercicio (para filtrar warmups)
 */
export const isPredictiveSet = (set, exerciseMaxWeight) => {
  if (!set) return false;
  const w = parseFloat(set.weight);
  const r = parseInt(set.reps, 10);
  const rpe = parseFloat(set.rpe);

  if (!w || w <= 0) return false;
  if (!r || r < 1 || r > 12) return false;
  if (!isNaN(rpe) && rpe < 6) return false;
  if (set.completed === false) return false;
  if (exerciseMaxWeight && w < exerciseMaxWeight * 0.5) return false;

  return true;
};

/**
 * Calcula el 1RM estimado actual de un ejercicio desde el historial.
 * weeksBack=null → usa todo el historial.
 */
export const computeExercise1RM = (exerciseName, history, options = {}) => {
  const { weeksBack = 12 } = options;

  if (!Array.isArray(history) || history.length === 0) {
    return { current1RM: null, topSets: [], sampleSize: 0 };
  }

  const cutoffDate = weeksBack
    ? new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000)
    : null;

  const allSetsRaw = [];
  history.forEach(session => {
    if (!session?.completedAt) return;
    if (cutoffDate && new Date(session.completedAt) < cutoffDate) return;
    const exercises = Array.isArray(session.exercises) ? session.exercises : [];
    exercises.forEach(ex => {
      if (!ex || ex.name !== exerciseName) return;
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      sets.forEach(set => {
        allSetsRaw.push({ ...set, _date: session.completedAt, _sessionId: session.historyId || session.id });
      });
    });
  });

  if (allSetsRaw.length === 0) {
    return { current1RM: null, topSets: [], sampleSize: 0 };
  }

  const maxWeight = Math.max(...allSetsRaw.map(s => parseFloat(s.weight) || 0).filter(w => w > 0));

  const predictive = allSetsRaw
    .filter(s => isPredictiveSet(s, maxWeight))
    .map(s => ({ ...s, _est1RM: estimate1RM(s.weight, s.reps, s.rpe) }))
    .filter(s => s._est1RM !== null && s._est1RM > 0);

  if (predictive.length === 0) {
    return { current1RM: null, topSets: [], sampleSize: 0 };
  }

  predictive.sort((a, b) => b._est1RM - a._est1RM);

  const topSets = predictive.slice(0, 3);
  const current1RM = topSets[0]._est1RM;

  return {
    current1RM,
    topSets,
    sampleSize: predictive.length,
    oldestDate: predictive[predictive.length - 1]._date,
    newestDate: predictive[0]._date,
  };
};

/**
 * Calcula 1RM estimado para todos los ejercicios con datos en el historial.
 * Returns: Array sorted by current1RM desc.
 */
export const computeAll1RMs = (history, options = {}) => {
  if (!Array.isArray(history) || history.length === 0) return [];

  const exerciseNames = new Set();
  history.forEach(s => {
    const exes = Array.isArray(s?.exercises) ? s.exercises : [];
    exes.forEach(e => { if (e?.name) exerciseNames.add(e.name); });
  });

  const results = [];
  exerciseNames.forEach(name => {
    const computed = computeExercise1RM(name, history, options);
    if (computed.current1RM !== null) {
      results.push({ name, ...computed });
    }
  });

  results.sort((a, b) => b.current1RM - a.current1RM);
  return results;
};
