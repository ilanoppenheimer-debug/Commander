import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ex, session, st } from './fixtures/builders.js';

// generateCoachContext lee Dexie y la fecha actual. Se prueba SIN tocar src/: la base se reemplaza por un
// doble en memoria (vi.mock) y el reloj se fija con fake timers. Contrato v1.8.4 §5, CONTEXTO PARA COACH.
const mock = vi.hoisted(() => ({ history: [], blocks: [], counts: new Map(), failHistory: false }));

vi.mock('../src/db/database', () => ({
  db: {
    history: {
      orderBy: () => ({ reverse: () => ({ toArray: async () => [...mock.history].sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))) }) }),
      toArray: async () => { if (mock.failHistory) throw new Error('boom'); return [...mock.history]; },
    },
  },
}));
vi.mock('../src/db/blocks', () => ({
  getActiveBlocks: async () => mock.blocks,
  getSessionCountsByBlock: async () => mock.counts,
}));

const NOW = '2026-06-15T15:00:00Z'; // lunes 11:00 en Santiago (UTC-4 en invierno)
const daysAgo = (d, hour = 15) => {
  const t = new Date(Date.parse(NOW) - d * 86400000);
  t.setUTCHours(hour, 0, 0, 0);
  return t.toISOString();
};
const sess = (name, d, exercises, extra = {}) => ({ name, completedAt: daysAgo(d), exercises, ...extra });
const main = (name, equipment, sets) => ex(name, equipment, { tag: 'main_lift', sets });
const acc = (name, equipment, sets) => ex(name, equipment, { tag: 'accessory', sets });

const BLOCK = {
  id: 'b3A', name: 'Bloque 3A — Intensificación', type: 'intensification', status: 'active',
  startedAt: '2026-05-01T12:00:00.000Z', appliesTo: ['main_lift'], fase: 'intensificacion',
  params: { repsRange: [3, 6], rpeRange: [7.5, 8.5] },
};

let generateCoachContext;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  mock.history = []; mock.blocks = []; mock.counts = new Map(); mock.failHistory = false;
  ({ generateCoachContext } = await import('../src/utils/routineImport/contextGenerator.js'));
});
afterEach(() => { vi.useRealTimers(); });

const gen = () => generateCoachContext();
// Texto de una sección: desde su encabezado "## ..." hasta el siguiente.
const section = (text, startsWith) => {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.startsWith(startsWith));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !lines[j].startsWith('## ') && !lines[j].startsWith('===')) j++;
  return lines.slice(i, j).join('\n');
};

const BASE = () => [
  sess('TORSO', 3, [
    main('press banca', 'barbell', [st(100, 5, 8), st(90, 6, 7, { type: 'back' })]),
    acc('Elevaciones Laterales', 'cable', [st(15, 12, 8)]),
    acc('Elevaciones Laterales', 'dumbbell', [st(8, 12, 8)]),
    ex('Plancha', 'bodyweight', { sets: [{ type: 'normal', seconds: 40, completed: true }] }),
  ], { blockIds: ['b3A'] }),
  sess('LEGS', 10, [main('Sentadilla', 'barbell', [st(140, 5, 8)])], { blockIds: ['b3A'] }),
  sess('ACCESORIOS', 5, [acc('Facepull', 'cable', [st(25, 15, 8)])]),
  sess('LEGS', 70, [main('Press Banca', 'barbell', [st(120, 5, 8)])]),
];

