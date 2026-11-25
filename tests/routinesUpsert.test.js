import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database.js';
import { saveRoutine, deleteRoutine } from '../src/db/repository.js';
import { buildRoutineClone } from '../src/utils/routineNaming.js';
import { convertImportedToRoutine } from '../src/utils/routineImport/converter.js';

// Plantillas: clonar crea una fila nueva y saveRoutine hace upsert por routineId. Datos sintéticos.
// (La tabla routines tiene _id autoincremental y routineId SIN índice único: un put sin _id siempre inserta.)
beforeEach(() => db.routines.clear());

const rows = () => db.routines.orderBy('_id').toArray();
const ex = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, name: `Ejercicio ${i}`, sets: [] }));

describe('saveRoutine: upsert por routineId', () => {
  it('una rutina nueva se inserta', async () => {
    await saveRoutine({ id: 'r-1', name: 'LEGS', exercises: ex(1) });
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'r-1', routineId: 'r-1', name: 'LEGS' });
  });

  it('1 fila + 2 saves con el mismo id (import "replace") = 1 fila, con el último contenido', async () => {
    await saveRoutine({ id: 'imported-A', name: 'LEGS', exercises: ex(1) });
    await saveRoutine({ id: 'imported-A', name: 'LEGS', exercises: ex(2) });
    await saveRoutine({ id: 'imported-A', name: 'LEGS', exercises: ex(3) });
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].exercises).toHaveLength(3);
  });

  it('un replace por el import real (convertImportedToRoutine) actualiza la fila existente', async () => {
    await saveRoutine({ id: 'imported-A', name: 'LEGS', exercises: ex(1), isImported: true });
    const parsed = { id: 'imported-NEW', name: 'LEGS', exercises: [{ name: 'Sentadilla', sets: [{ weight: 100, reps: 5 }] }], _replaceTargetId: 'imported-A' };
    await convertImportedToRoutine(parsed, {}, {}, 'replace');
    await convertImportedToRoutine({ ...parsed }, {}, {}, 'replace');
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].routineId).toBe('imported-A');
    expect(r[0].exercises[0].name).toBe('Sentadilla');
  });

  it('un id distinto sigue insertando una fila nueva (modo "new")', async () => {
    await saveRoutine({ id: 'a', name: 'A', exercises: [] });
    await saveRoutine({ id: 'b', name: 'B', exercises: [] });
    expect(await rows()).toHaveLength(2);
  });

  it('si la rutina trae _id (edición desde la lista), actualiza esa fila', async () => {
    await saveRoutine({ id: 'a', name: 'A', exercises: [] });
    const [row] = await rows();
    await saveRoutine({ ...row, name: 'A renombrada' });
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ _id: row._id, name: 'A renombrada' });
  });

  it('replace conserva lastPerformed y deja archived = false (reimportar es para usarla)', async () => {
    await saveRoutine({ id: 'a', name: 'A', exercises: [], lastPerformed: '2026-10-01T10:00:00Z', archived: true });
    await saveRoutine({ id: 'a', name: 'A', exercises: ex(2) });
    let [r] = await rows();
    expect(r).toMatchObject({ lastPerformed: '2026-10-01T10:00:00Z', archived: false });
    expect(await rows()).toHaveLength(1);
    // si la entrante define los campos, mandan los suyos
    await saveRoutine({ id: 'a', name: 'A', exercises: ex(2), lastPerformed: null, archived: true });
    [r] = await rows();
    expect(r).toMatchObject({ lastPerformed: null, archived: true });
  });

  it('archivar / desarchivar desde la lista (con _id) sigue respetando el valor que se manda', async () => {
    await saveRoutine({ id: 'a', name: 'A', exercises: [] });
    let [row] = await rows();
    await saveRoutine({ ...row, archived: true });
    [row] = await rows();
    expect(row.archived).toBe(true);
    await saveRoutine({ ...row, archived: false });
    expect((await rows())[0].archived).toBe(false);
  });

  it('con duplicados ya existentes, actualiza UNA sola fila (la de mayor _id) y no toca las demás', async () => {
    // Estado heredado: varias filas con el mismo routineId (así llegaron al backup real).
    await db.routines.bulkAdd([
      { id: 'x', routineId: 'x', name: 'LEGS', exercises: ex(1) },
      { id: 'x', routineId: 'x', name: 'LEGS', exercises: ex(2) },
      { id: 'x', routineId: 'x', name: 'LEGS', exercises: ex(3) },
    ]);
    const antes = await rows();
    await saveRoutine({ id: 'x', name: 'LEGS v2', exercises: ex(5) });
    const despues = await rows();
    expect(despues).toHaveLength(3);
    expect(despues.map((r) => r._id)).toEqual(antes.map((r) => r._id));
    expect(despues[0]).toEqual(antes[0]);
    expect(despues[1]).toEqual(antes[1]);
    expect(despues[2]).toMatchObject({ name: 'LEGS v2' });
    expect(despues[2].exercises).toHaveLength(5);
  });

  it('deleteRoutine sigue borrando por routineId', async () => {
    await saveRoutine({ id: 'a', name: 'A', exercises: [] });
    await saveRoutine({ id: 'b', name: 'B', exercises: [] });
    await deleteRoutine('a');
    expect((await rows()).map((r) => r.id)).toEqual(['b']);
  });
});

