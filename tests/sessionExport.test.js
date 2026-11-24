import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateSessionReport } from '../src/utils/sessionExport.js';
import { ex, session, st, setMeta } from './fixtures/builders.js';

// Contrato v1.8.4 §5 (reporte de sesión). Zona America/Santiago (setup); el reloj se fija para la ventana del 1RM.
const NOW = '2026-06-15T15:00:00Z';
const daysAgo = (d) => new Date(Date.parse(NOW) - d * 86400000).toISOString();

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); });

const sesion = (exercises, extra = {}) => ({ name: 'LEGS', completedAt: '2026-06-12T15:30:00.000Z', exercises, ...extra });
const report = (s, opts) => generateSessionReport(s, opts);
const lines = (s, opts) => report(s, opts).split('\n');

const BLOCK = { id: 'b3A', name: 'Bloque 3A — Intensificación', type: 'intensification', status: 'active', appliesTo: ['main_lift'], params: { repsRange: [3, 6], rpeRange: [7.5, 8.5] } };

describe('encabezado y resumen', () => {
  it('sin sesión, texto vacío', () => {
    expect(report(null)).toBe('');
    expect(report(undefined)).toBe('');
  });

  it('fecha local con día de la semana y hora (America/Santiago, UTC-4 en invierno)', () => {
    const l = lines(sesion([ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })]));
    expect(l[0]).toBe('=== REPORTE DE SESIÓN ===');
    expect(l[1]).toBe('Fecha: 2026-06-12 (viernes, 11:30)');
    expect(l[2]).toBe('Sesión: LEGS');
  });

  it('una sesión terminada a las 21:00 locales no cambia de día (la fecha no sale en UTC)', () => {
    const l = lines(sesion([ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })], { completedAt: '2026-06-13T01:00:00.000Z' }));
    expect(l[1]).toBe('Fecha: 2026-06-12 (viernes, 21:00)');
  });

  it('duración en minutos solo si hay', () => {
    expect(report(sesion([ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })], { durationSec: 3900 }))).toContain('Duración: 65 min');
    expect(report(sesion([ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })]))).not.toContain('Duración:');
  });

  it('resumen: series de trabajo, volumen, RPE promedio y pedido', () => {
    const r = report(sesion([ex('Sentadilla', 'barbell', { sets: [st(60, 5, '', { type: 'warmup' }), st(100, 5, 8), st(100, 5, 7)] })]), { pedidoText: 'Análisis libre' });
    expect(r).toContain('## Resumen\n- 2 series · 1000 kg·rep\n- RPE promedio: 7.5');
    expect(r.endsWith('=== PEDIDO ===\nAnálisis libre')).toBe(true);
  });
});

describe('sets, volumen y PC', () => {
  it('formato de cada set: tipo en mayúsculas y "kg × reps @ RPE"', () => {
    const l = lines(sesion([ex('Sentadilla', 'barbell', { sets: [st(150, 5, 8, { type: 'top' }), st(132.5, 5, 7.5, { type: 'back' })] })]));
    expect(l).toContain('    1. TOP     150 kg × 5 @ RPE 8');
    expect(l).toContain('    2. BACK    132.5 kg × 5 @ RPE 7.5');
    expect(l).toContain('  Real:');
  });

  it('volumen = peso × reps de los sets de trabajo, sin warmups', () => {
    const r = report(sesion([ex('Sentadilla', 'barbell', { sets: [st(60, 5, '', { type: 'warmup' }), st(150, 5, 8, { type: 'top' }), st(132.5, 5, 7.5, { type: 'back' })] })]));
    expect(r).toContain('  Volumen: 1412 kg·rep');
  });

  it('el volumen se imprime con separador de miles (es-ES) cuando pasa de 4 cifras', () => {
    const sets = Array.from({ length: 5 }, () => st(100, 20, 8));
    expect(report(sesion([ex('Sentadilla', 'barbell', { sets })]))).toContain('  Volumen: 10.000 kg·rep');
  });

  it('PC = peso corporal sin carga externa', () => {
    const r = report(sesion([ex('Dominadas', 'bodyweight', { sets: [st('', 8, 8)] })]));
    expect(r).toContain('    1. NORMAL  PC × 8 @ RPE 8');
  });

  it('peso corporal sin lastre no aporta volumen ni imprime la línea de volumen', () => {
    const r = report(sesion([ex('Dominadas', 'bodyweight', { sets: [st('', 8, 8), st('', 7, 8)] })]));
    expect(r).not.toContain('Volumen:');
    expect(r).toContain('- 2 series · 0 kg·rep');
  });

  it('un ejercicio por tiempo aporta 0 de volumen y muestra el tiempo real', () => {
    const r = report(sesion([ex('Plancha', 'bodyweight', { sets: [{ type: 'normal', seconds: 42, completed: true }] })]));
    expect(r).toContain('    1. NORMAL  42 s');
    expect(r).not.toContain('Volumen:');
  });

  it('un ejercicio por tiempo lleva el compañero como sufijo', () => {
    setMeta('Plancha', { companion: 'difficulty' });
    const r = report(sesion([ex('Plancha', 'bodyweight', { sets: [{ type: 'normal', seconds: 25, companionValue: '2', completed: true }] })]));
    expect(r).toContain('25 s · Media');
  });

  it('un ejercicio sin ningún set con datos no aparece', () => {
    const r = report(sesion([
      ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] }),
      ex('Facepull', 'cable', { sets: [{ type: 'normal', weight: '', reps: '', completed: false }] }),
    ]));
    expect(r).toContain('## Sentadilla');
    expect(r).not.toContain('Facepull');
  });

  it('el orden de los ejercicios es el orden de ejecución', () => {
    const r = report(sesion([
      ex('Facepull', 'cable', { sets: [st(25, 15, 8)] }), ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] }), ex('Prensa de Piernas', 'machine', { sets: [st(200, 10, 8)] }),
    ]));
    const pos = ['## Facepull', '## Sentadilla', '## Prensa de Piernas'].map((h) => r.indexOf(h));
    expect(pos.every((i) => i >= 0)).toBe(true);
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
  });
});

