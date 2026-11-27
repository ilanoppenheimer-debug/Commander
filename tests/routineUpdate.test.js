import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database.js';
import { planRoutineUpdate, diffRoutineVsSession, updateRoutineFromSession } from '../src/utils/routineUpdate.js';
import { findExistingTemplate } from '../src/utils/routineImport/converter.js';
import { useSessionStore } from '../src/stores/sessionStore.js';

// "Actualizar plantilla" desde una sesión: solo peso y reps; lo del Coach no se pierde y no se duplican ejercicios.
const cset = (o = {}) => ({ id: 's1', type: 'normal', weight: 100, reps: 5, rpe: '8', completed: false, notes: '', restSeconds: 150, planned: { reps: '3-5', rpeText: '8' }, plannedRpe: '7.5', targetSeconds: 30, ...o });
const routine = () => ({
  _id: 7, id: 'r-1', routineId: 'r-1', name: 'TORSO', isImported: true,
  exercises: [
    { id: 'e1', name: 'Press Banca', equipment: 'barbell', tag: 'main_lift', notes: 'Nota del Coach: pausa 1s', decisionAdaptativa: 'subir si RPE<8', restSeconds: 150,
      sets: [cset({ id: 's1' }), cset({ id: 's2', weight: 90 }), cset({ id: 's3', weight: 80 })] },
    { id: 'e2', name: 'Dominadas', equipment: 'bodyweight', tag: 'secondary', sets: [cset({ id: 's4', weight: 0, reps: 8 })] },
  ],
});
const done = (extra) => ({ weight: 105, reps: 5, rpe: '9', completed: true, type: 'normal', ...extra });

