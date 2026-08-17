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

// '1'/'2'/'3' — the companionValue vocabulary TimedSetRow's difficulty dots write.
// Not the same vocabulary as SCALE_3 (constants/exerciseMetadata.js, 'low'/'medium'/
// 'high') — that's a different field entirely — but reuses the same label text for
// visual consistency across the app.
const DIFFICULTY_SET_LABELS = { '1': 'Baja', '2': 'Media', '3': 'Alta' };

// companion ('difficulty'|'hr'|undefined) is the exercise-level getCompanion() value —
// callers that already resolved it (blockReport.js, per-exercise) pass it through;
// omitting it just means the companion suffix doesn't print, time still does.
export const formatSetSummary = (set, unit = 'kg', companion) => {
  const repsNum = parseInt(set?.reps, 10);
  if (isNaN(repsNum) || repsNum <= 0) {
    // No real reps — check for a time-based set (measurement='time' sets never carry
    // weight/reps, only seconds/companionValue; this is inferred from the set's own
    // shape, same way the rest of this function infers bodyweight from weight<=0,
    // rather than requiring every caller to thread the exercise's measurement through).
    const secsNum = parseInt(set?.seconds, 10);
    if (isNaN(secsNum) || secsNum <= 0) return '—';
    const timeStr = formatSeconds(secsNum);
    let companionStr = '';
    if (companion === 'difficulty') {
      const label = DIFFICULTY_SET_LABELS[String(set?.companionValue)];
      if (label) companionStr = ` · ${label}`;
    } else if (companion === 'hr') {
      const hrNum = parseInt(set?.companionValue, 10);
      if (!isNaN(hrNum) && hrNum > 0) companionStr = ` · ${hrNum} bpm`;
    }
    return `${timeStr}${companionStr}`;
  }
  const r = formatReps(set?.reps);
  const rawWeight = parseFloat(set?.weight);
  const w = (!isNaN(rawWeight) && rawWeight > 0) ? formatWeight(set?.weight, unit) : 'PC';
  const rpe = formatRpe(set?.rpe);
  const rpeStr = rpe !== '—' ? ` @ RPE ${rpe}` : '';
  return `${w} × ${r}${rpeStr}`;
};
