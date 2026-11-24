import { buildDisplayNameIndex, displayNameFor } from './exerciseName';
import { makeVariantMatcher, resolveHistoryEquipment } from './exerciseVariant';
import { calculate1RM } from './strengthMath';
import { isComparable1RMEquipment } from '../constants/gymConstants';
import { formatNum } from './weightUtils';

// Data behind Tendencias → Progreso 1RM (TrendModal). Pure and read-only.
//
// A 1RM estimate only means something when the load is external and comparable from one
// session to the next: the SAME criterion as "Enviar al Coach" and the session report
// (isComparable1RMEquipment: barbell / dumbbell / smith). Machines, cables and bodyweight get no 1RM
// (Contrato v1.8.4 §5; Catálogo 8.2 "Máquinas"); an appearance with no implement known (neither on the
// session nor in the exercise's metadata) is not guessed.
const isComparableAppearance = (ex) => isComparable1RMEquipment(resolveHistoryEquipment(ex));

/**
 * Exercises listed in Tendencias: Map<display name, number of appearances>, most frequent first. Only
 * appearances with a comparable implement count, so a name that was only ever done on a machine is not listed.
 * The printed name is the spelling of the most recent session (displayNameFor).
 */
export const trendExerciseCounts = (history) => {
  const displayNames = buildDisplayNameIndex(history);
  const counts = new Map();
  for (const s of Array.isArray(history) ? history : []) {
    for (const ex of Array.isArray(s?.exercises) ? s.exercises : []) {
      if (!ex?.name || !isComparableAppearance(ex)) continue;
      const name = displayNameFor(displayNames, ex.name);
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return new Map([...counts].sort((a, b) => b[1] - a[1]));
};

/**
 * One point per session for the variant (name + implement; `equipment` null = by name): the best estimated
 * 1RM of that session's sets (Epley with the RPE reserve) and its top weight, oldest first. Only comparable
 * appearances are plotted: with no implement given, a name done with a barbell AND a cable plots the barbell.
 */
export const buildTrendPoints = (exName, equipment, history) => {
  if (!exName || !Array.isArray(history)) return [];
  const isVariant = makeVariantMatcher(exName, equipment);
  const sorted = history.filter(Boolean).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

  const points = [];
  for (const session of sorted) {
    if (!session || !Array.isArray(session.exercises)) continue;
    const exData = session.exercises.find((e) => e && isVariant(e) && isComparableAppearance(e));
    if (!exData || !Array.isArray(exData.sets) || exData.sets.length === 0) continue;

    let max1RM = 0;
    let topWeight = 0;
    for (const s of exData.sets) {
      const weight = parseFloat(s.weight) || 0;
      const reps = parseFloat(s.reps) || 0;
      const rpe = parseFloat(s.rpe) || 10;
      if (weight > 0 && reps > 0) {
        const est1RM = calculate1RM(weight, reps, rpe, 'epley');
        if (est1RM > max1RM) max1RM = est1RM;
        if (weight > topWeight) topWeight = weight;
      }
    }
    if (max1RM > 0) {
      points.push({
        date: new Date(session.completedAt),
        shortDate: new Date(session.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        est1RM: formatNum(max1RM),
        topWeight: formatNum(topWeight),
      });
    }
  }
  return points;
};

// Is this implement one the chart can show? (null = by name: the points decide.)
export const hasTrendableEquipment = (equipment) => equipment == null || isComparable1RMEquipment(equipment);

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
