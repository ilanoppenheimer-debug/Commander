import { computeExercise1RM, RPE_CHART } from './strengthMath';

const ROUND_INCREMENTS = {
  barbell: 2.5, smith: 2.5, dumbbell: 1, cable: 2.5,
  machine: 5, kettlebell: 2, bodyweight: 1, other: 2.5,
};

const roundToEquipment = (weight, equipment) => {
  const inc = ROUND_INCREMENTS[equipment] || 2.5;
  return Math.round(weight / inc) * inc;
};

/**
 * Calcula peso sugerido para un ejercicio dado su bloque activo + 1RM histórico.
 * Returns: { weight, reps, rpe, sourceBlockId, sourceBlockName, sourceBlockColor, rationale } | null
 */
export const calculateSuggestedWeight = (exercise, history, activeBlocks) => {
  if (!exercise || !Array.isArray(activeBlocks) || activeBlocks.length === 0) return null;

  const tag = exercise?.metadata?.defaultTag || 'accessory';
  const block = activeBlocks.find(b => Array.isArray(b.appliesTo) && b.appliesTo.includes(tag));
  if (!block) return null;

  const oneRMData = computeExercise1RM(exercise.name, history, { weeksBack: 12 });
  if (!oneRMData?.current1RM) return null;

  const repsRange = block.params?.repsRange || [5, 8];
  const rpeRange  = block.params?.rpeRange  || [7, 8];
  const targetReps = Math.round((repsRange[0] + repsRange[1]) / 2);
  const targetRpe  = Math.round((rpeRange[0] + rpeRange[1]) * 2) / 2 / 2;

  const repsClamped = Math.min(Math.max(targetReps, 1), 12);
  const rpeRounded  = Math.round(targetRpe * 2) / 2;
  const factor = RPE_CHART[repsClamped]?.[rpeRounded];
  if (!factor) return null;

  const weeksInBlock = (block.sessionsLogged || 0) / Math.max(1, block.params?.suggestedFrequency || 2);
  const rawWeight  = oneRMData.current1RM * factor * Math.pow(block.params?.weeklyMod || 1.0, weeksInBlock);
  const finalWeight = roundToEquipment(rawWeight, exercise.equipment || 'barbell');

  return {
    weight: String(finalWeight),
    reps:   String(targetReps),
    rpe:    String(targetRpe),
    sourceBlockId:    block.id,
    sourceBlockName:  block.name,
    sourceBlockColor: block.color,
    rationale: `${tag} · ${block.name} · ${Math.round(factor * 100)}% 1RM`,
  };
};

/**
 * Detecta señales de fatiga sostenida en un bloque.
 * Returns: { severity, message, reasons } | null
 */
export const checkFatigueSignals = (block, recentSessions) => {
  if (!block || !Array.isArray(recentSessions)) return null;

  const tags = block.appliesTo || [];
  const blockSessions = recentSessions
    .filter(s => _sessionUsedTags(s, tags))
    .slice(-4);

  if (blockSessions.length < 3) return null;

  let rpeOverTarget = 0;
  const rpeUpperTarget = (block.params?.rpeRange?.[1] || 8) + 0.5;

  for (const session of blockSessions) {
    const rpes = _extractRpes(session, tags);
    if (!rpes.length) continue;
    const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    if (avg > rpeUpperTarget) rpeOverTarget++;
  }

  const maxWeights = blockSessions.map(s => _extractMaxWeight(s, tags)).filter(w => w > 0);
  let progressStall = 0;
  if (maxWeights.length >= 3) {
    const allEqual = maxWeights.every(w => w === maxWeights[0]);
    const decreasing = maxWeights.every((w, i) => i === 0 || w <= maxWeights[i - 1]);
    if (allEqual || (decreasing && maxWeights[0] > maxWeights[maxWeights.length - 1])) {
      progressStall = blockSessions.length;
    }
  }

  if (rpeOverTarget >= 3 || progressStall >= 4) {
    const reasons = [];
    if (rpeOverTarget >= 3) reasons.push('RPE alto sostenido en últimas sesiones');
    if (progressStall >= 4) reasons.push('Sin progreso de carga en 4+ sesiones');
    return { severity: 'high', message: 'Considerá un deload o cambiar de bloque', reasons };
  }
  return null;
};

const _sessionUsedTags = (session, tags) => {
  if (!session?.exercises || !tags.length) return false;
  return session.exercises.some(ex => tags.includes(ex?.metadata?.defaultTag || 'accessory'));
};

const _extractRpes = (session, tags) => {
  const rpes = [];
  for (const ex of (session?.exercises || [])) {
    if (!tags.includes(ex?.metadata?.defaultTag || 'accessory')) continue;
    for (const s of (Array.isArray(ex.sets) ? ex.sets : [])) {
      const r = parseFloat(s?.rpe);
      if (!isNaN(r) && r > 0) rpes.push(r);
    }
  }
  return rpes;
};

const _extractMaxWeight = (session, tags) => {
  let max = 0;
  for (const ex of (session?.exercises || [])) {
    if (!tags.includes(ex?.metadata?.defaultTag || 'accessory')) continue;
    for (const s of (Array.isArray(ex.sets) ? ex.sets : [])) {
      const w = parseFloat(s?.weight);
      if (!isNaN(w) && w > max) max = w;
    }
  }
  return max;
};
