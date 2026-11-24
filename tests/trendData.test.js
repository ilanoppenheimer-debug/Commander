import { describe, it, expect } from 'vitest';
import { trendEntries, trendKind, trendKindFor, buildTrendPoints, hasTrendableEquipment, pickTrendLabels, REFERENCE_LABEL } from '../src/utils/trendData.js';
import { estimate1RM } from '../src/utils/strengthMath.js';
import { ex, session, st, setMeta } from './fixtures/builders.js';

// Tendencias → Progreso 1RM. Contrato v1.8.4 §5 (reglas del 1RM) y Catálogo 8.2 (máquinas: referencia débil).
// Comparables: barra, mancuerna, multipower y landmine; máquina y polea como referencia; peso corporal y tiempo, fuera.
const sess = (date, exercises) => session(`${date}T15:00:00.000Z`, exercises);

describe('trendKind — qué se grafica y cómo', () => {
  it('comparable: barra, mancuerna, multipower y landmine', () => {
    for (const eq of ['barbell', 'dumbbell', 'smith', 'landmine']) expect(trendKind(eq), eq).toBe('comparable');
  });
  it('referencia: máquina y polea', () => {
    for (const eq of ['machine', 'cable']) expect(trendKind(eq), eq).toBe('reference');
  });
  it('fuera: peso corporal, kettlebell, banda, otro y sin implemento', () => {
    for (const eq of ['bodyweight', 'kettlebell', 'band', 'other', null, undefined]) expect(trendKind(eq), String(eq)).toBeNull();
  });
  it('hasTrendableEquipment: por nombre (null) o un implemento que se grafica', () => {
    for (const eq of [null, undefined, 'barbell', 'dumbbell', 'smith', 'landmine', 'machine', 'cable']) expect(hasTrendableEquipment(eq), String(eq)).toBe(true);
    for (const eq of ['bodyweight', 'kettlebell', 'band', 'other']) expect(hasTrendableEquipment(eq), eq).toBe(false);
  });
  it('la etiqueta visible es corta y fija', () => {
    expect(REFERENCE_LABEL).toBe('Referencia de esta máquina');
  });
});

