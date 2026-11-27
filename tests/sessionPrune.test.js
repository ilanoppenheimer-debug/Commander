import { describe, it, expect } from 'vitest';
import { generateSessionReport } from '../src/utils/sessionExport.js';
import { hasCompletedSets, pruneUnperformedExercises } from '../src/utils/sessionCompletion.js';

const e = (name, ...c) => ({ name, sets: c.map((completed) => ({ completed })) });

describe('pruneUnperformedExercises', () => {
  it('descarta ejercicios sin ninguna serie completada y conserva el resto con sus series no completadas', () => {
    const out = pruneUnperformedExercises([e('A', true, false), e('B', false), e('C'), e('D', true)]);
    expect(out.map((x) => x.name)).toEqual(['A', 'D']);
    expect(out[0].sets).toHaveLength(2);
  });
  it('entradas inválidas → []', () => {
    expect(pruneUnperformedExercises(null)).toEqual([]);
    expect(pruneUnperformedExercises([null, {}, { sets: 'x' }])).toEqual([]);
    expect(hasCompletedSets(undefined)).toBe(false);
  });
});

describe('pruneUnperformedExercises: supersets', () => {
  const sx = (name, supersetId, done) => ({ ...e(name, done), supersetId });

  it('superset de 2 con uno sin series: el restante queda suelto (sin supersetId) y el reporte imprime "Tiempo:" normal', () => {
    const out = pruneUnperformedExercises([sx('A1', 'ss-A', true), sx('A2', 'ss-A', false), sx('Z', null, true)]);
    expect(out.map((x) => x.name)).toEqual(['A1', 'Z']);
    expect(out[0].supersetId ?? null).toBeNull();

    const t = (min) => new Date(Date.parse('2026-06-12T14:00:00.000Z') + min * 60000).toISOString();
    const withSets = out.map((x, i) => ({ ...x, equipment: 'barbell', finishedAt: t(10 * (i + 1)), sets: [{ weight: 50, reps: 5, completed: true }] }));
    const r = generateSessionReport({ name: 'X', completedAt: t(30), startTime: t(0), exercises: withSets });
    expect(r).toContain('  Tiempo: 10 min');
    expect(r).not.toMatch(/superset/i);
  });

  it('superset de 3 que pierde uno sigue siendo superset de 2 (mismo id)', () => {
    const out = pruneUnperformedExercises([sx('B1', 'ss-B', true), sx('B2', 'ss-B', false), sx('B3', 'ss-B', true)]);
    expect(out.map((x) => [x.name, x.supersetId])).toEqual([['B1', 'ss-B'], ['B3', 'ss-B']]);
  });

  it('no toca otros grupos ni al resto de las propiedades del ejercicio', () => {
    const a = { ...sx('C1', 'ss-C', true), notes: 'n' };
    const out = pruneUnperformedExercises([a, sx('C2', 'ss-C', true), sx('D1', 'ss-D', true), sx('D2', 'ss-D', false)]);
    expect(out[0]).toBe(a);
    expect(out[2]).toMatchObject({ name: 'D1', supersetId: null });
  });
});
