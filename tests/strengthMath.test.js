import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FORMULAS, calculate1RM, calculateTrainingWeight, RPE_CHART, estimate1RM, calcWorkWeight,
  isPredictiveSet, computeExercise1RM, getLastLoggedSet, getTopHistoricalSet, computeAll1RMs,
} from '../src/utils/strengthMath.js';
import { confianza1RM } from '../src/utils/sessionExport.js';
import { COMPARABLE_1RM_EQUIPMENT, isComparable1RMEquipment } from '../src/constants/gymConstants.js';
import { ex, session, st, setMeta } from './fixtures/builders.js';

// Contrato v1.8.4 §5 (1RM estimado): ventana móvil de 12 semanas, por nombre + implemento, N = sets
// válidos (sin warmup ni drop, peso > 0, reps 1-12, RPE ≥ 6, no incompletos, peso ≥ 50% del máximo).
const NOW = '2026-06-15T15:00:00Z';
const daysAgo = (d) => new Date(Date.parse(NOW) - d * 86400000).toISOString();

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe('fórmulas', () => {
  it('Epley, Brzycki e híbrida (valores calculados a mano)', () => {
    expect(FORMULAS.epley(100, 5)).toBeCloseTo(116.6667, 3);       // 100 × (1 + 5/30)
    expect(FORMULAS.brzycki(100, 5)).toBeCloseTo(112.5, 5);         // 100 × 36 / 32
    expect(FORMULAS.hybrid(100, 5)).toBeCloseTo((116.6667 + 112.5) / 2, 3);
  });

  it('calculate1RM suma las repeticiones en reserva (10 − RPE) a las reps', () => {
    expect(calculate1RM(100, 5, 10)).toBeCloseTo(116.6667, 3);
    expect(calculate1RM(100, 5, 8)).toBeCloseTo(100 * (1 + 7 / 30), 3);
    expect(calculate1RM(100, 5)).toBeCloseTo(116.6667, 3); // sin RPE = 10
  });

  it('con una sola repetición efectiva el 1RM es el peso', () => {
    expect(calculate1RM(140, 1, 10)).toBe(140);
    expect(calculate1RM(140, 0, 10)).toBe(140);
  });

  it('entradas no numéricas no rompen', () => {
    expect(calculate1RM('abc', 5, 8)).toBe(0);
    expect(calculate1RM(undefined, undefined)).toBe(0);
  });

  it('calculateTrainingWeight es la inversa de Epley', () => {
    const orm = calculate1RM(100, 5, 8);
    expect(calculateTrainingWeight(orm, 5, 8)).toBeCloseTo(100, 6);
  });
});

describe('tabla RPE (RTS)', () => {
  it('tiene 12 filas de repeticiones y 9 columnas de RPE (6 a 10 de a 0,5)', () => {
    expect(Object.keys(RPE_CHART)).toHaveLength(12);
    for (const row of Object.values(RPE_CHART)) expect(Object.keys(row).map(Number).sort((a, b) => a - b)).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
  });
  it('1 rep a RPE 10 es el 100 %', () => {
    expect(RPE_CHART[1][10]).toBe(1);
  });
  it('el porcentaje baja al subir las repeticiones y al bajar el RPE', () => {
    for (let r = 1; r < 12; r++) for (const rpe of [6, 8, 10]) expect(RPE_CHART[r][rpe]).toBeGreaterThan(RPE_CHART[r + 1][rpe]);
    for (let r = 1; r <= 12; r++) expect(RPE_CHART[r][10]).toBeGreaterThan(RPE_CHART[r][6]);
  });
});

describe('estimate1RM', () => {
  it('con RPE usa la tabla: 100 × 5 @ 8 = 100 / 0,84', () => {
    expect(estimate1RM(100, 5, 8)).toBeCloseTo(100 / 0.84, 6);
  });
  it('sin RPE cae a Epley', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 6);
    expect(estimate1RM(100, 5, '')).toBeCloseTo(100 * (1 + 5 / 30), 6);
  });
  it('un RPE fuera de 6-10 o más de 12 reps cae a Epley', () => {
    expect(estimate1RM(100, 5, 5)).toBeCloseTo(100 * (1 + 5 / 30), 6);
    expect(estimate1RM(100, 15, 8)).toBeCloseTo(100 * (1 + 15 / 30), 6);
  });
  it('el RPE se redondea al medio punto más cercano', () => {
    expect(estimate1RM(100, 5, 8.3)).toBeCloseTo(100 / RPE_CHART[5][8.5], 6);
    expect(estimate1RM(100, 5, 8.2)).toBeCloseTo(100 / RPE_CHART[5][8], 6);
  });
  it('peso o reps inválidos → null', () => {
    for (const [w, r] of [[0, 5], [-10, 5], [100, 0], [100, -1], ['x', 5], [100, 'x'], [undefined, undefined]]) {
      expect(estimate1RM(w, r, 8), `${w}×${r}`).toBeNull();
    }
  });
  it('acepta texto con números (como los guarda la app)', () => {
    expect(estimate1RM('100', '5', '8')).toBeCloseTo(100 / 0.84, 6);
  });
});

