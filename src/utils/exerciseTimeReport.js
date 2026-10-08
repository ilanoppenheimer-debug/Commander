import { resolveExerciseTag } from './blockReport';

const REPORT_TAGS = ['main_lift', 'secondary'];
const WINDOW = 8;
const MIN_FOR_STATS = 3;

const hasData = (s) => s?.completed || parseFloat(s?.reps) > 0 || parseFloat(s?.weight) > 0;

// Linear-interpolated percentile over an ascending array (p in 0..1).
const percentile = (sorted, p) => {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};
const median = (arr) => percentile([...arr].sort((a, b) => a - b), 0.5);

const fmtMin = (n) => String(Math.round(n));
const fmtPerSet = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/**
 * One timed appearance per (session, exercise), or null when it can't be measured.
 * Duration = this exercise's finishedAt minus the finishedAt of the exercise right
 * BEFORE it in the session's list (or session.startTime for the first one) — the same
 * interval the session report's "Tiempo:" line prints. List order is trusted as
 * execution order. Dropped, never guessed: exercises with no finishedAt, supersets
 * (members share one stamp, so their interval is meaningless), and any whose
 * predecessor has no finishedAt (its interval would swallow the predecessor's work).
 */
const measureAppearance = (session, exercises, i) => {
  const ex = exercises[i];
  if (!ex?.finishedAt || ex.supersetId) return null;
  const prevRef = i === 0 ? session.startTime : exercises[i - 1]?.finishedAt;
  if (!prevRef) return null;
  const minutes = (new Date(ex.finishedAt) - new Date(prevRef)) / 60000;
  if (!(minutes > 0)) return null;
  const workSets = (Array.isArray(ex.sets) ? ex.sets : []).filter(s => s?.type !== 'warmup' && hasData(s)).length;
  return { minutes, perSet: workSets > 0 ? minutes / workSets : null, first: i === 0 };
};

/**
 * On-demand report: how long each main_lift / secondary exercise takes, to plan session
 * length. Window = the last WINDOW measurable appearances per exercise, any block.
 */
export const generateExerciseTimeReport = (allHistory) => {
  const sessions = (Array.isArray(allHistory) ? allHistory : [])
    .filter(s => s?.completedAt && Array.isArray(s.exercises))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const byName = new Map();
  for (const session of sessions) {
    session.exercises.forEach((ex, i) => {
      if (!ex?.name) return;
      const tag = resolveExerciseTag(ex);
      if (!REPORT_TAGS.includes(tag)) return;
      const entry = byName.get(ex.name) || { tag, appearances: [] };
      if (entry.appearances.length >= WINDOW) return;
      const m = measureAppearance(session, session.exercises, i);
      if (m) entry.appearances.push(m);
      byName.set(ex.name, entry);
    });
  }

  const rows = [...byName.entries()].filter(([, e]) => e.appearances.length > 0);
  rows.sort((a, b) =>
    REPORT_TAGS.indexOf(a[1].tag) - REPORT_TAGS.indexOf(b[1].tag) || a[0].localeCompare(b[0]));

  const lines = ['=== TIEMPOS POR EJERCICIO ==='];
  lines.push('Duración = cierre del ejercicio menos cierre del anterior (o inicio de la sesión). Últimas 8 apariciones medibles, sin importar el bloque. Solo main_lift y secondary.');
  lines.push('');
  if (rows.length === 0) {
    lines.push('Sin datos medibles (hace falta cerrar los ejercicios con "Finalizar ejercicio").');
    return lines.join('\n');
  }

  for (const [name, { tag, appearances }] of rows) {
    const n = appearances.length;
    if (n < MIN_FOR_STATS) {
      lines.push(`${name} [${tag}] · n=${n}`);
      continue;
    }
    const mins = appearances.map(a => a.minutes).sort((a, b) => a - b);
    const perSets = appearances.map(a => a.perSet).filter(v => v != null);
    const firstCount = appearances.filter(a => a.first).length;
    let line = `${name} [${tag}] · ${fmtMin(median(mins))} min (IQR ${fmtMin(percentile(mins, 0.25))}–${fmtMin(percentile(mins, 0.75))})`;
    if (perSets.length > 0) line += ` · ${fmtPerSet(median(perSets))} min/serie`;
    line += ` · n=${n}`;
    if (firstCount * 2 > n) line += ' · incluye calentamiento';
    lines.push(line);
  }
  return lines.join('\n');
};