describe('Clonar plantilla', () => {
  const opts = { id: 'routine-clon-1', now: '2026-11-25T12:00:00.000Z' };

  it('buildRoutineClone no arrastra _id / routineId / updatedAt ni lastPerformed', () => {
    const original = { _id: 52, id: 'r-52', routineId: 'r-52', name: 'DL (Plantilla)', exercises: ex(2), lastPerformed: '2026-10-01T10:00:00Z', updatedAt: '2026-10-29T10:00:00Z', createdAt: '2026-10-29T10:00:00Z' };
    const c = buildRoutineClone(original, [original], opts);
    expect('_id' in c).toBe(false);
    expect('routineId' in c).toBe(false);
    expect('updatedAt' in c).toBe(false);
    expect(c).toMatchObject({ id: 'routine-clon-1', name: 'DL (Plantilla) (copia)', lastPerformed: null, createdAt: opts.now });
    expect(c.exercises).toEqual(original.exercises);
    expect(original._id).toBe(52); // la original no se muta
  });

  it('clonar con filas leídas de la base (con _id) crea una fila nueva al final y deja la original intacta', async () => {
    await saveRoutine({ id: 'r-1', name: 'DL (Plantilla)', exercises: ex(2) });
    await saveRoutine({ id: 'r-2', name: 'TORSO (Plantilla)', exercises: ex(1) });
    const antes = await rows();
    const clon = buildRoutineClone(antes[0], antes, opts);
    await saveRoutine(clon);
    const despues = await rows();
    expect(despues).toHaveLength(3);
    expect(despues[0]).toEqual(antes[0]);
    expect(despues[1]).toEqual(antes[1]);
    expect(despues[2]).toMatchObject({ id: 'routine-clon-1', routineId: 'routine-clon-1', name: 'DL (Plantilla) (copia)' });
    expect(despues[2]._id).toBeGreaterThan(antes[1]._id);
  });

  it('tres clones seguidos: copia, copia 2, copia 3 — y el total de filas crece de a uno', async () => {
    await saveRoutine({ id: 'r-1', name: 'DL (Plantilla)', exercises: ex(1) });
    const nombres = [];
    for (let i = 1; i <= 3; i++) {
      const all = await rows();
      await saveRoutine(buildRoutineClone(all[0], all, { id: `clon-${i}`, now: opts.now }));
      nombres.push((await rows()).at(-1).name);
      expect(await rows()).toHaveLength(1 + i);
    }
    expect(nombres).toEqual(['DL (Plantilla) (copia)', 'DL (Plantilla) (copia 2)', 'DL (Plantilla) (copia 3)']);
    expect((await rows())[0].name).toBe('DL (Plantilla)');
  });
});
