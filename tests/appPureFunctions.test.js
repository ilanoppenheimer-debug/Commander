import { describe, it, expect } from 'vitest';
import { DURATION_ALARM_THRESHOLD_SEC } from '../src/constants/sessionConstants.js';
import { countSessionSets } from '../src/utils/sessionStats.js';
import { getSessionFase } from '../src/utils/sessionFase.js';
import { filterAndSortHistory } from '../src/utils/historyFilter.js';
import { nextCopyName } from '../src/utils/routineNaming.js';
import { attributeBlocks, buildCompletedSession } from '../src/utils/sessionCompletion.js';

// Funciones puras que vivían dentro de App.jsx (refactor E1). Datos 100% sintéticos.
const set = (weight, reps, extra = {}) => ({ weight, reps, ...extra });
const exo = (name, sets, extra = {}) => ({ name, sets, ...extra });
const hist = (name, completedAt, exercises = []) => ({ name, completedAt, exercises });

describe('DURATION_ALARM_THRESHOLD_SEC', () => {
  it('son 4 horas', () => expect(DURATION_ALARM_THRESHOLD_SEC).toBe(4 * 3600));
});

describe('countSessionSets', () => {
  it('cuenta series completadas o con reps/peso reales; ignora vacías', () => {
    const s = { exercises: [
      exo('A', [set('', '', { completed: true }), set(100, 5), set('', 8), set(50, ''), set('', ''), set(0, 0), set('x', 'y')]),
      exo('B', [set(40, 10, { completed: false })]),
    ] };
    expect(countSessionSets(s)).toBe(5); // completada, 100x5, 8 reps, solo peso 50, 40x10
  });
  it('tolera null/undefined y estructuras incompletas', () => {
    expect(countSessionSets(null)).toBe(0);
    expect(countSessionSets({})).toBe(0);
    expect(countSessionSets({ exercises: [null, { sets: null }, { sets: [null] }] })).toBe(0);
  });
});

describe('getSessionFase', () => {
  const blocksById = new Map([
    ['b1', { id: 'b1', fase: 'fuerza_maxima' }],
    ['b2', { id: 'b2', fase: 'hipertrofia' }],
    ['b3', { id: 'b3' }],
  ]);
  it('un solo bloque → fase con espacios', () => {
    expect(getSessionFase({ blockIds: ['b1'] }, blocksById)).toBe('fuerza maxima');
  });
  it('0 o 2+ bloques → undefined (no adivina)', () => {
    expect(getSessionFase({ blockIds: [] }, blocksById)).toBeUndefined();
    expect(getSessionFase({ blockIds: ['b1', 'b2'] }, blocksById)).toBeUndefined();
  });
  it('sin blockIds, bloque inexistente o sin fase → undefined', () => {
    expect(getSessionFase({}, blocksById)).toBeUndefined();
    expect(getSessionFase(null, blocksById)).toBeUndefined();
    expect(getSessionFase({ blockIds: ['nope'] }, blocksById)).toBeUndefined();
    expect(getSessionFase({ blockIds: ['b3'] }, blocksById)).toBeUndefined();
  });
});

describe('filterAndSortHistory', () => {
  const now = new Date('2026-06-30T12:00:00Z').getTime();
  const h = [
    hist('Pierna A', '2026-06-28T10:00:00Z', [exo('Sentadilla', [set(100, 5)])]),            // vol 500
    hist('Torso B', '2026-06-01T10:00:00Z', [exo('Press Banca', [set(60, 10), set(60, 10)])]), // vol 1200
    hist('Pierna C', '2025-01-01T10:00:00Z', [exo('Sentadilla', [set(80, 5)])]),              // vol 400
  ];
  const opts = (o = {}) => ({ search: '', exFilter: '', period: 'all', sort: 'newest', ...o });
  const names = (r) => r.map((x) => x.name);

  it('orden por defecto: más nuevo primero', () => {
    expect(names(filterAndSortHistory(h, opts(), now))).toEqual(['Pierna A', 'Torso B', 'Pierna C']);
  });
  it('oldest y volume', () => {
    expect(names(filterAndSortHistory(h, opts({ sort: 'oldest' }), now))).toEqual(['Pierna C', 'Torso B', 'Pierna A']);
    expect(names(filterAndSortHistory(h, opts({ sort: 'volume' }), now))).toEqual(['Torso B', 'Pierna A', 'Pierna C']);
  });
  it('búsqueda por nombre sin distinguir mayúsculas', () => {
    expect(names(filterAndSortHistory(h, opts({ search: 'PIERNA' }), now))).toEqual(['Pierna A', 'Pierna C']);
  });
  it('filtro por ejercicio', () => {
    expect(names(filterAndSortHistory(h, opts({ exFilter: 'Press Banca' }), now))).toEqual(['Torso B']);
  });
  it('períodos: week / month / year', () => {
    expect(names(filterAndSortHistory(h, opts({ period: 'week' }), now))).toEqual(['Pierna A']);
    expect(names(filterAndSortHistory(h, opts({ period: 'month' }), now))).toEqual(['Pierna A', 'Torso B']);
    expect(names(filterAndSortHistory(h, opts({ period: 'year' }), now))).toEqual(['Pierna A', 'Torso B']);
  });
  it('no muta el arreglo de entrada', () => {
    const copy = h.slice();
    filterAndSortHistory(h, opts({ sort: 'oldest' }), now);
    expect(h).toEqual(copy);
  });
  it('sesión sin completedAt no se filtra por período', () => {
    const r = filterAndSortHistory([hist('Sin fecha', undefined)], opts({ period: 'week' }), now);
    expect(names(r)).toEqual(['Sin fecha']);
  });
});

