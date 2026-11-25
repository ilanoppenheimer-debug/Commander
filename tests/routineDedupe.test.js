import { describe, it, expect } from 'vitest';
import { planRoutineDedupe, normalizeRoutineName, activeBlockStart } from '../src/utils/routineDedupe.js';

// Planificador puro de la deduplicación de plantillas. Filas SINTÉTICAS con la forma de las de Dexie.
let n = 0;
const row = (o) => ({ _id: ++n, routineId: `r-${n}`, name: 'X', exercises: [{ name: 'e' }], createdAt: '2026-10-10T10:00:00Z', ...o });
const imp = (o) => row({ isImported: true, importedAt: o.createdAt || '2026-10-10T10:00:00Z', ...o });
const ids = (rs) => rs.map((r) => r._id).sort((a, b) => a - b);
const BLOCK_START = '2026-10-05T00:00:00Z';

describe('normalizeRoutineName / activeBlockStart', () => {
  it('sin mayúsculas, tildes ni espacios repetidos; NO quita "(Plantilla)"', () => {
    expect(normalizeRoutineName('  Pierna  Á ')).toBe('pierna a');
    expect(normalizeRoutineName('DL (Plantilla)')).toBe('dl (plantilla)');
    expect(normalizeRoutineName(null)).toBe('');
  });
  it('el inicio del bloque es el startedAt más antiguo entre los ACTIVOS', () => {
    expect(activeBlockStart([{ status: 'active', startedAt: '2026-10-05' }, { status: 'active', startedAt: '2026-08-01' }, { status: 'completed', startedAt: '2026-01-01' }])).toBe('2026-08-01');
    expect(activeBlockStart([{ status: 'completed', startedAt: '2026-01-01' }, { status: 'active', startedAt: null }])).toBeNull();
    expect(activeBlockStart(undefined)).toBeNull();
  });
});