describe('trendEntries — qué ejercicios se listan en Tendencias', () => {
  const history = [
    sess('2026-06-01', [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8)] }), ex('Elevación de Gemelos', 'machine', { sets: [st(200, 12, 8)] })]),
    sess('2026-06-08', [ex('Press Banca', 'dumbbell', { sets: [st(40, 8, 8)] }), ex('Curl de Bíceps', 'cable', { sets: [st(20, 12, 8)] })]),
    sess('2026-06-15', [ex('Press Banca', 'barbell', { sets: [st(105, 5, 8)] }), ex('Curl de Bíceps', 'barbell', { sets: [st(30, 10, 8)] }),
      ex('Dominadas', 'bodyweight', { sets: [st('', 8, 8)] }), ex('Plancha', 'bodyweight', { sets: [{ type: 'normal', seconds: 40, completed: true }] })]),
  ];
  const byLabel = (h) => Object.fromEntries(trendEntries(h).map((e) => [e.label, e]));

  it('máquina y polea vuelven a la lista, marcadas como referencia', () => {
    const e = byLabel(history);
    expect(e['Elevación de Gemelos']).toMatchObject({ kind: 'reference', equipment: null, count: 1 });
  });

  it('peso corporal y ejercicios por tiempo quedan fuera', () => {
    const labels = Object.keys(byLabel(history));
    for (const out of ['Dominadas', 'Plancha']) expect(labels).not.toContain(out);
  });

  it('un ejercicio de tiempo en máquina (Bicicleta) también queda fuera', () => {
    const h = [sess('2026-06-01', [ex('Bicicleta', 'machine', { sets: [{ type: 'normal', seconds: 900, completed: true }] })])];
    expect(trendEntries(h)).toEqual([]);
  });

  it('landmine es comparable (helper compartido); kettlebell, banda y otro no se listan', () => {
    const h = [sess('2026-06-01', [
      ex('Remo Landmine', 'landmine', { sets: [st(40, 10, 8)] }), ex('Sentadilla Goblet', 'kettlebell', { sets: [st(24, 10, 8)] }),
      ex('Rotación Externa', 'band', { sets: [st(5, 15, 8)] }), ex('Cosa', 'other', { sets: [st(5, 15, 8)] }),
    ])];
    expect(trendEntries(h).map((e) => [e.label, e.kind])).toEqual([['Remo Landmine', 'comparable']]);
  });

  it('un nombre con más de un implemento se separa por implemento: el implemento separa los números', () => {
    const e = byLabel(history);
    expect(e['Press Banca · barra']).toMatchObject({ equipment: 'barbell', kind: 'comparable', count: 2 });
    expect(e['Press Banca · mancuerna']).toMatchObject({ equipment: 'dumbbell', kind: 'comparable', count: 1 });
    expect(e['Curl de Bíceps · polea']).toMatchObject({ equipment: 'cable', kind: 'reference', count: 1 });
    expect(e['Curl de Bíceps · barra']).toMatchObject({ equipment: 'barbell', kind: 'comparable', count: 1 });
    expect(e['Press Banca']).toBeUndefined();
  });

  it('un nombre con un solo implemento sale a secas y "por nombre" (equipment null)', () => {
    const h = [sess('2026-06-01', [ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })])];
    expect(trendEntries(h)).toEqual([{ key: 'sentadilla|', name: 'Sentadilla', equipment: null, label: 'Sentadilla', kind: 'comparable', count: 1 }]);
  });

  it('un implemento que no se grafica no cuenta para decidir si el nombre se separa', () => {
    const h = [sess('2026-06-01', [ex('Hip Thrust', 'barbell', { sets: [st(100, 8, 8)] })]), sess('2026-06-08', [ex('Hip Thrust', 'bodyweight', { sets: [st('', 15, 8)] })])];
    expect(trendEntries(h).map((e) => [e.label, e.count])).toEqual([['Hip Thrust', 1]]);
  });

  it('nombre canónico del Catálogo, como el CONTEXTO: aunque el historial tenga otra grafía', () => {
    const h = [
      sess('2026-06-01', [ex('Prensa de piernas unilateral', 'machine', { sets: [st(100, 10, 8)] }), ex('Reverse front fly', 'cable', { sets: [st(15, 12, 8)] })]),
      sess('2026-06-08', [ex('Prensa de piernas unilateral', 'machine', { sets: [st(110, 10, 8)] }), ex('Pajaros', 'cable', { sets: [st(10, 12, 8)] })]),
    ];
    const e = trendEntries(h);
    expect(e.map((x) => x.label).sort((a, b) => a.localeCompare(b, 'es'))).toEqual(['Pájaros', 'Prensa de Piernas Unilateral', 'Reverse Front Fly']);
    expect(e.find((x) => x.label === 'Prensa de Piernas Unilateral')).toMatchObject({ name: 'Prensa de Piernas Unilateral', count: 2 });
  });

  it('el nombre canónico también va en la etiqueta por implemento y se puede graficar con él', () => {
    const h = [
      sess('2026-06-01', [ex('elevaciones laterales', 'cable', { sets: [st(10, 12, 8)] })]),
      sess('2026-06-08', [ex('Elevaciones laterales', 'dumbbell', { sets: [st(8, 12, 8)] })]),
      sess('2026-06-15', [ex('elevaciones laterales', 'dumbbell', { sets: [st(9, 12, 8)] })]),
    ];
    const e = trendEntries(h);
    expect(e.map((x) => x.label).sort()).toEqual(['Elevaciones Laterales · mancuerna', 'Elevaciones Laterales · polea']);
    const mancuerna = e.find((x) => x.equipment === 'dumbbell');
    expect(buildTrendPoints(mancuerna.name, mancuerna.equipment, h)).toHaveLength(2);
  });

  it('un ejercicio propio que no está en el Catálogo conserva la grafía de la sesión más reciente', () => {
    const h = [sess('2026-06-01', [ex('mi ejercicio raro', 'barbell', { sets: [st(50, 8, 8)] })]), sess('2026-06-08', [ex('Mi Ejercicio Raro', 'barbell', { sets: [st(55, 8, 8)] })])];
    expect(trendEntries(h).map((x) => x.label)).toEqual(['Mi Ejercicio Raro']);
  });

  it('ordena de más a menos frecuente', () => {
    const counts = trendEntries(history).map((e) => e.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('un registro sin implemento resuelve por la metadata del ejercicio; sin nada, no se adivina', () => {
    setMeta('Remo con Barra', { equipment: 'barbell' });
    const h = [sess('2026-06-01', [ex('Remo con Barra', null, { sets: [st(80, 8, 8)] }), ex('Ejercicio Raro', null, { sets: [st(50, 8, 8)] })])];
    expect(trendEntries(h).map((e) => e.label)).toEqual(['Remo con Barra']);
  });

  it('las grafías del mismo ejercicio se suman y se imprime la de la sesión más reciente', () => {
    const h = [
      sess('2026-06-01', [ex('press banca', 'barbell', { sets: [st(100, 5, 8)] })]),
      sess('2026-06-08', [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8)] })]),
    ];
    expect(trendEntries(h).map((e) => [e.label, e.count])).toEqual([['Press Banca', 2]]);
  });

  it('historial vacío o inválido', () => {
    expect(trendEntries([])).toEqual([]);
    expect(trendEntries(undefined)).toEqual([]);
    expect(trendEntries([{ exercises: [null, {}] }])).toEqual([]);
  });
});

