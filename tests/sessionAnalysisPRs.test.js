import { describe, it, expect } from 'vitest';
import { findPRs } from '../src/utils/sessionAnalysis.js';
import { ex, session, st } from './fixtures/builders.js';

// Análisis post-sesión: el récord de 1RM solo con carga comparable (isComparable1RMEquipment: barra, mancuerna,
// multipower y landmine). El récord de peso vale con cualquier implemento.
const prs = (equipment, prev, now) => findPRs(
  [ex('Remo Landmine', equipment, { sets: [now] })],
  [session('2026-06-01T15:00:00Z', [ex('Remo Landmine', equipment, { sets: [prev] })])],
);
const kinds = (r) => r.flatMap((p) => p.records.map((x) => x.kind)).sort();

describe('findPRs — récord de 1RM por implemento', () => {
  it.each(['barbell', 'dumbbell', 'smith', 'landmine'])('con %s hay récord de peso y de 1RM', (eq) => {
    expect(kinds(prs(eq, st(40, 8, 8), st(45, 8, 8)))).toEqual(['1RM', 'weight']);
  });

  it.each(['machine', 'cable', 'bodyweight', 'kettlebell', 'band'])('con %s hay récord de peso, pero no de 1RM', (eq) => {
    expect(kinds(prs(eq, st(40, 8, 8), st(45, 8, 8)))).toEqual(['weight']);
  });

  it('la primera vez con un implemento no hay nada que superar', () => {
    expect(findPRs([ex('Remo Landmine', 'landmine', { sets: [st(40, 8, 8)] })], [])).toEqual([]);
  });

  it('los récords son por implemento: la landmine no se compara con la barra', () => {
    const r = findPRs(
      [ex('Remo con Barra', 'landmine', { sets: [st(30, 8, 8)] })],
      [session('2026-06-01T15:00:00Z', [ex('Remo con Barra', 'barbell', { sets: [st(80, 8, 8)] })])],
    );
    expect(r).toEqual([]);
  });
});
