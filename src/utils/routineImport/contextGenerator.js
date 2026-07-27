import { db } from '../../db/database';
import { getActiveBlocks, getSessionCountsByBlock } from '../../db/blocks';
import { formatSetSummary } from '../formatters';

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const formatShortDate = (iso) => {
  if (!iso) return '?';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_ES[d.getMonth()]}`;
};

// The type is whatever comes before the first "—" or "·" separator, or the whole
// name if there's no separator. No vocabulary hardcoded — survives the Coach
// renaming session types across blocks (2A's "Pierna/Torso" won't necessarily be
// 2B's or 3's).
const extractPrefix = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const sepMatch = raw.match(/[—·]/);
  const prefix = sepMatch ? raw.slice(0, sepMatch.index) : raw;
  return prefix.trim().replace(/\s+/g, ' ');
};

// Naive singular normalization on the first word only, so "Piernas A" and "Pierna A"
// group together without hardcoding any vocabulary. Guarded by a minimum length so
// short first words ("Gas", "Vas") aren't mangled. Same plural/singular tolerance the
// old Pierna/Torso-specific regex had, generalized instead of hardcoded.
const singularizeFirstWord = (str) => {
  const words = str.split(' ');
  const first = words[0] || '';
  if (first.length > 3 && /s$/i.test(first)) {
    words[0] = first.slice(0, -1);
  }
  return words.join(' ');
};

const toTitleCase = (str) => str.toLowerCase().replace(/(^|[\s/])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

// Case/plural-insensitive by construction: two names that differ only in casing or a
// trailing "s" on the first word produce the identical output string, so grouping by
// this value (as a plain Map key) merges them without a separate normalization step.
export const classifySessionType = (name) => {
  const prefix = extractPrefix(name);
  if (!prefix) return 'Sin clasificar';
  return toTitleCase(singularizeFirstWord(prefix));
};

// Pure/sync — groups a block's sessions (matched by blockIds, exact) by derived type,
// sorted by count descending. Shared between generateCoachContext (below) and the
// home screen (App.jsx), so there's one place that knows how to do this, not two.
export const getSessionTypeBreakdown = (blockId, allHistory) => {
  const blockSessions = (Array.isArray(allHistory) ? allHistory : []).filter(
    s => Array.isArray(s.blockIds) && s.blockIds.includes(blockId)
  );
  const byType = new Map();
  for (const s of blockSessions) {
    const label = classifySessionType(s.name);
    const date = s.completedAt || s.createdAt || null;
    const entry = byType.get(label) || { count: 0, lastDate: null };
    entry.count++;
    if (date && (!entry.lastDate || date > entry.lastDate)) entry.lastDate = date;
    byType.set(label, entry);
  }
  return [...byType.entries()]
    .map(([label, entry]) => ({ label, count: entry.count, lastDate: entry.lastDate }))
    .sort((a, b) => b.count - a.count);
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
        const sortedTypes = getSessionTypeBreakdown(b.id, allHistoryForBlocks);
        if (sortedTypes.length === 0) continue;

        lines.push(activeBlocks.length > 1 ? `## Sesiones por tipo — ${b.name}` : '## Sesiones del bloque por tipo');
        for (const { label, count, lastDate } of sortedTypes) {
          lines.push(`  - ${label}: ${count} (última: ${formatShortDate(lastDate)})`);
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
