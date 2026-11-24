import { describe, it, expect } from 'vitest';
import {
  buildSeriesPorEjercicio, getSessionsOutsideBlock, getSessionTypeBreakdown, classifySessionType,
} from '../src/utils/routineImport/contextGenerator.js';
import { ex, session, st, setMeta } from './fixtures/builders.js';

// Contrato v1.8.4 §5, CONTEXTO PARA COACH. Fechas fijas; el "ahora" se inyecta (nowMs).
const NOW = Date.parse('2026-06-15T15:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const sess = (name, d, exercises, extra = {}) => ({ name, completedAt: daysAgo(d), exercises, ...extra });

const TITLE = '## Series por ejercicio (sin warmups, completadas)';

describe('Series por ejercicio — ventanas de 7 y 8–14 días', () => {
  it('cuenta en dos ventanas hacia atrás desde "ahora": 7 días y 8–14 días', () => {
    const out = buildSeriesPorEjercicio([
      sess('LEGS', 2, [ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8), st(100, 5, 8), st(100, 5, 8)] })]),
      sess('LEGS', 10, [ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8), st(100, 5, 8)] })]),
    ], NOW);
    expect(out[0]).toBe(TITLE);
    expect(out).toContain('  - Sentadilla: 7 días 3 · 8–14 días 2');
    expect(out.at(-1)).toBe('');
  });

  it('bordes de las ventanas: los últimos 7 días, luego hasta los 14', () => {
    const fila = (dias) => buildSeriesPorEjercicio([
      sess('LEGS', dias, [ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })]),
    ], NOW).find((l) => l.startsWith('  - Sentadilla'));
    expect(fila(6.9)).toBe('  - Sentadilla: 7 días 1 · 8–14 días 0');
    expect(fila(7.5)).toBe('  - Sentadilla: 7 días 0 · 8–14 días 1');
    expect(fila(13.9)).toBe('  - Sentadilla: 7 días 0 · 8–14 días 1');
    expect(fila(14.1)).toBeUndefined();
  });

  it('una sesión de hace 15 días queda afuera', () => {
    const out = buildSeriesPorEjercicio([
      sess('LEGS', 15, [ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })]),
    ], NOW);
    expect(out).toEqual([TITLE, 'Sin sesiones en los últimos 14 días.', '']);
  });

  it('una sesión futura no cuenta', () => {
    const out = buildSeriesPorEjercicio([sess('LEGS', -1, [ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })])], NOW);
    expect(out[1]).toBe('Sin sesiones en los últimos 14 días.');
  });

  it('sin sesiones en 14 días lo dice explícitamente (también con historial vacío)', () => {
    expect(buildSeriesPorEjercicio([], NOW)).toEqual([TITLE, 'Sin sesiones en los últimos 14 días.', '']);
    expect(buildSeriesPorEjercicio(undefined, NOW)).toEqual([TITLE, 'Sin sesiones en los últimos 14 días.', '']);
  });

  it('hay sesiones pero ninguna serie válida: lo dice distinto', () => {
    const out = buildSeriesPorEjercicio([sess('LEGS', 1, [ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8, { type: 'warmup' })] })])], NOW);
    expect(out).toEqual([TITLE, 'Sin series completadas en los últimos 14 días.', '']);
  });
});

