import { describe, it, expect } from 'vitest';
import { generateSessionReport } from '../src/utils/sessionExport.js';
import { isSavableSet, hasSavableSets, countUnsavedSets, pruneUnperformedExercises } from '../src/utils/sessionCompletion.js';

// set: [completed, weight, reps, seconds]
const st = ([completed, weight = '', reps = '', seconds]) => ({ completed, weight, reps, ...(seconds !== undefined ? { seconds } : {}) });
const OK = [true, '50', '5'];
const e = (name, ...sets) => ({ name, sets: sets.map(st) });

describe('isSavableSet: completed === true Y con datos', () => {
  it('marcada con reps, peso o segundos → entra', () => {
    expect(isSavableSet(st([true, '50', '5']))).toBe(true);
    expect(isSavableSet(st([true, '0', '12']))).toBe(true);        // peso corporal: reps sin peso
    expect(isSavableSet(st([true, '80', '']))).toBe(true);         // peso sin reps
    expect(isSavableSet(st([true, '', '', 45]))).toBe(true);       // hold: segundos
  });
  it('NO marcada no entra aunque traiga valores (AMRAP que hereda 180 kg sin reps)', () => {
    expect(isSavableSet(st([false, '180', '']))).toBe(false);
    expect(isSavableSet(st([false, '50', '5']))).toBe(false);
    expect(isSavableSet(st([undefined, '50', '5']))).toBe(false);
    expect(isSavableSet({ weight: '50', reps: '5', completed: 'true' })).toBe(false); // estrictamente === true
  });
  it('marcada pero vacía no entra (DROP marcado sin datos → "PC×0")', () => {
    expect(isSavableSet(st([true, '', '']))).toBe(false);
    expect(isSavableSet(st([true, '0', '0']))).toBe(false);
    expect(isSavableSet(st([true, '0', '0', 0]))).toBe(false);
    expect(isSavableSet(null)).toBe(false);
  });
});

describe('pruneUnperformedExercises', () => {
  it('conserva solo las series guardables y descarta los ejercicios que se quedan sin ninguna', () => {
    const out = pruneUnperformedExercises([
      e('A', OK, [false, '180', ''], [true, '', '']),   // 1 buena, 1 sin marcar, 1 marcada vacía
      e('B', [false, '50', '5']),                         // solo sin marcar
      e('C', [true, '', '']),                             // solo marcada vacía
      e('D'),
      e('E', OK, OK),
    ]);
    expect(out.map((x) => x.name)).toEqual(['A', 'E']);
    expect(out[0].sets).toHaveLength(1);
    expect(out[1].sets).toHaveLength(2);
  });
  it('no muta la entrada', () => {
    const input = [e('A', OK, [false, '1', ''])];
    const copia = JSON.parse(JSON.stringify(input));
    pruneUnperformedExercises(input);
    expect(input).toEqual(copia);
  });
  it('entradas inválidas → []', () => {
    expect(pruneUnperformedExercises(null)).toEqual([]);
    expect(pruneUnperformedExercises([null, {}, { sets: 'x' }])).toEqual([]);
    expect(hasSavableSets(undefined)).toBe(false);
  });
});

describe('countUnsavedSets (el N del aviso)', () => {
  it('cuenta sin marcar + marcadas vacías, también en ejercicios que quedan fuera', () => {
    expect(countUnsavedSets([e('A', OK, [false, '180', ''], [true, '', '']), e('B', [false, '1', '1'])])).toBe(3);
  });
  it('0 si todo se guarda o no hay nada', () => {
    expect(countUnsavedSets([e('A', OK, OK)])).toBe(0);
    expect(countUnsavedSets([])).toBe(0);
    expect(countUnsavedSets(null)).toBe(0);
  });
});

describe('pruneUnperformedExercises: supersets', () => {
  const sx = (name, supersetId, ...sets) => ({ ...e(name, ...sets), supersetId });

  it('superset de 2 con uno sin series: el restante queda suelto (sin supersetId) y el reporte imprime "Tiempo:" normal', () => {
    const out = pruneUnperformedExercises([sx('A1', 'ss-A', OK), sx('A2', 'ss-A', [false, '50', '5']), sx('Z', null, OK)]);
    expect(out.map((x) => x.name)).toEqual(['A1', 'Z']);
    expect(out[0].supersetId ?? null).toBeNull();

    const t = (min) => new Date(Date.parse('2026-06-12T14:00:00.000Z') + min * 60000).toISOString();
    const withTimes = out.map((x, i) => ({ ...x, equipment: 'barbell', finishedAt: t(10 * (i + 1)) }));
    const r = generateSessionReport({ name: 'X', completedAt: t(30), startTime: t(0), exercises: withTimes });
    expect(r).toContain('  Tiempo: 10 min');
    expect(r).not.toMatch(/superset/i);
  });

  it('superset de 3 que pierde uno sigue siendo superset de 2 (mismo id)', () => {
    const out = pruneUnperformedExercises([sx('B1', 'ss-B', OK), sx('B2', 'ss-B', [true, '', '']), sx('B3', 'ss-B', OK)]);
    expect(out.map((x) => [x.name, x.supersetId])).toEqual([['B1', 'ss-B'], ['B3', 'ss-B']]);
  });

  it('no toca otros grupos', () => {
    const out = pruneUnperformedExercises([sx('C1', 'ss-C', OK), sx('C2', 'ss-C', OK), sx('D1', 'ss-D', OK), sx('D2', 'ss-D', [false, '5', '5'])]);
    expect(out.map((x) => [x.name, x.supersetId ?? null])).toEqual([['C1', 'ss-C'], ['C2', 'ss-C'], ['D1', null]]);
  });
});
