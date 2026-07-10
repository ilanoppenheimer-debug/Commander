import { formatSetSummary, formatVolume } from './formatters';
import { computeExercise1RM } from './strengthMath';
import { getExerciseMeta } from '../constants/exerciseMetadata';

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  const dayName = DAYS_ES[d.getDay()];
  const dateStr = isoDate.slice(0, 10);
  const hourStr = d.toTimeString().slice(0, 5);
  return `${dateStr} (${dayName}, ${hourStr})`;
};

const PAIN_WORDS = ['dolor', 'molestia', 'pinchazo', 'tiron', 'tirón', 'lesion', 'lesión', 'pinzamiento'];

const hasPainKeyword = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PAIN_WORDS.some(w => lower.includes(w));
};

/**
 * Returns block context for a given exercise tag, using params.repsRange / params.rpeRange.
 */
const getBlockContext = (exerciseTag, blocks) => {
  if (!Array.isArray(blocks) || !exerciseTag) return null;
  const match = blocks.find(b =>
    (b.status === 'active' || b.status === 'paused') &&
    Array.isArray(b.appliesTo) && b.appliesTo.includes(exerciseTag)
  );
  if (!match) return null;
  const p = match.params || {};
  return {
    blockName: match.name,
    blockType: match.type,
    startedAt: match.startedAt || null,
    sessionsLogged: match.sessionsLogged ?? 0,
    sessionsTarget: match.sessionsTarget ?? null,
    repsMin: p.repsRange?.[0],
    repsMax: p.repsRange?.[1],
    rpeMin: p.rpeRange?.[0],
    rpeMax: p.rpeRange?.[1],
  };
};

const formatPlanLine = (ctx) => {
  if (!ctx) return null;
  const reps = ctx.repsMin != null && ctx.repsMax != null
    ? `${ctx.repsMin}-${ctx.repsMax} reps`
    : '';
  const rpe = ctx.rpeMin != null && ctx.rpeMax != null
    ? `RPE ${ctx.rpeMin}-${ctx.rpeMax}`
    : '';
  const parts = [reps, rpe].filter(Boolean).join(', ');
  return parts ? `  Plan: ${parts}` : null;
};

// DORMANT: comparación histórica (bajó/progresó), apagada por decisión
// filosófica (v2.0) — la app no evalúa desempeño, eso es rol del Coach.
// const findPrevSet = (exerciseName, setType, allSessions, currentId) => {
//   if (!Array.isArray(allSessions)) return null;
//   const sorted = allSessions
//     .filter(s => (s.historyId || s._id) !== currentId)
//     .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
//   for (const session of sorted) {
//     if (!Array.isArray(session.exercises)) continue;
//     const ex = session.exercises.find(e => e.name === exerciseName);
//     if (!ex || !Array.isArray(ex.sets)) continue;
//     const match = ex.sets.find(s => s.type === setType && s.completed);
//     if (match) return { ...match, _sessionDate: session.completedAt || null };
//   }
//   return null;
// };

const computeFlags = (set) => {
  const flags = [];
  if (hasPainKeyword(set.notes)) flags.push('molestia reportada');
  return flags;
};

const padType = (type) => {
  const label = (type && type !== 'normal' ? type.toUpperCase() : 'NORMAL').padEnd(7);
  return label;
};

const confianza1RM = (n) => {
  if (n >= 6) return 'alta';
  if (n >= 3) return 'media';
  return 'baja';
};

/**
 * Generates a text report for a session, ready to paste into Claude Coach.
 */
export const generateSessionReport = (session, { blocks = [], allSessions = [], pedidoText = 'Análisis libre' } = {}) => {
  if (!session) return '';

  const lines = [];
  lines.push('=== REPORTE DE SESIÓN ===');
  lines.push(`Fecha: ${formatDate(session.completedAt || session.createdAt)}`);
  lines.push(`Sesión: ${session.name || 'Sin nombre'}`);

  if (session.durationSec > 0) {
    lines.push(`Duración: ${Math.round(session.durationSec / 60)} min`);
  }

  const currentId = session.historyId || session._id;
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];

  let totalSets = 0;
  let totalVolume = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  const allFlagsSeen = new Set();

  for (const ex of exercises) {
    const exMeta = ex.metadata || getExerciseMeta(ex.name) || {};
    const tag = exMeta.defaultTag || ex.tag || null;
    const blockCtx = getBlockContext(tag, blocks);

    lines.push('');
    lines.push(`## ${ex.name}${tag ? ` [${tag}]` : ''}`);

    const planLine = formatPlanLine(blockCtx);
    if (planLine) lines.push(planLine);
    if (blockCtx) {
      const sess = blockCtx.sessionsTarget
        ? `${blockCtx.sessionsLogged}/${blockCtx.sessionsTarget}`
        : `${blockCtx.sessionsLogged} sesiones`;
      lines.push(`  Bloque: ${blockCtx.blockName} (${sess})`);
    }

    lines.push('  Real:');

    let exVolume = 0;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];

    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      if (!s.completed) continue;

      const flags = computeFlags(s);
      flags.forEach(f => allFlagsSeen.add(f));

      const summary = formatSetSummary(s);
      const flagsStr = flags.length > 0 ? `   ⚠️ ${flags.join(', ')}` : '';
      lines.push(`    ${i + 1}. ${padType(s.type)} ${summary}${flagsStr}`);

      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps, 10) || 0;
      if (w > 0 && r > 0) exVolume += w * r;

      const rpe = parseFloat(s.rpe);
      if (!isNaN(rpe) && rpe > 0) { rpeSum += rpe; rpeCount++; }
      totalSets++;
    }

    totalVolume += exVolume;
    if (exVolume > 0) lines.push(`  Volumen: ${formatVolume(exVolume)}`);

    const orm = computeExercise1RM(ex.name, allSessions, { weeksBack: 12 });
    if (orm.current1RM != null && orm.sampleSize >= 1) {
      const rounded = Math.round(orm.current1RM * 2) / 2;
      lines.push(`  1RM est.: ${rounded} kg (confianza ${confianza1RM(orm.sampleSize)}, N=${orm.sampleSize}) — referencia, no máximo del día`);
    }

    if (ex.exerciseNotes?.trim()) {
      lines.push(`  Nota ejercicio: "${ex.exerciseNotes.trim()}"`);
    }

    const setsWithNotes = sets.filter(s => s.notes?.trim());
    for (const s of setsWithNotes) {
      const num = sets.indexOf(s) + 1;
      lines.push(`  Nota set ${num}: "${s.notes.trim()}"`);
    }
  }

  lines.push('');
  lines.push('## Resumen');
  lines.push(`- ${totalSets} series · ${formatVolume(totalVolume)}`);

  if (rpeCount > 0) {
    lines.push(`- RPE promedio: ${(rpeSum / rpeCount).toFixed(1)}`);
  }

  if (allFlagsSeen.size > 0) {
    lines.push(`- Flags: ${[...allFlagsSeen].join(', ')}`);
  }

  lines.push('');
  lines.push('=== PEDIDO ===');
  lines.push(pedidoText);

  return lines.join('\n');
};
