import { describe, it, expect } from 'vitest';
import { scoreCandidates, isTableDuplicate } from '../src/utils/routineImport/exerciseMatching.js';
import { DEFAULT_EXERCISE_DB } from '../src/constants/gymConstants.js';
import { FAMILY_TABLE } from '../src/constants/exerciseFamilies.js';
import { ex, session, setMeta } from './fixtures/builders.js';
import { EQUIVALENCIAS_84, SOLO_MAYUSCULAS_84 } from './fixtures/catalogo.js';

// El pool es el mismo que arma findExerciseMatch: ejercicios base + variantes de la tabla.
// (los ejercicios propios del atleta se agregan aparte; acá no hay).
const POOL = [...new Set([...(Array.isArray(DEFAULT_EXERCISE_DB) ? DEFAULT_EXERCISE_DB : []), ...FAMILY_TABLE.map((r) => r.name)])];
const score = (name, opts) => scoreCandidates(name, POOL, opts);
const offered = (m) => [m.exerciseName, ...(m.alternatives || []), ...(m.candidates || [])].filter(Boolean);

// Contrato v1.8.3 §3 (Nombre del ejercicio) y Catálogo 8.1 / 8.4.
describe('exacto: misma identidad (sin mayúsculas, tildes ni espacios repetidos)', () => {
  it('el nombre del Catálogo tal cual', () => {
    expect(score('Press Banca')).toEqual({ type: 'exact', exerciseName: 'Press Banca' });
  });
  it('mayúsculas, tildes y espacios no importan', () => {
    expect(score('press  banca')).toMatchObject({ type: 'exact', exerciseName: 'Press Banca' });
    expect(score('PAJAROS')).toMatchObject({ type: 'exact', exerciseName: 'Pájaros' });
    expect(score('curl de biceps')).toMatchObject({ type: 'exact', exerciseName: 'Curl de Bíceps' });
  });
  it.each(SOLO_MAYUSCULAS_84)('8.4: "%s" es "%s" salvo mayúsculas/tildes → exacto', (viejo, nuevo) => {
    expect(score(viejo)).toMatchObject({ type: 'exact', exerciseName: nuevo });
  });
  it('un nombre vacío o ausente no resuelve nada', () => {
    expect(score('')).toEqual({ type: 'none' });
    expect(score(undefined)).toEqual({ type: 'none' });
  });
});

describe('nombres viejos (8.4): probable, con la variante nueva preseleccionada y el implemento sugerido', () => {
  it.each(EQUIVALENCIAS_84)('"%s" → %s (%s)', (viejo, nuevo, equipo) => {
    const m = score(viejo);
    expect(m.type).toBe('probable');
    expect(m.exerciseName).toBe(nuevo);
    expect(m.suggestedEquipment).toBe(equipo);
    expect(m.suggestedFrom).toBe('regla');
  });

  it('es una red de seguridad, no un permiso: un nombre viejo nunca sale exacto', () => {
    for (const [viejo] of EQUIVALENCIAS_84) expect(score(viejo).type).not.toBe('exact');
  });

  it('Rotaciones internas/externas de hombro → Rotación Externa / Interna con polea', () => {
    const m = score('Rotaciones internas/externas de hombro');
    expect(['probable', 'fuzzy']).toContain(m.type);
    expect(offered(m)).toEqual(expect.arrayContaining(['Rotación Externa']));
    if (m.type === 'probable') {
      expect(['Rotación Externa', 'Rotación Interna']).toContain(m.exerciseName);
      expect(m.suggestedEquipment).toBe('cable');
    }
  });
});

