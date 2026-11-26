// Deduplicación de plantillas (tabla `routines`). PURA: recibe las filas tal como están en Dexie y devuelve el plan;
// no escribe nada. El IO está en db/migrations/migrateDedupeRoutines.js.
//
// Contexto: `routines` tiene clave autoincremental `_id` e índice NO único en `routineId`, así que varios imports en
// modo "replace" (antes de saveRoutine con upsert) dejaron varias filas con el mismo routineId, y "Guardar como
// plantilla" dejó copias de las mismas rutinas por nombre.
//
// Tres pasadas, en este orden (cada una opera sobre lo que dejó la anterior):
//  1. Por routineId queda UNA fila: la de import más reciente (importedAt, o createdAt si no hay; desempate: mayor
//     _id). Las demás se ELIMINAN. El sobreviviente hereda el lastPerformed más reciente del grupo.
//     (No se usa updatedAt/lastUpdatedAt: "Actualizar plantilla" puede dejar una fila dañada con fecha reciente.)
//  2. Entre las ACTIVAS, por nombre normalizado (sin mayúsculas ni tildes): gana el import más reciente; si no hay
//     import en el grupo, la de lastPerformed más reciente (fallback createdAt). Las demás se ARCHIVAN.
//  3. Entre las activas que quedan: si hay un bloque activo con startedAt, se ARCHIVAN las que no tienen
//     lastPerformed ni import desde ese inicio. Sin bloque activo, no hace nada.
// Las ya archivadas no se tocan.

import { normalizeRoutineName } from './routineNaming';

export { normalizeRoutineName };

const ms = (x) => { const t = x ? Date.parse(x) : NaN; return Number.isFinite(t) ? t : 0; };
const importDate = (r) => ms(r.importedAt || r.createdAt);
const byRecencyDesc = (score) => (a, b) => score(b) - score(a) || (b._id ?? 0) - (a._id ?? 0);

/** Fecha desde la que cuenta el uso en la pasada 3: el startedAt más antiguo entre los bloques activos (el más conservador). */
export const activeBlockStart = (blocks) => {
  const starts = (Array.isArray(blocks) ? blocks : [])
    .filter((b) => b?.status === 'active' && b.startedAt && ms(b.startedAt) > 0)
    .map((b) => b.startedAt);
  if (!starts.length) return null;
  return starts.reduce((min, s) => (ms(s) < ms(min) ? s : min));
};

export const planRoutineDedupe = (rows, { blockStart = null } = {}) => {
  const all = (Array.isArray(rows) ? rows : []).filter(Boolean);

  // ── Pasada 1 ──
  const byId = new Map();
  for (const r of all) {
    const key = r.routineId ?? r.id;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(r);
  }
  const pass1 = { groups: [], remove: [], inherit: [] };
  const survivors = [];
  for (const [routineId, group] of byId) {
    const sorted = [...group].sort(byRecencyDesc(importDate));
    const keep = sorted[0];
    survivors.push(keep);
    if (group.length < 2) continue;
    const remove = sorted.slice(1);
    pass1.groups.push({ routineId, keep, remove });
    pass1.remove.push(...remove);
    const best = group.reduce((m, r) => (ms(r.lastPerformed) > ms(m) ? r.lastPerformed : m), null);
    if (best && ms(best) > ms(keep.lastPerformed)) pass1.inherit.push({ row: keep, lastPerformed: best, before: keep.lastPerformed });
  }
  const inheritedLP = new Map(pass1.inherit.map((i) => [i.row._id, i.lastPerformed]));
  // Estado de los sobrevivientes después de la pasada 1 (con el lastPerformed heredado).
  const view = (r) => (inheritedLP.has(r._id) ? { ...r, lastPerformed: inheritedLP.get(r._id) } : r);
  const afterPass1 = survivors.map(view);

  // ── Pasada 2 ──
  const active1 = afterPass1.filter((r) => !r.archived);
  const byName = new Map();
  for (const r of active1) {
    const k = normalizeRoutineName(r.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  const pass2 = { groups: [], archive: [] };
  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    const imports = group.filter((r) => r.isImported);
    const pool = imports.length ? imports : group;
    const score = imports.length ? importDate : (r) => ms(r.lastPerformed) || ms(r.createdAt);
    const winner = [...pool].sort(byRecencyDesc(score))[0];
    const archive = group.filter((r) => r !== winner);
    pass2.groups.push({ name, winner, archive, byImport: imports.length > 0 });
    pass2.archive.push(...archive);
  }
  const archivedIn2 = new Set(pass2.archive.map((r) => r._id));

  // ── Pasada 3 ──
  const pass3 = { since: blockStart || null, archive: [] };
  const active2 = active1.filter((r) => !archivedIn2.has(r._id));
  if (blockStart) {
    const since = ms(blockStart);
    for (const r of active2) {
      const usedSince = ms(r.lastPerformed) >= since && ms(r.lastPerformed) > 0;
      const importedSince = !!r.isImported && importDate(r) >= since;
      if (!usedSince && !importedSince) pass3.archive.push(r);
    }
  }
  const archivedIn3 = new Set(pass3.archive.map((r) => r._id));
  const finalActive = active2.filter((r) => !archivedIn3.has(r._id)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es') || a._id - b._id);

  const archivedBefore = all.filter((r) => r.archived).length;
  const noop = !pass1.remove.length && !pass1.inherit.length && !pass2.archive.length && !pass3.archive.length;
  return {
    noop, pass1, pass2, pass3, finalActive,
    summary: {
      before: { rows: all.length, active: all.length - archivedBefore, archived: archivedBefore },
      after: {
        rows: survivors.length, active: finalActive.length,
        archived: survivors.filter((r) => r.archived).length + pass2.archive.length + pass3.archive.length,
      },
      removed: pass1.remove.length, archivedByName: pass2.archive.length, archivedByBlock: pass3.archive.length, inherited: pass1.inherit.length,
    },
  };
};