describe('Series por ejercicio — qué es una serie', () => {
  const one = (sets, name = 'Press Banca', equipment = 'barbell') =>
    buildSeriesPorEjercicio([sess('TORSO', 1, [ex(name, equipment, { sets })])], NOW);

  it('sin warmups', () => {
    expect(one([st(60, 5, '', { type: 'warmup' }), st(100, 5, 8)])).toContain('  - Press Banca: 7 días 1 · 8–14 días 0');
  });
  it('no marcada incompleta (`completed: false` no cuenta)', () => {
    expect(one([st(100, 5, 8), st(100, 5, 8, { completed: false })])).toContain('  - Press Banca: 7 días 1 · 8–14 días 0');
  });
  it('con datos: reps, peso o segundos; un set vacío no cuenta aunque diga completado', () => {
    const sets = [
      st(100, 5, 8),
      { type: 'normal', weight: '', reps: '', completed: true },
      { type: 'normal', weight: '20', reps: '', completed: true },
      { type: 'normal', seconds: 40, completed: true },
      { type: 'normal', weight: '0', reps: '0', seconds: 0, completed: true },
    ];
    expect(one(sets)).toContain('  - Press Banca: 7 días 3 · 8–14 días 0');
  });
  it('un set sin la marca `completed` pero con datos cuenta (como en el 1RM)', () => {
    expect(one([{ type: 'normal', weight: '100', reps: '5' }])).toContain('  - Press Banca: 7 días 1 · 8–14 días 0');
  });
  it('un ejercicio sin ninguna serie válida no aparece', () => {
    const out = one([st(60, 5, '', { type: 'warmup' })], 'Facepull', 'cable');
    expect(out.join('\n')).not.toContain('Facepull');
  });
  it('incluye skills, cardio y holds por tiempo: nada se excluye por ejercicio', () => {
    const out = buildSeriesPorEjercicio([sess('DL', 1, [
      ex('Handstand', 'bodyweight', { sets: [{ type: 'normal', seconds: 30, completed: true }] }),
      ex('Bicicleta', 'machine', { sets: [{ type: 'normal', seconds: 900, completed: true }] }),
    ])], NOW).join('\n');
    expect(out).toContain('  - Handstand: 7 días 1');
    expect(out).toContain('  - Bicicleta: 7 días 1');
  });
  it('un hold unilateral por tiempo cuenta por fila: un set por lado = 2', () => {
    const lado = { type: 'normal', seconds: 30, completed: true };
    const out = buildSeriesPorEjercicio([sess('DL', 1, [ex('Plancha Lateral', 'bodyweight', { sets: [lado, lado] })])], NOW).join('\n');
    expect(out).toContain('  - Plancha Lateral: 7 días 2');
  });
});

describe('Series por ejercicio — bloques Split / ACCESORIOS / Otras', () => {
  const sets = [st(100, 5, 8)];
  const run = (sessions) => buildSeriesPorEjercicio(sessions, NOW);

  it('LEGS, TORSO y DL van en "Split (LEGS / TORSO / DL)"', () => {
    const out = run([
      sess('LEGS', 1, [ex('Sentadilla', 'barbell', { sets })]),
      sess('TORSO', 2, [ex('Press Banca', 'barbell', { sets })]),
      sess('DL', 3, [ex('Peso Muerto', 'barbell', { sets })]),
    ]);
    expect(out).toContain('Split (LEGS / TORSO / DL):');
    expect(out).not.toContain('ACCESORIOS:');
    expect(out).not.toContain('Otras:');
  });

  it('el tipo de sesión es el prefijo del nombre y no distingue mayúsculas ni plural', () => {
    for (const nombre of ['LEGS — Bloque 3A', 'legs', 'Legs', 'TORSO', 'torso · semana 2', 'dl', 'DL / pesado']) {
      const out = run([sess(nombre, 1, [ex('Sentadilla', 'barbell', { sets })])]);
      expect(out, nombre).toContain('Split (LEGS / TORSO / DL):');
    }
  });

  it('ACCESORIOS tiene su propio bloque', () => {
    const out = run([sess('ACCESORIOS', 1, [ex('Facepull', 'cable', { sets })])]);
    expect(out).toContain('ACCESORIOS:');
    expect(out).not.toContain('Split (LEGS / TORSO / DL):');
  });

  it('cualquier otro nombre va en "Otras"', () => {
    for (const nombre of ['PULL', 'Cardio', '', undefined]) {
      const out = run([sess(nombre, 1, [ex('Dominadas', 'bodyweight', { sets })])]);
      expect(out, String(nombre)).toContain('Otras:');
    }
  });

  it('los bloques salen en orden Split, ACCESORIOS, Otras y solo si tienen filas', () => {
    const out = run([
      sess('PULL', 1, [ex('Dominadas', 'bodyweight', { sets })]),
      sess('ACCESORIOS', 1, [ex('Facepull', 'cable', { sets })]),
      sess('LEGS', 1, [ex('Sentadilla', 'barbell', { sets })]),
    ]);
    const idx = ['Split (LEGS / TORSO / DL):', 'ACCESORIOS:', 'Otras:'].map((t) => out.indexOf(t));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('dentro de un bloque: más series primero, luego la ventana reciente, luego por nombre', () => {
    const out = run([sess('LEGS', 1, [
      ex('Prensa de Piernas', 'machine', { sets: [st(200, 10, 8)] }),
      ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8), st(100, 5, 8), st(100, 5, 8)] }),
      ex('Curl Femoral Sentado', 'machine', { sets: [st(50, 10, 8)] }),
    ])]);
    const rows = out.filter((l) => l.startsWith('  - ')).map((l) => l.split(':')[0].replace('  - ', ''));
    expect(rows).toEqual(['Sentadilla', 'Curl Femoral Sentado', 'Prensa de Piernas']);
  });

  it('el mismo ejercicio en dos sesiones del mismo bloque se suma', () => {
    const out = run([
      sess('LEGS', 1, [ex('Sentadilla', 'barbell', { sets })]),
      sess('LEGS', 5, [ex('Sentadilla', 'barbell', { sets })]),
    ]);
    expect(out).toContain('  - Sentadilla: 7 días 2 · 8–14 días 0');
  });

  it('el mismo ejercicio en bloques distintos no se mezcla', () => {
    const out = run([
      sess('LEGS', 1, [ex('Facepull', 'cable', { sets })]),
      sess('ACCESORIOS', 1, [ex('Facepull', 'cable', { sets })]),
    ]);
    expect(out.filter((l) => l === '  - Facepull: 7 días 1 · 8–14 días 0')).toHaveLength(2);
  });
});

