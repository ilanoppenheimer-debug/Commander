import { describe, it, expect } from 'vitest';
import {
  variantLabel, EQUIPMENT_LABEL_ES, makeSessionLabeler, createVariantIndex, matchesVariant,
  makeVariantMatcher, equipmentMatches, resolveHistoryEquipment, isTimeMeasured,
  defaultImplement, offeredImplements,
} from '../src/utils/exerciseVariant.js';
import { canonicalExerciseName } from '../src/constants/exerciseFamilies.js';
import { setMeta, setMeasurementFor, ex, session } from './fixtures/builders.js';

// Contrato v1.8.3 §5 (nombre con implemento) y Catálogo 8.1 / 8.3.

describe('variantLabel — formato "Nombre · implemento"', () => {
  it('usa " · " y el implemento en español, nunca paréntesis', () => {
    expect(variantLabel('Elevaciones Laterales', 'cable')).toBe('Elevaciones Laterales · polea');
    expect(variantLabel('Curl de Bíceps', 'barbell')).toBe('Curl de Bíceps · barra');
    expect(variantLabel('Elevaciones Laterales', 'cable')).not.toMatch(/[()]/);
  });

  it.each([
    ['barbell', 'barra'], ['dumbbell', 'mancuerna'], ['cable', 'polea'], ['machine', 'máquina'],
    ['smith', 'multipower'], ['kettlebell', 'kettlebell'], ['landmine', 'landmine'],
    ['band', 'banda elástica'], ['bodyweight', 'peso corporal'],
  ])('Catálogo 8.3: %s se muestra como "%s"', (id, es) => {
    expect(EQUIPMENT_LABEL_ES[id]).toBe(es);
    expect(variantLabel('Press Banca', id)).toBe(`Press Banca · ${es}`);
  });

  it('sin implemento sale el nombre a secas', () => {
    expect(variantLabel('Press Banca', null)).toBe('Press Banca');
    expect(variantLabel('Press Banca', undefined)).toBe('Press Banca');
  });

  it('un ejercicio por tiempo nunca lleva sufijo (el implemento no separa números)', () => {
    expect(variantLabel('Plancha', 'bodyweight')).toBe('Plancha');
    expect(variantLabel('Handstand', 'bodyweight')).toBe('Handstand');
    expect(variantLabel('Bicicleta', 'machine')).toBe('Bicicleta');
  });

  it('un implemento desconocido se muestra tal cual, sin romper', () => {
    expect(variantLabel('Press Banca', 'raro')).toBe('Press Banca · raro');
  });
});