describe('molestia reportada: la única marca automática', () => {
  it('una nota con palabra de dolor marca el set y el resumen', () => {
    const r = report(sesion([ex('Press Banca', 'barbell', { sets: [st(100, 5, 8, { notes: 'molestia en el hombro' })] })]));
    expect(r).toContain('   ⚠️ molestia reportada');
    expect(r).toContain('- Flags: molestia reportada');
    expect(r).toContain('Nota set 1: "molestia en el hombro"');
  });
  it('sin palabra de dolor no hay marca', () => {
    const r = report(sesion([ex('Press Banca', 'barbell', { sets: [st(100, 5, 8, { notes: 'rápido' })] })]));
    expect(r).not.toContain('molestia reportada');
    expect(r).not.toContain('Flags:');
  });
  it('las notas del ejercicio salen como "Nota ejercicio:"', () => {
    const r = report(sesion([ex('Press Banca', 'barbell', { exerciseNotes: ' agarre más ancho ', sets: [st(100, 5, 8)] })]));
    expect(r).toContain('  Nota ejercicio: "agarre más ancho"');
  });
});

describe('Plan y Bloque (§5)', () => {
  const tagged = (tag, sets) => ex('Sentadilla', 'barbell', { tag, sets });

  it('un ejercicio con tag en aplica_a recibe "Plan:" y "Bloque:"', () => {
    const l = lines(sesion([tagged('main_lift', [st(150, 5, 8)])]), { blocks: [BLOCK], blockSessionCounts: new Map([['b3A', 9]]) });
    expect(l).toContain('## Sentadilla [main_lift]');
    expect(l).toContain('  Plan: 3-6 reps, RPE 7.5-8.5');
    expect(l).toContain('  Bloque: Bloque 3A — Intensificación (9 sesiones)');
  });

  it('con una sola sesión, singular; con meta, logradas/meta', () => {
    const uno = report(sesion([tagged('main_lift', [st(150, 5, 8)])]), { blocks: [BLOCK], blockSessionCounts: new Map([['b3A', 1]]) });
    expect(uno).toContain('(1 sesión)');
    const meta = report(sesion([tagged('main_lift', [st(150, 5, 8)])]), { blocks: [{ ...BLOCK, sessionsTarget: 12 }], blockSessionCounts: new Map([['b3A', 9]]) });
    expect(meta).toContain('(9/12)');
  });

  it('un tag fuera de aplica_a no recibe plan', () => {
    const r = report(sesion([tagged('accessory', [st(150, 5, 8)])]), { blocks: [BLOCK] });
    expect(r).not.toContain('Plan:');
    expect(r).not.toContain('Bloque:');
  });

  it('un ejercicio medido en tiempo nunca lleva línea "Plan:"', () => {
    const r = report(sesion([ex('Plancha', 'bodyweight', { tag: 'main_lift', sets: [{ type: 'normal', seconds: 40, completed: true }] })]), { blocks: [BLOCK] });
    expect(r).not.toContain('Plan:');
  });

  it('un bloque completado no aplica', () => {
    const r = report(sesion([tagged('main_lift', [st(150, 5, 8)])]), { blocks: [{ ...BLOCK, status: 'completed' }] });
    expect(r).not.toContain('Plan:');
  });
});