describe('nextCopyName', () => {
  const rs = (...names) => names.map((name) => ({ name }));
  it('primera copia', () => expect(nextCopyName('Pierna', rs('Pierna'))).toBe('Pierna (copia)'));
  it('segunda y tercera copia', () => {
    expect(nextCopyName('Pierna', rs('Pierna', 'Pierna (copia)'))).toBe('Pierna (copia 2)');
    expect(nextCopyName('Pierna', rs('Pierna (copia)', 'Pierna (copia 2)'))).toBe('Pierna (copia 3)');
  });
  it('clonar una copia no anida el sufijo', () => {
    expect(nextCopyName('Pierna (copia 2)', rs('Pierna', 'Pierna (copia)', 'Pierna (copia 2)'))).toBe('Pierna (copia 3)');
  });
  it('escapa caracteres de regex en el nombre', () => {
    expect(nextCopyName('A+B (x)', rs('A+B (x) (copia)'))).toBe('A+B (x) (copia 2)');
  });
  it('sin nombre usa "Rutina"', () => expect(nextCopyName('', [])).toBe('Rutina (copia)'));
});

describe('attributeBlocks', () => {
  const blocks = [
    { id: 'fz', appliesTo: ['squat'] },
    { id: 'hp', appliesTo: ['bench'] },
    { id: 'x', appliesTo: [] },
  ];
  it('sin bloques activos → todo vacío', () => {
    expect(attributeBlocks([], [exo('A', [], { tag: 'squat' })])).toEqual({ blockIds: [], matchedBlocks: [], untaggedCount: 0 });
  });
  it('un voto por tag; los sin tag se cuentan aparte', () => {
    const exs = [exo('S', [], { tag: 'squat' }), exo('Z', [], { tag: 'squat' }), exo('Ejercicio inventado sin metadata', [])];
    const r = attributeBlocks(blocks, exs);
    expect(r.blockIds).toEqual(['fz']);
    expect(r.matchedBlocks).toEqual([blocks[0]]);
    expect(r.untaggedCount).toBe(1);
  });
  it('bloques paralelos: dos tags → dos bloques', () => {
    const r = attributeBlocks(blocks, [exo('S', [], { tag: 'squat' }), exo('B', [], { tag: 'bench' })]);
    expect(r.blockIds).toEqual(['fz', 'hp']);
  });
});

describe('buildCompletedSession', () => {
  const now = new Date('2026-06-30T12:00:00Z').getTime();
  const exercises = [exo('A', [set(100, 5, { completed: true })])];

  it('con startTime calcula durationSec y cierra el último ejercicio', () => {
    const session = { startTime: new Date(now - 45 * 60000).toISOString(), routineId: 'r1', sessionNum: 3 };
    const r = buildCompletedSession({ sessionName: 'Pierna', exercises, session, blockIds: ['fz'], now });
    expect(r).toMatchObject({
      historyId: `hist-${now}`, name: 'Pierna', completedAt: '2026-06-30T12:00:00.000Z',
      durationSec: 2700, routineId: 'r1', sessionNum: 3, blockIds: ['fz'],
    });
    expect(r.startTime).toBe(session.startTime);
    expect(r.exercises[0].finishedAt).toBe('2026-06-30T12:00:00.000Z');
  });
  it('sin startTime no hay duración; defaults de nombre/routineId/sessionNum', () => {
    const r = buildCompletedSession({ sessionName: '', exercises, session: null, blockIds: [], now });
    expect(r.name).toBe('Entrenamiento Libre');
    expect('durationSec' in r).toBe(false);
    expect('startTime' in r).toBe(false);
    expect(r.routineId).toBeNull();
    expect(r.sessionNum).toBeNull();
  });
  it('una sesión abierta más de 4 h supera el umbral de alarma', () => {
    const session = { startTime: new Date(now - 5 * 3600000).toISOString() };
    const r = buildCompletedSession({ sessionName: 'x', exercises, session, blockIds: [], now });
    expect(r.durationSec).toBeGreaterThan(DURATION_ALARM_THRESHOLD_SEC);
  });
});
