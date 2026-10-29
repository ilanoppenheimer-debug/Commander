export const DEFAULT_INCREMENTS_BY_EQUIPMENT = {
  barbell:    { weight: { small: 2.5, large: 5,  options: [1.25, 2.5, 5, 10, 20] } },
  smith:      { weight: { small: 2.5, large: 5,  options: [1.25, 2.5, 5, 10] } },
  dumbbell:   { weight: { small: 1,   large: 2,  options: [0.5, 1, 2, 2.5, 5] } },
  cable:      { weight: { small: 2.5, large: 5,  options: [1.25, 2.5, 5, 10] } },
  machine:    { weight: { small: 5,   large: 10, options: [2.5, 5, 10, 20] } },
  kettlebell: { weight: { small: 2,   large: 4,  options: [2, 4, 8, 12] } },
  landmine:   { weight: { small: 2.5, large: 5,  options: [1.25, 2.5, 5, 10, 20] } },
  band:       { weight: { small: 1,   large: 2.5,options: [0.5, 1, 2.5, 5] } },
  bodyweight: { weight: { small: 1,   large: 2.5,options: [0.5, 1, 2.5, 5, 10] } },
  other:      { weight: { small: 2.5, large: 5,  options: [1.25, 2.5, 5, 10] } },
};

export const REPS_INCREMENTS = { small: 1, large: 2, options: [1, 2, 5, 10] };
export const RPE_INCREMENTS  = { small: 0.5, large: 1, options: [0.5, 1, 2] };

export const getIncrementsFor = (field, equipment, exerciseMeta = null, globalOverrides = {}) => {
  if (field === 'rpe')  return exerciseMeta?.customIncrements?.rpe  || globalOverrides?.rpe  || RPE_INCREMENTS;
  if (field === 'reps') return exerciseMeta?.customIncrements?.reps || globalOverrides?.reps || REPS_INCREMENTS;

  if (exerciseMeta?.customIncrements?.weight) return exerciseMeta.customIncrements.weight;
  // No implement defined (null): the generic table, no per-implement overrides.
  if (equipment && globalOverrides?.weight?.[equipment]) return globalOverrides.weight[equipment];
  return DEFAULT_INCREMENTS_BY_EQUIPMENT[equipment]?.weight || DEFAULT_INCREMENTS_BY_EQUIPMENT.other.weight;
};

export const applyDelta = (currentValue, delta, field = 'weight') => {
  const num = parseFloat(currentValue);
  const base = isNaN(num) ? 0 : num;
  const result = base + delta;
  if (field === 'reps') return Math.max(0, Math.min(99,  Math.round(result)));
  if (field === 'rpe')  return Math.max(0, Math.min(10,  Math.round(result * 2) / 2));
  return Math.max(0, Math.min(999, Math.round(result * 100) / 100));
};

export const formatNumber = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const num = parseFloat(val);
  if (isNaN(num)) return String(val);
  if (Number.isInteger(num)) return String(num);
  const dec = num.toString().split('.')[1] || '';
  return num.toFixed(dec.length > 1 ? 2 : 1);
};
