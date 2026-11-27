import { describe, it, expect } from 'vitest';
import { normalizeRoutineName, findActiveByName, uniqueRoutineName, nextCopyName } from '../src/utils/routineNaming.js';
import { normalizeRoutineName as normFromDedupe } from '../src/utils/routineDedupe.js';

// Regla única de nombres de plantilla: no hay dos ACTIVAS con el mismo nombre normalizado; las archivadas pueden repetir.
const r = (name, extra = {}) => ({ id: `id-${name}-${Math.random()}`, name, ...extra });

describe('normalizeRoutineName (compartida con la deduplicación)', () => {
  it('sin mayúsculas, tildes ni espacios repetidos', () => {
    expect(normalizeRoutineName('  Pierna  Á ')).toBe('pierna a');
    expect(normalizeRoutineName('CAFÉ')).toBe('cafe');
    expect(normalizeRoutineName(null)).toBe('');
  });
  it('es la MISMA función que usa la deduplicación', () => {
    expect(normFromDedupe).toBe(normalizeRoutineName);
  });
});

describe('findActiveByName', () => {
  const rows = [r('LEGS'), r('Torso Á'), r('DL', { archived: true })];
  it('encuentra por nombre normalizado entre las activas', () => {
    expect(findActiveByName('legs', rows).name).toBe('LEGS');
    expect(findActiveByName('  torso a ', rows).name).toBe('Torso Á');
  });
  it('ignora las archivadas (pueden repetir) y los nombres vacíos', () => {
    expect(findActiveByName('DL', rows)).toBeNull();
    expect(findActiveByName('', rows)).toBeNull();
    expect(findActiveByName('NUEVA', rows)).toBeNull();
  });
  it('excluye a la propia plantilla (renombrar a su mismo nombre, o con otras mayúsculas, no choca)', () => {
    const propia = r('LEGS');
    expect(findActiveByName('legs', [propia], propia.id)).toBeNull();
    expect(findActiveByName('legs', [propia, r('Legs')], propia.id).name).toBe('Legs');
  });
});

describe('uniqueRoutineName', () => {
  it('base libre → base; ocupada → "Base 2", "Base 3"…', () => {
    expect(uniqueRoutineName('Nueva Plantilla', [])).toBe('Nueva Plantilla');
    expect(uniqueRoutineName('Nueva Plantilla', [r('Nueva Plantilla')])).toBe('Nueva Plantilla 2');
    expect(uniqueRoutineName('Nueva Plantilla', [r('nueva plantilla'), r('Nueva Plantilla 2')])).toBe('Nueva Plantilla 3');
  });
  it('una archivada no ocupa el nombre', () => {
    expect(uniqueRoutineName('Nueva Plantilla', [r('Nueva Plantilla', { archived: true })])).toBe('Nueva Plantilla');
  });
});

describe('nextCopyName con nombre normalizado', () => {
  it('"Café" y "cafe (COPIA)" son la misma familia (antes colisionaba)', () => {
    expect(nextCopyName('Café', [r('Café'), r('Cafe (copia)')])).toBe('Café (copia 2)');
    expect(nextCopyName('X', [r('X'), r('x (Copia)')])).toBe('X (copia 2)');
    expect(nextCopyName('Café', [r('Café'), r('CAFE (copia 2)')])).toBe('Café (copia 3)');
  });
  it('sigue igual para los casos simples', () => {
    expect(nextCopyName('Pierna', [r('Pierna')])).toBe('Pierna (copia)');
    expect(nextCopyName('Pierna (copia 2)', [r('Pierna'), r('Pierna (copia)'), r('Pierna (copia 2)')])).toBe('Pierna (copia 3)');
    expect(nextCopyName('A+B (x)', [r('A+B (x) (copia)')])).toBe('A+B (x) (copia 2)');
    expect(nextCopyName('', [])).toBe('Rutina (copia)');
  });
  it('el resultado nunca choca con una activa existente', () => {
    const rows = [r('Café'), r('cafe (copia)'), r('Cafe (copia 2)')];
    const nuevo = nextCopyName('Café', rows);
    expect(findActiveByName(nuevo, rows)).toBeNull();
  });
});
