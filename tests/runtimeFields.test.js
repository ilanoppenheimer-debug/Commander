import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stripRuntimeFields } from '../src/utils/runtimeFields.js';
import { useSessionStore } from '../src/stores/sessionStore.js';
import { generateSessionReport } from '../src/utils/sessionExport.js';
import { db } from '../src/db/database.js';

// Una plantilla guardada con "Guardar como plantilla" arrastraba campos de la sesión que la generó. Datos sintéticos.
const OLD = '2026-10-12T17:10:14.452Z';
const dirtySet = (extra = {}) => ({ id: 's1', type: 'normal', weight: 0, reps: 0, rpe: '8', completed: true, notes: '', restSeconds: 90, ...extra });
const dirtyTemplate = (extra = {}) => ({
  id: 'r-acc', name: 'ACCESORIOS', exercises: [
    { id: 'e1', name: 'Curl Martillo', equipment: 'dumbbell', notes: 'Nota del Coach: codo pegado', decisionAdaptativa: 'subir si RPE<8', tag: 'accessory', restSeconds: 60,
      finishedAt: OLD, exerciseNotes: 'me dolió el codo',
      sets: [dirtySet({ planned: { reps: '8-10', rpeText: '8' }, plannedRpe: '7.5', targetSeconds: 30, seconds: '30', companionValue: '2' })] },
    { id: 'e2', name: 'Elevación Lateral', equipment: 'dumbbell', finishedAt: '2026-10-12T17:40:00.000Z', sets: [dirtySet()] },
  ], ...extra,
});

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); useSessionStore.setState({ session: null, hydrated: false, lastDeleted: null }); });
afterEach(() => vi.useRealTimers());

describe('stripRuntimeFields', () => {
  it('quita los campos de runtime del ejercicio y del set', () => {
    const [e1] = stripRuntimeFields(dirtyTemplate().exercises);
    expect('finishedAt' in e1).toBe(false);
    expect('exerciseNotes' in e1).toBe(false);
    const s = e1.sets[0];
    for (const k of ['seconds', 'companionValue']) expect(k in s, k).toBe(false);
    expect(s.completed).toBe(false);
    expect(s.rpe).toBe('');
  });

  it('NO toca lo del Coach: notes / decisionAdaptativa del ejercicio y planned / plannedRpe / targetSeconds / restSeconds / type del set', () => {
    const [e1] = stripRuntimeFields(dirtyTemplate().exercises);
    expect(e1.notes).toBe('Nota del Coach: codo pegado');
    expect(e1.decisionAdaptativa).toBe('subir si RPE<8');
    expect(e1).toMatchObject({ id: 'e1', name: 'Curl Martillo', equipment: 'dumbbell', tag: 'accessory', restSeconds: 60 });
    expect(e1.sets[0]).toMatchObject({ id: 's1', type: 'normal', restSeconds: 90, targetSeconds: 30, plannedRpe: '7.5', planned: { reps: '8-10', rpeText: '8' } });
  });

  it('notes (Coach) y exerciseNotes (atleta) son campos distintos: solo se va el del atleta', () => {
    const [e] = stripRuntimeFields([{ id: 'x', name: 'X', notes: 'coach', exerciseNotes: 'atleta', sets: [] }]);
    expect(e.notes).toBe('coach');
    expect('exerciseNotes' in e).toBe(false);
  });

  it('keepRpe conserva el rpe prescrito por el Coach (rutina importada)', () => {
    const [e1] = stripRuntimeFields(dirtyTemplate().exercises, { keepRpe: true });
    expect(e1.sets[0].rpe).toBe('8');
    expect(e1.sets[0].completed).toBe(false);
  });

  it('no muta la entrada y tolera datos raros', () => {
    const t = dirtyTemplate();
    const copia = JSON.parse(JSON.stringify(t));
    stripRuntimeFields(t.exercises);
    expect(t).toEqual(copia);
    expect(stripRuntimeFields(undefined)).toBeUndefined();
    expect(stripRuntimeFields([null, { id: 'a', sets: null }])).toEqual([null, { id: 'a', sets: null }]);
  });
});

