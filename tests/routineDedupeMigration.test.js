import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../src/db/database.js';
import { previewRoutineDedupe, applyRoutineDedupe, rollbackRoutineDedupe, DEDUPE_ROUTINES_FLAG } from '../src/db/migrations/migrateDedupeRoutines.js';

// El backup automático se puede forzar a fallar; si no, pasa al real (así se verifica que de verdad se guarda).
const ctl = vi.hoisted(() => ({ failBackup: false }));
vi.mock('../src/services/backupService.js', async (orig) => {
  const m = await orig();
  return { ...m, createAutoBackup: (t) => (ctl.failBackup ? Promise.resolve({ success: false, error: 'boom' }) : m.createAutoBackup(t)) };
});

// Migración de deduplicación de plantillas sobre Dexie en memoria. Datos sintéticos.
const ex = (n = 1) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, name: `Ej ${i}`, sets: [] }));
const seed = async () => {
  await db.routines.bulkAdd([
    { routineId: 'L', id: 'L', name: 'LEGS', isImported: true, importedAt: '2026-10-09T00:00:00Z', createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z', exercises: ex(7) },
    { routineId: 'L', id: 'L', name: 'LEGS', isImported: true, importedAt: '2026-11-11T00:00:00Z', createdAt: '2026-11-11T00:00:00Z', updatedAt: '2026-11-11T00:00:00Z', exercises: ex(8) },
    { routineId: 'routine-t1', id: 'routine-t1', name: 'LEGS', createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z', lastPerformed: '2026-10-16T00:00:00Z', exercises: ex(3) },
    { routineId: 'P', id: 'P', name: 'PUSH', isImported: true, importedAt: '2026-10-07T00:00:00Z', createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z', exercises: ex(5) },
    { routineId: 'routine-old', id: 'routine-old', name: 'Piernas A', createdAt: '2026-04-26T00:00:00Z', updatedAt: '2026-07-20T00:00:00Z', lastPerformed: '2026-04-26T00:00:00Z', exercises: ex(2) },
    { routineId: 'A', id: 'A', name: 'ARCH', archived: true, isImported: true, importedAt: '2026-05-27T00:00:00Z', createdAt: '2026-05-27T00:00:00Z', exercises: ex(1) },
  ]);
  await db.blocks.put({ id: 'b3A', name: 'Bloque 3A', status: 'active', startedAt: '2026-10-05T00:00:00Z', appliesTo: ['main_lift'] });
  await db.history.bulkAdd([
    { historyId: 'h1', completedAt: '2026-10-20T10:00:00Z', name: 'LEGS', routineId: 'L', exercises: [{ name: 'Sentadilla', sets: [{ weight: 100, reps: 5, completed: true }] }] },
    { historyId: 'h2', completedAt: '2026-10-16T10:00:00Z', name: 'LEGS', routineId: 'routine-t1', exercises: [] },
  ]);
};
const dump = async () => ({
  routines: await db.routines.orderBy('_id').toArray(), history: await db.history.orderBy('_id').toArray(),
  blocks: await db.blocks.toArray(), settings: (await db.settings.toArray()).filter((s) => s.key !== DEDUPE_ROUTINES_FLAG),
});

beforeEach(async () => { ctl.failBackup = false; await Promise.all(db.tables.map((t) => t.clear())); await seed(); });

describe('previewRoutineDedupe', () => {
  it('es de solo lectura y calcula sobre los datos actuales', async () => {
    const antes = await dump();
    const { plan, appliedAt } = await previewRoutineDedupe();
    expect(await dump()).toEqual(antes);
    expect(appliedAt).toBeNull();
    expect((await previewRoutineDedupe()).applied).toBeNull();
    expect(plan.summary).toMatchObject({ removed: 1, archivedByName: 1 });
    expect(plan.pass3.since).toBe('2026-10-05T00:00:00Z');
  });
});

describe('el registro sobrevive a recargar', () => {
  it('después de aplicar, preview informa lo aplicado (con el registro en la base) hasta que se deshace', async () => {
    await applyRoutineDedupe();
    // "recargar" = una lectura nueva: el registro vive en Dexie, no en memoria
    const p = await previewRoutineDedupe();
    expect(p.applied).toMatchObject({ removed: 1, archived: 2, inherited: 0 });
    expect(p.appliedAt).toBeTruthy();
    await rollbackRoutineDedupe();
    expect((await previewRoutineDedupe()).applied).toBeNull();
  });
});

describe('applyRoutineDedupe', () => {
  it('elimina las repetidas, archiva por nombre y por bloque, y hereda lastPerformed', async () => {
    const r = await applyRoutineDedupe();
    expect(r).toMatchObject({ ok: true, ran: true });
    const rows = await db.routines.orderBy('_id').toArray();
    expect(rows).toHaveLength(5); // sale 1 (LEGS del 9-oct)
    const by = (name) => rows.find((x) => x.name === name);
    expect(rows.filter((x) => x.name === 'LEGS' && !x.archived)).toHaveLength(1);
    expect(rows.find((x) => x.name === 'LEGS' && !x.archived).exercises).toHaveLength(8); // el import más reciente
    expect(rows.find((x) => x.routineId === 'routine-t1').archived).toBe(true);            // misma nombre, no import
    expect(by('Piernas A').archived).toBe(true);                                          // sin uso desde el bloque
    expect(by('PUSH').archived).toBeUndefined();                                          // importada desde el inicio del bloque
    expect(by('ARCH').archived).toBe(true);                                               // ya estaba archivada
    expect((await previewRoutineDedupe()).plan.noop).toBe(true);
    expect((await db.settings.get(DEDUPE_ROUTINES_FLAG)).value.appliedAt).toBeTruthy();
  });

  it('el sobreviviente conserva _id y updatedAt (es un arreglo de datos, no una edición) y hereda el lastPerformed', async () => {
    await db.routines.where('routineId').equals('L').modify((x) => { if (x.exercises.length === 7) x.lastPerformed = '2026-10-12T00:00:00Z'; });
    const antes = await db.routines.toArray();
    const sob = antes.find((x) => x.routineId === 'L' && x.exercises.length === 8);
    await applyRoutineDedupe();
    const despues = await db.routines.get(sob._id);
    expect(despues.updatedAt).toBe(sob.updatedAt);
    expect(despues.lastPerformed).toBe('2026-10-12T00:00:00Z');
  });

  it('el historial, los bloques y el resto de los ajustes quedan intactos', async () => {
    const antes = await dump();
    await applyRoutineDedupe();
    const despues = await dump();
    expect(despues.history).toEqual(antes.history);
    expect(despues.blocks).toEqual(antes.blocks);
    expect(despues.settings).toEqual(antes.settings);
    // todo routineId del historial sigue existiendo entre las rutinas
    const rids = new Set((await db.routines.toArray()).map((r) => r.routineId));
    for (const h of despues.history) expect(rids.has(h.routineId), h.routineId).toBe(true);
  });

  it('hace un backup automático real con el estado ANTERIOR', async () => {
    await applyRoutineDedupe();
    const b = (await db.backups.toArray()).find((x) => x.trigger === 'pre-routine-dedupe');
    expect(b).toBeTruthy();
    expect(b.data.routines).toHaveLength(6);
  });

  it('si el backup falla, aborta sin escribir nada', async () => {
    ctl.failBackup = true;
    const antes = await dump();
    const r = await applyRoutineDedupe();
    expect(r).toMatchObject({ ok: false, reason: 'backup-failed' });
    expect(await dump()).toEqual(antes);
    expect(await db.settings.get(DEDUPE_ROUTINES_FLAG)).toBeUndefined();
  });

  it('es atómica: si falla la escritura del flag, no queda nada a medias', async () => {
    const antes = await dump();
    const spy = vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('disco lleno'));
    const r = await applyRoutineDedupe();
    spy.mockRestore();
    expect(r).toMatchObject({ ok: false, reason: 'write-failed' });
    expect(await dump()).toEqual(antes);
  });

  it('idempotente: una segunda corrida no escribe nada', async () => {
    await applyRoutineDedupe();
    const despues = await dump();
    const backupsAntes = await db.backups.count();
    const r2 = await applyRoutineDedupe();
    expect(r2).toMatchObject({ ok: true, ran: false, reason: 'already-applied' });
    expect(await dump()).toEqual(despues);
    expect(await db.backups.count()).toBe(backupsAntes);
  });

  it('sin nada para hacer no escribe (ni backup)', async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.routines.add({ routineId: 'x', id: 'x', name: 'X', exercises: ex(1) });
    const r = await applyRoutineDedupe();
    expect(r).toMatchObject({ ok: true, ran: false, reason: 'nothing-to-do' });
    expect(await db.backups.count()).toBe(0);
  });
});

describe('rollbackRoutineDedupe', () => {
  it('deja las plantillas exactamente como estaban (filas con su _id, archived y lastPerformed)', async () => {
    const antes = await dump();
    await applyRoutineDedupe();
    const r = await rollbackRoutineDedupe();
    expect(r).toMatchObject({ ok: true, restored: 1 });
    expect(await dump()).toEqual(antes);
    expect(await db.settings.get(DEDUPE_ROUTINES_FLAG)).toBeUndefined();
    expect((await previewRoutineDedupe()).plan.noop).toBe(false); // vuelve a haber algo para ordenar
  });

  it('no pisa ediciones posteriores: solo revierte archived / lastPerformed', async () => {
    await applyRoutineDedupe();
    const t = await db.routines.where('routineId').equals('routine-t1').first();
    await db.routines.update(t._id, { name: 'LEGS renombrada' });
    await rollbackRoutineDedupe();
    const despues = await db.routines.get(t._id);
    expect(despues.name).toBe('LEGS renombrada');
    expect('archived' in despues).toBe(false);
  });

  it('no toca lo creado o decidido después del orden: plantillas nuevas, desarchivadas a mano y lastPerformed nuevo', async () => {
    await db.routines.where('routineId').equals('L').modify((x) => { if (x.exercises.length === 7) x.lastPerformed = '2026-10-12T00:00:00Z'; });
    await applyRoutineDedupe();
    const nueva = await db.routines.add({ routineId: 'nueva', id: 'nueva', name: 'NUEVA', exercises: ex(2), createdAt: '2026-11-26T00:00:00Z' });
    const sob = await db.routines.where('routineId').equals('L').first();
    await db.routines.update(sob._id, { lastPerformed: '2026-11-25T00:00:00Z' });          // se usó después del orden
    const piernas = await db.routines.where('routineId').equals('routine-old').first();
    await db.routines.update(piernas._id, { archived: false });                           // la desarchivé a mano
    const r = await rollbackRoutineDedupe();
    expect(r.ok).toBe(true);
    expect((await db.routines.get(nueva)).name).toBe('NUEVA');                            // la creada después sigue
    expect((await db.routines.get(sob._id)).lastPerformed).toBe('2026-11-25T00:00:00Z');  // no vuelve al valor anterior
    expect((await db.routines.get(piernas._id)).archived).toBe(false);                    // su decisión se respeta
    expect(r.restored).toBe(1);                                                           // y la fila eliminada volvió
  });

  it('si el _id de una fila eliminada ya existe (backup restaurado en el medio), no la pisa', async () => {
    await applyRoutineDedupe();
    const rec = (await db.settings.get(DEDUPE_ROUTINES_FLAG)).value;
    await db.routines.put({ _id: rec.removed[0]._id, routineId: 'otra', id: 'otra', name: 'OTRA', exercises: [] });
    const r = await rollbackRoutineDedupe();
    expect(r).toMatchObject({ ok: true, restored: 0 });
    expect((await db.routines.get(rec.removed[0]._id)).name).toBe('OTRA');
  });

  it('sin nada aplicado, no hace nada', async () => {
    expect(await rollbackRoutineDedupe()).toMatchObject({ ok: false, reason: 'not-applied' });
  });
});
