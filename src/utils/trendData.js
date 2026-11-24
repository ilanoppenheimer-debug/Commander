import { buildDisplayNameIndex, displayNameFor, normalizeExerciseName } from './exerciseName';
import { canonicalExerciseName } from '../constants/exerciseFamilies';
import { makeVariantMatcher, resolveHistoryEquipment, variantLabel, isTimeMeasured } from './exerciseVariant';
import { estimate1RM, isPredictiveSet } from './strengthMath';
import { isComparable1RMEquipment } from '../constants/gymConstants';
import { formatNum } from './weightUtils';

// Data behind Tendencias → Progreso 1RM (TrendModal). Pure and read-only.
//
// What is charted, by implement:
//  - 'comparable': isComparable1RMEquipment (barbell, dumbbell, smith, landmine): the criterion of "Enviar al
//    Coach", the session report and Mis 1RM.
//  - 'reference': machine and cable. The load is not comparable between gyms, so the number is a reference for
//    THIS machine only (Catálogo 8.2 "Máquinas"): charted, and labelled so.
//  - everything else is not charted here (bodyweight, time-measured, kettlebell, band, other, no implement known).
// A 1RM point follows Contrato v1.8.4 §5 (the same rules and estimate as the Coach context): isPredictiveSet and
// estimate1RM of strengthMath.js.
export const REFERENCE_LABEL = 'Referencia de esta máquina';

const REFERENCE_EQUIPMENT = ['machine', 'cable'];

// 'comparable' | 'reference' | null (not charted).
export const trendKind = (equipment) => {
  if (isComparable1RMEquipment(equipment)) return 'comparable';
  if (REFERENCE_EQUIPMENT.includes(equipment)) return 'reference';
  return null;
};

// Kind of one history appearance (its implement: the session's, else the exercise's metadata; time-measured
// exercises are never charted).
const appearanceKind = (ex) => (isTimeMeasured(ex?.name) ? null : trendKind(resolveHistoryEquipment(ex)));

/**
 * Entries listed in Tendencias, most frequent first: [{ key, name, equipment, label, kind, count }].
 * One entry per exercise name; a name done with more than one chartable implement gets one entry per implement
 * ("Curl de Bíceps · barra" / "· polea"), because the implement separates the numbers. `equipment` is null
 * (by name) for a name with a single chartable implement. The printed name is the Catálogo's spelling when the
 * history's is the same exercise (canonicalExerciseName, as in the Coach context), else the spelling of the most
 * recent session. Appearances that are not chartable do not count.
 */
export const trendEntries = (history) => {
  const displayNames = buildDisplayNameIndex(history);
  const byName = new Map(); // normalized name -> Map(equipment -> count)
  for (const s of Array.isArray(history) ? history : []) {
    for (const ex of Array.isArray(s?.exercises) ? s.exercises : []) {
      if (!ex?.name || !appearanceKind(ex)) continue;
      const n = normalizeExerciseName(ex.name);
      const eq = resolveHistoryEquipment(ex);
      if (!byName.has(n)) byName.set(n, new Map());
      byName.get(n).set(eq, (byName.get(n).get(eq) || 0) + 1);
    }
  }
  const entries = [];
  for (const [n, eqs] of byName) {
    const name = canonicalExerciseName(displayNameFor(displayNames, n));
    if (eqs.size === 1) {
      const [[eq, count]] = [...eqs];
      entries.push({ key: `${n}|`, name, equipment: null, label: name, kind: trendKind(eq), count });
    } else {
      for (const [eq, count] of eqs) entries.push({ key: `${n}|${eq}`, name, equipment: eq, label: variantLabel(name, eq), kind: trendKind(eq), count });
    }
  }
  return entries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
};

// The appearances a chart for (name, equipment) uses, newest last, as { session, ex, kind }. With no implement
// given and a name that has both comparable and reference appearances, only the comparable ones: the two are not
// the same scale.
const chartAppearances = (exName, equipment, history) => {
  const isVariant = makeVariantMatcher(exName, equipment);
  const sorted = history.filter(Boolean).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const all = [];
  for (const session of sorted) {
    if (!Array.isArray(session.exercises)) continue;
    const ex = session.exercises.find((e) => e && isVariant(e) && appearanceKind(e));
    if (ex) all.push({ session, ex, kind: appearanceKind(ex) });
  }
  const kinds = new Set(all.map((a) => a.kind));
  return equipment == null && kinds.size > 1 ? all.filter((a) => a.kind === 'comparable') : all;
};