describe('buildTrendPoints — los puntos del gráfico siguen las reglas de §5', () => {
  const press = (date, sets, eq = 'barbell') => sess(date, [ex('Press Banca', eq, { sets })]);

  it('un punto por sesión: el mejor 1RM estimado con la tabla RPE (el mismo cálculo que el CONTEXTO), de la más vieja a la más nueva', () => {
    const h = [press('2026-06-15', [st(105, 5, 8)]), press('2026-06-01', [st(100, 5, 8), st(90, 8, 7)])];
    const p = buildTrendPoints('Press Banca', 'barbell', h);
    expect(p).toHaveLength(2);
    expect(p[0].date < p[1].date).toBe(true);
    expect(p[0].est1RM).toBeCloseTo(100 / 0.84, 2); // tabla RTS: 5 reps @ RPE 8 = 84 %
    expect(p[0].topWeight).toBe(100);
    expect(p[1].est1RM).toBeCloseTo(105 / 0.84, 2);
  });

  it('coincide con estimate1RM: el valor del gráfico es el del CONTEXTO', () => {
    const p = buildTrendPoints('Press Banca', 'barbell', [press('2026-06-01', [st(143, 3, 7.5)])]);
    expect(p[0].est1RM).toBeCloseTo(estimate1RM(143, 3, 7.5), 2);
  });

  it('un set de descarga a RPE 5 no entra: la sesión de descarga no da punto (el valle falso)', () => {
    const h = [press('2026-05-14', [st(245, 1, 9)]), press('2026-05-20', [st(130, 5, 5), st(130, 3, 5)]), press('2026-05-27', [st(240, 2, 9)])];
    expect(buildTrendPoints('Press Banca', 'barbell', h)).toHaveLength(2);
  });

  it('warmup, drop, incompletos, más de 12 reps y peso 0 no entran', () => {
    const h = [press('2026-06-01', [
      st(100, 5, 8),
      st(100, 5, 8, { type: 'warmup' }), st(100, 5, 8, { type: 'drop' }), st(100, 5, 8, { completed: false }),
      st(100, 15, 8), st(0, 5, 8),
    ])];
    const p = buildTrendPoints('Press Banca', 'barbell', h);
    expect(p).toHaveLength(1);
    expect(p[0].est1RM).toBeCloseTo(100 / 0.84, 2);
    expect(p[0].topWeight).toBe(100);
  });

  it('un set liviano (< 50 % del máximo del ejercicio en la ventana) no entra', () => {
    const h = [press('2026-06-01', [st(100, 5, 8), st(40, 10, 8)])];
    expect(buildTrendPoints('Press Banca', 'barbell', h)[0].topWeight).toBe(100);
  });

  it('el 50 % se mide contra la ventana de 12 semanas que termina en esa sesión', () => {
    const h = [press('2026-01-05', [st(200, 3, 8)]), press('2026-06-01', [st(90, 5, 8)])]; // el 200 queda 21 semanas atrás
    expect(buildTrendPoints('Press Banca', 'barbell', h)).toHaveLength(2);
  });

  it('con implemento pedido, solo ese; sin implemento y un nombre con barra y polea, grafica la barra (otra escala)', () => {
    const h = [
      sess('2026-06-01', [ex('Curl de Bíceps', 'barbell', { sets: [st(30, 10, 8)] })]),
      sess('2026-06-08', [ex('Curl de Bíceps', 'cable', { sets: [st(60, 10, 8)] })]),
    ];
    expect(buildTrendPoints('Curl de Bíceps', null, h).map((p) => p.topWeight)).toEqual([30]);
    expect(buildTrendPoints('Curl de Bíceps', 'cable', h).map((p) => p.topWeight)).toEqual([60]);
  });

  it('máquina y polea se grafican (referencia de esa máquina)', () => {
    const h = [press('2026-06-01', [st(200, 12, 8)], 'machine'), press('2026-06-08', [st(210, 12, 8)], 'machine')];
    const p = buildTrendPoints('Press Banca', null, h);
    expect(p).toHaveLength(2);
    expect(trendKindFor('Press Banca', null, h)).toBe('reference');
  });

  it('peso corporal y tiempo no tienen puntos', () => {
    const bw = [sess('2026-06-01', [ex('Dominadas', 'bodyweight', { sets: [st(10, 6, 8)] })])];
    expect(buildTrendPoints('Dominadas', null, bw)).toEqual([]);
    const timed = [sess('2026-06-01', [ex('Bicicleta', 'machine', { sets: [st(10, 6, 8)] })])];
    expect(buildTrendPoints('Bicicleta', null, timed)).toEqual([]);
  });

  it('trendKindFor: comparable si hay alguna aparición comparable; null sin datos', () => {
    const h = [press('2026-06-01', [st(100, 5, 8)], 'barbell'), press('2026-06-08', [st(60, 10, 8)], 'cable')];
    expect(trendKindFor('Press Banca', null, h)).toBe('comparable');
    expect(trendKindFor('Press Banca', 'cable', h)).toBe('reference');
    expect(trendKindFor('Sentadilla', null, h)).toBeNull();
    expect(trendKindFor('', null, undefined)).toBeNull();
  });

  it('entradas inválidas no rompen', () => {
    expect(buildTrendPoints('', null, [])).toEqual([]);
    expect(buildTrendPoints('Press Banca', null, undefined)).toEqual([]);
    expect(buildTrendPoints('Press Banca', null, [null, {}, { exercises: [null] }])).toEqual([]);
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