describe('pasada 1: mismo routineId', () => {
  it('queda la de import más reciente (no la de updatedAt); las demás se eliminan', () => {
    const a = imp({ routineId: 'R', createdAt: '2026-10-09T00:00:00Z' });
    const b = imp({ routineId: 'R', createdAt: '2026-10-22T00:00:00Z' });
    const c = imp({ routineId: 'R', createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-11-30T00:00:00Z' });
    const p = planRoutineDedupe([a, b, c]);
    expect(p.pass1.groups).toHaveLength(1);
    expect(p.pass1.groups[0].keep._id).toBe(b._id);
    expect(ids(p.pass1.remove)).toEqual(ids([a, c]));
  });

  it('una fila dañada por "Actualizar plantilla" (lastUpdatedAt reciente, import viejo) NO sobrevive', () => {
    const limpia = imp({ routineId: 'T', createdAt: '2026-10-18T00:00:00Z', exercises: [1, 2, 3] });
    const danada = imp({ routineId: 'T', createdAt: '2026-10-15T00:00:00Z', lastUpdatedAt: '2026-10-29T00:00:00Z', exercises: [1, 1, 1, 1, 1, 1, 2, 3] });
    expect(planRoutineDedupe([danada, limpia]).pass1.groups[0].keep._id).toBe(limpia._id);
  });

  it('desempate por mayor _id', () => {
    const a = imp({ routineId: 'R', createdAt: '2026-10-09T00:00:00Z' });
    const b = imp({ routineId: 'R', createdAt: '2026-10-09T00:00:00Z' });
    expect(planRoutineDedupe([a, b]).pass1.groups[0].keep._id).toBe(b._id);
  });

  it('el sobreviviente hereda el lastPerformed más reciente del grupo (y no se pisa uno más nuevo propio)', () => {
    const vieja = row({ routineId: 'R', createdAt: '2026-04-01T00:00:00Z', lastPerformed: '2026-05-03T10:00:00Z' });
    const nueva = imp({ routineId: 'R', createdAt: '2026-09-15T00:00:00Z' });
    const p = planRoutineDedupe([vieja, nueva], { blockStart: null });
    expect(p.pass1.inherit).toEqual([{ row: nueva, lastPerformed: '2026-05-03T10:00:00Z', before: undefined }]);
    const propio = imp({ routineId: 'S', createdAt: '2026-09-15T00:00:00Z', lastPerformed: '2026-10-20T00:00:00Z' });
    const otra = row({ routineId: 'S', createdAt: '2026-04-01T00:00:00Z', lastPerformed: '2026-05-03T10:00:00Z' });
    expect(planRoutineDedupe([propio, otra]).pass1.inherit).toEqual([]);
  });

  it('filas con routineId único no se tocan', () => {
    const p = planRoutineDedupe([row({}), row({ name: 'Y' })]);
    expect(p.pass1.remove).toEqual([]);
  });
});

describe('pasada 2: nombre normalizado entre activas', () => {
  it('gana el import más reciente; las plantillas del mismo nombre se archivan', () => {
    const i1 = imp({ name: 'LEGS', createdAt: '2026-10-09T00:00:00Z' });
    const i2 = imp({ name: 'Legs', createdAt: '2026-11-11T00:00:00Z' });
    const t = row({ name: 'LEGS', createdAt: '2026-11-20T00:00:00Z', lastPerformed: '2026-11-25T00:00:00Z' }); // más nueva en todo, pero NO es import
    const p = planRoutineDedupe([i1, i2, t]);
    expect(p.pass2.groups[0].winner._id).toBe(i2._id);
    expect(p.pass2.groups[0].byImport).toBe(true);
    expect(ids(p.pass2.archive)).toEqual(ids([i1, t]));
  });

  it('sin import en el grupo: gana la de lastPerformed más reciente', () => {
    const a = row({ name: 'Torso', lastPerformed: '2026-10-15T00:00:00Z' });
    const b = row({ name: 'torso', lastPerformed: '2026-10-18T00:00:00Z' });
    const c = row({ name: 'TORSO' });
    const p = planRoutineDedupe([a, b, c]);
    expect(p.pass2.groups[0]).toMatchObject({ byImport: false });
    expect(p.pass2.groups[0].winner._id).toBe(b._id);
    expect(ids(p.pass2.archive)).toEqual(ids([a, c]));
  });

  it('las ya archivadas no cuentan ni se tocan; "(Plantilla)" es otro nombre', () => {
    const arch = imp({ name: 'DL', archived: true });
    const act = imp({ name: 'DL' });
    const tpl = row({ name: 'DL (Plantilla)' });
    const p = planRoutineDedupe([arch, act, tpl]);
    expect(p.pass2.archive).toEqual([]);
  });

  it('opera sobre los sobrevivientes de la pasada 1 (un nombre repetido solo por filas del mismo routineId no archiva nada)', () => {
    const a = imp({ routineId: 'R', name: 'PUSH', createdAt: '2026-10-07T00:00:00Z' });
    const b = imp({ routineId: 'R', name: 'PUSH', createdAt: '2026-10-20T00:00:00Z' });
    const p = planRoutineDedupe([a, b]);
    expect(ids(p.pass1.remove)).toEqual([a._id]);
    expect(p.pass2.archive).toEqual([]);
  });
});

describe('pasada 3: sin uso ni import desde el inicio del bloque activo', () => {
  it('archiva las activas sin lastPerformed ni import desde el startedAt; conserva las usadas o importadas desde entonces', () => {
    const viejaImport = imp({ name: 'A', createdAt: '2026-09-22T00:00:00Z' });
    const viejaTpl = row({ name: 'B', createdAt: '2026-09-01T00:00:00Z' });
    const usada = row({ name: 'C', createdAt: '2026-09-01T00:00:00Z', lastPerformed: '2026-10-20T00:00:00Z' });
    const importNuevo = imp({ name: 'D', createdAt: '2026-10-06T00:00:00Z' });
    const usadaAntes = row({ name: 'E', lastPerformed: '2026-04-28T00:00:00Z' });
    const p = planRoutineDedupe([viejaImport, viejaTpl, usada, importNuevo, usadaAntes], { blockStart: BLOCK_START });
    expect(ids(p.pass3.archive)).toEqual(ids([viejaImport, viejaTpl, usadaAntes]));
    expect(ids(p.finalActive)).toEqual(ids([usada, importNuevo]));
  });

  it('sin bloque activo no archiva nada', () => {
    const p = planRoutineDedupe([imp({ name: 'A', createdAt: '2026-01-01T00:00:00Z' })], { blockStart: null });
    expect(p.pass3.archive).toEqual([]);
    expect(p.noop).toBe(true);
  });

  it('una plantilla archivada por nombre (pasada 2) no se cuenta de nuevo en la 3', () => {
    const w = imp({ name: 'DL', createdAt: '2026-10-27T00:00:00Z' });
    const l = row({ name: 'DL', createdAt: '2026-09-01T00:00:00Z' });
    const p = planRoutineDedupe([w, l], { blockStart: BLOCK_START });
    expect(ids(p.pass2.archive)).toEqual([l._id]);
    expect(p.pass3.archive).toEqual([]);
  });
});

describe('plan global', () => {
  const fixture = () => {
    n = 100;
    return [
      imp({ routineId: 'L', name: 'LEGS', createdAt: '2026-10-09T00:00:00Z' }),
      imp({ routineId: 'L', name: 'LEGS', createdAt: '2026-11-11T00:00:00Z' }),
      row({ name: 'LEGS', lastPerformed: '2026-10-16T00:00:00Z' }),
      imp({ name: 'PUSH', createdAt: '2026-10-07T00:00:00Z' }),
      row({ name: 'Piernas A', createdAt: '2026-04-26T00:00:00Z', lastPerformed: '2026-04-26T00:00:00Z' }),
      imp({ name: 'VIEJA', createdAt: '2026-05-27T00:00:00Z', archived: true }),
    ];
  };
  it('resumen antes/después coherente', () => {
    const p = planRoutineDedupe(fixture(), { blockStart: BLOCK_START });
    expect(p.summary).toMatchObject({
      before: { rows: 6, active: 5, archived: 1 },
      after: { rows: 5, active: 2, archived: 3 },
      removed: 1, archivedByName: 1, archivedByBlock: 1,
    });
    expect(p.finalActive.map((r) => r.name)).toEqual(['LEGS', 'PUSH']);
  });
  it('no muta las filas de entrada', () => {
    const rows = fixture();
    const copia = JSON.parse(JSON.stringify(rows));
    planRoutineDedupe(rows, { blockStart: BLOCK_START });
    expect(rows).toEqual(copia);
  });
  it('idempotente: aplicar el plan en memoria y replanificar da vacío', () => {
    const rows = fixture();
    const p = planRoutineDedupe(rows, { blockStart: BLOCK_START });
    const gone = new Set(p.pass1.remove.map((r) => r._id));
    const arch = new Set([...p.pass2.archive, ...p.pass3.archive].map((r) => r._id));
    const lp = new Map(p.pass1.inherit.map((i) => [i.row._id, i.lastPerformed]));
    const after = rows.filter((r) => !gone.has(r._id)).map((r) => ({ ...r, ...(arch.has(r._id) ? { archived: true } : {}), ...(lp.has(r._id) ? { lastPerformed: lp.get(r._id) } : {}) }));
    expect(planRoutineDedupe(after, { blockStart: BLOCK_START }).noop).toBe(true);
  });
  it('entrada vacía o inválida', () => {
    expect(planRoutineDedupe([]).noop).toBe(true);
    expect(planRoutineDedupe(undefined).summary.before.rows).toBe(0);
  });
});