describe('makeSessionLabeler — v1.8.3: dos implementos en la MISMA sesión llevan siempre sufijo', () => {
  const sesion = [
    ex('Elevaciones Laterales', 'cable'),
    ex('Elevaciones Laterales', 'dumbbell'),
    ex('Press Banca', 'barbell'),
  ];

  it('caso real: Elevaciones Laterales con polea y con mancuerna en la misma sesión', () => {
    const label = makeSessionLabeler(sesion);
    expect(label(sesion[0])).toBe('Elevaciones Laterales · polea');
    expect(label(sesion[1])).toBe('Elevaciones Laterales · mancuerna');
  });

  it('un nombre con un solo implemento queda sin sufijo', () => {
    const label = makeSessionLabeler(sesion);
    expect(label(sesion[2])).toBe('Press Banca');
  });

  it('el mismo nombre con el mismo implemento dos veces no se separa', () => {
    const s = [ex('Press Banca', 'barbell'), ex('Press Banca', 'barbell')];
    const label = makeSessionLabeler(s);
    expect(label(s[0])).toBe('Press Banca');
  });

  it('mayúsculas y tildes no crean otro nombre: se separan igual', () => {
    const s = [ex('Elevaciones laterales', 'cable'), ex('ELEVACIONES LATERALES', 'dumbbell')];
    const label = makeSessionLabeler(s);
    expect(label(s[0])).toBe('Elevaciones laterales · polea');
    expect(label(s[1])).toBe('ELEVACIONES LATERALES · mancuerna');
  });

  it('nameOf imprime la grafía canónica y el sufijo usa ese nombre', () => {
    const s = [ex('elevaciones laterales', 'cable'), ex('elevaciones laterales', 'dumbbell')];
    const label = makeSessionLabeler(s, canonicalExerciseName);
    expect(label(s[0])).toBe('Elevaciones Laterales · polea');
    expect(label(s[1])).toBe('Elevaciones Laterales · mancuerna');
  });

  it('nameOf también aplica cuando no hay sufijo', () => {
    const s = [ex('press banca', 'barbell')];
    expect(makeSessionLabeler(s, canonicalExerciseName)(s[0])).toBe('Press Banca');
  });

  it('un ejercicio por tiempo nunca se separa aunque aparezca con dos implementos', () => {
    const s = [ex('Plancha', 'bodyweight'), ex('Plancha', 'machine')];
    const label = makeSessionLabeler(s);
    expect(label(s[0])).toBe('Plancha');
    expect(label(s[1])).toBe('Plancha');
  });

  it('una sesión vieja sin implemento usa la metadata del ejercicio', () => {
    setMeta('Remo Mancuerna', { equipment: 'dumbbell' });
    const s = [ex('Remo Mancuerna', null), ex('Remo Mancuerna', 'cable')];
    const label = makeSessionLabeler(s);
    expect(label(s[0])).toBe('Remo Mancuerna · mancuerna');
    expect(label(s[1])).toBe('Remo Mancuerna · polea');
  });

  it('el implemento guardado en la sesión gana sobre la metadata', () => {
    setMeta('Press Banca', { equipment: 'dumbbell' });
    const s = [ex('Press Banca', 'barbell'), ex('Press Banca', 'smith')];
    const label = makeSessionLabeler(s);
    expect(label(s[0])).toBe('Press Banca · barra');
  });

  it('cada sesión se etiqueta por separado: un implemento por sesión no lleva sufijo', () => {
    const a = [ex('Elevaciones Laterales', 'cable')];
    const b = [ex('Elevaciones Laterales', 'dumbbell')];
    expect(makeSessionLabeler(a)(a[0])).toBe('Elevaciones Laterales');
    expect(makeSessionLabeler(b)(b[0])).toBe('Elevaciones Laterales');
  });

  it('entradas vacías o inválidas no rompen', () => {
    expect(() => makeSessionLabeler(undefined)).not.toThrow();
    expect(() => makeSessionLabeler(null)).not.toThrow();
    const label = makeSessionLabeler([]);
    expect(label(ex('Press Banca', 'barbell'))).toBe('Press Banca');
    expect(makeSessionLabeler([{ sets: [] }, null])(ex('Press Banca'))).toBe('Press Banca');
  });
});