describe('prefijo de rol y sufijo de protocolo: se quitan y van a la nota (8.4, Contrato §3)', () => {
  it('"Dominadas — Test Máximo" → Dominadas, el protocolo a la nota, bodyweight', () => {
    expect(score('Dominadas — Test Máximo')).toMatchObject({
      type: 'exact', exerciseName: 'Dominadas', strippedNote: 'Test Máximo', strippedName: 'Dominadas',
    });
    expect(score('Dominadas — Test Máximo').suggestedEquipment).toBe('bodyweight');
  });

  it('"Handstand en Paralelas — Hold Máximo" → Handstand en Paralelas (protocolo → nota)', () => {
    const m = score('Handstand en Paralelas — Hold Máximo');
    expect(m).toMatchObject({ exerciseName: 'Handstand en Paralelas', strippedNote: 'Hold Máximo' });
    expect(m.suggestedEquipment).toBe('bodyweight');
  });

  it('"Prevención — Extensión de Muñeca" → Extensión de Muñeca con polea; "Prevención" a la nota', () => {
    const m = score('Prevención — Extensión de Muñeca');
    expect(m).toMatchObject({ exerciseName: 'Extensión de Muñeca', strippedNote: 'Prevención' });
    expect(m.suggestedEquipment).toBe('cable');
  });

  it('"Prevención — Manguito Rotador": ofrece Rotación Externa e Interna y "Prevención" va a la nota', () => {
    const m = score('Prevención — Manguito Rotador');
    expect(m.strippedNote).toBe('Prevención');
    expect(offered(m)).toEqual(expect.arrayContaining(['Rotación Externa', 'Rotación Interna']));
    expect(offered(m)).not.toContain('Manguito Rotador');
  });

  it.each([
    ['Press Banca — Activación', 'Activación'],
    ['Press Banca — Calentamiento', 'Calentamiento'],
    ['Plancha — AMRAP', 'AMRAP'],
  ])('"%s" → Press Banca/Plancha con la nota "%s"', (nombre, nota) => {
    const m = score(nombre);
    expect(m.strippedNote).toBe(nota);
    expect(m.type).toBe('exact');
  });

  it('un guion con otro texto NO se quita (no es rol ni protocolo)', () => {
    const m = score('Press Banca — Tempo 3-1-1');
    expect(m.strippedNote).toBeUndefined();
    expect(m.type).not.toBe('exact');
  });

  it('el rol/protocolo se reconoce sin mayúsculas ni tildes', () => {
    expect(score('Dominadas — test maximo').strippedNote).toBe('test maximo');
  });
});

describe('nombre de familia: ofrece SOLO las variantes de esa familia (Contrato §3)', () => {
  it('sin historial ofrece las variantes de la familia (el Contrato no fija cuál queda preseleccionada)', () => {
    const m = score('Curl Femoral');
    expect(m.family).toBe('Curl Femoral');
    expect(offered(m).sort()).toEqual(['Curl Femoral Acostado', 'Curl Femoral Sentado', 'Nordic Curl']);
  });

  it('con historial preselecciona la variante usada más recientemente, con su implemento', () => {
    const history = [
      session('2026-01-05T12:00:00Z', [ex('Curl Femoral Sentado', 'machine')]),
      session('2026-01-12T12:00:00Z', [ex('Nordic Curl', 'bodyweight')]),
    ];
    const m = score('Curl Femoral', { history });
    expect(m).toMatchObject({ type: 'probable', exerciseName: 'Nordic Curl', viaHistory: true, family: 'Curl Femoral' });
    expect(m.suggestedEquipment).toBe('bodyweight');
    expect(m.suggestedFrom).toBe('historial');
    expect(m.alternatives.sort()).toEqual(['Curl Femoral Acostado', 'Curl Femoral Sentado']);
  });

  it('"Cardio": ofrece Bicicleta, Trotadora, Elíptica y Escalera; nunca "Cardio (sin especificar)"', () => {
    const m = score('Cardio');
    expect(m.family).toBe('Cardio');
    expect(m.candidates.sort()).toEqual(['Bicicleta', 'Elíptica', 'Escalera', 'Trotadora']);
    expect(m.candidates).not.toContain('Cardio (sin especificar)');
  });

  it('"Cardio" con historial preselecciona la más reciente, con machine', () => {
    const history = [
      session('2026-01-05T12:00:00Z', [ex('Bicicleta', 'machine')]),
      session('2026-01-09T12:00:00Z', [ex('Trotadora', 'machine')]),
    ];
    expect(score('Cardio', { history })).toMatchObject({ type: 'probable', exerciseName: 'Trotadora', suggestedEquipment: 'machine' });
  });

  it('"Front Lever" ofrece sus cinco variantes y ninguna otra', () => {
    const m = score('Front Lever');
    expect(m.family).toBe('Front Lever');
    expect(offered(m).sort()).toEqual([
      'Front Lever Advanced Tuck', 'Front Lever Full', 'Front Lever One Leg', 'Front Lever Tuck', 'Front Lever con Ayuda',
    ]);
  });

  it('"Remo" (familia) ofrece solo variantes de Remo', () => {
    const m = score('Remo');
    expect(m.family).toBe('Remo');
    for (const n of offered(m)) expect(n.startsWith('Remo')).toBe(true);
  });

  it('"Curl Femoral" no se resuelve como si fuera "Curl Femoral Sentado" en silencio', () => {
    expect(score('Curl Femoral').type).not.toBe('exact');
  });
});

