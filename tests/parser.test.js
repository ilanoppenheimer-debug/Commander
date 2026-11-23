import { describe, it, expect } from 'vitest';
import { parseRoutineMarkdown, parseRestSeconds } from '../src/utils/routineImport/parser.js';
import { routineMd, exBlock, simpleEx, setMeta } from './fixtures/builders.js';

// Contrato v1.8.3 §1, §3, §4, §4b.
const parse = (md) => parseRoutineMarkdown(md);
const firstEx = (md) => parse(md).routine.exercises[0];
const withRows = (rows, bullets = ['equipo: barbell', 'descanso: 90s'], name = 'Press Banca') =>
  routineMd({ exercises: [exBlock({ name, bullets, rows })] });
const oneSet = (peso, reps = '5', tipo = 'normal', rpe = '8') => firstEx(withRows([[tipo, peso, reps, rpe, '90s']])).sets[0];
const warningsOf = (md) => parse(md).warnings;

describe('estructura general (Contrato §1)', () => {
  it('una rutina mínima válida se importa', () => {
    const r = parse(routineMd({ exercises: [simpleEx()] }));
    expect(r.success).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.routine.name).toBe('LEGS');
    expect(r.routine.sourceDate).toBe('2026-01-05');
    expect(r.routine.exercises).toHaveLength(1);
    expect(r.routine.exercises[0].name).toBe('Press Banca');
  });

  it.each([[''], [undefined], [null], [42]])('entrada inválida (%s) da error, sin romper', (input) => {
    const r = parse(input);
    expect(r.success).toBe(false);
    expect(r.errors).toEqual(['Input vacío o inválido']);
  });

  it('sin "---" inicial: "Falta bloque YAML inicial"', () => {
    const r = parse('nombre: LEGS\n\n# EJERCICIO: Press Banca\n');
    expect(r.success).toBe(false);
    expect(r.errors[0]).toMatch(/Falta bloque YAML inicial/);
  });

  it('sin nombre de sesión: error', () => {
    const r = parse(routineMd({ header: 'fecha: 2026-01-05', exercises: [simpleEx()] }));
    expect(r.success).toBe(false);
    expect(r.errors[0]).toMatch(/Falta campo "nombre"/);
  });

  it('sin ejercicios: error', () => {
    const r = parse(routineMd({ exercises: [] }));
    expect(r.success).toBe(false);
    expect(r.errors[0]).toMatch(/No se encontraron ejercicios/);
  });

  it('el formato lista YAML (`ejercicios: - nombre:`) no importa (§1, caso TORSO 15-oct)', () => {
    const md = '---\nnombre: TORSO\n---\n\nejercicios:\n  - nombre: Press Banca\n    equipo: barbell\n';
    const r = parse(md);
    expect(r.success).toBe(false);
    expect(r.errors[0]).toMatch(/No se encontraron ejercicios/);
  });

  it('un ejercicio sin tabla de sets se omite con aviso', () => {
    const md = routineMd({ exercises: [exBlock({ name: 'Press Banca', bullets: ['equipo: barbell'] }), simpleEx({ name: 'Remo con Barra' })] });
    const r = parse(md);
    expect(r.routine.exercises.map((e) => e.name)).toEqual(['Remo con Barra']);
    expect(r.warnings.some((w) => /sin tabla de sets/.test(w))).toBe(true);
  });

  it('el nombre de sesión con separador o palabra de bloque avisa; el día solo, no (§1)', () => {
    const limpio = parse(routineMd({ header: 'nombre: LEGS', exercises: [simpleEx()] })).warnings;
    const sucio = parse(routineMd({ header: 'nombre: LEGS — Bloque 3A', exercises: [simpleEx()] })).warnings;
    expect(sucio.length).toBeGreaterThan(limpio.length);
  });

  it('nota_ejercicio de una línea y multilínea (`|`)', () => {
    const una = firstEx(withRows([['normal', '100', '5', '8', '90s']], ['equipo: barbell', 'descanso: 90s', 'nota_ejercicio: Pausa de 1s']));
    expect(una.notes).toBe('Pausa de 1s');
    const multi = firstEx(withRows([['normal', '100', '5', '8', '90s']], ['equipo: barbell', 'descanso: 90s', 'nota_ejercicio: |\n    Línea uno\n    Línea dos']));
    expect(multi.notes).toContain('Línea uno');
    expect(multi.notes).toContain('Línea dos');
  });
});

