export const formatWeight = (weight, unit = 'kg') => {
  if (weight === null || weight === undefined || weight === '') return '—';
  const n = parseFloat(weight);
  if (isNaN(n) || n === 0) return '—';
  const formatted = n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${unit}`;
};

export const formatReps = (reps) => {
  if (reps === null || reps === undefined || reps === '') return '—';
  const n = parseInt(reps, 10);
  if (isNaN(n)) return '—';
  return String(n);
};

export const formatRpe = (rpe) => {
  if (rpe === null || rpe === undefined || rpe === '') return '—';
  const n = parseFloat(rpe);
  if (isNaN(n)) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

export const formatSeconds = (sec) => {
  if (sec == null) return '—';
  const n = parseInt(sec, 10);
  if (isNaN(n)) return '—';
  if (n < 60) return `${n} s`;
  const min = Math.floor(n / 60);
  const rem = n % 60;
  return rem === 0 ? `${min} min` : `${min}:${String(rem).padStart(2, '0')}`;
};

export const formatVolume = (volume) => {
  if (volume == null) return '—';
  const n = parseInt(volume, 10);
  if (isNaN(n)) return '—';
  return `${n.toLocaleString('es-ES')} kg·rep`;
};

export const formatSetSummary = (set, unit = 'kg') => {
  const repsNum = parseInt(set?.reps, 10);
  if (isNaN(repsNum) || repsNum <= 0) return '—';
  const r = formatReps(set?.reps);
  const rawWeight = parseFloat(set?.weight);
  const w = (!isNaN(rawWeight) && rawWeight > 0) ? formatWeight(set?.weight, unit) : 'PC';
  const rpe = formatRpe(set?.rpe);
  const rpeStr = rpe !== '—' ? ` @ RPE ${rpe}` : '';
  return `${w} × ${r}${rpeStr}`;
};