describe('startSession desde una plantilla "sucia"', () => {
  it('arranca limpia: ningún ejercicio cerrado, sets sin completar ni resultados de la sesión anterior', () => {
    useSessionStore.getState().startSession(dirtyTemplate());
    const { exercises, routineId } = useSessionStore.getState().session;
    expect(routineId).toBe('r-acc');
    for (const e of exercises) {
      expect(e.finishedAt, e.name).toBeUndefined();
      expect('exerciseNotes' in e).toBe(false);
      for (const s of e.sets) { expect(s.completed).toBe(false); expect(s.rpe).toBe(''); expect('seconds' in s).toBe(false); }
    }
    expect(exercises[0].notes).toBe('Nota del Coach: codo pegado');
    expect(exercises[0].sets[0].targetSeconds).toBe(30);
  });

  it('una rutina importada conserva su rpe (es el del Coach)', () => {
    useSessionStore.getState().startSession(dirtyTemplate({ isImported: true }));
    expect(useSessionStore.getState().session.exercises[0].sets[0].rpe).toBe('8');
  });

  it('"Finalizar ejercicio" cierra al primer toque (antes lo des-cerraba, porque ya venía con finishedAt)', () => {
    useSessionStore.getState().startSession(dirtyTemplate());
    const id = useSessionStore.getState().session.exercises[0].id;
    useSessionStore.getState().finishExercise(id);
    expect(useSessionStore.getState().session.exercises[0].finishedAt).toBeTruthy();
    useSessionStore.getState().finishExercise(id);
    expect(useSessionStore.getState().session.exercises[0].finishedAt).toBeNull();
  });

  it('el botón no puede mostrar minutos negativos: ningún finishedAt queda anterior al inicio de la sesión', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-25T15:00:00Z'));
    useSessionStore.getState().startSession(dirtyTemplate());
    const { exercises, startTime } = useSessionStore.getState().session;
    const stale = exercises.filter((e) => e.finishedAt && new Date(e.finishedAt) < new Date(startTime));
    expect(stale).toEqual([]);
  });
});

describe('el reporte de sesión no imprime tiempos gigantes', () => {
  const mins = (txt) => [...txt.matchAll(/Tiempo(?: superset \w+ \(\d+ ejercicios\))?: (-?\d+) min/g)].map((m) => Number(m[1]));

  it('sesión iniciada desde una plantilla vieja y cerrada hoy: todos los "Tiempo:" son de minutos, no de semanas', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-25T15:00:00Z'));
    useSessionStore.getState().startSession(dirtyTemplate());
    const id1 = useSessionStore.getState().session.exercises[0].id;
    const id2 = useSessionStore.getState().session.exercises[1].id;
    vi.setSystemTime(new Date('2026-11-25T15:12:00Z')); useSessionStore.getState().finishExercise(id1);
    vi.setSystemTime(new Date('2026-11-25T15:30:00Z')); useSessionStore.getState().finishExercise(id2);
    const s = { ...useSessionStore.getState().session, completedAt: '2026-11-25T15:31:00.000Z' };
    s.exercises = s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, weight: 10, reps: 10, completed: true })) }));
    const t = mins(generateSessionReport(s));
    expect(t).toEqual([12, 18]);
  });

  it('control: sin limpiar (finishedAt viejo heredado), el mismo flujo SÍ produciría un tiempo gigante', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-25T15:00:00Z'));
    const sucio = dirtyTemplate().exercises.map((e) => ({ ...e }));
    const s = { name: 'T', startTime: '2026-11-25T15:00:00.000Z', completedAt: '2026-11-25T15:31:00.000Z',
      exercises: [sucio[0], { ...sucio[1], finishedAt: '2026-11-25T15:30:00.000Z', sets: [dirtySet({ weight: 10, reps: 10 })] }] };
    s.exercises[0].sets = [dirtySet({ weight: 10, reps: 10 })];
    expect(Math.max(...mins(generateSessionReport(s)))).toBeGreaterThan(10000);
  });
});