describe('estructura y orden de las secciones (§5)', () => {
  it('encabezado, secciones en el orden del Contrato y pie', async () => {
    mock.blocks = [BLOCK]; mock.counts = new Map([['b3A', 2]]); mock.history = BASE();
    const t = await gen();
    expect(t.startsWith('=== CONTEXTO PARA COACH ===\nFecha: 2026-06-15\n')).toBe(true);
    expect(t.endsWith('=== FIN CONTEXTO ===')).toBe(true);
    const marcas = [
      '## Última sesión', '## Top sets recientes (últimas 8 semanas)',
      '## Últimos registros por ejercicio (últimas 8 semanas, sin main lifts)', '## Bloques de entrenamiento activos',
      '## Sesiones del bloque por tipo', 'Fuera del bloque', '## Series por ejercicio (sin warmups, completadas)', '## Frecuencia',
    ].map((m) => t.indexOf(m));
    expect(marcas.every((i) => i >= 0)).toBe(true);
    expect(marcas).toEqual([...marcas].sort((a, b) => a - b));
  });

  it('la fecha es la LOCAL (America/Santiago), no la UTC', async () => {
    vi.setSystemTime(new Date('2026-06-16T02:30:00Z')); // 22:30 del 15-jun en Santiago
    expect((await gen()).split('\n')[1]).toBe('Fecha: 2026-06-15');
  });

  it('con historial vacío: sin secciones de datos, lo dice y no rompe', async () => {
    const t = await gen();
    expect(t).toContain('Sin sesiones en los últimos 14 días.');
    expect(t).not.toContain('## Última sesión');
    expect(t).not.toContain('## Top sets');
    expect(t).toContain('  - Últimos 7 días: 0 sesiones');
    expect(t).toContain('  - Total registrado: 0 sesiones');
  });

  it('si una sección falla, las demás siguen y el pie queda', async () => {
    mock.history = BASE(); mock.failHistory = true;
    const t = await gen();
    expect(t).toContain('(Error leyendo top sets)');
    expect(t).toContain('## Última sesión');
    expect(t.endsWith('=== FIN CONTEXTO ===')).toBe(true);
  });
});

describe('Última sesión', () => {
  it('todos los ejercicios de la última sesión con su mejor set, con la grafía canónica', async () => {
    mock.history = BASE();
    const s = section(await gen(), '## Última sesión');
    expect(s).toContain('## Última sesión: TORSO (2026-06-12)');
    expect(s).toContain('Ejercicios: 4');
    expect(s).toContain('  - Press Banca: 100 kg × 5 @ RPE 8'); // 'press banca' en el historial
    expect(s).toContain('  - Plancha: 40 s');
  });

  it('el mejor set es el de mayor peso', async () => {
    mock.history = [sess('TORSO', 1, [main('Press Banca', 'barbell', [st(80, 8, 7), st(110, 3, 8.5), st(95, 6, 8)])])];
    expect(await gen()).toContain('  - Press Banca: 110 kg × 3 @ RPE 8.5');
  });

  it('v1.8.3: un nombre con dos implementos en la misma sesión lleva siempre sufijo', async () => {
    mock.history = BASE();
    const s = section(await gen(), '## Última sesión');
    expect(s).toContain('  - Elevaciones Laterales · polea: 15 kg × 12 @ RPE 8');
    expect(s).toContain('  - Elevaciones Laterales · mancuerna: 8 kg × 12 @ RPE 8');
  });

  it('un ejercicio sin sets completados con datos se omite y el encabezado lo dice', async () => {
    mock.history = [sess('TORSO', 1, [
      main('Press Banca', 'barbell', [st(100, 5, 8)]),
      acc('Facepull', 'cable', [st(25, 15, 8, { completed: false })]),
    ])];
    const s = section(await gen(), '## Última sesión');
    expect(s).toContain('Ejercicios: 1 (1 sin datos, omitido)');
    expect(s).not.toContain('Facepull');
  });

  it('la fecha de la sesión es local: 21:00 del 12-jun en Santiago es 01:00Z del 13', async () => {
    mock.history = [{ name: 'LEGS', completedAt: '2026-06-13T01:00:00.000Z', exercises: [main('Sentadilla', 'barbell', [st(140, 5, 8)])] }];
    expect(await gen()).toContain('## Última sesión: LEGS (2026-06-12)');
  });
});

