import { getExerciseMeta } from '../constants/exerciseMetadata';
import { computeExercise1RM } from './strengthMath';
import { formatVolume } from './formatters';

const PAIN_WORDS = ['dolor', 'molestia', 'pinchazo', 'tiron', 'tirón', 'lesion', 'lesión', 'pinzamiento'];
const hasPainKeyword = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PAIN_WORDS.some(w => lower.includes(w));
};

const sessionBelongsToBlock = (session, block) => {
  if (!session?.completedAt || !block?.startedAt) return false;
  if (session.completedAt < block.startedAt) return false;
  const endDate = block.completedAt || new Date().toISOString();
  if (session.completedAt > endDate) return false;
  const tags = Array.isArray(block.appliesTo) ? block.appliesTo : [];
  if (tags.length === 0) return false;
  return (session.exercises || []).some(ex => {
    const meta = getExerciseMeta(ex?.name) || {};
    return tags.includes(meta.defaultTag || 'accessory');
  });
};

export const generateBlockReport = (block, allHistory) => {
  if (!block?.startedAt) return '(Bloque sin fecha de inicio — actívalo primero)';
  if (!Array.isArray(allHistory)) return '';

  const endDate = block.completedAt || new Date().toISOString();
  const blockTags = Array.isArray(block.appliesTo) ? block.appliesTo : [];

  const blockSessions = allHistory
    .filter(s => sessionBelongsToBlock(s, block))
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

  const startMs = new Date(block.startedAt).getTime();
  const endMs = new Date(endDate).getTime();
  const weeksDiff = Math.max(1, Math.round((endMs - startMs) / (7 * 24 * 60 * 60 * 1000)));

  // Exercises present in block sessions with matching tag, in appearance order
  const exerciseNames = [];
  const seenNames = new Set();
  blockSessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (!ex?.name || seenNames.has(ex.name)) return;
      const meta = getExerciseMeta(ex.name) || {};
      if (blockTags.includes(meta.defaultTag || 'accessory')) {
        exerciseNames.push(ex.name);
        seenNames.add(ex.name);
      }
    });
  });

  // 1RM split: first half vs last half of sessions by date
  const mid = Math.floor(blockSessions.length / 2);
  const firstHalf = blockSessions.slice(0, Math.max(1, mid));
  const lastHalf  = blockSessions.slice(mid);

  // Weekly volume (warmups excluded per B1 semantics)
  const weeklyVolume = {};
  blockSessions.forEach(s => {
    const weekNum = Math.max(1, Math.ceil((new Date(s.completedAt).getTime() - startMs) / (7 * 24 * 60 * 60 * 1000)));
    const key = `S${weekNum}`;
    if (!weeklyVolume[key]) weeklyVolume[key] = 0;
    (s.exercises || []).forEach(ex => {
      const meta = getExerciseMeta(ex?.name) || {};
      if (!blockTags.includes(meta.defaultTag || 'accessory')) return;
      (ex.sets || []).forEach(set => {
        if (!set?.completed || set.type === 'warmup') return;
        const w = parseFloat(set.weight) || 0;
        const r = parseInt(set.reps, 10) || 0;
        if (w > 0 && r > 0) weeklyVolume[key] += w * r;
      });
    });
  });

  // Totals across all block sessions
  let totalVolume = 0, totalSets = 0, rpeSum = 0, rpeCount = 0;
  blockSessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      const meta = getExerciseMeta(ex?.name) || {};
      if (!blockTags.includes(meta.defaultTag || 'accessory')) return;
      (ex.sets || []).forEach(set => {
        if (!set?.completed || set.type === 'warmup') return;
        const w = parseFloat(set.weight) || 0;
        const r = parseInt(set.reps, 10) || 0;
        if (w > 0 && r > 0) { totalVolume += w * r; totalSets++; }
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
      (ex.sets || []).forEach(set => {
        if (set?.notes && hasPainKeyword(set.notes)) {
          molestias.push({ date: (s.completedAt || '').slice(0, 10), exercise: ex.name, note: set.notes.trim() });
        }
      });
    });
  });

  const lines = [];

  lines.push('=== REPORTE DE BLOQUE ===');
  lines.push(`Bloque: ${block.name} · ${block.type || 'custom'}`);
  lines.push(`Período: ${block.startedAt.slice(0, 10)} – ${block.completedAt ? block.completedAt.slice(0, 10) : 'hoy'} · ${weeksDiff} semana${weeksDiff !== 1 ? 's' : ''}`);
  lines.push(`Sesiones: ${blockSessions.length} / ${block.sessionsTarget ?? '∞'}`);
  lines.push('Nota: atribución de sesiones aproximada (por fecha y tag, sin ID de bloque).');
  lines.push('Puede incluir sesiones de períodos de pausa.');

  for (const name of exerciseNames) {
    lines.push('');
    lines.push(`## ${name}`);

    const orm1 = computeExercise1RM(name, firstHalf, { weeksBack: null });
    const orm2 = computeExercise1RM(name, lastHalf,  { weeksBack: null });
    if ((orm1.current1RM != null && orm1.sampleSize >= 1) || (orm2.current1RM != null && orm2.sampleSize >= 1)) {
      const f1 = (orm1.current1RM != null && orm1.sampleSize >= 1) ? `${Math.round(orm1.current1RM * 2) / 2} kg` : '—';
      const f2 = (orm2.current1RM != null && orm2.sampleSize >= 1) ? `${Math.round(orm2.current1RM * 2) / 2} kg` : '—';
      lines.push(`  1RM est.: ${f1} → ${f2}`);
    }

    let bestSet = null, bestDate = '', best1RM = 0;
    blockSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        if (ex.name !== name) return;
        (ex.sets || []).forEach(set => {
          if (!set?.completed || set.type === 'warmup') return;
          const w = parseFloat(set.weight) || 0;
          const r = parseInt(set.reps, 10) || 0;
          if (!w || !r) return;
          const est = w * (1 + r / 30);
          if (est > best1RM) { best1RM = est; bestSet = set; bestDate = (s.completedAt || '').slice(0, 10); }
        });
      });
    });
    if (bestSet) {
      const rpeStr = parseFloat(bestSet.rpe) > 0 ? ` @ RPE ${bestSet.rpe}` : '';
      lines.push(`  Mejor set: ${bestSet.weight} kg × ${bestSet.reps}${rpeStr} (${bestDate})`);
    }

    let exVol = 0, exSets = 0;
    blockSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        if (ex.name !== name) return;
        (ex.sets || []).forEach(set => {
          if (!set?.completed || set.type === 'warmup') return;
          const w = parseFloat(set.weight) || 0;
          const r = parseInt(set.reps, 10) || 0;
          if (w > 0 && r > 0) { exVol += w * r; exSets++; }
        });
      });
    });
    if (exSets > 0) lines.push(`  Sets de trabajo: ${exSets} · Volumen: ${formatVolume(exVol)}`);
  }

  lines.push('');
  lines.push('## Resumen');
  if (blockSessions.length === 0) {
    lines.push('Sin sesiones atribuidas al bloque en este período.');
  } else {
    lines.push(`- Volumen total: ${formatVolume(totalVolume)}`);
    const weekKeys = Object.keys(weeklyVolume).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
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