describe('Series por ejercicio — nombres', () => {
  const sets = [st(100, 5, 8)];
  it('sale el nombre canónico del Catálogo aunque el historial tenga otra grafía', () => {
    const out = buildSeriesPorEjercicio([sess('TORSO', 1, [ex('press banca', 'barbell', { sets })])], NOW);
    expect(out).toContain('  - Press Banca: 7 días 1 · 8–14 días 0');
  });
  it('las grafías del mismo ejercicio se suman', () => {
    const out = buildSeriesPorEjercicio([
      sess('TORSO', 1, [ex('press banca', 'barbell', { sets })]),
      sess('TORSO', 2, [ex('PRESS BANCA', 'barbell', { sets })]),
    ], NOW);
    expect(out).toContain('  - Press Banca: 7 días 2 · 8–14 días 0');
  });
  it('el implemento aparece solo si hubo más de uno en la ventana', () => {
    const uno = buildSeriesPorEjercicio([sess('TORSO', 1, [ex('Elevaciones Laterales', 'cable', { sets })])], NOW);
    expect(uno).toContain('  - Elevaciones Laterales: 7 días 1 · 8–14 días 0');
    const dos = buildSeriesPorEjercicio([sess('TORSO', 1, [
      ex('Elevaciones Laterales', 'cable', { sets }), ex('Elevaciones Laterales', 'dumbbell', { sets }),
    ])], NOW);
    expect(dos).toContain('  - Elevaciones Laterales · polea: 7 días 1 · 8–14 días 0');
    expect(dos).toContain('  - Elevaciones Laterales · mancuerna: 7 días 1 · 8–14 días 0');
  });
  it('un ejercicio por tiempo nunca se separa por implemento', () => {
    const t = { type: 'normal', seconds: 30, completed: true };
    const out = buildSeriesPorEjercicio([sess('DL', 1, [ex('Plancha', 'bodyweight', { sets: [t] }), ex('Plancha', 'machine', { sets: [t] })])], NOW);
    expect(out).toContain('  - Plancha: 7 días 2 · 8–14 días 0');
  });
  it('la app no agrupa por músculo: los únicos encabezados son los tres bloques de sesión', () => {
    const out = buildSeriesPorEjercicio([sess('TORSO', 1, [ex('Press Banca', 'barbell', { sets })])], NOW);
    const encabezados = out.filter((l) => l && !l.startsWith('  - ') && !l.startsWith('## '));
    expect(encabezados).toEqual(['Split (LEGS / TORSO / DL):']);
  });
});

