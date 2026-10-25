// The Coach's time plan for a timed set, as written in the Reps column and kept raw in
// `set.planned.reps`: "36s", "30seg", "10min", a range "30-40s" / "1-2min", or "máx".
// Display/compare helpers only — the hold target itself (`targetSeconds`) is written at
// import by the parser (lower end of a range).

const TIME_RE = /^(\d+)(?:\s*[-–—]\s*(\d+))?\s*(s|seg|sec|min)$/i;
const MAX_RE = /^m[aá]x\.?(?:\s*(?:s|seg|sec))?$/i;
const MAX_TIME_RE = /^m[aá]x\.?\s*(?:s|seg|sec)$/i;

// → { lo, hi, isRange, unit: 's'|'min', loText, hiText } (lo/hi in seconds) | null
export const parsePlannedTime = (text) => {
  const m = TIME_RE.exec(String(text ?? '').trim());
  if (!m) return null;
  const unit = m[3].toLowerCase() === 'min' ? 'min' : 's';
  const mult = unit === 'min' ? 60 : 1;
  const lo = parseInt(m[1], 10) * mult;
  const hi = m[2] != null ? parseInt(m[2], 10) * mult : lo;
  return { lo, hi, isRange: m[2] != null, unit, loText: m[1], hiText: m[2] ?? m[1] };
};

// "máx" / "max" / "MAX" ("máx s", "max seg": same, with the unit): the open-ended set —
// no target, always a stopwatch.
export const isMaxPlan = (text) => MAX_RE.test(String(text ?? '').trim());

// "máx s" / "máx seg" / "max s": the Coach says explicitly it is a TIME max. The importer
// never turns it into AMRAP, whatever the exercise's measurement.
export const isMaxTimePlan = (text) => MAX_TIME_RE.test(String(text ?? '').trim());

// "30-40 s" / "1-2 min" for a ranged plan, else null (single values show as mm:ss).
export const plannedRangeLabel = (text) => {
  const p = parsePlannedTime(text);
  return p?.isRange ? `${p.loText}-${p.hiText} ${p.unit === 'min' ? 'min' : 's'}` : null;
};