describe('Top sets recientes (últimas 8 semanas)', () => {
  it('solo main lifts; los accesorios no aparecen acá', async () => {
    mock.history = BASE();
    const s = section(await gen(), '## Top sets recientes');
    expect(s).toContain('  - Sentadilla:');
    expect(s).toContain('  - Press Banca:');
    expect(s).not.toContain('Facepull');
    expect(s).not.toContain('Elevaciones');
    expect(s).not.toContain('Plancha');
  });

  it('el mejor set solo cuenta las últimas 8 semanas; el 1RM usa la ventana de 12 y lo dice', async () => {
    mock.history = BASE(); // incluye un Press Banca de hace 70 días (10 semanas) a 120 kg
    const s = section(await gen(), '## Top sets recientes');
    expect(s).toContain('  - Press Banca: 100 kg × 5 @ RPE 8 (12-jun)');
    expect(s).not.toContain('120 kg');
    expect(s).toContain('    1RM est. 143 kg (confianza media, N=3, ventana 12 semanas)');
  });

  it('el 1RM va con N, confianza y la ventana; 1 set válido = confianza baja', async () => {
    mock.history = [sess('LEGS', 10, [main('Sentadilla', 'barbell', [st(140, 5, 8)])])];
    expect(await gen()).toContain('    1RM est. 166.5 kg (confianza baja, N=1, ventana 12 semanas)');
  });

  it('mejor set y último top cuando son distintos', async () => {
    mock.history = [
      sess('TORSO', 20, [main('Press Banca', 'barbell', [st(110, 4, 8.5)])]),
      sess('TORSO', 3, [main('Press Banca', 'barbell', [st(100, 5, 8)])]),
    ];
    const s = section(await gen(), '## Top sets recientes');
    expect(s).toContain('  - Press Banca: mejor 110 kg × 4 @ RPE 8.5 (26-may) · último 100 × 5 @ 8 (12-jun)');
  });

  it('con dos implementos en las 8 semanas, cada uno sale "Nombre · implemento" con su propio 1RM', async () => {
    mock.history = [
      sess('TORSO', 20, [main('Press Banca', 'barbell', [st(100, 5, 8)])]),
      sess('TORSO', 3, [main('Press Banca', 'dumbbell', [st(40, 8, 8)])]),
    ];
    const s = section(await gen(), '## Top sets recientes');
    expect(s).toContain('  - Press Banca · barra:');
    expect(s).toContain('  - Press Banca · mancuerna:');
    expect(s.match(/1RM est\./g)).toHaveLength(2);
  });

  it('con un solo implemento sale el nombre a secas', async () => {
    mock.history = [sess('TORSO', 3, [main('Press Banca', 'barbell', [st(100, 5, 8)])])];
    const s = section(await gen(), '## Top sets recientes');
    expect(s).toContain('  - Press Banca:');
    expect(s).not.toContain('· barra');
  });

  it('un warmup no es top set', async () => {
    mock.history = [sess('TORSO', 3, [main('Press Banca', 'barbell', [st(60, 5, '', { type: 'warmup' }), st(100, 5, 8)])])];
    expect(section(await gen(), '## Top sets recientes')).toContain('  - Press Banca: 100 kg × 5 @ RPE 8 (12-jun)');
  });

  it('sin main lifts en las 8 semanas, la sección no sale', async () => {
    mock.history = [sess('ACCESORIOS', 3, [acc('Facepull', 'cable', [st(25, 15, 8)])])];
    expect(await gen()).not.toContain('## Top sets');
  });

  it('las fechas son locales (13-jun 01:00Z es el 12-jun)', async () => {
    mock.history = [{ name: 'TORSO', completedAt: '2026-06-13T01:00:00.000Z', exercises: [main('Press Banca', 'barbell', [st(100, 5, 8)])] }];
    expect(await gen()).toContain('(12-jun)');
  });
});

