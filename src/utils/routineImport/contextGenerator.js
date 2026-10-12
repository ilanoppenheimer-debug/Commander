import { db } from '../../db/database';
import { getActiveBlocks, getSessionCountsByBlock } from '../../db/blocks';
import { formatSetSummary } from '../formatters';
import { getCompanion } from '../../constants/exerciseMetadata';
import { localDateStr } from '../localDate';
import { normalizeExerciseName } from '../exerciseName';
import { resolveExerciseTag } from '../blockReport';
import { collectAppearances, formatLatestEntry, formatShortDate, extractPrefix } from '../exerciseHistoryLines';

// The "how big was this set" axis for topSet selection below — weight for loaded/
// bodyweight sets, seconds for time-measured sets (which never carry a real weight).
// A single exercise is one measurement type per its exerciseMetadata, so in practice
// this never has to compare weight against seconds within the same exercise's sets —
// same accepted caveat as blockReport.js's bestSetForExercise for a mid-stream
// reconfigured exercise.
const bestAxisValue = (s) => {
  const w = parseFloat(s?.weight) || 0;
  if (w > 0) return w;
  return parseFloat(s?.seconds) || 0;
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

// What gets PRINTED: the session type exactly as the athlete wrote it ("DL", "LEGS",
// "Pierna A"), whitespace-collapsed by extractPrefix and nothing else — no case
// change, no singularization.
export const classifySessionType = (name) => extractPrefix(name) || 'Sin clasificar';

// What gets GROUPED: case/plural-insensitive, so legacy names like "Piernas A" and
// "Pierna A" (both exist in block 2A's history) still count as one type. The
// singularized form lives only in this key; it is never shown, so it can't rename a
// type the athlete wrote on purpose.
const sessionTypeKey = (name) => {
  const prefix = extractPrefix(name);
  return prefix ? singularizeFirstWord(prefix).toLowerCase() : 'sin clasificar';
};

// Most recent session attributed to this block, regardless of whether it carries
// sessionNum — old sessions predate that field, and reaching further back for a stale
// one that happens to have it would misreport which cycle the Coach is actually in.
const getLastSessionNum = (blockId, allHistory) => {
  const matches = (Array.isArray(allHistory) ? allHistory : [])
    .filter(s => Array.isArray(s.blockIds) && s.blockIds.includes(blockId))
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  return matches[0]?.sessionNum ?? null;
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
    const key = sessionTypeKey(s.name);
    const date = s.completedAt || s.createdAt || null;
    const entry = byType.get(key) || { count: 0, lastDate: null, label: classifySessionType(s.name) };
    entry.count++;
    // The printed label is the variant used by the most recent session of the group.
    if (date && (!entry.lastDate || date > entry.lastDate)) {
      entry.lastDate = date;
      entry.label = classifySessionType(s.name);
    }
    byType.set(key, entry);
  }
  return [...byType.values()]
    .map(({ label, count, lastDate }) => ({ label, count, lastDate }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Generates a text block of current training context to paste into Claude Project.
 * All data comes from local Dexie — no external calls.
 */
export const generateCoachContext = async () => {
  const lines = [];

  lines.push('=== CONTEXTO PARA COACH ===');
  lines.push(`Fecha: ${localDateStr(new Date())}`);
  lines.push('');

  // ── Última sesión ──────────────────────────────────────────────────────────
  try {
    const allHistory = await db.history.orderBy('completedAt').reverse().toArray();

    if (allHistory.length > 0) {
      const last = allHistory[0];
      const date = localDateStr(last.completedAt || last.createdAt);
      const exes = Array.isArray(last.exercises) ? last.exercises : [];

      lines.push(`## Última sesión: ${last.name || 'Sin nombre'} (${date})`);
      // Every exercise is listed; one with no completed set carrying data (nothing to
      // summarize) is skipped, and the header says so instead of counting it as listed.
      const entries = [];
      for (const ex of exes) {
        if (!ex?.name || !Array.isArray(ex.sets)) continue;
        const completed = ex.sets.filter(s => s?.completed && bestAxisValue(s) > 0);
        if (completed.length === 0) continue;
        const topSet = completed.reduce((best, s) =>
          bestAxisValue(s) > bestAxisValue(best) ? s : best, completed[0]);
        entries.push(`  - ${ex.name}: ${formatSetSummary(topSet, 'kg', getCompanion(ex.name))}`);
      }
      const skipped = exes.length - entries.length;
      lines.push(`Ejercicios: ${entries.length}${skipped > 0 ? ` (${skipped} sin datos, omitido${skipped > 1 ? 's' : ''})` : ''}`);
      lines.push(...entries);
      lines.push('');
    }
  } catch { lines.push('(Error leyendo última sesión)\n'); }

  // ── Top sets recientes (8 semanas) ─────────────────────────────────────────
  try {
    const cutoff = Date.now() - 56 * 24 * 60 * 60 * 1000;
    const allHistory = await db.history.toArray();
    const recent = allHistory.filter(s => new Date(s.completedAt || s.createdAt || 0).getTime() > cutoff);

    if (recent.length > 0) {
      // Main lifts only: everything else (accessories, secondary, timed work) is covered
      // by "Últimos registros por ejercicio", which excludes mains — complementary, not
      // overlapping. Keyed by exercise identity (spelling variants are one exercise);
      // `name` is the spelling of the most recent session that has it.
      const topByEx = {};
      const latestNameAt = {};
      for (const session of recent) {
        const sessionTime = Date.parse(session.completedAt || session.createdAt || '') || 0;
        for (const ex of (Array.isArray(session.exercises) ? session.exercises : [])) {
          if (!ex?.name || resolveExerciseTag(ex) !== 'main_lift') continue;
          const key = normalizeExerciseName(ex.name);
          if (!(key in latestNameAt) || sessionTime >= latestNameAt[key].t) latestNameAt[key] = { name: ex.name, t: sessionTime };
          const target = topByEx;
          for (const s of (Array.isArray(ex.sets) ? ex.sets : [])) {
            const value = bestAxisValue(s);
            if (value <= 0) continue;
            // Best = heaviest; same weight -> more reps; same reps -> most recent. The
            // history array comes in key order, not chronological, so without the
            // explicit tiebreak the winner of a tie was whichever session came first.
            const reps = parseInt(s.reps, 10) || 0;
            const cur = target[key];
            const better = !cur || value > cur.value
              || (value === cur.value && (reps > cur.repsNum || (reps === cur.repsNum && sessionTime > cur.t)));
            if (better) {
              target[key] = {
                value, repsNum: reps, t: sessionTime, weight: s.weight, reps: s.reps, rpe: s.rpe, seconds: s.seconds, companionValue: s.companionValue,
                date: localDateStr(session.completedAt),
              };
            }
          }
        }
      }
      for (const key of Object.keys(topByEx)) topByEx[key].name = latestNameAt[key].name;

      const rankedEntries = (byEx) => Object.entries(byEx)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 10);

      const pushSection = (title, entries) => {
        if (entries.length === 0) return;
        lines.push(title);
        for (const [, s] of entries) {
          lines.push(`  - ${s.name}: ${formatSetSummary(s, 'kg', getCompanion(s.name))}${s.date ? ` (${s.date})` : ''}`);
        }
        lines.push('');
      };

      pushSection('## Top sets recientes (últimas 8 semanas)', rankedEntries(topByEx));
    }
  } catch { lines.push('(Error leyendo top sets)\n'); }

  // ── Últimos registros por ejercicio (8 semanas) ────────────────────────────
  // Everything that is NOT a main lift (accessories, secondary): the Coach only saw main
  // lifts above and had to guess accessory loads. One line per exercise with its latest
  // appearance, grouped under the session type of that appearance. Cap: none, for now.
  try {
    const sinceMs = Date.now() - 56 * 24 * 60 * 60 * 1000;
    const allHistory = await db.history.toArray();
    const byKey = collectAppearances(allHistory, {
      sinceMs,
      include: (ex) => resolveExerciseTag(ex) !== 'main_lift',
    });
    if (byKey.size > 0) {
      const groups = new Map(); // sessionTypeKey -> { label, entries: [{ time, text }] }
      for (const apps of byKey.values()) {
        const latest = apps[0];
        const gKey = sessionTypeKey(latest.sessionName);
        if (!groups.has(gKey)) groups.set(gKey, { label: classifySessionType(latest.sessionName), entries: [] });
        groups.get(gKey).entries.push({
          time: latest.time,
          text: `${latest.name} — ${formatLatestEntry(apps, getCompanion(latest.name))}`,
        });
      }
      lines.push('## Últimos registros por ejercicio (últimas 8 semanas, sin main lifts)');
      for (const g of [...groups.values()].sort((a, b) => b.entries.length - a.entries.length)) {
        lines.push(`${g.label}:`);
        for (const e of g.entries.sort((a, b) => b.time - a.time)) lines.push(`  - ${e.text}`);
      }
      lines.push('');
    }
  } catch { lines.push('(Error leyendo últimos registros por ejercicio)\n'); }

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
        const faseStr = b.fase ? `fase ${b.fase}` : '';
        const lastSessionNum = getLastSessionNum(b.id, allHistoryForBlocks);
        const sessionNumStr = lastSessionNum != null ? `última sesión: #${lastSessionNum}` : '';
        const parts = [repsStr, rpeStr, sessStr, faseStr, sessionNumStr].filter(Boolean).join(', ');
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