describe('calcWorkWeight', () => {
  it('es la inversa de estimate1RM sobre la tabla', () => {
    const orm = estimate1RM(100, 5, 8);
    expect(calcWorkWeight(orm, 5, 8)).toBeCloseTo(100, 6);
  });
  it('fuera de rango → null', () => {
    expect(calcWorkWeight(0, 5, 8)).toBeNull();
    expect(calcWorkWeight(100, 0, 8)).toBeNull();
    expect(calcWorkWeight(100, 13, 8)).toBeNull();
    expect(calcWorkWeight(100, 5, 5.5)).toBeNull();
    expect(calcWorkWeight(100, 5, 10.5)).toBeNull();
    expect(calcWorkWeight('x', 5, 8)).toBeNull();
  });
});

describe('isPredictiveSet — qué cuenta como set válido (§5)', () => {
  const ok = { type: 'normal', weight: '100', reps: '5', rpe: '8', completed: true };

  it('un set normal con peso, reps y RPE es válido', () => {
    expect(isPredictiveSet(ok)).toBe(true);
  });
  it.each(['top', 'back', 'backoff', 'amrap', 'normal', undefined])('el tipo %s cuenta', (type) => {
    expect(isPredictiveSet({ ...ok, type })).toBe(true);
  });
  it.each(['warmup', 'drop'])('el tipo %s NO cuenta', (type) => {
    expect(isPredictiveSet({ ...ok, type })).toBe(false);
  });
  it('peso > 0', () => {
    expect(isPredictiveSet({ ...ok, weight: '0' })).toBe(false);
    expect(isPredictiveSet({ ...ok, weight: '' })).toBe(false);
    expect(isPredictiveSet({ ...ok, weight: '-5' })).toBe(false);
  });
  it('reps de 1 a 12', () => {
    expect(isPredictiveSet({ ...ok, reps: '1' })).toBe(true);
    expect(isPredictiveSet({ ...ok, reps: '12' })).toBe(true);
    expect(isPredictiveSet({ ...ok, reps: '0' })).toBe(false);
    expect(isPredictiveSet({ ...ok, reps: '13' })).toBe(false);
    expect(isPredictiveSet({ ...ok, reps: '' })).toBe(false);
  });
  it('RPE ≥ 6; sin RPE también vale', () => {
    expect(isPredictiveSet({ ...ok, rpe: '6' })).toBe(true);
    expect(isPredictiveSet({ ...ok, rpe: '5.5' })).toBe(false);
    expect(isPredictiveSet({ ...ok, rpe: '5' })).toBe(false);
    expect(isPredictiveSet({ ...ok, rpe: '' })).toBe(true);
  });
  it('un set incompleto (`completed: false`) no cuenta; sin la marca, sí', () => {
    expect(isPredictiveSet({ ...ok, completed: false })).toBe(false);
    const { completed, ...sinMarca } = ok;
    expect(isPredictiveSet(sinMarca)).toBe(true);
  });
  it('peso ≥ 50 % del máximo del ejercicio (se descartan los livianos)', () => {
    expect(isPredictiveSet({ ...ok, weight: '50' }, 100)).toBe(true);
    expect(isPredictiveSet({ ...ok, weight: '49.9' }, 100)).toBe(false);
    expect(isPredictiveSet({ ...ok, weight: '10' }, 100)).toBe(false);
    expect(isPredictiveSet({ ...ok, weight: '10' })).toBe(true); // sin máximo no hay corte
  });
  it('sin set no rompe', () => {
    expect(isPredictiveSet(null)).toBe(false);
    expect(isPredictiveSet(undefined)).toBe(false);
  });
});