describe('planRoutineUpdate', () => {
  it('actualiza peso y reps de los sets completados y NO toca lo del Coach', () => {
    const session = { exercises: [{ id: 'e1', name: 'Press Banca', sets: [done({ weight: 105 }), done({ weight: 90, reps: 6 })] }] };
    const { exercises, changes } = planRoutineUpdate(routine(), session);
    const e1 = exercises[0];
    expect(e1.sets[0]).toMatchObject({ id: 's1', weight: 105, reps: 5, rpe: '8', restSeconds: 150, targetSeconds: 30, plannedRpe: '7.5', planned: { reps: '3-5', rpeText: '8' } });
    expect(e1.sets[1]).toMatchObject({ weight: 90, reps: 6, rpe: '8', restSeconds: 150 });
    expect(e1).toMatchObject({ notes: 'Nota del Coach: pausa 1s', decisionAdaptativa: 'subir si RPE<8', tag: 'main_lift', restSeconds: 150, equipment: 'barbell' });
    expect(changes.map((c) => c.type)).toEqual(['update_set', 'update_set']);
  });

  it('el RPE registrado en la sesión NO se copia a la plantilla', () => {
    const { exercises } = planRoutineUpdate(routine(), { exercises: [{ id: 'e1', name: 'Press Banca', sets: [done({ rpe: '10' })] }] });
    expect(exercises[0].sets[0].rpe).toBe('8');
  });

  it('los sets de la plantilla que la sesión no completó se mantienen (no se recorta la plantilla)', () => {
    const { exercises } = planRoutineUpdate(routine(), { exercises: [{ id: 'e1', name: 'Press Banca', sets: [done()] }] });
    expect(exercises[0].sets).toHaveLength(3);
    expect(exercises[0].sets[2]).toMatchObject({ id: 's3', weight: 80 });
  });

  it('un set de más se agrega, con el descanso del último set de la plantilla', () => {
    const sets = [done(), done({ weight: 90 }), done({ weight: 80 }), done({ weight: 70, reps: 8 })];
    const { exercises, changes } = planRoutineUpdate(routine(), { exercises: [{ id: 'e1', name: 'Press Banca', sets }] });
    expect(exercises[0].sets).toHaveLength(4);
    expect(exercises[0].sets[3]).toMatchObject({ weight: 70, reps: 8, rpe: '', restSeconds: 150, completed: false });
    expect(changes.some((c) => c.type === 'add_set')).toBe(true);
  });

  it('un ejercicio nuevo con sets completados se agrega SIN campos de runtime', () => {
    const nuevo = { id: 'x9', name: 'Curl', equipment: 'dumbbell', finishedAt: '2026-11-26T10:00:00Z', exerciseNotes: 'mía', sets: [done({ seconds: '30' })] };
    const { exercises, changes } = planRoutineUpdate(routine(), { exercises: [nuevo] });
    const curl = exercises.find((e) => e.name === 'Curl');
    expect('finishedAt' in curl).toBe(false);
    expect('exerciseNotes' in curl).toBe(false);
    expect(curl.sets[0]).toMatchObject({ weight: 105, reps: 5, completed: false, rpe: '' });
    expect('seconds' in curl.sets[0]).toBe(false);
    expect(changes[0].type).toBe('add_exercise');
    expect(exercises.filter((e) => e.name === 'Press Banca')).toHaveLength(1);
  });

  it('REGRESIÓN (fila dañada del backup): un ejercicio repetido en la sesión no duplica el de la plantilla', () => {
    // 6 apariciones de "Press Banca" en la sesión (ids propios: se agregaron a mano) + el original por id.
    const rep = (i) => ({ id: `n${i}`, name: 'Press Banca', sets: [done({ weight: 60 + i })] });
    const session = { exercises: [{ id: 'e1', name: 'Press Banca', sets: [done()] }, rep(1), rep(2), rep(3), rep(4), rep(5)] };
    const { exercises } = planRoutineUpdate(routine(), session);
    // el de la plantilla queda UNA vez; las apariciones extra entran como ejercicios nuevos, no como copias del existente
    expect(exercises.filter((e) => e.id === 'e1')).toHaveLength(1);
    expect(exercises.filter((e) => e.name === 'Press Banca')).toHaveLength(6);
    expect(exercises).toHaveLength(2 + 5);
  });

  it('empareja por id primero y por nombre después, sin reutilizar un ejercicio ya emparejado', () => {
    const session = { exercises: [{ id: 'zz', name: 'Dominadas', sets: [done({ weight: 6, reps: 9 })] }, { id: 'e2', name: 'Dominadas', sets: [done({ weight: 5, reps: 10 })] }] };
    const { exercises } = planRoutineUpdate(routine(), session);
    // 'e2' (por id) actualiza la plantilla; 'zz' (mismo nombre, sin ejercicio libre) entra como nuevo
    expect(exercises.find((e) => e.id === 'e2').sets[0].reps).toBe(10);
    expect(exercises.filter((e) => e.name === 'Dominadas')).toHaveLength(2);
  });

  it('peso corporal sin lastre: un set completado con peso 0 (o vacío) también actualiza las reps', () => {
    const session = { exercises: [{ id: 'e2', name: 'Dominadas', sets: [done({ weight: 0, reps: 10 })] }] };
    const { exercises, changes } = planRoutineUpdate(routine(), session);
    expect(exercises.find((e) => e.id === 'e2').sets[0]).toMatchObject({ id: 's4', weight: 0, reps: 10, restSeconds: 150, targetSeconds: 30 });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: 'update_set', exerciseName: 'Dominadas', before: { reps: 8 }, after: { reps: 10 } });
    const vacio = { exercises: [{ id: 'e2', name: 'Dominadas', sets: [done({ weight: '', reps: '12' })] }] };
    expect(planRoutineUpdate(routine(), vacio).exercises.find((e) => e.id === 'e2').sets[0]).toMatchObject({ weight: 0, reps: 12 });
  });

  it('peso corporal: sets de más y ejercicios nuevos con peso 0 también entran; un set sin reps no cuenta', () => {
    const sets = [done({ weight: 0, reps: 10 }), done({ weight: 0, reps: 9 }), done({ weight: 0, reps: 0 })];
    const { exercises, changes } = planRoutineUpdate(routine(), { exercises: [{ id: 'e2', name: 'Dominadas', sets }] });
    expect(exercises.find((e) => e.id === 'e2').sets).toHaveLength(2); // 10 actualiza el set 1, 9 se agrega; reps 0 no cuenta
    expect(changes.map((c) => c.type)).toEqual(['update_set', 'add_set']);
    const nuevo = planRoutineUpdate(routine(), { exercises: [{ id: 'n1', name: 'Fondos', sets: [done({ weight: 0, reps: 12 })] }] });
    expect(nuevo.exercises.find((e) => e.name === 'Fondos').sets[0]).toMatchObject({ weight: 0, reps: 12 });
    expect(nuevo.changes[0].type).toBe('add_exercise');
  });

  it('sin sets completados no cambia nada; entradas inválidas no rompen', () => {
    const r = routine();
    const { exercises, changes } = planRoutineUpdate(r, { exercises: [{ id: 'e1', name: 'Press Banca', sets: [{ weight: 100, reps: 5, completed: false }] }] });
    expect(changes).toEqual([]);
    expect(exercises).toEqual(r.exercises);
    expect(planRoutineUpdate(null, null).changes).toEqual([]);
  });

  it('no muta la plantilla ni la sesión', () => {
    const r = routine(); const copia = JSON.parse(JSON.stringify(r));
    const s = { exercises: [{ id: 'e1', name: 'Press Banca', sets: [done()] }] }; const sCopia = JSON.parse(JSON.stringify(s));
    planRoutineUpdate(r, s);
    expect(r).toEqual(copia); expect(s).toEqual(sCopia);
  });

  it('diffRoutineVsSession (lo que muestra el modal) es exactamente plan.changes', () => {
    const s = { exercises: [{ id: 'e1', name: 'Press Banca', sets: [done(), done({ weight: 91 })] }] };
    expect(diffRoutineVsSession(routine(), s)).toEqual(planRoutineUpdate(routine(), s).changes);
  });
});

