// Regresión de D: las sesiones VIEJAS ya guardadas (con series sin completar y vacías dentro) se siguen leyendo igual.
// La regla de "qué se guarda" solo afecta a las sesiones nuevas; reporte, CONTEXTO y 1RM no se tocaron.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateSessionReport } from '../src/utils/sessionExport.js';
import { buildSeriesPorEjercicio } from '../src/utils/routineImport/contextGenerator.js';
import { computeExercise1RM } from '../src/utils/strengthMath.js';
import { pruneUnperformedExercises } from '../src/utils/sessionCompletion.js';

const NOW = '2026-06-15T15:00:00Z';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); });

const S = (completed, weight, reps, extra = {}) => ({ type: 'normal', completed, weight, reps, rpe: '', ...extra });
const vieja = () => ({ historyId: 'h1', name: 'LEGS', completedAt: '2026-06-12T15:30:00.000Z', exercises: [
  { name: 'Sentadilla', equipment: 'barbell', tag: 'main_lift', sets: [S(true, '100', '5', { rpe: '8' }), S(false, '100', '5'), S(false, '180', ''), S(true, '', '')] },
  { name: 'Prensa', equipment: 'machine', sets: [S(true, '200', '10')] },
] });

describe('sesiones viejas con series sin completar / vacías', () => {
  it('reporte de sesión: igual que antes (las series guardadas se imprimen tal cual)', () => {
    expect(generateSessionReport(vieja())).toBe([
      '=== REPORTE DE SESIÓN ===', 'Fecha: 2026-06-12 (viernes, 11:30)', 'Sesión: LEGS', '',
      '## Sentadilla [main_lift]', '  Real:', '    1. NORMAL  100 kg × 5 @ RPE 8', '    2. NORMAL  100 kg × 5', '    3. NORMAL  —', '    4. NORMAL  —',
      '  Volumen: 1000 kg·rep', '',
      '## Prensa', '  Real:', '    1. NORMAL  200 kg × 10', '  Volumen: 2000 kg·rep', '',
      '## Resumen', '- 5 series · 3000 kg·rep', '- RPE promedio: 8.0', '', '=== PEDIDO ===', 'Análisis libre',
    ].join('\n'));
  });

  it('CONTEXTO (series por ejercicio): igual que antes', () => {
    expect(buildSeriesPorEjercicio([vieja()], Date.parse(NOW))).toEqual([
      '## Series por ejercicio (sin warmups, completadas)', 'Split (LEGS / TORSO / DL):',
      '  - Prensa: 7 días 1 · 8–14 días 0', '  - Sentadilla: 7 días 1 · 8–14 días 0', '',
    ]);
  });

  it('1RM: la serie no completada de una sesión vieja sigue sin contar; la completada sí', () => {
    const r = computeExercise1RM('Sentadilla', [vieja()]);
    expect(r.sampleSize).toBe(1); // solo la completada 100×5@8
    const conRpe = vieja(); conRpe.exercises[0].sets[1].rpe = '8'; conRpe.exercises[0].sets[0].rpe = '8';
    expect(computeExercise1RM('Sentadilla', [conRpe]).sampleSize).toBe(1); // solo la completada
  });

  it('y la misma sesión, guardada con la regla nueva, conserva lo que ya contaba en CONTEXTO y 1RM', () => {
    const nueva = { ...vieja(), exercises: pruneUnperformedExercises(vieja().exercises) };
    expect(buildSeriesPorEjercicio([nueva], Date.parse(NOW))).toEqual(buildSeriesPorEjercicio([vieja()], Date.parse(NOW)));
    const a = vieja(); a.exercises[0].sets.forEach((s) => { s.rpe = '8'; });
    const b = { ...a, exercises: pruneUnperformedExercises(a.exercises) };
    expect(computeExercise1RM('Sentadilla', [b])).toEqual(computeExercise1RM('Sentadilla', [a]));
  });
});