describe('matchesVariant — nombre + implemento separan los números (Catálogo 8.1)', () => {
  it('mismo nombre e implemento: es la misma variante', () => {
    expect(matchesVariant(ex('Curl de Bíceps', 'barbell'), 'Curl de Bíceps', 'barbell')).toBe(true);
  });

  it('mismo nombre, otro implemento: NO es la misma variante (números separados)', () => {
    expect(matchesVariant(ex('Curl de Bíceps', 'dumbbell'), 'Curl de Bíceps', 'barbell')).toBe(false);
  });

  it('historial viejo sin implemento cuenta para cualquier implemento', () => {
    expect(matchesVariant(ex('Curl de Bíceps'), 'Curl de Bíceps', 'barbell')).toBe(true);
    expect(matchesVariant(ex('Curl de Bíceps'), 'Curl de Bíceps', 'dumbbell')).toBe(true);
  });

  it('el historial sin implemento toma el de la metadata del ejercicio', () => {
    setMeta('Curl de Bíceps', { equipment: 'dumbbell' });
    expect(matchesVariant(ex('Curl de Bíceps'), 'Curl de Bíceps', 'barbell')).toBe(false);
    expect(matchesVariant(ex('Curl de Bíceps'), 'Curl de Bíceps', 'dumbbell')).toBe(true);
  });

  it('sin implemento actual ("sin definir") se compara solo por nombre', () => {
    expect(matchesVariant(ex('Curl de Bíceps', 'cable'), 'Curl de Bíceps', null)).toBe(true);
  });

  it('la identidad ignora mayúsculas, tildes y espacios repetidos (8.1)', () => {
    expect(matchesVariant(ex('curl  de biceps', 'barbell'), 'Curl de Bíceps', 'barbell')).toBe(true);
  });

  it('"con", plural o palabras de más son otro ejercicio (8.1)', () => {
    expect(matchesVariant(ex('Curl de Bíceps con Barra', 'barbell'), 'Curl de Bíceps', 'barbell')).toBe(false);
    expect(matchesVariant(ex('Curl de Bíceps Bayesiano', 'cable'), 'Curl de Bíceps', 'cable')).toBe(false);
  });

  it('un nombre vacío nunca coincide', () => {
    expect(matchesVariant(ex(''), '', null)).toBe(false);
    expect(matchesVariant(ex('Press Banca'), '', null)).toBe(false);
  });

  it('peso corporal y tiempo: el implemento no separa números (8.1)', () => {
    expect(matchesVariant(ex('Plancha', 'machine'), 'Plancha', 'bodyweight')).toBe(true);
    expect(matchesVariant(ex('Handstand', 'bodyweight'), 'Handstand', 'machine')).toBe(true);
  });

  it('makeVariantMatcher y equipmentMatches son coherentes con matchesVariant', () => {
    const m = makeVariantMatcher('Press Banca', 'barbell');
    expect(m(ex('Press Banca', 'barbell'))).toBe(true);
    expect(m(ex('Press Banca', 'dumbbell'))).toBe(false);
    expect(equipmentMatches('barbell', null)).toBe(true);
    expect(equipmentMatches(null, 'cable')).toBe(true);
    expect(equipmentMatches('barbell', 'cable')).toBe(false);
  });
});

describe('createVariantIndex — reportes por período (Contrato §5)', () => {
  it('con un solo implemento en el período, sale el nombre a secas', () => {
    const idx = createVariantIndex([ex('Curl de Bíceps', 'barbell'), ex('Curl de Bíceps', 'barbell')]);
    expect(idx.labelFor('Curl de Bíceps', 'barbell')).toBe('Curl de Bíceps');
    expect(idx.isMulti('curl de biceps')).toBe(false);
  });

  it('con más de un implemento, cada uno sale "Nombre · implemento"', () => {
    const idx = createVariantIndex([ex('Curl de Bíceps', 'barbell'), ex('Curl de Bíceps', 'dumbbell')]);
    expect(idx.labelFor('Curl de Bíceps', 'barbell')).toBe('Curl de Bíceps · barra');
    expect(idx.labelFor('Curl de Bíceps', 'dumbbell')).toBe('Curl de Bíceps · mancuerna');
    expect(idx.isMulti('curl de biceps')).toBe(true);
  });

  it('otro nombre del período no se ve afectado', () => {
    const idx = createVariantIndex([ex('Curl de Bíceps', 'barbell'), ex('Curl de Bíceps', 'dumbbell'), ex('Press Banca', 'barbell')]);
    expect(idx.labelFor('Press Banca', 'barbell')).toBe('Press Banca');
  });

  it('un ejercicio por tiempo nunca se separa', () => {
    const idx = createVariantIndex([ex('Plancha', 'bodyweight'), ex('Plancha', 'machine')]);
    expect(idx.isMulti('plancha')).toBe(false);
    expect(idx.keyOf(ex('Plancha', 'machine')).key).toBe(idx.keyOf(ex('Plancha', 'bodyweight')).key);
  });

  it('una variante distinta tiene otra clave; la misma variante, la misma clave', () => {
    const idx = createVariantIndex([ex('Curl de Bíceps', 'barbell'), ex('Curl de Bíceps', 'dumbbell')]);
    expect(idx.keyOf(ex('Curl de Bíceps', 'barbell')).key).not.toBe(idx.keyOf(ex('Curl de Bíceps', 'dumbbell')).key);
    expect(idx.keyOf(ex('curl de biceps', 'barbell')).key).toBe(idx.keyOf(ex('Curl de Bíceps', 'barbell')).key);
  });

  it('un registro viejo sin implemento se une al único implemento del nombre', () => {
    const idx = createVariantIndex([ex('Curl de Bíceps', 'barbell'), ex('Curl de Bíceps')]);
    expect(idx.keyOf(ex('Curl de Bíceps')).key).toBe(idx.keyOf(ex('Curl de Bíceps', 'barbell')).key);
    expect(idx.isMulti('curl de biceps')).toBe(false);
  });

  it('si el nombre tiene dos implementos, el registro sin implemento queda aparte', () => {
    const idx = createVariantIndex([ex('Curl de Bíceps', 'barbell'), ex('Curl de Bíceps', 'dumbbell'), ex('Curl de Bíceps')]);
    expect(idx.keyOf(ex('Curl de Bíceps')).equipment).toBeNull();
    expect(idx.isMulti('curl de biceps')).toBe(true);
  });
});