describe('updateRoutineFromSession (Dexie)', () => {
  beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

  it('actualiza la MISMA fila (sin duplicarla), conserva el Coach y marca lastUpdatedAt', async () => {
    const { _id, ...r } = routine();
    await db.routines.add(r);
    const antes = await db.routines.toArray();
    const res = await updateRoutineFromSession('r-1', { exercises: [{ id: 'e1', name: 'Press Banca', sets: [done({ weight: 110 })] }] });
    expect(res.ok).toBe(true);
    const filas = await db.routines.toArray();
    expect(filas).toHaveLength(1);
    expect(filas[0]._id).toBe(antes[0]._id);
    expect(filas[0].lastUpdatedAt).toBeTruthy();
    expect(filas[0].exercises[0].sets[0]).toMatchObject({ weight: 110, restSeconds: 150, targetSeconds: 30, rpe: '8' });
    expect(filas[0].exercises[0].notes).toBe('Nota del Coach: pausa 1s');
    expect((await db.backups.toArray()).some((b) => b.trigger === 'pre-routine-update-from-session')).toBe(true);
  });

  it('plantilla inexistente → error sin escribir', async () => {
    expect(await updateRoutineFromSession('nope', { exercises: [] })).toMatchObject({ ok: false, reason: 'routine-not-found' });
  });
});

describe('findExistingTemplate (wizard de import)', () => {
  beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });
  const add = (name, extra = {}) => db.routines.add({ routineId: `r-${name}-${Math.random()}`, id: 'x', name, exercises: [], createdAt: '2026-10-01T00:00:00Z', ...extra });

  it('compara por nombre normalizado (mayúsculas, tildes y espacios)', async () => {
    await add('Pierna Á');
    expect((await findExistingTemplate({ name: '  PIERNA a ' })).name).toBe('Pierna Á');
    expect(await findExistingTemplate({ name: 'OTRA' })).toBeNull();
  });
  it('prefiere la ACTIVA sobre una archivada con el mismo nombre', async () => {
    await add('LEGS', { archived: true, createdAt: '2026-11-11T00:00:00Z' });
    await add('Legs', { createdAt: '2026-10-09T00:00:00Z' });
    expect((await findExistingTemplate({ name: 'legs' })).archived).toBeFalsy();
  });
  it('si solo hay archivadas, devuelve la más reciente; entre activas, la más reciente', async () => {
    await add('DL', { archived: true, createdAt: '2026-10-01T00:00:00Z' });
    const nueva = await add('dl', { archived: true, createdAt: '2026-10-20T00:00:00Z' });
    expect((await findExistingTemplate({ name: 'DL' }))._id).toBe(nueva);
  });
});

describe('keepRpe: isImported', () => {
  const imp = (extra = {}) => ({ id: 'r', name: 'X', isImported: true, exercises: [{ id: 'e', name: 'A', sets: [{ id: 's', weight: 1, reps: 1, rpe: '8' }] }], ...extra });
  const rpeAlIniciar = (r) => { useSessionStore.getState().startSession(r); return useSessionStore.getState().session.exercises[0].sets[0].rpe; };
  it('importada: conserva el RPE del Coach', () => { expect(rpeAlIniciar(imp())).toBe('8'); });
  it('importada que ya pasó por "Actualizar plantilla" (lastUpdatedAt): también lo conserva (el flujo nuevo no copia RPE)', () => {
    expect(rpeAlIniciar(imp({ lastUpdatedAt: '2026-10-29T00:00:00Z' }))).toBe('8');
  });
  it('plantilla guardada de una sesión (no importada): se vacía', () => { expect(rpeAlIniciar(imp({ isImported: false }))).toBe(''); });
});