describe('probable: mismo nombre salvo puntuación, palabras de relleno y plural (8.1)', () => {
  it('"Remo con mancuerna" → Remo Mancuerna (8.1: "con" es otro nombre, pero el wizard lo reconduce)', () => {
    const m = score('Remo con mancuerna');
    expect(m.type).toBe('probable');
    expect(m.exerciseName).toBe('Remo Mancuerna');
  });
  it('"Remo mancuernas" (plural) → Remo Mancuerna', () => {
    expect(score('Remo mancuernas')).toMatchObject({ type: 'probable', exerciseName: 'Remo Mancuerna' });
  });
  it('nunca se aplica solo: probable no es exacto', () => {
    expect(score('Remo con mancuerna').type).not.toBe('exact');
  });
});

describe('sin resolver: un nombre que no está en el Catálogo (Contrato §3)', () => {
  it('"Sentadilla Zercher" sale pendiente con sugerencias, nunca exacto ni probable', () => {
    const m = score('Sentadilla Zercher');
    expect(m.type).toBe('fuzzy');
    expect(m.candidates).toEqual(expect.arrayContaining(['Sentadilla']));
  });
  it('algo sin ninguna relación no tiene candidatos', () => {
    expect(score('Xyzzy Qwerty')).toEqual({ type: 'none' });
  });
  it('los candidatos son como mucho 5', () => {
    expect(score('Curl').candidates.length).toBeLessThanOrEqual(5);
  });
});

describe('sugerencia de implemento por historial (Contrato §3: "sugiere el último implemento usado")', () => {
  it('un exacto sin equipo en el YAML sugiere el último implemento del historial', () => {
    const history = [
      session('2026-01-05T12:00:00Z', [ex('Press Banca', 'barbell')]),
      session('2026-01-19T12:00:00Z', [ex('Press Banca', 'dumbbell')]),
    ];
    const m = score('Press Banca', { history });
    expect(m).toMatchObject({ type: 'exact', suggestedEquipment: 'dumbbell', suggestedFrom: 'historial' });
  });
  it('gana la aparición más reciente, no la última del arreglo', () => {
    const history = [
      session('2026-03-01T12:00:00Z', [ex('Press Banca', 'smith')]),
      session('2026-01-05T12:00:00Z', [ex('Press Banca', 'barbell')]),
    ];
    expect(score('Press Banca', { history }).suggestedEquipment).toBe('smith');
  });
  it('una aparición sin implemento no pisa a una con implemento', () => {
    const history = [
      session('2026-01-05T12:00:00Z', [ex('Press Banca', 'barbell')]),
      session('2026-02-05T12:00:00Z', [ex('Press Banca')]),
    ];
    expect(score('Press Banca', { history }).suggestedEquipment).toBe('barbell');
  });
  it('el implemento del historial viejo sin equipo sale de la metadata', () => {
    setMeta('Press Banca', { equipment: 'smith' });
    const history = [session('2026-01-05T12:00:00Z', [ex('Press Banca')])];
    expect(score('Press Banca', { history }).suggestedEquipment).toBe('smith');
  });
  it('sin historial no se sugiere nada (no se adivina)', () => {
    const m = score('Press Banca', { history: [] });
    expect(m.suggestedEquipment).toBeUndefined();
    expect(m.suggestedFrom).toBeUndefined();
  });
  it('el historial se compara por identidad de nombre', () => {
    const history = [session('2026-01-05T12:00:00Z', [ex('PRESS banca', 'smith')])];
    expect(score('Press Banca', { history }).suggestedEquipment).toBe('smith');
  });
});

describe('ejercicios propios que duplican una variante del Catálogo', () => {
  it('isTableDuplicate: una fila propia igual (normalizada) a una variante del Catálogo es esa variante', () => {
    expect(isTableDuplicate('Press Banca')).toBe(true);
    expect(isTableDuplicate('press  banca')).toBe(true);
    expect(isTableDuplicate('Pajaros')).toBe(true);
  });
  it('un ejercicio propio que no está en el Catálogo no es duplicado', () => {
    expect(isTableDuplicate('Mi Ejercicio')).toBe(false);
    expect(isTableDuplicate('Sentadilla Zercher')).toBe(false);
    expect(isTableDuplicate('')).toBe(false);
  });
  it('un ejercicio propio del pool que coincide exacto se asigna solo', () => {
    expect(scoreCandidates('Mi Ejercicio', [...POOL, 'Mi Ejercicio'])).toEqual({ type: 'exact', exerciseName: 'Mi Ejercicio' });
  });
});