describe('sufijo "· plan …" (§5)', () => {
  const real = (set) => report(sesion([ex('Sentadilla', 'barbell', { sets: [set] })]));

  it('si lo real se aparta del plan, el set lleva lo planificado al lado', () => {
    const r = real(st(92.5, 5, 8, { type: 'back', planned: { weight: '94', reps: '5', rpeText: '8' } }));
    expect(r).toContain('1. BACK    92.5 kg × 5 @ RPE 8 · plan 94×5 @8');
  });

  it('lo cumplido no lleva sufijo; un RPE dentro del rango cuenta como cumplido', () => {
    expect(real(st(94, 5, 8, { type: 'back', planned: { weight: '94', reps: '5', rpeText: '8' } }))).not.toContain('· plan');
    expect(real(st(94, 5, 8, { type: 'back', planned: { weight: '94', reps: '5', rpeText: '7.5–8.5' } }))).not.toContain('· plan');
  });

  it('un RPE fuera del rango sí lleva sufijo', () => {
    expect(real(st(94, 5, 9.5, { type: 'back', planned: { weight: '94', reps: '5', rpeText: '7.5–8.5' } }))).toContain('· plan 94×5 @7.5–8.5');
  });

  it('los warmups nunca llevan sufijo', () => {
    expect(real(st(40, 5, '', { type: 'warmup', planned: { weight: '60', reps: '5' } }))).not.toContain('· plan');
  });

  it('una sesión vieja sin plan no lleva sufijo', () => {
    expect(real(st(92.5, 5, 8, { type: 'back' }))).not.toContain('· plan');
  });

  it('en tiempos: el tiempo planificado al lado; con compañero va después de él', () => {
    setMeta('Handstand', { companion: 'difficulty' });
    const r = report(sesion([ex('Handstand', 'bodyweight', { sets: [{ type: 'normal', seconds: 25, companionValue: '2', completed: true, planned: { reps: '38s' } }] })]));
    expect(r).toContain('25 s · Media · plan 38s');
  });

  it('un tiempo dentro del rango no lleva sufijo, y "máx s" nunca', () => {
    const rango = report(sesion([ex('Handstand', 'bodyweight', { sets: [{ type: 'normal', seconds: 35, completed: true, planned: { reps: '30-40s' } }] })]));
    expect(rango).not.toContain('· plan');
    const max = report(sesion([ex('Handstand', 'bodyweight', { sets: [{ type: 'normal', seconds: 35, completed: true, planned: { reps: 'máx s' } }] })]));
    expect(max).not.toContain('· plan');
  });
});

describe('nombre con implemento (§5, v1.8.3)', () => {
  it('el mismo nombre con dos implementos en la sesión se separa: "· polea" / "· mancuerna"', () => {
    const r = report(sesion([
      ex('Elevaciones Laterales', 'cable', { sets: [st(15, 12, 8)] }),
      ex('Elevaciones Laterales', 'dumbbell', { sets: [st(8, 12, 8)] }),
    ]));
    expect(r).toContain('## Elevaciones Laterales · polea');
    expect(r).toContain('## Elevaciones Laterales · mancuerna');
  });
  it('un solo implemento: el nombre a secas', () => {
    expect(report(sesion([ex('Elevaciones Laterales', 'cable', { sets: [st(15, 12, 8)] })]))).toContain('## Elevaciones Laterales\n');
  });
});

