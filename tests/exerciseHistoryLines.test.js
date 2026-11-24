import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatShortDate, extractPrefix, formatPlainSet, collectAppearances, lastLoggedSeconds, buildExerciseShareText,
} from '../src/utils/exerciseHistoryLines.js';
import { localDateStr } from '../src/utils/localDate.js';
import { ex, session, st, setMeta } from './fixtures/builders.js';

// Fechas con zona America/Santiago (tests/setup.js): UTC-4 en invierno, UTC-3 en verano.
const NOW = '2026-06-15T15:00:00Z';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe('fechas locales', () => {
  it('formatShortDate usa el día LOCAL, no el UTC', () => {
    expect(formatShortDate('2026-06-13T01:00:00.000Z')).toBe('12-jun'); // 21:00 del 12 en Santiago
    expect(formatShortDate('2026-06-13T05:00:00.000Z')).toBe('13-jun'); // 01:00 del 13
    expect(formatShortDate('2026-01-05T01:00:00.000Z')).toBe('04-ene'); // verano: 22:00 del 4
  });
  it('sin fecha, "?"', () => {
    expect(formatShortDate(null)).toBe('?');
    expect(formatShortDate('')).toBe('?');
  });
  it('los meses salen en español abreviado', () => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    meses.forEach((m, i) => expect(formatShortDate(new Date(2026, i, 15, 12).toISOString())).toBe(`15-${m}`));
  });
  it('localDateStr: fecha local; una fecha sin hora se devuelve tal cual; inválida, vacío', () => {
    expect(localDateStr('2026-06-13T01:00:00.000Z')).toBe('2026-06-12');
    expect(localDateStr('2026-06-15')).toBe('2026-06-15');
    expect(localDateStr('basura')).toBe('');
    expect(localDateStr(null)).toBe('');
  });
});

describe('extractPrefix — tipo de sesión', () => {
  it.each([
    ['LEGS', 'LEGS'], ['LEGS — Bloque 3A', 'LEGS'], ['TORSO · semana 2', 'TORSO'], ['DL. pesado', 'DL'],
    ['PULL / A', 'PULL'], ['  Pierna   A ', 'Pierna A'], ['', ''], [undefined, ''],
  ])('%j → %j', (nombre, esperado) => {
    expect(extractPrefix(nombre)).toBe(esperado);
  });
});

describe('formatPlainSet', () => {
  it('peso × reps @ RPE, PC si no hay peso', () => {
    expect(formatPlainSet(st(100, 3, 8))).toBe('100 × 3 @ 8');
    expect(formatPlainSet(st('', 10, 7.5))).toBe('PC × 10 @ 7.5');
    expect(formatPlainSet(st(100, 3, ''))).toBe('100 × 3');
  });
  it('los textos con ceros a la izquierda se normalizan (datos reales: "012", "037.5")', () => {
    expect(formatPlainSet(st('037.5', '08', ''))).toBe('37.5 × 8');
  });
});

describe('collectAppearances / lastLoggedSeconds', () => {
  it('agrupa por variante, la más nueva primero, solo sets de trabajo', () => {
    const h = [
      session('2026-06-01T15:00:00Z', [ex('Facepull', 'cable', { sets: [st(20, 15, 8)] })], { name: 'ACCESORIOS' }),
      session('2026-06-10T15:00:00Z', [ex('Facepull', 'cable', { sets: [st(10, 15, '', { type: 'warmup' }), st(25, 15, 8)] })], { name: 'TORSO' }),
    ];
    const apps = [...collectAppearances(h).values()][0];
    expect(apps.map((a) => a.sessionType)).toEqual(['TORSO', 'ACCESORIOS']);
    expect(apps[0].sets).toHaveLength(1);
  });
  it('sinceMs limita la ventana', () => {
    const h = [session('2026-04-01T15:00:00Z', [ex('Facepull', 'cable', { sets: [st(20, 15, 8)] })])];
    expect(collectAppearances(h, { sinceMs: Date.parse('2026-05-01T00:00:00Z') }).size).toBe(0);
  });
  it('el máximo del hold de la última aparición, no su último set', () => {
    const t = (s) => ({ type: 'normal', seconds: s, completed: true });
    const h = [
      session('2026-06-01T15:00:00Z', [ex('Handstand', 'bodyweight', { sets: [t(90)] })]),
      session('2026-06-10T15:00:00Z', [ex('Handstand', 'bodyweight', { sets: [t(40), t(55), t(30)] })]),
    ];
    expect(lastLoggedSeconds(h, 'Handstand')).toBe(55);
    expect(lastLoggedSeconds([], 'Handstand')).toBe(0);
  });
});

