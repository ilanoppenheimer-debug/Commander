import { computeExercise1RM, RPE_CHART } from './strengthMath';

const ROUND_INCREMENTS = {
  barbell: 2.5, smith: 2.5, dumbbell: 1, cable: 2.5,
  machine: 5, kettlebell: 2, bodyweight: 1, other: 2.5,
};

export const roundToEquipment = (weight, equipment) => {
  const inc = ROUND_INCREMENTS[equipment] || 2.5;
  return Math.round(weight / inc) * inc;
};

const clampReps = (n) => Math.max(1, Math.min(12, Math.round(n)));
const clampRpe  = (n) => Math.max(6, Math.min(10, Math.round(n * 2) / 2));

/**
 * Finds the active block that covers the exercise's tag.
 * No tag → no vote: an untagged exercise matches NO block, rather than assuming
 * 'accessory' and possibly matching the wrong one (which would derive a backoff
 * suggestion — a live suggested weight — from a block the exercise has nothing to
 * do with). Callers already degrade gracefully when this returns null: better no
 * suggestion than one derived from the wrong block.
 */
export const findBlockForExercise = (exercise, activeBlocks) => {
  if (!exercise || !Array.isArray(activeBlocks)) return null;
  const tag = exercise.metadata?.defaultTag;
  if (!tag) return null;
  return activeBlocks.find(b =>
    b && Array.isArray(b.appliesTo) && b.appliesTo.includes(tag)
  ) || null;
};

/**
 * Calculates suggested weight for a TOP set from estimated 1RM.
 * Uses RPE_CHART: 1RM × factor (not peso_anterior × wMod).
 * Returns: { weight, reps, rpe, sourceBlockId, sourceBlockColor } | null
 */
export const calculateTopSetSuggestion = (exercise, history, block) => {
  if (!exercise || !block || !block.params) return null;

  // Try 12-week window first, then full history
  let oneRMData = computeExercise1RM(exercise.name, history, { weeksBack: 12 });
  if (!oneRMData?.current1RM || oneRMData.current1RM <= 0) {
    oneRMData = computeExercise1RM(exercise.name, history, { weeksBack: null });
  }
  if (!oneRMData?.current1RM || oneRMData.current1RM <= 0) return null;

  const repsRange = block.params.repsRange || [5, 8];
  const rpeRange  = block.params.rpeRange  || [7, 8];

  // TOP uses the hardest end of the rep range
  const targetReps = clampReps(Math.max(...repsRange));
  const targetRpe  = clampRpe((rpeRange[0] + rpeRange[1]) / 2);

  const factor = RPE_CHART[targetReps]?.[targetRpe];
  if (typeof factor !== 'number' || factor <= 0 || factor > 1) return null;

  const weeklyMod = (typeof block.params.weeklyMod === 'number'
    && block.params.weeklyMod > 0.5
    && block.params.weeklyMod < 1.5)
    ? block.params.weeklyMod : 1.0;

  const sessionsLogged = Math.max(0, block.sessionsLogged || 0);
  const freq = Math.max(1, block.params.suggestedFrequency || 2);
  const weeksInBlock = sessionsLogged / freq;
  const progressionFactor = Math.pow(weeklyMod, weeksInBlock);

  const rawWeight = oneRMData.current1RM * factor * progressionFactor;

  // Sanity clamp: 30%–105% of 1RM
  const clamped = Math.max(
    oneRMData.current1RM * 0.3,
    Math.min(oneRMData.current1RM * 1.05, rawWeight)
  );

  const finalWeight = roundToEquipment(clamped, exercise.equipment || 'barbell');

  console.debug('[blocksMath TOP]', {
    exercise: exercise.name,
    oneRM: oneRMData.current1RM,
    targetReps,
    targetRpe,
    factor,
    progressionFactor,
    rawWeight,
    finalWeight,
  });

  return {
    weight: String(finalWeight),
    reps:   String(targetReps),
    rpe:    String(targetRpe),
    sourceBlockId:    block.id,
    sourceBlockColor: block.color,
  };
};

/**
 * Calculates suggested weight for a BACK set, reactive to the real TOP weight.
 * If TOP set has a typed weight, uses it as reference; otherwise uses topSuggestion.
 * Returns: { weight, reps, rpe, sourceBlockId, sourceBlockColor } | null
 */
export const calculateBackoffSuggestion = (topSet, topSuggestion, block, exercise) => {
  if (!block || !block.params) return null;

  let referenceWeight, referenceReps, referenceRpe;

  const topWeight = parseFloat(topSet?.weight);
  const topReps   = parseInt(topSet?.reps, 10);
  const topRpe    = parseFloat(topSet?.rpe);

  if (!isNaN(topWeight) && topWeight > 0) {
    // Reactive to real TOP
    referenceWeight = topWeight;
    referenceReps   = (!isNaN(topReps) && topReps > 0) ? topReps : (parseInt(topSuggestion?.reps, 10) || 5);
    referenceRpe    = (!isNaN(topRpe)  && topRpe  > 0) ? topRpe  : (parseFloat(topSuggestion?.rpe) || 8);
  } else if (topSuggestion) {
    // Fallback to predictive suggestion
    referenceWeight = parseFloat(topSuggestion.weight);
    referenceReps   = parseInt(topSuggestion.reps, 10);
    referenceRpe    = parseFloat(topSuggestion.rpe);
  } else {
    return null;
  }

  if (!referenceWeight || referenceWeight <= 0) return null;

  const backoffPct = (typeof block.params.backoffPctOfTop === 'number'
    && block.params.backoffPctOfTop > 0.5
    && block.params.backoffPctOfTop <= 1.0)
    ? block.params.backoffPctOfTop : 0.90;

  const repsAdjust = Number.isInteger(block.params.backoffRepsAdjust)
    ? block.params.backoffRepsAdjust : 0;

  const backoffWeight = referenceWeight * backoffPct;
  const backoffReps   = clampReps(referenceReps + repsAdjust);
  const backoffRpe    = clampRpe(referenceRpe - 0.5);

  const finalWeight = roundToEquipment(backoffWeight, exercise?.equipment || 'barbell');

  return {
    weight: String(finalWeight),
    reps:   String(backoffReps),
    rpe:    String(backoffRpe),
    sourceBlockId:    block.id,
    sourceBlockColor: block.color,
  };
};

/**
 * Returns the first explicitly-typed TOP set, or the first set as de-facto TOP.
 */
export const findTopSetInExercise = (exercise) => {
  if (!exercise || !Array.isArray(exercise.sets)) return null;
  const explicit = exercise.sets.find(s => (s?.type || '').toLowerCase() === 'top');
  return explicit || exercise.sets[0] || null;
};

export const isTopSet = (set) => {
  const t = (set?.type || '').toLowerCase();
  return t === 'top' || t === 'normal' || t === '';
};

export const isBackSet = (set) => {
  const t = (set?.type || '').toLowerCase();
  return t === 'back' || t === 'backoff';
};