describe('resolveHistoryEquipment / isTimeMeasured', () => {
  it('el implemento guardado en la sesión gana; sin él, la metadata; sin nada, null', () => {
    setMeta('Press Banca', { equipment: 'smith' });
    expect(resolveHistoryEquipment({ name: 'Press Banca', equipment: 'barbell' })).toBe('barbell');
    expect(resolveHistoryEquipment({ name: 'Press Banca' })).toBe('smith');
    expect(resolveHistoryEquipment({ name: 'Peso Muerto' })).toBeNull();
    expect(resolveHistoryEquipment(undefined)).toBeNull();
  });

  it('los ejercicios por tiempo del Catálogo ya vienen configurados como tiempo (8.8)', () => {
    for (const n of ['Plancha', 'Plancha Lateral', 'Handstand', 'Handstand en Paralelas', 'Front Lever Tuck', 'Bicicleta']) {
      expect(isTimeMeasured(n)).toBe(true);
    }
    expect(isTimeMeasured('Press Banca')).toBe(false);
  });

  it('la medición que configura el atleta manda sobre la tabla', () => {
    setMeasurementFor('Plancha', 'reps');
    expect(isTimeMeasured('Plancha')).toBe(false);
  });
});

describe('defaultImplement / offeredImplements — implemento al agregar un ejercicio', () => {
  const hist = [
    session('2026-01-05T12:00:00Z', [ex('Curl de Bíceps', 'barbell')]),
    session('2026-01-12T12:00:00Z', [ex('Curl de Bíceps', 'cable')]),
  ];

  it('arranca con el último implemento usado en esa variante', () => {
    expect(defaultImplement('Curl de Bíceps', hist)).toBe('cable');
  });

  it('sin historial, el primero que ofrece el Catálogo', () => {
    expect(defaultImplement('Curl de Bíceps', [])).toBe('barbell');
    expect(defaultImplement('Remo Mancuerna', [])).toBe('dumbbell');
  });

  it('una variante sin implemento declarado queda "sin definir" (null), nunca se adivina', () => {
    expect(defaultImplement('Tibial Anterior', [])).toBeNull();
  });

  it('un ejercicio propio toma el implemento de su metadata', () => {
    setMeta('Mi Ejercicio', { equipment: 'kettlebell' });
    expect(defaultImplement('Mi Ejercicio', [])).toBe('kettlebell');
  });

  it('ofrece los implementos del Catálogo, en su orden', () => {
    expect(offeredImplements('Curl de Bíceps', hist)).toEqual(['barbell', 'dumbbell', 'cable']);
    expect(offeredImplements('Sissy Squat', [])).toEqual(['bodyweight', 'machine']);
  });

  it('un ejercicio propio ofrece con qué se usó', () => {
    const h = [session('2026-02-01T12:00:00Z', [ex('Mi Ejercicio', 'dumbbell')])];
    expect(offeredImplements('Mi Ejercicio', h)).toEqual(['dumbbell']);
  });
});
