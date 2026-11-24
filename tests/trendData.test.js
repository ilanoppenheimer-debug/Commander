import { describe, it, expect } from 'vitest';
import { trendExerciseCounts, buildTrendPoints, hasTrendableEquipment, pickTrendLabels } from '../src/utils/trendData.js';
import { ex, session, st, setMeta } from './fixtures/builders.js';

// Tendencias → Progreso 1RM. Contrato v1.8.4 §5 y Catálogo 8.2: el 1RM es referencia solo con carga externa
// comparable (barra, mancuerna, multipower), el mismo criterio que "Enviar al Coach" y el reporte de sesión.
const sess = (date, exercises) => session(`${date}T15:00:00.000Z`, exercises);

describe('trendExerciseCounts — qué ejercicios se listan en Tendencias', () => {
  const history = [
    sess('2026-06-01', [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8)] }), ex('Elevación de Gemelos', 'machine', { sets: [st(200, 12, 8)] })]),
    sess('2026-06-08', [ex('Press Banca', 'dumbbell', { sets: [st(40, 8, 8)] }), ex('Curl de Bíceps', 'cable', { sets: [st(20, 12, 8)] })]),
    sess('2026-06-15', [ex('Press Banca', 'barbell', { sets: [st(105, 5, 8)] }), ex('Curl de Bíceps', 'barbell', { sets: [st(30, 10, 8)] }),
      ex('Dominadas', 'bodyweight', { sets: [st('', 8, 8)] }), ex('Plancha', 'bodyweight', { sets: [{ type: 'normal', seconds: 40, completed: true }] })]),
  ];

  it('solo barra, mancuerna y multipower; máquina, polea, peso corporal y tiempo quedan afuera', () => {
    const names = [...trendExerciseCounts(history).keys()];
    expect(names).toEqual(['Press Banca', 'Curl de Bíceps']);
    for (const out of ['Elevación de Gemelos', 'Dominadas', 'Plancha']) expect(names).not.toContain(out);
  });

  it('multipower cuenta', () => {
    const h = [sess('2026-06-01', [ex('Sentadilla', 'smith', { sets: [st(100, 5, 8)] })])];
    expect([...trendExerciseCounts(h).keys()]).toEqual(['Sentadilla']);
  });

  it('cuenta solo las apariciones comparables (un nombre con polea y barra cuenta la barra)', () => {
    const counts = trendExerciseCounts(history);
    expect(counts.get('Press Banca')).toBe(3);
    expect(counts.get('Curl de Bíceps')).toBe(1);
  });

  it('ordena de más a menos frecuente', () => {
    expect([...trendExerciseCounts(history).values()]).toEqual([3, 1]);
  });

  it('un ejercicio solo de máquina no se lista aunque tenga muchas sesiones', () => {
    const h = Array.from({ length: 5 }, (_, i) => sess(`2026-06-0${i + 1}`, [ex('Prensa de Piernas', 'machine', { sets: [st(200, 10, 8)] })]));
    expect(trendExerciseCounts(h).size).toBe(0);
  });

  it('un registro sin implemento resuelve por la metadata del ejercicio; sin nada, no se adivina', () => {
    setMeta('Remo con Barra', { equipment: 'barbell' });
    const h = [sess('2026-06-01', [ex('Remo con Barra', null, { sets: [st(80, 8, 8)] }), ex('Ejercicio Raro', null, { sets: [st(50, 8, 8)] })])];
    expect([...trendExerciseCounts(h).keys()]).toEqual(['Remo con Barra']);
  });

  it('las grafías del mismo ejercicio se suman y se imprime la de la sesión más reciente', () => {
    const h = [
      sess('2026-06-01', [ex('press banca', 'barbell', { sets: [st(100, 5, 8)] })]),
      sess('2026-06-08', [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8)] })]),
    ];
    expect([...trendExerciseCounts(h)]).toEqual([['Press Banca', 2]]);
  });

  it('historial vacío o inválido', () => {
    expect(trendExerciseCounts([]).size).toBe(0);
    expect(trendExerciseCounts(undefined).size).toBe(0);
    expect(trendExerciseCounts([{ exercises: [null, {}] }]).size).toBe(0);
  });
});