describe('confianza1RM (§5): alta N≥6 · media N 3-5 · baja N<3', () => {
  it.each([[0, 'baja'], [1, 'baja'], [2, 'baja'], [3, 'media'], [5, 'media'], [6, 'alta'], [23, 'alta']])('N=%s → %s', (n, c) => {
    expect(confianza1RM(n)).toBe(c);
  });
});

describe('computeExercise1RM — ventana móvil de 12 semanas', () => {
  const press = (when, sets, equipment = 'barbell') => session(when, [ex('Press Banca', equipment, { sets })]);

  it('un nombre nuevo, sin historial, arranca con N=0 y sin 1RM', () => {
    expect(computeExercise1RM('Press Banca', [])).toEqual({ current1RM: null, topSets: [], sampleSize: 0 });
    expect(computeExercise1RM('Press Banca', undefined)).toEqual({ current1RM: null, topSets: [], sampleSize: 0 });
    expect(computeExercise1RM('Press Banca', [press(daysAgo(3), [st(100, 5, 8)])], { equipment: 'barbell' }).sampleSize).toBe(1);
    expect(computeExercise1RM('Sentadilla', [press(daysAgo(3), [st(100, 5, 8)])]).sampleSize).toBe(0);
  });

  it('el 1RM es el mejor set estimado; N cuenta los sets válidos; guarda hasta 3 top sets', () => {
    const h = [press(daysAgo(3), [st(100, 5, 8), st(105, 5, 8.5), st(110, 3, 8), st(90, 8, 7)])];
    const r = computeExercise1RM('Press Banca', h);
    expect(r.sampleSize).toBe(4);
    expect(r.topSets).toHaveLength(3);
    const ests = [100 / 0.84, 105 / 0.855, 110 / 0.875, 90 / 0.76];
    expect(r.current1RM).toBeCloseTo(Math.max(...ests), 6);
    expect(r.topSets.map((s) => s._est1RM)).toEqual([...ests].sort((a, b) => b - a).slice(0, 3));
  });

  it('warmup, drop, incompletos, reps fuera de 1-12, RPE < 6 y peso 0 no cuentan', () => {
    const h = [press(daysAgo(3), [
      st(100, 5, 8),
      st(100, 5, 8, { type: 'warmup' }), st(100, 5, 8, { type: 'drop' }), st(100, 5, 8, { completed: false }),
      st(100, 15, 8), st(100, 0, 8), st(100, 5, 5), st(0, 5, 8),
    ])];
    expect(computeExercise1RM('Press Banca', h).sampleSize).toBe(1);
  });

  it('un set liviano (< 50 % del máximo del ejercicio) no cuenta', () => {
    const h = [press(daysAgo(3), [st(100, 5, 8), st(40, 10, 8)])];
    expect(computeExercise1RM('Press Banca', h).sampleSize).toBe(1);
  });

  it('ventana de 12 semanas: 83 días entra, 85 días queda afuera', () => {
    const h = [press(daysAgo(83), [st(100, 5, 8)]), press(daysAgo(85), [st(120, 5, 8)])];
    const r = computeExercise1RM('Press Banca', h);
    expect(r.sampleSize).toBe(1);
    expect(r.current1RM).toBeCloseTo(100 / 0.84, 6);
  });

  it('weeksBack: null usa todo el historial', () => {
    const h = [press(daysAgo(83), [st(100, 5, 8)]), press(daysAgo(400), [st(120, 5, 8)])];
    expect(computeExercise1RM('Press Banca', h, { weeksBack: null }).sampleSize).toBe(2);
    expect(computeExercise1RM('Press Banca', h, { weeksBack: 4 }).sampleSize).toBe(0);
  });

  it('NO se reinicia por bloque: sesiones de bloques distintos suman', () => {
    const h = [
      { ...press(daysAgo(10), [st(100, 5, 8)]), blockIds: ['2A'] },
      { ...press(daysAgo(3), [st(105, 5, 8)]), blockIds: ['3A'] },
    ];
    expect(computeExercise1RM('Press Banca', h).sampleSize).toBe(2);
  });

  it('por nombre + implemento: otro implemento no suma', () => {
    const h = [press(daysAgo(5), [st(100, 5, 8)], 'barbell'), press(daysAgo(4), [st(40, 8, 8)], 'dumbbell')];
    expect(computeExercise1RM('Press Banca', h, { equipment: 'barbell' }).sampleSize).toBe(1);
    expect(computeExercise1RM('Press Banca', h, { equipment: 'dumbbell' }).sampleSize).toBe(1);
    expect(computeExercise1RM('Press Banca', h, { equipment: 'dumbbell' }).current1RM).toBeCloseTo(40 / RPE_CHART[8][8], 6);
  });

  it('historial viejo sin implemento cuenta para cualquier implemento', () => {
    const h = [press(daysAgo(5), [st(100, 5, 8)], null)];
    expect(computeExercise1RM('Press Banca', h, { equipment: 'barbell' }).sampleSize).toBe(1);
    expect(computeExercise1RM('Press Banca', h, { equipment: 'dumbbell' }).sampleSize).toBe(1);
  });

  it('sin implemento ("sin definir") mezcla implementos: se calcula por nombre', () => {
    const h = [press(daysAgo(5), [st(100, 5, 8)], 'barbell'), press(daysAgo(4), [st(60, 8, 8)], 'dumbbell')];
    expect(computeExercise1RM('Press Banca', h).sampleSize).toBe(2);
  });

  it('un ejercicio por tiempo no se separa por implemento', () => {
    const plancha = (when, eq) => session(when, [ex('Plancha', eq, { sets: [st(20, 5, 8)] })]);
    const h = [plancha(daysAgo(5), 'bodyweight'), plancha(daysAgo(4), 'machine')];
    expect(computeExercise1RM('Plancha', h, { equipment: 'bodyweight' }).sampleSize).toBe(2);
  });

  it('la identidad del nombre ignora mayúsculas y tildes', () => {
    const h = [session(daysAgo(3), [ex('PRESS banca', 'barbell', { sets: [st(100, 5, 8)] })])];
    expect(computeExercise1RM('Press Banca', h).sampleSize).toBe(1);
  });

  it('la metadata del ejercicio resuelve el implemento de una sesión vieja sin él', () => {
    setMeta('Press Banca', { equipment: 'dumbbell' });
    const h = [press(daysAgo(5), [st(100, 5, 8)], null)];
    expect(computeExercise1RM('Press Banca', h, { equipment: 'barbell' }).sampleSize).toBe(0);
    expect(computeExercise1RM('Press Banca', h, { equipment: 'dumbbell' }).sampleSize).toBe(1);
  });

  it('sesiones sin fecha o sin ejercicios no rompen', () => {
    const h = [{ exercises: [] }, { completedAt: daysAgo(2) }, null, press(daysAgo(2), [st(100, 5, 8)])];
    expect(() => computeExercise1RM('Press Banca', h.filter(Boolean))).not.toThrow();
    expect(computeExercise1RM('Press Banca', h.filter(Boolean)).sampleSize).toBe(1);
  });
});