describe('equipo (Contrato §3)', () => {
  const equipoDe = (valor) => firstEx(routineMd({ exercises: [exBlock({ name: 'Curl de Bíceps', bullets: [`equipo: ${valor}`, 'descanso: 90s'], rows: [['normal', '20', '10', '8', '90s']] })] }));

  it.each(['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'kettlebell', 'landmine', 'band', 'bodyweight'])('"%s" es un valor canónico', (v) => {
    expect(equipoDe(v).equipment).toBe(v);
  });

  it('se acepta sin distinguir mayúsculas: Landmine = landmine', () => {
    expect(equipoDe('Landmine').equipment).toBe('landmine');
    expect(equipoDe('BARBELL').equipment).toBe('barbell');
    expect(equipoDe('  Cable ').equipment).toBe('cable');
  });

  it('solo en inglés: "mancuernas" y "barra" son desconocidos → sin definir, con aviso', () => {
    for (const v of ['mancuernas', 'barra', 'polea']) {
      const md = routineMd({ exercises: [exBlock({ name: 'Curl de Bíceps', bullets: [`equipo: ${v}`, 'descanso: 90s'], rows: [['normal', '20', '10', '8', '90s']] })] });
      expect(firstEx(md).equipment, v).toBeNull();
      expect(warningsOf(md).some((w) => /Equipo desconocido/.test(w)), v).toBe(true);
    }
  });

  it('sin `equipo`: NO se asume barra; queda sin definir y avisa', () => {
    const md = routineMd({ exercises: [exBlock({ name: 'Curl de Bíceps', bullets: ['descanso: 90s'], rows: [['normal', '20', '10', '8', '90s']] })] });
    expect(firstEx(md).equipment).toBeNull();
    expect(warningsOf(md).some((w) => /sin equipo/.test(w))).toBe(true);
  });

  it('`other` existe como valor aunque no tenga equivalente (evitarlo)', () => {
    expect(equipoDe('other').equipment).toBe('other');
  });
});

describe('peso: números, PC, PC+10 y rangos (Contrato §4)', () => {
  it('un número se guarda tal cual', () => {
    expect(oneSet('137.5').weight).toBe('137.5');
    expect(oneSet('60').weight).toBe('60');
  });

  it('PC = peso corporal sin lastre: sin peso externo; el texto del Coach queda en el plan', () => {
    const s = oneSet('PC');
    expect(s.weight).toBe('');
    expect(s.planned.weight).toBe('PC');
  });

  it('PC+10 = 10 kg de lastre: la carga es el lastre', () => {
    const s = oneSet('PC+10');
    expect(s.weight).toBe('10');
    expect(s.planned.weight).toBe('PC+10');
  });

  it('PC + 10 (con espacios) y decimales', () => {
    expect(oneSet('PC + 10').weight).toBe('10');
    expect(oneSet('PC+7.5').weight).toBe('7.5');
    expect(oneSet('pc+5').weight).toBe('5');
  });

  it('PC sin avisos; un peso que no se entiende, sí', () => {
    const md = (peso) => withRows([['normal', peso, '5', '8', '90s']], ['equipo: bodyweight', 'descanso: 90s'], 'Dominadas');
    expect(warningsOf(md('PC')).filter((w) => /Peso no parseable/.test(w))).toEqual([]);
    expect(warningsOf(md('PC+10')).filter((w) => /Peso no parseable/.test(w))).toEqual([]);
    expect(warningsOf(md('mucho')).some((w) => /Peso no parseable/.test(w))).toBe(true);
    expect(warningsOf(md('PC+')).some((w) => /Peso no parseable/.test(w))).toBe(true);
  });

  it('un rango de peso se guarda como plan, sin peso real', () => {
    const s = oneSet('110-113');
    expect(s.weight).toBe('');
    expect(s.planned.weight).toBe('110-113');
  });

  it('"-" o vacío: sin peso', () => {
    expect(oneSet('-').weight).toBe('');
    expect(oneSet('').weight).toBe('');
  });
});

