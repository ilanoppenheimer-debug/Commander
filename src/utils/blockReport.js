import { getExerciseMeta, getCompanion } from '../constants/exerciseMetadata';
import { formatSetSummary, formatVolume } from './formatters';
import { getSessionTypeBreakdown } from './routineImport/contextGenerator';

const PAIN_WORDS = ['dolor', 'molestia', 'pinchazo', 'tiron', 'tirón', 'lesion', 'lesión', 'pinzamiento'];
const hasPainKeyword = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PAIN_WORDS.some(w => lower.includes(w));
};

// Same criterion sessionExport.js already established: a set counts as real data if it's
// marked completed OR carries reps OR carries weight — not a strict completed:true gate,
// which silently dropped sets the user filled in but forgot to check off.
const hasData = (s) => s?.completed || parseFloat(s?.reps) > 0 || parseFloat(s?.weight) > 0;
const isWorkSet = (s) => s?.type !== 'warmup';

const sessionsForBlock = (blockId, allHistory) =>
  (Array.isArray(allHistory) ? allHistory : []).filter(
    s => Array.isArray(s.blockIds) && s.blockIds.includes(blockId)
  );

// Same precedence chain as sessionExport.js: the session-persisted tag wins, global
// metadata is fallback only for sessions that predate the field. No 'accessory' fallback
// — an untagged exercise votes for no block, so a mixed session (one that matches this
// block AND another in parallel) doesn't leak the other block's exercises into this report.
const resolveExerciseTag = (ex) => ex?.tag || getExerciseMeta(ex?.name)?.defaultTag || null;

// Ranks sets to pick the "best" one for display — not a projected/estimated value, just a
// selection heuristic so we know which REAL set to show. Loaded work ranks by an Epley-ish
// score; bodyweight (weight 0) ranks by reps, since weight can't discriminate there.
const setScore = (weight, reps) => (weight > 0 ? weight * (1 + reps / 30) : reps);

const bestSetForExercise = (name, sessions) => {
  let best = null, bestDate = '', bestScoreVal = -1;
  for (const s of sessions) {
    for (const ex of (s.exercises || [])) {
      if (ex?.name !== name) continue;
      for (const set of (ex.sets || [])) {
        if (!hasData(set) || !isWorkSet(set)) continue;
        const w = parseFloat(set.weight) || 0;
        const r = parseInt(set.reps, 10) || 0;
        const secs = parseInt(set.seconds, 10) || 0;
        // No reps AND no time — nothing to rank (e.g. completed:true with everything
        // else blank). A timed set (r<=0, secs>0) still qualifies here, unlike before.
        if (r <= 0 && secs <= 0) continue;
        // Timed sets don't share a scale with the loaded/bodyweight score below — rank
        // by raw seconds instead. An exercise is either reps- or time-measured per its
        // exerciseMetadata, so in practice these two branches don't compete against
        // each other for the same exercise name; a transitional mixed-history exercise
        // (reconfigured mid-stream) is the one case where this comparison is not
        // apples-to-apples — accepted, not solved here.
        const score = r > 0 ? setScore(w, r) : secs;
        if (score > bestScoreVal) { bestScoreVal = score; best = set; bestDate = (s.completedAt || '').slice(0, 10); }
      }
    }
  }
  return best ? { set: best, date: bestDate } : null;
};

const findPreviousBlock = (block, allBlocks) => {
  const candidates = (Array.isArray(allBlocks) ? allBlocks : [])
    .filter(b => b.id !== block.id && b.completedAt && b.completedAt <= block.startedAt);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
};

/**
 * Compiles what happened in a block — real sets, real volume, real best-set comparisons.
 * Read-only: never writes anything, never closes the block. The Coach decides what it
 * means; this only assembles the evidence.
 */