describe('"Enviar al Coach" — buildExerciseShareText (§5)', () => {
  const press = (when, eq, sets, name = 'TORSO') => session(when, [ex('Press Banca', eq, { sets })], { name });

  it('sin registros, null', () => {
    expect(buildExerciseShareText('Press Banca', [])).toBeNull();
  });

  it('últimas apariciones, la más nueva primero, con fecha local y tipo de sesión', () => {
    const h = [press('2026-06-01T15:00:00Z', 'barbell', [st(95, 5, 8)]), press('2026-06-10T15:00:00Z', 'barbell', [st(100, 5, 8)])];
    const t = buildExerciseShareText('Press Banca', h);
    expect(t.split('\n')[0]).toBe('Historial de Press Banca');
    expect(t).toContain('Últimas 2 apariciones:');
    expect(t.indexOf('100×5@8 (10-jun, TORSO)')).toBeLessThan(t.indexOf('95×5@8 (01-jun, TORSO)'));
  });

  it('una sola aparición: "Última aparición:"', () => {
    expect(buildExerciseShareText('Press Banca', [press('2026-06-10T15:00:00Z', 'barbell', [st(100, 5, 8)])])).toContain('Última aparición:');
  });

  it('como máximo las últimas 6 apariciones', () => {
    const h = Array.from({ length: 9 }, (_, i) => press(`2026-06-0${i + 1}T15:00:00Z`, 'barbell', [st(100, 5, 8)]));
    expect(buildExerciseShareText('Press Banca', h)).toContain('Últimas 6 apariciones:');
  });

  it('1RM si es barra o mancuerna (últimas 12 semanas)', () => {
    for (const eq of ['barbell', 'dumbbell']) {
      const t = buildExerciseShareText('Press Banca', [press('2026-06-10T15:00:00Z', eq, [st(100, 5, 8)])]);
      expect(t, eq).toContain('1RM estimado: 119 kg (N=1, últimas 12 semanas) — referencia, no máximo del día');
    }
  });

  it('sin 1RM en máquina, polea o peso corporal', () => {
    for (const eq of ['machine', 'cable', 'bodyweight']) {
      expect(buildExerciseShareText('Press Banca', [press('2026-06-10T15:00:00Z', eq, [st(100, 5, 8)])]), eq).not.toContain('1RM estimado');
    }
  });

  it('con un implemento pedido: solo ese, y el título lo dice ("Press Banca · barra")', () => {
    const h = [press('2026-06-01T15:00:00Z', 'dumbbell', [st(40, 8, 8)]), press('2026-06-10T15:00:00Z', 'barbell', [st(100, 5, 8)])];
    const t = buildExerciseShareText('Press Banca', h, { equipment: 'barbell' });
    expect(t.split('\n')[0]).toBe('Historial de Press Banca · barra');
    expect(t).not.toContain('40×8');
  });

  it('sin implemento pedido y apariciones con implementos distintos: cada línea lleva el suyo', () => {
    const h = [press('2026-06-01T15:00:00Z', 'dumbbell', [st(40, 8, 8)]), press('2026-06-10T15:00:00Z', 'barbell', [st(100, 5, 8)])];
    const t = buildExerciseShareText('Press Banca', h);
    expect(t).toContain('(10-jun, TORSO, barra)');
    expect(t).toContain('(01-jun, TORSO, mancuerna)');
  });

  it('un ejercicio por tiempo ignora el implemento pedido (es una sola variante)', () => {
    const t = (s) => ({ type: 'normal', seconds: s, completed: true });
    const h = [session('2026-06-10T15:00:00Z', [ex('Plancha', 'bodyweight', { sets: [t(45)] })], { name: 'DL' })];
    expect(buildExerciseShareText('Plancha', h, { equipment: 'machine' }).split('\n')[0]).toBe('Historial de Plancha');
  });

  it('otras grafías del nombre se avisan', () => {
    const h = [
      session('2026-06-01T15:00:00Z', [ex('press banca', 'barbell', { sets: [st(95, 5, 8)] })], { name: 'TORSO' }),
      session('2026-06-10T15:00:00Z', [ex('Press Banca', 'barbell', { sets: [st(100, 5, 8)] })], { name: 'TORSO' }),
    ];
    expect(buildExerciseShareText('Press Banca', h).split('\n')[0]).toBe('Historial de Press Banca (también registrado como: press banca)');
  });

  it('el compañero de un ejercicio de tiempo se imprime', () => {
    setMeta('Plancha', { companion: 'difficulty' });
    const h = [session('2026-06-10T15:00:00Z', [ex('Plancha', 'bodyweight', { sets: [{ type: 'normal', seconds: 45, companionValue: '3', completed: true }] })], { name: 'DL' })];
    expect(buildExerciseShareText('Plancha', h)).toContain('45 s · Alta (10-jun, DL)');
  });
});
