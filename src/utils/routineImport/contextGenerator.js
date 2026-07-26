import { db } from '../../db/database';
import { getActiveBlocks, getSessionCountsByBlock } from '../../db/blocks';
import { formatSetSummary } from '../formatters';

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const formatShortDate = (iso) => {
  if (!iso) return '?';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_ES[d.getMonth()]}`;
};

// Anchored to the start of the name, validated against 17 real Bloque 2A session
// names (variants: casing, plural "Piernas", trailing "— BLOQUE 2A · SEM N" suffixes,
// even a truncated name). Anything that doesn't match falls into "Sin clasificar" —
// declared and visible, never silently forced into the wrong bucket.
const SESSION_TYPE_PATTERNS = [
  { label: 'Pierna A', pattern: /^piernas?\s+a\b/i },
  { label: 'Pierna B', pattern: /^piernas?\s+b\b/i },
  { label: 'Torso A',  pattern: /^torsos?\s+a\b/i },
  { label: 'Torso B',  pattern: /^torsos?\s+b\b/i },
];

const classifySessionType = (name) => {
  const trimmed = String(name || '').trim();
  const match = SESSION_TYPE_PATTERNS.find(p => p.pattern.test(trimmed));
  return match ? match.label : 'Sin clasificar';
};

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
    const [activeBlocks, sessionCounts, allHistoryForBlocks] = await Promise.all([
      getActiveBlocks(),
      getSessionCountsByBlock(),
      db.history.toArray(),
    ]);
    if (activeBlocks.length > 0) {
      lines.push('## Bloques de entrenamiento activos');
      for (const b of activeBlocks) {
        const p = b.params || {};
        const repsStr = p.repsRange ? `${p.repsRange[0]}-${p.repsRange[1]} reps` : '';
        const rpeStr = p.rpeRange ? `RPE ${p.rpeRange[0]}-${p.rpeRange[1]}` : '';
        const logged = sessionCounts.get(b.id) || 0;
        const sessStr = `${logged}${b.sessionsTarget ? `/${b.sessionsTarget}` : ''} sesiones`;
        const parts = [repsStr, rpeStr, sessStr].filter(Boolean).join(', ');
        lines.push(`  - ${b.name} (${b.type})${parts ? `: ${parts}` : ''}`);
        if (Array.isArray(b.appliesTo) && b.appliesTo.length) {
          lines.push(`    Tags: ${b.appliesTo.join(', ')}`);
        }
      }
      lines.push('');

      // Descriptive only: reports what was done, per session type, within each
      // active block. Never suggests what's next — that's the Coach's call.
      for (const b of activeBlocks) {
        const blockSessions = allHistoryForBlocks.filter(
          s => Array.isArray(s.blockIds) && s.blockIds.includes(b.id)
        );
        if (blockSessions.length === 0) continue;

        const byType = new Map();
        for (const s of blockSessions) {
          const label = classifySessionType(s.name);
          const date = s.completedAt || s.createdAt || null;
          const entry = byType.get(label) || { count: 0, lastDate: null };
          entry.count++;
          if (date && (!entry.lastDate || date > entry.lastDate)) entry.lastDate = date;
          byType.set(label, entry);
        }
        const sortedTypes = [...byType.entries()].sort((a, b2) => b2[1].count - a[1].count);

        lines.push(activeBlocks.length > 1 ? `## Sesiones por tipo — ${b.name}` : '## Sesiones del bloque por tipo');
        for (const [label, entry] of sortedTypes) {
          lines.push(`  - ${label}: ${entry.count} (última: ${formatShortDate(entry.lastDate)})`);
        }
        lines.push('');
      }
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