describe('1RM estimado en el reporte (§5)', () => {
  const hist = (n) => Array.from({ length: n }, (_, i) => session(daysAgo(3 + i), [ex('Sentadilla', 'barbell', { sets: [st(150, 5, 8)] })], { historyId: `h${i}` }));

  it('línea de 1RM con confianza y N, "referencia, no máximo del día"', () => {
    const allSessions = hist(7);
    const r = report(sesion([ex('Sentadilla', 'barbell', { sets: [st(150, 5, 8)] })]), { allSessions });
    expect(r).toContain('  1RM est.: 178.5 kg (confianza alta, N=7) — referencia, no máximo del día');
  });
  it('confianza media con 3-5 y baja con menos', () => {
    expect(report(sesion([ex('Sentadilla', 'barbell', { sets: [st(150, 5, 8)] })]), { allSessions: hist(4) })).toContain('confianza media, N=4');
    expect(report(sesion([ex('Sentadilla', 'barbell', { sets: [st(150, 5, 8)] })]), { allSessions: hist(1) })).toContain('confianza baja, N=1');
  });
  it('solo con carga externa comparable: máquina, polea, peso corporal y sin implemento no llevan 1RM', () => {
    for (const eq of ['machine', 'cable', 'bodyweight', null]) {
      const allSessions = [session(daysAgo(3), [ex('Prensa de Piernas', eq, { sets: [st(200, 10, 8)] })])];
      expect(report(sesion([ex('Prensa de Piernas', eq, { sets: [st(200, 10, 8)] })]), { allSessions }), String(eq)).not.toContain('1RM est.');
    }
  });
  it('barra, mancuerna, multipower y landmine sí', () => {
    for (const eq of ['barbell', 'dumbbell', 'smith', 'landmine']) {
      const allSessions = [session(daysAgo(3), [ex('Press Banca', eq, { sets: [st(100, 5, 8)] })])];
      expect(report(sesion([ex('Press Banca', eq, { sets: [st(100, 5, 8)] })]), { allSessions }), eq).toContain('1RM est.');
    }
  });
  it('un ejercicio con landmine lleva la línea de 1RM con su confianza y N', () => {
    const allSessions = [session(daysAgo(3), [ex('Remo Landmine', 'landmine', { sets: [st(40, 10, 8)] })])];
    expect(report(sesion([ex('Remo Landmine', 'landmine', { sets: [st(40, 10, 8)] })]), { allSessions }))
      .toContain('  1RM est.: 53 kg (confianza baja, N=1) — referencia, no máximo del día');
  });
  it('kettlebell y banda no llevan 1RM', () => {
    for (const eq of ['kettlebell', 'band']) {
      const allSessions = [session(daysAgo(3), [ex('Sentadilla Goblet', eq, { sets: [st(24, 10, 8)] })])];
      expect(report(sesion([ex('Sentadilla Goblet', eq, { sets: [st(24, 10, 8)] })]), { allSessions }), eq).not.toContain('1RM est.');
    }
  });
  it('es del implemento de ese ejercicio: el de otro implemento no suma', () => {
    const allSessions = [
      session(daysAgo(3), [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8)] })]),
      session(daysAgo(4), [ex('Press Banca', 'dumbbell', { sets: [st(60, 8, 8)] })]),
    ];
    expect(report(sesion([ex('Press Banca', 'dumbbell', { sets: [st(60, 8, 8)] })]), { allSessions })).toContain('N=1');
  });
});

describe('tiempo por ejercicio y supersets (§5)', () => {
  const fin = (min) => new Date(Date.parse('2026-06-12T14:00:00.000Z') + min * 60000).toISOString();

  it('Tiempo = minutos desde que se cerró el ejercicio anterior (o el inicio de la sesión)', () => {
    const s = sesion([
      ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)], finishedAt: fin(24) }),
      ex('Prensa de Piernas', 'machine', { sets: [st(200, 10, 8)], finishedAt: fin(35) }),
    ], { startTime: fin(0) });
    const r = report(s);
    expect(r).toContain('  Tiempo: 24 min');
    expect(r).toContain('  Tiempo: 11 min');
  });

  it('sin cierre del ejercicio no se estima nada', () => {
    expect(report(sesion([ex('Sentadilla', 'barbell', { sets: [st(100, 5, 8)] })], { startTime: fin(0) }))).not.toContain('Tiempo:');
  });

  it('un superset: cada miembro lleva [superset A] y hay UNA línea de tiempo, en el primero', () => {
    const s = sesion([
      ex('Aperturas', 'cable', { supersetId: 'x1', sets: [st(20, 12, 8)], finishedAt: fin(18) }),
      ex('Pájaros', 'cable', { supersetId: 'x1', sets: [st(10, 12, 8)], finishedAt: fin(18) }),
    ], { startTime: fin(11) });
    const l = lines(s);
    expect(l).toContain('## Aperturas [superset A]');
    expect(l).toContain('## Pájaros [superset A]');
    expect(l.filter((x) => x.startsWith('  Tiempo superset'))).toEqual(['  Tiempo superset A (2 ejercicios): 7 min']);
    expect(l.indexOf('  Tiempo superset A (2 ejercicios): 7 min')).toBeLessThan(l.indexOf('## Pájaros [superset A]'));
  });

  it('las letras se regeneran por orden de aparición en la sesión', () => {
    const s = sesion([
      ex('Aperturas', 'cable', { supersetId: 'zz9', sets: [st(20, 12, 8)] }),
      ex('Pájaros', 'cable', { supersetId: 'zz9', sets: [st(10, 12, 8)] }),
      ex('Curl de Bíceps', 'cable', { supersetId: 'aa1', sets: [st(15, 12, 8)] }),
      ex('Hammer Curl', 'cable', { supersetId: 'aa1', sets: [st(15, 12, 8)] }),
    ]);
    const r = report(s);
    expect(r).toContain('## Aperturas [superset A]');
    expect(r).toContain('## Curl de Bíceps [superset B]');
  });

  it('si falta algún cierre del grupo, la línea de tiempo se omite', () => {
    const s = sesion([
      ex('Aperturas', 'cable', { supersetId: 'x1', sets: [st(20, 12, 8)], finishedAt: fin(18) }),
      ex('Pájaros', 'cable', { supersetId: 'x1', sets: [st(10, 12, 8)] }),
    ], { startTime: fin(11) });
    expect(report(s)).not.toContain('Tiempo superset');
  });
});
