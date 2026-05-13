import { db } from '../../db/database';
import { getActiveBlocks } from '../../db/blocks';
import { formatSetSummary } from '../formatters';

/**
 * Generates a text block of current training context to paste into Claude Project.
 * All data comes from local Dexie — no external calls.
 */
export const generateCoachContext = async () => {
  const lines = [];

  lines.push('=== CONTEXTO PARA COACH ===');
  lines.push(`Fecha: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // ── Última sesión ──────────────────────────────────────────────────────────
  try {
    const allHistory = await db.history.orderBy('completedAt').reverse().toArray();

    if (allHistory.length > 0) {
      const last = allHistory[0];
      const date = (last.completedAt || last.createdAt || '').slice(0, 10);
      const exes = Array.isArray(last.exercises) ? last.exercises : [];

      lines.push(`## Última sesión: ${last.name || 'Sin nombre'} (${date})`);
      lines.push(`Ejercicios: ${exes.length}`);

      for (const ex of exes.slice(0, 6)) {
        if (!ex?.name || !Array.isArray(ex.sets)) continue;
        const completed = ex.sets.filter(s => s?.completed && parseFloat(s?.weight) > 0);
        if (completed.length === 0) continue;
        const topSet = completed.reduce((best, s) =>
          (parseFloat(s.weight) || 0) > (parseFloat(best.weight) || 0) ? s : best, completed[0]);
        lines.push(`  - ${ex.name}: ${formatSetSummary(topSet)}`);
      }
      lines.push('');
    }
  } catch { lines.push('(Error leyendo última sesión)\n'); }

  // ── Top sets recientes (4 semanas) ─────────────────────────────────────────
  try {
    const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
    const allHistory = await db.history.toArray();
    const recent = allHistory.filter(s => new Date(s.completedAt || s.createdAt || 0).getTime() > cutoff);

    if (recent.length > 0) {
      const topByEx = {};
      for (const session of recent) {
        for (const ex of (Array.isArray(session.exercises) ? session.exercises : [])) {
          if (!ex?.name) continue;
          for (const s of (Array.isArray(ex.sets) ? ex.sets : [])) {
            const w = parseFloat(s?.weight);
            if (!w || w <= 0) continue;
            if (!topByEx[ex.name] || w > topByEx[ex.name].weight) {
              topByEx[ex.name] = { weight: w, reps: s.reps, rpe: s.rpe, date: (session.completedAt || '').slice(0, 10) };
            }
          }
        }
      }

      const entries = Object.entries(topByEx)
        .sort((a, b) => b[1].weight - a[1].weight)
        .slice(0, 10);

      if (entries.length > 0) {
        lines.push('## Top sets recientes (últimas 4 semanas)');
        for (const [name, s] of entries) {
          lines.push(`  - ${name}: ${formatSetSummary(s)}${s.date ? ` (${s.date})` : ''}`);
        }
        lines.push('');
      }
    }
  } catch { lines.push('(Error leyendo top sets)\n'); }

  // ── Bloques activos ────────────────────────────────────────────────────────
  try {
    const activeBlocks = await getActiveBlocks();
    if (activeBlocks.length > 0) {
      lines.push('## Bloques de entrenamiento activos');
      for (const b of activeBlocks) {
        const p = b.params || {};
        const repsStr = p.repsRange ? `${p.repsRange[0]}-${p.repsRange[1]} reps` : '';
        const rpeStr = p.rpeRange ? `RPE ${p.rpeRange[0]}-${p.rpeRange[1]}` : '';
        const sessStr = b.sessionsLogged != null
          ? `${b.sessionsLogged}${b.sessionsTarget ? `/${b.sessionsTarget}` : ''} sesiones`
          : '';
        const parts = [repsStr, rpeStr, sessStr].filter(Boolean).join(', ');
        lines.push(`  - ${b.name} (${b.type})${parts ? `: ${parts}` : ''}`);
        if (Array.isArray(b.appliesTo) && b.appliesTo.length) {
          lines.push(`    Tags: ${b.appliesTo.join(', ')}`);
        }
      }
      lines.push('');
    }
  } catch { lines.push('(Error leyendo bloques)\n'); }

  // ── Frecuencia ─────────────────────────────────────────────────────────────
  try {
    const allHistory = await db.history.toArray();
    const now = Date.now();
    const last7  = allHistory.filter(s => now - new Date(s.completedAt || 0).getTime() < 7  * 86400000).length;
    const last14 = allHistory.filter(s => now - new Date(s.completedAt || 0).getTime() < 14 * 86400000).length;
    lines.push('## Frecuencia de entrenamiento');
    lines.push(`  - Últimos 7 días: ${last7} sesiones`);
    lines.push(`  - Últimas 2 semanas: ${last14} sesiones`);
    lines.push(`  - Total registrado: ${allHistory.length} sesiones`);
    lines.push('');
  } catch { /* ignore */ }

  lines.push('=== FIN CONTEXTO ===');
  return lines.join('\n');
};