describe('Últimos registros por ejercicio (sin main lifts)', () => {
  it('una línea por ejercicio con su última aparición, bajo el tipo de sesión', async () => {
    mock.history = BASE();
    const s = section(await gen(), '## Últimos registros por ejercicio');
    expect(s).toContain('TORSO:\n');
    expect(s).toContain('ACCESORIOS:\n  - Facepull — 25×15@8 (10-jun, ACCESORIOS)');
    expect(s).not.toContain('Sentadilla');
    expect(s).not.toContain('Press Banca');
  });

  it('con más de un implemento en las 8 semanas, el nombre lleva el implemento; los de tiempo nunca', async () => {
    mock.history = BASE();
    const s = section(await gen(), '## Últimos registros por ejercicio');
    expect(s).toContain('  - Elevaciones Laterales · polea — 15×12@8 (12-jun, TORSO)');
    expect(s).toContain('  - Elevaciones Laterales · mancuerna — 8×12@8 (12-jun, TORSO)');
    expect(s).toContain('  - Plancha — 40 s (12-jun, TORSO)');
  });

  it('con un solo implemento sale el nombre a secas', async () => {
    mock.history = [sess('ACCESORIOS', 5, [acc('Facepull', 'cable', [st(25, 15, 8)])])];
    expect(await gen()).toContain('  - Facepull — 25×15@8');
  });

  it('muestra como máximo 4 sets de trabajo y cuenta el resto', async () => {
    mock.history = [sess('ACCESORIOS', 5, [acc('Facepull', 'cable', Array.from({ length: 6 }, () => st(25, 15, 8)))])];
    expect(await gen()).toContain('  - Facepull — 25×15@8, 25×15@8, 25×15@8, 25×15@8 (+2) (10-jun, ACCESORIOS)');
  });

  it('sin warmups ni sets incompletos', async () => {
    mock.history = [sess('ACCESORIOS', 5, [acc('Facepull', 'cable', [st(10, 15, '', { type: 'warmup' }), st(25, 15, 8, { completed: false }), st(30, 12, 8)])])];
    const s = section(await gen(), '## Últimos registros por ejercicio');
    expect(s).toContain('  - Facepull — 30×12@8 (10-jun, ACCESORIOS)');
  });

  it('ejercicios por tiempo con su compañero', async () => {
    const { setMeta } = await import('./fixtures/builders.js');
    setMeta('Plancha', { companion: 'difficulty' });
    mock.history = [sess('DL', 3, [ex('Plancha', 'bodyweight', { sets: [{ type: 'normal', seconds: 40, companionValue: '2', completed: true }] })])];
    expect(await gen()).toContain('  - Plancha — 40 s · Media (12-jun, DL)');
  });

  it('si la última aparición fue sin lastre, se agrega la última con carga', async () => {
    mock.history = [
      sess('PULL', 15, [ex('Dominadas', 'bodyweight', { tag: 'secondary', sets: [st(10, 6, 8)] })]),
      sess('PULL', 3, [ex('Dominadas', 'bodyweight', { tag: 'secondary', sets: [st('', 8, 7.5)] })]),
    ];
    expect(await gen()).toContain('  - Dominadas — PC×8@7.5 (12-jun, PULL) · con lastre: +10×6@8 (31-may)');
  });

  it('solo las últimas 8 semanas', async () => {
    mock.history = [sess('ACCESORIOS', 60, [acc('Facepull', 'cable', [st(25, 15, 8)])])];
    expect(await gen()).not.toContain('## Últimos registros');
  });

  it('el tipo de sesión es el de la última aparición', async () => {
    mock.history = [
      sess('TORSO', 20, [acc('Facepull', 'cable', [st(20, 15, 8)])]),
      sess('ACCESORIOS', 5, [acc('Facepull', 'cable', [st(25, 15, 8)])]),
    ];
    const s = section(await gen(), '## Últimos registros por ejercicio');
    expect(s).toContain('ACCESORIOS:\n  - Facepull — 25×15@8');
    expect(s).not.toContain('TORSO:');
  });
});