describe('getTopHistoricalSet / getLastLoggedSet', () => {
  const h = [
    session(daysAgo(10), [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8), st(90, 8, 7)] })]),
    session(daysAgo(3), [ex('Press Banca', 'barbell', { sets: [st(95, 6, 7.5), st(80, 10, '')] })]),
  ];
  it('el top set es el de mayor 1RM estimado, como texto', () => {
    expect(getTopHistoricalSet('Press Banca', h)).toEqual({ weight: '100', reps: '5', rpe: '8' });
    expect(getTopHistoricalSet('Sentadilla', h)).toBeNull();
  });
  it('el último set registrado es el último de la sesión más reciente (reps y RPE, sin peso)', () => {
    expect(getLastLoggedSet('Press Banca', h)).toEqual({ reps: '10', rpe: '' });
  });
  it('el último set ignora warmup, drop e incompletos; no pide peso (peso corporal)', () => {
    const bw = [session(daysAgo(2), [ex('Dominadas', 'bodyweight', { sets: [
      st('', 8, 8), st('', 6, '', { type: 'warmup' }), st('', 5, '', { completed: false }),
    ] })])];
    expect(getLastLoggedSet('Dominadas', bw)).toEqual({ reps: '8', rpe: '8' });
    expect(getLastLoggedSet('Dominadas', [])).toBeNull();
  });
});

