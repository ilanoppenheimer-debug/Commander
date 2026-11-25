import { db } from '../database';
import { logger } from '../../services/logger';
import { planRoutineDedupe, activeBlockStart } from '../../utils/routineDedupe';

// Deduplicación de plantillas. Toda la lógica es la función pura planRoutineDedupe (ver utils/routineDedupe.js);
// este archivo es solo el IO alrededor.
//
// NO corre al arrancar: se dispara desde Datos, después de revisar la tabla del dry-run y descargar un backup, y
// además hace su propio backup automático (obligatorio: si falla, no se toca nada). Idempotente: con el flag
// puesto, o con datos que ya no tienen nada para hacer, no escribe. Es una migración NUEVA: no edita ninguna
// anterior. Las eliminaciones son solo de filas con el mismo routineId que un sobreviviente (el routineId sigue
// existiendo, así que el historial y las sesiones activas siguen enlazadas); el resto solo se ARCHIVA.

export const DEDUPE_ROUTINES_FLAG = 'routinesDedupeV1';

const loadState = async () => {
  const [rows, blocks] = await Promise.all([db.routines.toArray(), db.blocks.toArray()]);
  return { rows, blockStart: activeBlockStart(blocks) };
};

/** Solo lectura: qué haría ahora sobre los datos actuales. No escribe. */
export const previewRoutineDedupe = async () => {
  const { rows, blockStart } = await loadState();
  const flag = await db.settings.get(DEDUPE_ROUTINES_FLAG);
  return { plan: planRoutineDedupe(rows, { blockStart }), appliedAt: flag?.value?.appliedAt || null };
};

export const summarizeRoutineDedupe = (plan) => ({ ...plan.summary });

/**
 * Aplica el plan. Aborta sin escribir si: ya se aplicó, no hay nada para hacer o falla el backup automático.
 * Escribe en UNA transacción (todo o nada), guarda en `settings` el registro para el rollback (las filas
 * eliminadas verbatim y los valores previos de lo que se archivó / heredó) y re-planifica sobre lo guardado: tiene
 * que dar un plan vacío.
 */
export const applyRoutineDedupe = async () => {
  const flag = await db.settings.get(DEDUPE_ROUTINES_FLAG);
  if (flag?.value?.appliedAt) return { ok: true, ran: false, reason: 'already-applied' };

  const { rows, blockStart } = await loadState();
  const plan = planRoutineDedupe(rows, { blockStart });
  if (plan.noop) return { ok: true, ran: false, reason: 'nothing-to-do' };

  try {
    const { createAutoBackup } = await import('../../services/backupService');
    const backup = await createAutoBackup('pre-routine-dedupe');
    if (!backup?.success) return { ok: false, reason: 'backup-failed', error: backup?.error };
  } catch (e) {
    return { ok: false, reason: 'backup-failed', error: String(e) };
  }

  const removed = plan.pass1.remove;
  const removedPk = removed.map((r) => r._id);
  const archive = [
    ...plan.pass2.archive.map((r) => ({ row: r, pass: 2 })),
    ...plan.pass3.archive.map((r) => ({ row: r, pass: 3 })),
  ];
  const record = {
    appliedAt: new Date().toISOString(),
    blockStart,
    removed,                                                        // filas verbatim: el rollback las reinserta
    archived: archive.map(({ row, pass }) => ({ _id: row._id, pass, hadArchived: 'archived' in row, archivedBefore: row.archived })),
    inherited: plan.pass1.inherit.map((i) => ({ _id: i.row._id, hadLastPerformed: 'lastPerformed' in i.row, before: i.row.lastPerformed, after: i.lastPerformed })),
  };

  try {
    await db.transaction('rw', db.routines, db.settings, async () => {
      if (removedPk.length) await db.routines.bulkDelete(removedPk);
      // Es un arreglo de datos, no una edición: las filas conservan su _id y su updatedAt.
      for (const i of plan.pass1.inherit) await db.routines.update(i.row._id, { lastPerformed: i.lastPerformed });
      for (const { row } of archive) await db.routines.update(row._id, { archived: true });
      await db.settings.put({ key: DEDUPE_ROUTINES_FLAG, value: record });
    });
  } catch (e) {
    logger.error('migrateDedupeRoutines failed while writing', { error: String(e) });
    return { ok: false, reason: 'write-failed', error: String(e) };
  }

  const after = await loadState();
  const recheck = planRoutineDedupe(after.rows, { blockStart: after.blockStart });
  const expected = plan.summary.after;
  const got = recheck.summary.before;
  if (!recheck.noop || got.rows !== expected.rows || got.active !== expected.active || got.archived !== expected.archived) {
    logger.error('migrateDedupeRoutines: post-check failed', { noop: recheck.noop, expected, got });
    return { ok: false, reason: 'post-check-failed', hint: 'Restaurá el backup descargado.' };
  }
  logger.info('migrateDedupeRoutines applied', plan.summary);
  return { ok: true, ran: true, summary: summarizeRoutineDedupe(plan) };
};

/**
 * Deshace lo aplicado, usando el registro guardado: reinserta las filas eliminadas con su _id original y revierte
 * SOLO los campos que se tocaron (archived, lastPerformed) en las demás, sin pisar ediciones posteriores.
 */
export const rollbackRoutineDedupe = async () => {
  const flag = await db.settings.get(DEDUPE_ROUTINES_FLAG);
  const rec = flag?.value;
  if (!rec?.appliedAt) return { ok: false, reason: 'not-applied' };
  try {
    await db.transaction('rw', db.routines, db.settings, async () => {
      if (rec.removed?.length) await db.routines.bulkPut(rec.removed);
      for (const a of rec.archived || []) {
        const row = await db.routines.get(a._id);
        if (!row) continue;
        const next = { ...row };
        if (a.hadArchived) next.archived = a.archivedBefore; else delete next.archived;
        await db.routines.put(next);
      }
      for (const i of rec.inherited || []) {
        const row = await db.routines.get(i._id);
        if (!row) continue;
        const next = { ...row };
        if (i.hadLastPerformed) next.lastPerformed = i.before; else delete next.lastPerformed;
        await db.routines.put(next);
      }
      await db.settings.delete(DEDUPE_ROUTINES_FLAG);
    });
  } catch (e) {
    logger.error('rollbackRoutineDedupe failed', { error: String(e) });
    return { ok: false, reason: 'rollback-failed', error: String(e) };
  }
  return { ok: true, restored: rec.removed?.length || 0 };
};