describe('Bloques activos y sesiones del bloque por tipo', () => {
  it('bloque, tipo, params, sesiones, fase y tags de aplica_a', async () => {
    mock.blocks = [BLOCK]; mock.counts = new Map([['b3A', 2]]); mock.history = BASE();
    const s = section(await gen(), '## Bloques de entrenamiento activos');
    expect(s).toContain('  - Bloque 3A — Intensificación (intensification): 3-6 reps, RPE 7.5-8.5, 2 sesiones, fase intensificacion');
    expect(s).toContain('    Tags: main_lift');
  });

  it('con meta de sesiones se muestra logradas/meta', async () => {
    mock.blocks = [{ ...BLOCK, sessionsTarget: 12 }]; mock.counts = new Map([['b3A', 2]]); mock.history = BASE();
    expect(await gen()).toContain('2/12 sesiones');
  });

  it('la última sesión del bloque con número se informa', async () => {
    mock.blocks = [BLOCK]; mock.counts = new Map([['b3A', 2]]);
    mock.history = [sess('TORSO', 3, [main('Press Banca', 'barbell', [st(100, 5, 8)])], { blockIds: ['b3A'], sessionNum: 14 })];
    expect(await gen()).toContain('última sesión: #14');
  });

  it('sin bloques activos no hay sección de bloques', async () => {
    mock.history = BASE();
    const t = await gen();
    expect(t).not.toContain('## Bloques');
    expect(t).not.toContain('Fuera del bloque');
  });

  it('conteo por tipo de sesión y «Fuera del bloque» (hoy, las ACCESORIOS), con conteo y última fecha', async () => {
    mock.blocks = [BLOCK]; mock.counts = new Map([['b3A', 2]]); mock.history = BASE();
    const t = await gen();
    expect(section(t, '## Sesiones del bloque por tipo')).toContain('  - TORSO: 1 (última: 12-jun)\n  - LEGS: 1 (última: 05-jun)');
    expect(t).toContain('Fuera del bloque (sin ejercicios de aplica_a), desde el inicio del bloque:\n  - ACCESORIOS: 1 (última: 10-jun)');
  });

  it('con dos bloques activos, cada conteo lleva el nombre del bloque', async () => {
    mock.blocks = [BLOCK, { ...BLOCK, id: 'b4', name: 'Bloque 4' }];
    mock.counts = new Map([['b3A', 2], ['b4', 0]]);
    mock.history = [sess('TORSO', 3, [main('Press Banca', 'barbell', [st(100, 5, 8)])], { blockIds: ['b3A'] })];
    expect(await gen()).toContain('## Sesiones por tipo — Bloque 3A — Intensificación');
  });
});

describe('Series por ejercicio y Frecuencia dentro del CONTEXTO', () => {
  it('la sección Series coincide con buildSeriesPorEjercicio y usa el reloj actual', async () => {
    const { buildSeriesPorEjercicio } = await import('../src/utils/routineImport/contextGenerator.js');
    mock.history = BASE();
    const t = await gen();
    expect(t).toContain(buildSeriesPorEjercicio(BASE(), Date.now()).join('\n').trimEnd());
  });

  it('Frecuencia: sesiones en 7 días, 14 días y total, con singular y plural', async () => {
    mock.history = BASE();
    let t = await gen();
    expect(t).toContain('  - Últimos 7 días: 2 sesiones');
    expect(t).toContain('  - Últimas 2 semanas: 3 sesiones');
    expect(t).toContain('  - Total registrado: 4 sesiones');
    mock.history = [sess('LEGS', 2, [main('Sentadilla', 'barbell', [st(140, 5, 8)])])];
    t = await gen();
    expect(t).toContain('  - Últimos 7 días: 1 sesión\n');
    expect(t).toContain('  - Total registrado: 1 sesión\n');
  });
});
