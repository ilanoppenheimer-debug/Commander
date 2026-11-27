// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database.js';
import { markRoutinePerformed } from '../src/db/repository.js';

beforeEach(async () => { await db.routines.clear(); });

describe('markRoutinePerformed', () => {
  it('toca solo lastPerformed de la fila de mayor _id; no des-archiva ni cambia nada más', async () => {
    await db.routines.add({ id: 'r', routineId: 'r', name: 'X', archived: true, exercises: [{ id: 'e' }] });
    await db.routines.add({ id: 'r', routineId: 'r', name: 'X', archived: true, exercises: [{ id: 'e' }] });
    const antes = await db.routines.orderBy('_id').toArray();
    expect(await markRoutinePerformed('r', '2026-11-27T10:00:00.000Z')).toBe(true);
    const despues = await db.routines.orderBy('_id').toArray();
    expect(despues[0]).toEqual(antes[0]);
    expect(despues[1]).toEqual({ ...antes[1], lastPerformed: '2026-11-27T10:00:00.000Z' });
  });
  it('plantilla inexistente o id vacío: no hace nada', async () => {
    expect(await markRoutinePerformed('nope')).toBe(false);
    expect(await markRoutinePerformed(null)).toBe(false);
    expect(await db.routines.count()).toBe(0);
  });
});
