// The Coach's plan per set (`set.planned = { weight, reps, rpeText }`, raw text exactly as
// the YAML table had it: "100", "5", "7–8", "35s"). Written once at import and never
// recomputed; it is data on the side — placeholders and real values don't read it.

const TYPE_LABELS = { warmup: 'W', top: 'Top', back: 'Back', backoff: 'Back', normal: 'Normal', amrap: 'AMRAP', drop: 'Drop', myo: 'Myo' };
// The chip summarizes only these set types; warm-ups (and drop/myo) keep their plan in
// set.planned but are not shown there.
const SUMMARY_TYPES = new Set(['top', 'back', 'backoff', 'normal', 'amrap']);
const inSummary = (s) => SUMMARY_TYPES.has((s?.type || 'normal').toLowerCase());
const typeLabel = (t) => TYPE_LABELS[(t || 'normal').toLowerCase()] || (t || 'Normal');

const RANGE = /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/;
const NUM = /^\d+(?:\.\d+)?$/;
const SECS = /^(\d+)\s*(?:s|seg|sec)$/i;

// "100×5 @7–8" · "5 reps @8" (no planned weight: the app derives it) · "35s"
export const formatPlannedSet = (planned) => {
  if (!planned) return '';
  const w = planned.weight || '';
  const r = planned.reps || '';
  const rpe = planned.rpeText ? ` @${planned.rpeText}` : '';
  if (SECS.test(r) || /^\d+\s*min$/i.test(r)) return `${r}${rpe}`;
  if (!w && !r) return rpe.trim();
  const head = w ? `${w}×${r || '?'}` : `${r} reps`;
  return `${head}${rpe}`;
};

export const hasPlannedSets = (sets) => (Array.isArray(sets) ? sets : []).some(s => inSummary(s) && s?.planned && formatPlannedSet(s.planned));

/**
 * Plan summary grouped by set type, in the routine's order of first appearance:
 * [{ label: 'Top', text: '100×5 @7–8', count: 1 }, { label: 'Back', text: '94×5 @8', count: 2 }]
 * Consecutive-or-not sets of one type with the same text collapse into one entry with count.
 */
export const summarizePlannedSets = (sets) => {
  const groups = [];
  for (const s of (Array.isArray(sets) ? sets : [])) {
    if (!inSummary(s)) continue;
    const text = formatPlannedSet(s?.planned);
    if (!text) continue;
    const label = typeLabel(s.type);
    const hit = groups.find(g => g.label === label && g.text === text);
    if (hit) hit.count++;
    else groups.push({ label, text, count: 1 });
  }
  return groups;
};

const asNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

/**
 * Does the real set depart from its plan? Only comparable pieces count: a numeric planned
 * weight/reps against the real one, an RPE number or range against the real RPE (inside a
 * range = on plan), planned seconds against real seconds. A plan piece that isn't numeric
 * (or a real value that wasn't logged) is never a deviation.
 */
export const planDeviates = (set) => {
  const p = set?.planned;
  if (!p || (set.type || '').toLowerCase() === 'warmup') return false; // no plan suffix for warm-ups

  const pw = NUM.test(p.weight || '') ? parseFloat(p.weight) : null;
  const rw = asNum(set.weight);
  if (pw != null && rw != null && Math.abs(pw - rw) > 0.01) return true;

  const rr = asNum(set.reps);
  if (rr != null && rr > 0) {
    if (NUM.test(p.reps || '') && parseFloat(p.reps) !== rr) return true;
    const rm = RANGE.exec(p.reps || '');
    if (rm && (rr < parseFloat(rm[1]) || rr > parseFloat(rm[2]))) return true;
  }

  const secs = SECS.exec(p.reps || '');
  const rs = asNum(set.seconds);
  if (secs && rs != null && rs > 0 && Math.abs(parseInt(secs[1], 10) - rs) > 0.5) return true;

  const rrpe = asNum(set.rpe);
  if (rrpe != null && rrpe > 0 && p.rpeText) {
    const t = String(p.rpeText).trim();
    if (NUM.test(t) && Math.abs(parseFloat(t) - rrpe) > 0.01) return true;
    const m = RANGE.exec(t);
    if (m && (rrpe < parseFloat(m[1]) || rrpe > parseFloat(m[2]))) return true;
  }
  return false;
};