// Which kind a chart is: 'reference' when everything it plots is machine/cable.
export const trendKindFor = (exName, equipment, history) => {
  if (!Array.isArray(history) || !exName) return equipment ? trendKind(equipment) : null;
  const kinds = new Set(chartAppearances(exName, equipment, history).map((a) => a.kind));
  if (kinds.size === 0) return equipment ? trendKind(equipment) : null;
  return kinds.has('comparable') ? 'comparable' : 'reference';
};

const WINDOW_MS = 12 * 7 * 24 * 60 * 60 * 1000; // the 12-week rolling window of §5

/**
 * One point per session for the variant (name + implement; `equipment` null = by name), oldest first: the best
 * estimated 1RM among the session's valid sets (§5: no warmup or drop, weight > 0, reps 1-12, RPE ≥ 6, not
 * incomplete, weight ≥ 50 % of the exercise's maximum in the 12-week window ending that session) and the top
 * weight of those sets. A session with no valid set has no point.
 */
export const buildTrendPoints = (exName, equipment, history) => {
  if (!exName || !Array.isArray(history)) return [];
  const apps = chartAppearances(exName, equipment, history)
    .filter((a) => Array.isArray(a.ex.sets) && a.ex.sets.length > 0)
    .map((a) => ({ ...a, t: Date.parse(a.session.completedAt) }));

  const points = [];
  for (const a of apps) {
    // Maximum weight of the exercise in the window (same reference computeExercise1RM uses: every set).
    let refMax = 0;
    for (const b of apps) {
      if (b.t > a.t || a.t - b.t >= WINDOW_MS) continue;
      for (const s of b.ex.sets) refMax = Math.max(refMax, parseFloat(s?.weight) || 0);
    }
    let best = 0;
    let topWeight = 0;
    for (const s of a.ex.sets) {
      if (!isPredictiveSet(s, refMax)) continue;
      const est = estimate1RM(s.weight, s.reps, s.rpe);
      if (est > best) best = est;
      topWeight = Math.max(topWeight, parseFloat(s.weight) || 0);
    }
    if (best > 0) {
      points.push({
        date: new Date(a.session.completedAt),
        shortDate: new Date(a.session.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        est1RM: formatNum(best),
        topWeight: formatNum(topWeight),
      });
    }
  }
  return points;
};

// Can the modal chart this implement? (null = by name: the data decides.)
export const hasTrendableEquipment = (equipment) => equipment == null || trendKind(equipment) !== null;

/**
 * Which labels of the chart get printed, so they never overlap (a long history is ~30 points over ~260 units).
 * `xs`: x of each point in chart units; `values`: its 1RM. A label is kept only when it is at least `gap`
 * units from every label already kept, in this order of importance:
 *   values: the best, the last, the first, the lowest;
 *   dates:  first and last, then evenly spaced ticks.
 * Returns { value: Set<index>, date: Set<index> }.
 */
export const pickTrendLabels = (xs, values, { valueGap = 36, dateGap = 32 } = {}) => {
  const n = xs.length;
  const value = new Set();
  const date = new Set();
  if (n === 0) return { value, date };

  const keep = (set, idx, gap) => {
    if ([...set].every((j) => Math.abs(xs[idx] - xs[j]) >= gap)) set.add(idx);
  };

  let hi = 0;
  let lo = 0;
  values.forEach((v, i) => { if (v > values[hi]) hi = i; if (v < values[lo]) lo = i; });
  for (const idx of [hi, n - 1, 0, lo]) keep(value, idx, valueGap);

  // Dates: as many evenly spaced ticks as fit, always starting at the first and ending at the last.
  const span = xs[n - 1] - xs[0];
  const slots = Math.max(1, Math.floor(span / dateGap) + 1);
  if (n === 1 || slots === 1) { date.add(0); if (n > 1) keep(date, n - 1, dateGap); }
  else {
    for (let t = 0; t < slots; t++) keep(date, Math.round((t * (n - 1)) / (slots - 1)), dateGap);
    keep(date, n - 1, dateGap);
  }
  return { value, date };
};