describe('reps: máx, AMRAP, tiempo y formatos no parseables (Contrato §4 / §4b)', () => {
  const warnsFor = (reps, tipo = 'normal', name = 'Press Banca') =>
    warningsOf(withRows([[tipo, '100', reps, '8', '90s']], ['equipo: barbell', 'descanso: 90s'], name));

  it('`máx` a secas en un ejercicio de repeticiones → AMRAP, con aviso', () => {
    const s = oneSet('100', 'máx');
    expect(s.type).toBe('amrap');
    expect(s.reps).toBe('');
    expect(warnsFor('máx').some((w) => /AMRAP/.test(w))).toBe(true);
  });

  it('`max` sin tilde y `MÁX` también son máx', () => {
    expect(oneSet('100', 'max').type).toBe('amrap');
    expect(oneSet('100', 'MÁX').type).toBe('amrap');
  });

  it('el tipo `amrap` o la palabra AMRAP: set AMRAP, hereda peso, reps vacías', () => {
    expect(oneSet('100', '', 'amrap').type).toBe('amrap');
    expect(oneSet('100', 'AMRAP').type).toBe('amrap');
    expect(oneSet('100', 'AMRAP').reps).toBe('');
  });

  it('`máx` dentro de un set top/back no es AMRAP: avisa y queda sin reps', () => {
    const s = oneSet('100', 'máx', 'top');
    expect(s.type).toBe('top');
    expect(s.reps).toBe('');
    expect(warnsFor('máx', 'top').some((w) => /no parseables/.test(w))).toBe(true);
  });

  it.each(['máx s', 'máx seg', 'max s', 'máx sec', 'Máx. s'])('`%s` = máximo por tiempo: tipo normal, nunca AMRAP, sin aviso', (reps) => {
    const md = withRows([['normal', '-', reps, '-', '60s']], ['equipo: bodyweight', 'descanso: 60s'], 'Plancha');
    const s = firstEx(md).sets[0];
    expect(s.type).toBe('normal');
    expect(s._rawReps).toBe(reps);
    expect(warningsOf(md).filter((w) => /AMRAP|no parseables/.test(w))).toEqual([]);
  });

  it.each(['25s', '45seg', '10min', '30-40s', '1-2min', '38s'])('reps con formato de duración (%s): se reconoce como tiempo, sin aviso', (reps) => {
    const md = withRows([['normal', '-', reps, '-', '60s']], ['equipo: bodyweight', 'descanso: 60s'], 'Handstand');
    expect(firstEx(md).sets[0]._rawReps).toBe(reps);
    expect(warningsOf(md).filter((w) => /Reps no parseables/.test(w))).toEqual([]);
  });

  it('reps no numéricas ("intento libre"): el set se importa y las reps quedan vacías', () => {
    const md = withRows([['normal', '100', 'intento libre', '8', '90s']]);
    expect(firstEx(md).sets).toHaveLength(1);
    expect(firstEx(md).sets[0].reps).toBe('');
    expect(warningsOf(md).some((w) => /Reps no parseables/.test(w))).toBe(true);
  });

  it('reps numéricas y rango: número real / plan', () => {
    expect(oneSet('100', '5').reps).toBe('5');
    const r = oneSet('100', '6-8');
    expect(r.reps).toBe('');
    expect(r.planned.reps).toBe('6-8');
  });
});

describe('RPE y tipo de set (Contrato §4)', () => {
  it('rango de RPE (con -, – o —): el límite inferior queda como RPE planificado, sin RPE real', () => {
    for (const rango of ['7.5-8', '7.5–8', '7.5—8']) {
      const s = oneSet('100', '5', 'normal', rango);
      expect(s.rpe, rango).toBe('');
      expect(s.plannedRpe, rango).toBe('7.5');
      expect(s.planned.rpeText, rango).toBe(rango);
    }
  });

  it('un RPE numérico es el RPE', () => {
    expect(oneSet('100', '5', 'normal', '8.5').rpe).toBe('8.5');
  });

  it('un RPE que no se entiende avisa', () => {
    const md = withRows([['normal', '100', '5', 'duro', '90s']]);
    expect(warningsOf(md).some((w) => /RPE no parseable/.test(w))).toBe(true);
  });

  it.each(['warmup', 'top', 'back', 'normal', 'drop', 'amrap', 'myo'])('tipo "%s" es válido', (t) => {
    expect(oneSet('100', '5', t).type).toBe(t);
  });

  // DIFERENCIA CON EL CONTRATO (reportada, no ajustada). Contrato §4, tabla de tipos de set: "`back` /
  // `backoff`". El parser solo reconoce `back` (VALID_SET_TYPES); `backoff` cae a "Tipo desconocido" → normal.
  it.fails('DIFERENCIA-CONTRATO §4: `backoff` es un tipo válido, igual que `back`', () => {
    expect(oneSet('100', '5', 'backoff').type).toBe('backoff');
  });

  it('el tipo se lee sin mayúsculas; uno desconocido avisa y queda normal', () => {
    expect(oneSet('100', '5', 'TOP').type).toBe('top');
    const md = withRows([['rarito', '100', '5', '8', '90s']]);
    expect(firstEx(md).sets[0].type).toBe('normal');
    expect(warningsOf(md).some((w) => /Tipo desconocido/.test(w))).toBe(true);
  });

  it('el plan por set guarda Peso, Reps y RPE tal como los escribió el Coach (§4)', () => {
    const s = oneSet('110-113', '3-5', 'top', '7.5–8');
    expect(s.planned).toEqual({ weight: '110-113', reps: '3-5', rpeText: '7.5–8' });
  });
});

