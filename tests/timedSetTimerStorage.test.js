import { describe, it, expect, beforeEach } from 'vitest';
import {
  timerKey, shiftTimedSetTimersAfterRemoval, shiftTimedSetTimersAfterInsertion, clearAllTimedSetTimers,
  clearTimedSetTimersForExercise, isTimedHoldRunning, markHoldMinimized, unmarkHoldMinimized, isHoldMinimized,
} from '../src/utils/timedSetTimerStorage.js';

// Holds por tiempo (Contrato §4b): el timer en curso queda en localStorage por ejercicio + número de set.
const put = (ex, i, v) => localStorage.setItem(timerKey(ex, i), JSON.stringify(v));
const get = (ex, i) => JSON.parse(localStorage.getItem(timerKey(ex, i)) || 'null');
const HOLD = { startedAt: 1_700_000_000_000 };

beforeEach(() => { clearAllTimedSetTimers(); });

describe('mover los timers cuando se borra o se agrega un set', () => {
  it('borrar un set anterior desliza el timer del hold en curso un índice hacia abajo, sin perderlo', () => {
    put('e1', 3, HOLD); // el hold corre en el set 3 (índice 1-based)
    shiftTimedSetTimersAfterRemoval('e1', 0, 4); // se borra el set 1
    expect(get('e1', 3)).toBeNull();
    expect(get('e1', 2)).toEqual(HOLD);
  });

  it('borrar el set que tiene el hold se lleva su timer', () => {
    put('e1', 2, HOLD);
    shiftTimedSetTimersAfterRemoval('e1', 1, 3);
    expect(get('e1', 2)).toBeNull();
    expect(get('e1', 1)).toBeNull();
  });

  it('borrar un set posterior no toca el timer', () => {
    put('e1', 1, HOLD);
    shiftTimedSetTimersAfterRemoval('e1', 2, 4);
    expect(get('e1', 1)).toEqual(HOLD);
  });

  it('no mezcla ejercicios', () => {
    put('e1', 2, HOLD); put('e2', 2, { startedAt: 5 });
    shiftTimedSetTimersAfterRemoval('e1', 0, 3);
    expect(get('e1', 1)).toEqual(HOLD);
    expect(get('e2', 2)).toEqual({ startedAt: 5 });
  });

  it('deshacer el borrado (insertar) es la inversa exacta', () => {
    put('e1', 3, HOLD);
    shiftTimedSetTimersAfterRemoval('e1', 0, 4);
    shiftTimedSetTimersAfterInsertion('e1', 0, 4);
    expect(get('e1', 3)).toEqual(HOLD);
    expect(get('e1', 2)).toBeNull();
  });
});

describe('isTimedHoldRunning', () => {
  it('un hold en curso (con startedAt, sin stoppedAt) cuenta; uno detenido esperando confirmación no', () => {
    expect(isTimedHoldRunning()).toBe(false);
    put('e1', 1, { startedAt: 1, stoppedAt: 99 });
    expect(isTimedHoldRunning()).toBe(false);
    put('e1', 2, HOLD);
    expect(isTimedHoldRunning()).toBe(true);
  });
});

// Bug: borrar (o agregar) una serie recrea todas las filas del ejercicio (la key lleva la cantidad de sets) y el
// efecto de restauración de TimedSetRow reabría el overlay de un hold que la atleta había minimizado.
describe('hold minimizado: sobrevive al remonte de la fila', () => {
  it('se recuerda por ejercicio + el startedAt del hold, no por índice de set', () => {
    expect(isHoldMinimized('e1', HOLD.startedAt)).toBe(false);
    markHoldMinimized('e1', HOLD.startedAt);
    expect(isHoldMinimized('e1', HOLD.startedAt)).toBe(true);
    expect(isHoldMinimized('e2', HOLD.startedAt)).toBe(false);
    expect(isHoldMinimized('e1', HOLD.startedAt + 1)).toBe(false);
  });

  it('el reloj del restore: tras borrar una serie anterior, el hold sigue minimizado en su nuevo índice', () => {
    put('e1', 3, HOLD);
    markHoldMinimized('e1', HOLD.startedAt);
    shiftTimedSetTimersAfterRemoval('e1', 0, 4);
    // La fila remontada lee su key nueva y decide si reabre el overlay:
    const restored = get('e1', 2);
    expect(restored.startedAt).toBe(HOLD.startedAt);
    expect(isHoldMinimized('e1', restored.startedAt)).toBe(true);
  });

  it('agregar o deshacer un borrado tampoco lo reabre', () => {
    put('e1', 2, HOLD);
    markHoldMinimized('e1', HOLD.startedAt);
    shiftTimedSetTimersAfterInsertion('e1', 0, 3);
    expect(isHoldMinimized('e1', get('e1', 3).startedAt)).toBe(true);
  });

  it('reabrir el overlay (tocar el hold) o terminar el hold lo desmarca', () => {
    markHoldMinimized('e1', HOLD.startedAt);
    unmarkHoldMinimized('e1', HOLD.startedAt);
    expect(isHoldMinimized('e1', HOLD.startedAt)).toBe(false);
  });

  it('borrar el set que tiene el hold minimizado olvida la marca', () => {
    put('e1', 2, HOLD);
    markHoldMinimized('e1', HOLD.startedAt);
    shiftTimedSetTimersAfterRemoval('e1', 1, 3);
    expect(isHoldMinimized('e1', HOLD.startedAt)).toBe(false);
  });

  it('borrar un set posterior no desmarca el hold', () => {
    put('e1', 1, HOLD);
    markHoldMinimized('e1', HOLD.startedAt);
    shiftTimedSetTimersAfterRemoval('e1', 2, 4);
    expect(isHoldMinimized('e1', HOLD.startedAt)).toBe(true);
  });

  it('limpiar los timers de un ejercicio, o todos (fin de sesión), olvida las marcas', () => {
    markHoldMinimized('e1', 1); markHoldMinimized('e2', 2);
    clearTimedSetTimersForExercise('e1');
    expect(isHoldMinimized('e1', 1)).toBe(false);
    expect(isHoldMinimized('e2', 2)).toBe(true);
    clearAllTimedSetTimers();
    expect(isHoldMinimized('e2', 2)).toBe(false);
  });

  it('sin startedAt no marca nada', () => {
    markHoldMinimized('e1', null);
    expect(isHoldMinimized('e1', null)).toBe(false);
  });

  it('una key corrupta no rompe el borrado', () => {
    localStorage.setItem(timerKey('e1', 1), '{no es json');
    expect(() => shiftTimedSetTimersAfterRemoval('e1', 0, 2)).not.toThrow();
  });
});