describe('Sesiones del bloque por tipo / «Fuera del bloque»', () => {
  const BLOCK = { id: 'b-3A', startedAt: '2026-05-01T12:00:00.000Z', appliesTo: ['main_lift'] };

  it('getSessionTypeBreakdown cuenta las sesiones del bloque por tipo (el prefijo del nombre), de mayor a menor', () => {
    const h = [
      sess('LEGS — Bloque 3A', 9, [], { blockIds: ['b-3A'] }),
      sess('LEGS', 7, [], { blockIds: ['b-3A'] }),
      sess('TORSO A', 8, [], { blockIds: ['b-3A'] }),
      sess('LEGS', 2, [], { blockIds: ['otro'] }),
    ];
    const r = getSessionTypeBreakdown('b-3A', h);
    expect(r.map(({ label, count }) => [label, count])).toEqual([['LEGS', 2], ['TORSO A', 1]]);
  });

  it('agrupa sin distinguir mayúsculas ni plural, y muestra el nombre tal como se escribió en la última', () => {
    const h = [
      sess('Piernas A', 20, [], { blockIds: ['b'] }),
      sess('Pierna A', 5, [], { blockIds: ['b'] }),
      sess('PULL', 4, [], { blockIds: ['b'] }),
    ];
    const r = getSessionTypeBreakdown('b', h);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ label: 'Pierna A', count: 2, lastDate: daysAgo(5) });
    expect(r[1]).toMatchObject({ label: 'PULL', count: 1 });
  });

  it('classifySessionType: el prefijo antes de — · . /, tal como se escribió; sin nombre, "Sin clasificar"', () => {
    expect(classifySessionType('LEGS — Bloque 3A')).toBe('LEGS');
    expect(classifySessionType('TORSO · semana 2')).toBe('TORSO');
    expect(classifySessionType('DL / pesado')).toBe('DL');
    expect(classifySessionType('  Pierna   A ')).toBe('Pierna A');
    expect(classifySessionType('')).toBe('Sin clasificar');
    expect(classifySessionType(undefined)).toBe('Sin clasificar');
  });

  it('«Fuera del bloque»: sesiones desde el inicio del bloque sin ejercicios con tag de aplica_a (hoy, ACCESORIOS)', () => {
    const h = [
      sess('LEGS', 10, [ex('Sentadilla', 'barbell', { tag: 'main_lift', sets: [] })]),
      sess('ACCESORIOS', 8, [ex('Facepull', 'cable', { tag: 'accessory', sets: [] })]),
      sess('ACCESORIOS', 3, [ex('Facepull', 'cable', { tag: 'accessory', sets: [] })]),
    ];
    const r = getSessionsOutsideBlock(BLOCK, h);
    expect(r).toEqual([{ label: 'ACCESORIOS', count: 2, lastDate: daysAgo(3) }]);
  });

  it('una sesión estampada con el id del bloque no está fuera, aunque no tenga el tag', () => {
    const h = [sess('ACCESORIOS', 3, [ex('Facepull', 'cable', { tag: 'accessory', sets: [] })], { blockIds: ['b-3A'] })];
    expect(getSessionsOutsideBlock(BLOCK, h)).toEqual([]);
  });

  it('el tag sale del ejercicio, y si no lo tiene, de la metadata del ejercicio', () => {
    setMeta('Press Banca', { defaultTag: 'main_lift' });
    const h = [sess('TORSO', 3, [ex('Press Banca', 'barbell', { sets: [] })])];
    expect(getSessionsOutsideBlock(BLOCK, h)).toEqual([]);
  });

  it('las sesiones anteriores al inicio del bloque no cuentan', () => {
    const h = [{ name: 'ACCESORIOS', completedAt: '2026-04-20T12:00:00.000Z', exercises: [] }];
    expect(getSessionsOutsideBlock(BLOCK, h)).toEqual([]);
  });

  it('un bloque sin fecha de inicio no informa nada (no se adivina)', () => {
    expect(getSessionsOutsideBlock({ id: 'x', appliesTo: ['main_lift'] }, [sess('ACCESORIOS', 3, [])])).toEqual([]);
    expect(getSessionsOutsideBlock(undefined, [])).toEqual([]);
  });

  it('solo lectura: no modifica las sesiones ni el bloque', () => {
    const h = [sess('ACCESORIOS', 3, [ex('Facepull', 'cable', { tag: 'accessory', sets: [] })])];
    const copia = JSON.stringify(h);
    const bloque = JSON.stringify(BLOCK);
    getSessionsOutsideBlock(BLOCK, h);
    getSessionTypeBreakdown('b-3A', h);
    expect(JSON.stringify(h)).toBe(copia);
    expect(JSON.stringify(BLOCK)).toBe(bloque);
  });
});