describe('descanso (Contrato §3)', () => {
  const restOf = (valor) => firstEx(withRows([['normal', '100', '5', '8', '-']], ['equipo: barbell', ...(valor ? [`descanso: ${valor}`] : [])])).restSeconds;

  it('180s, 90s y 2min', () => {
    expect(restOf('180s')).toBe(180);
    expect(restOf('90s')).toBe(90);
    expect(restOf('2min')).toBe(120);
  });

  it('si falta, la app asume 90 s', () => {
    expect(restOf(null)).toBe(90);
  });

  it('parseRestSeconds', () => {
    expect(parseRestSeconds('90s')).toBe(90);
    expect(parseRestSeconds('2min')).toBe(120);
    expect(parseRestSeconds('')).toBeFalsy();
    expect(parseRestSeconds(undefined)).toBeFalsy();
  });

  // DIFERENCIA CON EL CONTRATO (reportada, no ajustada). Contrato §3 `descanso`: "Si falta, la app
  // asume 90 s sin avisar." El parser avisa ("sin descanso — se asume 90s").
  it.fails('DIFERENCIA-CONTRATO §3: un `descanso` ausente se asume en 90 s SIN avisar', () => {
    const md = withRows([['normal', '100', '5', '8', '-']], ['equipo: barbell']);
    expect(warningsOf(md).filter((w) => /descanso/.test(w))).toEqual([]);
  });
});

describe('`familia:` (Contrato §3, v1.8)', () => {
  const famDe = (valor, name = 'Sentadilla Zercher') =>
    parse(routineMd({ exercises: [exBlock({ name, bullets: ['equipo: barbell', `familia: ${valor}`, 'descanso: 150s'], rows: [['normal', '100', '5', '8', '150s']] })] }));

  it('una familia existente se toma con su grafía del Catálogo (SENTADILLA → Sentadilla), sin aviso', () => {
    const r = famDe('SENTADILLA');
    expect(r.routine.exercises[0].familia).toBe('Sentadilla');
    expect(r.warnings.some((w) => /Familia nueva/.test(w))).toBe(false);
  });

  it('sin mayúsculas ni tildes: "curl de biceps" → Curl de Bíceps', () => {
    expect(famDe('curl de biceps').routine.exercises[0].familia).toBe('Curl de Bíceps');
  });

  it('"Sentadila" (mal escrita) crea una familia nueva y lo avisa', () => {
    const r = famDe('Sentadila');
    expect(r.routine.exercises[0].familia).toBe('Sentadila');
    expect(r.warnings.some((w) => /Familia nueva: Sentadila/.test(w))).toBe(true);
  });

  it('las comillas alrededor del valor se ignoran', () => {
    expect(famDe('"Sentadilla"').routine.exercises[0].familia).toBe('Sentadilla');
    expect(famDe("'Sentadilla'").routine.exercises[0].familia).toBe('Sentadilla');
  });

  it('reconoce las familias propias del atleta', () => {
    setMeta('Mi Ejercicio', { family: 'Mi Familia' });
    const r = famDe('mi familia');
    expect(r.routine.exercises[0].familia).toBe('Mi Familia');
    expect(r.warnings.some((w) => /Familia nueva/.test(w))).toBe(false);
  });

  it('un YAML sin `familia:` funciona igual que antes: el ejercicio no trae el campo', () => {
    const e = firstEx(routineMd({ exercises: [simpleEx()] }));
    expect('familia' in e).toBe(false);
  });

  it('una familia nueva sobre un ejercicio que ya tiene familia no avisa', () => {
    const r = famDe('Mi Familia Nueva', 'Press Banca');
    expect(r.warnings.some((w) => /Familia nueva/.test(w))).toBe(false);
  });
});