describe('isComparable1RMEquipment — carga externa y constante', () => {
  it('barra, mancuerna, multipower y landmine (barra con discos)', () => {
    expect(COMPARABLE_1RM_EQUIPMENT).toEqual(['barbell', 'dumbbell', 'smith', 'landmine']);
    for (const eq of ['barbell', 'dumbbell', 'smith', 'landmine']) expect(isComparable1RMEquipment(eq), eq).toBe(true);
  });
  it('máquina, polea, peso corporal, kettlebell, banda, otro y sin implemento, no', () => {
    for (const eq of ['machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other', null, undefined]) expect(isComparable1RMEquipment(eq), String(eq)).toBe(false);
  });
});

describe('computeAll1RMs — una entrada por variante comparable (§5)', () => {
  const sess = (when, name, equipment, sets) => session(when, [ex(name, equipment, { sets })]);

  it('un nombre con dos implementos comparables sale por implemento, rotulado "Nombre · implemento"', () => {
    const h = [
      sess(daysAgo(5), 'Curl de Bíceps', 'barbell', [st(40, 8, 8)]),
      sess(daysAgo(4), 'Curl de Bíceps', 'dumbbell', [st(16, 10, 8)]),
    ];
    const r = computeAll1RMs(h);
    expect(r.map((e) => e.label).sort()).toEqual(['Curl de Bíceps · barra', 'Curl de Bíceps · mancuerna']);
  });

  it('un nombre con un solo implemento comparable sale con el nombre a secas', () => {
    const h = [sess(daysAgo(5), 'Curl de Bíceps', 'barbell', [st(40, 8, 8)])];
    expect(computeAll1RMs(h).map((e) => e.label)).toEqual(['Curl de Bíceps']);
  });

  it('la polea no infla a la mancuerna (un solo implemento comparable: se calcula solo con ese)', () => {
    const h = [
      sess(daysAgo(5), 'Curl de Bíceps', 'dumbbell', [st(16, 10, 8)]),
      sess(daysAgo(4), 'Curl de Bíceps', 'cable', [st(60, 10, 8)]),
    ];
    const r = computeAll1RMs(h);
    expect(r).toHaveLength(1);
    expect(r[0].equipment).toBe('dumbbell');
    expect(r[0].sampleSize).toBe(1);
  });

  it('Mis 1RM con landmine: una variante propia, con su implemento y su 1RM', () => {
    const h = [sess(daysAgo(5), 'Remo Landmine', 'landmine', [st(40, 10, 8)])];
    const r = computeAll1RMs(h);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Remo Landmine', equipment: 'landmine', label: 'Remo Landmine', sampleSize: 1 });
    expect(r[0].current1RM).toBeCloseTo(40 / RPE_CHART[10][8], 6);
  });

  it('un nombre con barra y landmine sale por implemento: "· barra" / "· landmine"', () => {
    const h = [
      sess(daysAgo(5), 'Remo con Barra', 'barbell', [st(60, 8, 8)]),
      sess(daysAgo(4), 'Remo con Barra', 'landmine', [st(40, 10, 8)]),
    ];
    expect(computeAll1RMs(h).map((e) => e.label).sort()).toEqual(['Remo con Barra · barra', 'Remo con Barra · landmine']);
  });

  it('la polea no infla a la landmine (un solo implemento comparable)', () => {
    const h = [
      sess(daysAgo(5), 'Remo en T con apoyo', 'landmine', [st(40, 10, 8)]),
      sess(daysAgo(4), 'Remo en T con apoyo', 'machine', [st(100, 10, 8)]),
    ];
    const r = computeAll1RMs(h);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ equipment: 'landmine', sampleSize: 1 });
  });

  it('máquina, polea y peso corporal no son comparables: por nombre, sin implemento', () => {
    const h = [sess(daysAgo(5), 'Prensa de Piernas', 'machine', [st(200, 10, 8)])];
    const r = computeAll1RMs(h);
    expect(r).toHaveLength(1);
    expect(r[0].equipment).toBeNull();
  });

  it('ordena por 1RM descendente', () => {
    const h = [
      sess(daysAgo(5), 'Curl de Bíceps', 'barbell', [st(40, 8, 8)]),
      sess(daysAgo(5), 'Sentadilla', 'barbell', [st(140, 5, 8)]),
    ];
    const r = computeAll1RMs(h);
    expect(r.map((e) => e.name)).toEqual(['Sentadilla', 'Curl de Bíceps']);
  });

  it('sin historial → lista vacía', () => {
    expect(computeAll1RMs([])).toEqual([]);
    expect(computeAll1RMs(undefined)).toEqual([]);
  });
});