export const generateBlockReport = (block, allHistory, allBlocks = []) => {
  if (!block?.startedAt) return '(Bloque sin fecha de inicio — actívalo primero)';
  if (!Array.isArray(allHistory)) return '';

  const blockTags = Array.isArray(block.appliesTo) ? block.appliesTo : [];
  const blockSessions = sessionsForBlock(block.id, allHistory)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

  const startMs = new Date(block.startedAt).getTime();
  const endDate = block.completedAt || new Date().toISOString();
  const endMs = new Date(endDate).getTime();
  const weeksDiff = Math.max(1, Math.round((endMs - startMs) / (7 * 24 * 60 * 60 * 1000)));

  // Declared, not filled: sessions in the block's date range that were never stamped
  // with any blockIds at all. Guessing them in by date+tag would resurrect the exact
  // mis-attribution bug this report exists to fix.
  const orphanCount = allHistory.filter(s => {
    if (!s.completedAt) return false;
    if (s.completedAt < block.startedAt) return false;
    if (s.completedAt > endDate) return false;
    return !Array.isArray(s.blockIds) || s.blockIds.length === 0;
  }).length;

  const previousBlock = findPreviousBlock(block, allBlocks);
  const previousSessions = previousBlock ? sessionsForBlock(previousBlock.id, allHistory) : [];

  // Exercises that belong to this block by tag, in first-appearance order.
  const exerciseNames = [];
  const seenNames = new Set();
  blockSessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (!ex?.name || seenNames.has(ex.name)) return;
      const tag = resolveExerciseTag(ex);
      if (tag && blockTags.includes(tag)) {
        exerciseNames.push(ex.name);
        seenNames.add(ex.name);
      }
    });
  });

  // Weekly + total volume, sets, RPE — loaded work only for volume (kg·rep needs a
  // weight); sets/RPE count any real data, bodyweight included.
  const weeklyVolume = {};
  let totalVolume = 0, totalSets = 0, rpeSum = 0, rpeCount = 0;
  blockSessions.forEach(s => {
    const weekNum = Math.max(1, Math.ceil((new Date(s.completedAt).getTime() - startMs) / (7 * 24 * 60 * 60 * 1000)));
    const key = `S${weekNum}`;
    if (!weeklyVolume[key]) weeklyVolume[key] = 0;
    (s.exercises || []).forEach(ex => {
      const tag = resolveExerciseTag(ex);
      if (!tag || !blockTags.includes(tag)) return;
      (ex.sets || []).forEach(set => {
        if (!hasData(set) || !isWorkSet(set)) return;
        totalSets++;
        const w = parseFloat(set.weight) || 0;
        const r = parseInt(set.reps, 10) || 0;
        if (w > 0 && r > 0) { totalVolume += w * r; weeklyVolume[key] += w * r; }
        const rpe = parseFloat(set.rpe);
        if (!isNaN(rpe) && rpe > 0) { rpeSum += rpe; rpeCount++; }
      });
    });
  });

  const durSessions = blockSessions.filter(s => (s.durationSec || 0) > 0);
  const avgDurMin = durSessions.length > 0
    ? Math.round(durSessions.reduce((a, s) => a + s.durationSec, 0) / durSessions.length / 60)
    : null;

  const molestias = [];
  blockSessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (ex?.exerciseNotes?.trim() && hasPainKeyword(ex.exerciseNotes)) {
        molestias.push({ date: (s.completedAt || '').slice(0, 10), exercise: ex.name, note: ex.exerciseNotes.trim() });
      }
      (ex.sets || []).forEach(set => {
        if (set?.notes?.trim() && hasPainKeyword(set.notes)) {
          molestias.push({ date: (s.completedAt || '').slice(0, 10), exercise: ex.name, note: set.notes.trim() });
        }
      });
    });
  });

  const lines = [];

  lines.push('=== REPORTE DE BLOQUE ===');
  lines.push(`Bloque: ${block.name} · ${block.type || 'custom'}${block.fase ? ` · fase ${block.fase}` : ''}`);
  lines.push(`Período: ${block.startedAt.slice(0, 10)} – ${block.completedAt ? block.completedAt.slice(0, 10) : 'hoy'} · ${weeksDiff} semana${weeksDiff !== 1 ? 's' : ''}`);
  lines.push(`Sesiones: ${blockSessions.length}${block.sessionsTarget ? ` / ${block.sessionsTarget}` : ''}`);
  if (orphanCount > 0) {
    lines.push(`⚠ ${orphanCount} sesión${orphanCount !== 1 ? 'es' : ''} en el rango del bloque sin blockIds — no incluida${orphanCount !== 1 ? 's' : ''}, revisar manualmente.`);
  }

  const typeBreakdown = getSessionTypeBreakdown(block.id, allHistory);
  if (typeBreakdown.length > 0) {
    lines.push('');
    lines.push('## Sesiones por tipo');
    for (const { label, count, lastDate } of typeBreakdown) {
      lines.push(`  - ${label}: ${count}`);
    }
  }

  for (const name of exerciseNames) {
    const best = bestSetForExercise(name, blockSessions);
    const companion = getCompanion(name);

    let exSets = 0, exVolume = 0;
    blockSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        if (ex.name !== name) return;
        (ex.sets || []).forEach(set => {
          if (!hasData(set) || !isWorkSet(set)) return;
          exSets++;
          const w = parseFloat(set.weight) || 0;
          const r = parseInt(set.reps, 10) || 0;
          if (w > 0 && r > 0) exVolume += w * r;
        });
      });
    });

    // Header only once we know there's something printable — no title-with-empty-body.
    if (exSets === 0) continue;

    lines.push('');
    lines.push(`## ${name}`);

    if (best) {
      let bestLine = `  Mejor set: ${formatSetSummary(best.set, 'kg', companion)} (${best.date})`;
      const prevBest = previousBlock ? bestSetForExercise(name, previousSessions) : null;
      if (prevBest) {
        bestLine += ` [bloque anterior: ${formatSetSummary(prevBest.set, 'kg', companion)}, ${prevBest.date}]`;
      }
      lines.push(bestLine);
    }

    lines.push(`  Sets de trabajo: ${exSets}${exVolume > 0 ? ` · Volumen: ${formatVolume(exVolume)}` : ''}`);
  }

  lines.push('');
  lines.push('## Resumen');
  if (blockSessions.length === 0) {
    lines.push('Sin sesiones atribuidas al bloque.');
  } else {
    lines.push(`- Volumen total: ${formatVolume(totalVolume)}`);
    const weekKeys = Object.keys(weeklyVolume).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
    if (weekKeys.length > 0) {
      lines.push(`- Volumen por semana: ${weekKeys.map(k => `${k}: ${formatVolume(weeklyVolume[k])}`).join(' / ')}`);
    }
    if (rpeCount > 0) lines.push(`- RPE promedio: ${(rpeSum / rpeCount).toFixed(1)}`);
    if (avgDurMin !== null) lines.push(`- Duración promedio: ${avgDurMin} min`);
  }

  lines.push('');
  lines.push('## Molestias reportadas');
  if (molestias.length > 0) {
    molestias.forEach(m => lines.push(`- ${m.date}, ${m.exercise}: "${m.note}"`));
  } else {
    lines.push('Ninguna registrada');
  }

  lines.push('');
  lines.push('## Bitácora');
  lines.push('- ¿Qué funcionó?');
  lines.push('- ¿Qué fricción tuve?');
  lines.push('- ¿Qué cambiaría?');

  return lines.join('\n');
};