describe('buildTrendPoints — los puntos del gráfico', () => {
  it('un punto por sesión, el mejor 1RM estimado (Epley con reserva de RPE) y el peso máximo, de la más vieja a la más nueva', () => {
    const h = [
      sess('2026-06-15', [ex('Press Banca', 'barbell', { sets: [st(105, 5, 8)] })]),
      sess('2026-06-01', [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8), st(90, 8, 7)] })]),
    ];
    const p = buildTrendPoints('Press Banca', 'barbell', h);
    expect(p).toHaveLength(2);
    expect(p[0].date < p[1].date).toBe(true);
    expect(p[0].est1RM).toBeCloseTo(100 * (1 + 7 / 30), 2); // 100 × 5 @ 8 → 5 + 2 reps
    expect(p[0].topWeight).toBe(100);
    expect(p[1].est1RM).toBeCloseTo(105 * (1 + 7 / 30), 2);
  });

  it('sin implemento pedido, grafica solo las apariciones comparables: la polea no se mezcla con la barra', () => {
    const h = [
      sess('2026-06-01', [ex('Curl de Bíceps', 'barbell', { sets: [st(30, 10, 8)] })]),
      sess('2026-06-08', [ex('Curl de Bíceps', 'cable', { sets: [st(60, 10, 8)] })]),
    ];
    const p = buildTrendPoints('Curl de Bíceps', null, h);
    expect(p).toHaveLength(1);
    expect(p[0].topWeight).toBe(30);
  });

  it('con implemento pedido, solo ese', () => {
    const h = [
      sess('2026-06-01', [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8)] })]),
      sess('2026-06-08', [ex('Press Banca', 'dumbbell', { sets: [st(40, 8, 8)] })]),
    ];
    expect(buildTrendPoints('Press Banca', 'dumbbell', h)).toHaveLength(1);
    expect(buildTrendPoints('Press Banca', 'dumbbell', h)[0].topWeight).toBe(40);
  });

  it('un ejercicio de máquina no tiene puntos (el caso del outlier de Elevación de Gemelos)', () => {
    const h = [
      sess('2026-06-01', [ex('Elevación de Gemelos', 'machine', { sets: [st(200, 12, 8)] })]),
      sess('2026-06-08', [ex('Elevación de Gemelos', 'machine', { sets: [st(210, 12, 8)] })]),
    ];
    expect(buildTrendPoints('Elevación de Gemelos', null, h)).toEqual([]);
    expect(buildTrendPoints('Elevación de Gemelos', 'machine', h)).toEqual([]);
  });

  it('sets sin peso o sin repeticiones no cuentan; una sesión sin datos no da punto', () => {
    const h = [sess('2026-06-01', [ex('Press Banca', 'barbell', { sets: [st('', 5, 8), st(100, '', 8)] })])];
    expect(buildTrendPoints('Press Banca', 'barbell', h)).toEqual([]);
  });

  it('entradas inválidas no rompen', () => {
    expect(buildTrendPoints('', null, [])).toEqual([]);
    expect(buildTrendPoints('Press Banca', null, undefined)).toEqual([]);
    expect(buildTrendPoints('Press Banca', null, [null, {}, { exercises: [null] }])).toEqual([]);
  });
});

describe('hasTrendableEquipment', () => {
  it('barra, mancuerna, multipower y "por nombre" sí; máquina, polea, peso corporal, kettlebell, landmine y banda no', () => {
    for (const eq of [null, undefined, 'barbell', 'dumbbell', 'smith']) expect(hasTrendableEquipment(eq), String(eq)).toBe(true);
    for (const eq of ['machine', 'cable', 'bodyweight', 'kettlebell', 'landmine', 'band', 'other']) expect(hasTrendableEquipment(eq), eq).toBe(false);
  });
});

describe('pickTrendLabels — las etiquetas del gráfico no se superponen', () => {
  // El gráfico real: viewBox de 300 de ancho, margen de 20 a cada lado.
  const xsFor = (n) => Array.from({ length: n }, (_, i) => 20 + (i / (n - 1)) * 260);
  const wave = (n) => Array.from({ length: n }, (_, i) => 200 + 60 * Math.sin(i / 2));
  const minGap = (xs, set) => {
    const pos = [...set].map((i) => xs[i]).sort((a, b) => a - b);
    return pos.slice(1).reduce((m, x, i) => Math.min(m, x - pos[i]), Infinity);
  };

  it.each([2, 3, 5, 8, 12, 20, 30, 45, 60, 100])('con %s puntos, ninguna etiqueta queda más cerca que el mínimo', (n) => {
    const xs = xsFor(n);
    const { value, date } = pickTrendLabels(xs, wave(n));
    expect(minGap(xs, value)).toBeGreaterThanOrEqual(36);
    expect(minGap(xs, date)).toBeGreaterThanOrEqual(32);
  });

  it('siempre se rotula la primera y la última fecha', () => {
    for (const n of [2, 7, 30, 80]) {
      const { date } = pickTrendLabels(xsFor(n), wave(n));
      expect(date.has(0), `n=${n}`).toBe(true);
      expect(date.has(n - 1), `n=${n}`).toBe(true);
    }
  });

  it('el valor se rotula en el máximo, el último, el primero y el mínimo, cuando entran', () => {
    const values = [200, 210, 180, 260, 240, 220];
    const xs = xsFor(6); // separación de 52 unidades: caben todos
    const { value } = pickTrendLabels(xs, values);
    expect([...value].sort()).toEqual([0, 2, 3, 5]);
  });

  it('con muchos puntos juntos se priorizan el máximo y el último sobre los demás', () => {
    const n = 30;
    const values = Array.from({ length: n }, (_, i) => 200 + i);
    const { value } = pickTrendLabels(xsFor(n), values);
    expect(value.has(n - 1)).toBe(true); // el máximo es el último
    expect(value.size).toBeLessThanOrEqual(8);
  });

  it('pocos puntos: se rotulan todas las fechas', () => {
    const { date } = pickTrendLabels(xsFor(3), [1, 2, 3]);
    expect([...date].sort()).toEqual([0, 1, 2]);
  });

  it('un solo punto o ninguno no rompe', () => {
    expect(pickTrendLabels([], [])).toEqual({ value: new Set(), date: new Set() });
    const one = pickTrendLabels([150], [250]);
    expect([...one.value]).toEqual([0]);
    expect([...one.date]).toEqual([0]);
  });
});
