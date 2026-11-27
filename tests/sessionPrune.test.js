import { describe, it, expect } from 'vitest';
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