describe('campos del ejercicio: tag, superset, backoff, unilateral', () => {
  it('tag válido se sugiere; uno desconocido queda null', () => {
    const ok = firstEx(withRows([['normal', '100', '5', '8', '90s']], ['equipo: barbell', 'tag: main_lift', 'descanso: 90s']));
    expect(ok.tagSuggested).toBe('main_lift');
    const mal = firstEx(withRows([['normal', '100', '5', '8', '90s']], ['equipo: barbell', 'tag: raro', 'descanso: 90s']));
    expect(mal.tagSuggested).toBeNull();
  });

  it('backoff_pct de ejercicio: 0.97 vale; 88 avisa con pista y se ignora; fuera de rango se ignora', () => {
    const rows = [['normal', '100', '5', '8', '90s']];
    expect(firstEx(withRows(rows, ['equipo: barbell', 'backoff_pct: 0.97', 'descanso: 90s'])).backoffPct).toBe(0.97);
    const md88 = withRows(rows, ['equipo: barbell', 'backoff_pct: 88', 'descanso: 90s']);
    expect(firstEx(md88).backoffPct).toBeUndefined();
    expect(warningsOf(md88).some((w) => /0\.88/.test(w))).toBe(true);
    expect(firstEx(withRows(rows, ['equipo: barbell', 'backoff_pct: 0.3', 'descanso: 90s'])).backoffPct).toBeUndefined();
  });

  it('`unilateral:` en el YAML se acepta (sin avisos) pero no se declara en el contrato: la app lo sabe por su tabla', () => {
    const md = withRows([['normal', '30', '10', '8', '90s']], ['equipo: dumbbell', 'unilateral: true', 'descanso: 90s'], 'Remo Mancuerna');
    expect(parse(md).success).toBe(true);
    expect(warningsOf(md).filter((w) => /unilateral/i.test(w))).toEqual([]);
  });

  it('superset: mismo valor = mismo grupo; no consecutivo avisa', () => {
    const a = (name) => exBlock({ name, bullets: ['equipo: cable', 'superset: A', 'descanso: 60s'], rows: [['normal', '20', '10', '8', '60s']] });
    const sin = exBlock({ name: 'Facepull', bullets: ['equipo: cable', 'descanso: 60s'], rows: [['normal', '20', '10', '8', '60s']] });
    const ok = parse(routineMd({ exercises: [a('Aperturas'), a('Pájaros')] }));
    expect(ok.routine.exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A']);
    expect(ok.warnings.some((w) => /no es consecutivo/.test(w))).toBe(false);
    const roto = parse(routineMd({ exercises: [a('Aperturas'), sin, a('Pájaros')] }));
    expect(roto.warnings.some((w) => /no es consecutivo/.test(w))).toBe(true);
  });
});

describe('bloque (Contrato §2)', () => {
  const header = (extra) => `nombre: LEGS\nfecha: 2026-01-05\nbloque:\n  id: 3A\n  nombre: Bloque 3A\n  tipo: intensification\n  aplica_a: [main_lift]\n  params:\n    reps_rango: [3, 6]\n    rpe_rango: [7.5, 8.5]\n    backoff_pct: ${extra}\n  semana: 1`;

  it('el bloque va dentro del header y se lee', () => {
    const r = parse(routineMd({ header: header('0.88'), exercises: [simpleEx()] }));
    expect(r.success).toBe(true);
    expect(r.routine.blockMeta).toBeTruthy();
    expect(JSON.stringify(r.routine.blockMeta)).toContain('3A');
  });

  it('backoff_pct de bloque fuera de rango (88) avisa y se ignora', () => {
    const r = parse(routineMd({ header: header('88'), exercises: [simpleEx()] }));
    expect(r.warnings.some((w) => /fuera de rango/.test(w))).toBe(true);
  });
});
