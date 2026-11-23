import { describe, it, expect } from 'vitest';
import {
  resolveFamily, resolveMuscleGroup, isUnilateral, unilateralSpec, tableIsUnilateral, clearMetaFields,
  matchFamily, getMeasurement, familyDefaultGroup,
} from '../src/constants/exerciseMetadata.js';
import {
  FAMILY_TABLE, FAMILY_NAMES, getFamilyEntry, familyVariants, canonicalExerciseName, offeredEquipment,
  SELECTOR_TABLE_NAMES, isHiddenFromSelector, tableFamilyOf,
} from '../src/constants/exerciseFamilies.js';
import { setMeta } from './fixtures/builders.js';
import { CATALOGO_83, ES_TO_ID, GRUPO_POR_FAMILIA } from './fixtures/catalogo.js';

const idsOf = (csv) => (csv ? csv.split(',').map((x) => ES_TO_ID[x.trim()]) : []);
const uniSpec = (u) => (u === 'sí' ? true : u === 'con polea' ? ['cable'] : false);

// ── Tabla de familias contra el Catálogo 8.3 ────────────────────────────────────────────────
describe('Tabla de familias = Catálogo 8.3', () => {
  it('toda fila del Catálogo mapea a una variante conocida (el transcrito no tiene typos)', () => {
    expect(ES_TO_ID['banda']).toBe('band');
    for (const [, , impl] of CATALOGO_83) idsOf(impl).forEach((id) => expect(id).toBeTruthy());
  });

  it.each(CATALOGO_83)('%s › %s: familia, implementos, unilateral y medición', (family, name, impl, uni = '', time = false) => {
    const e = getFamilyEntry(name);
    expect(e, `falta "${name}" en FAMILY_TABLE`).toBeTruthy();
    expect(e.family).toBe(family);
    expect(e.name).toBe(name);
    expect(offeredEquipment(name)).toEqual(idsOf(impl));
    expect(e.unilateral ?? false).toEqual(uniSpec(uni));
    expect(e.measurement).toBe(time ? 'time' : 'reps');
    expect(e.inSelector).toBe(true);
  });

  it('el selector ofrece exactamente las variantes del Catálogo 8.3 (ni una más, ni una menos)', () => {
    const esperado = CATALOGO_83.map((r) => r[1]).sort();
    // Manguito Rotador (genérico) existe pero oculto: "se prescribe Rotación Externa o Interna".
    expect([...SELECTOR_TABLE_NAMES].sort()).toEqual(esperado);
  });

  it('solo-historial: Cardio (sin especificar), Remo Polea / Landmine (sin resolver) y Manguito Rotador resuelven pero no se ofrecen', () => {
    for (const n of ['Cardio (sin especificar)', 'Remo Polea / Landmine (sin resolver)', 'Manguito Rotador']) {
      expect(getFamilyEntry(n), n).toBeTruthy();
      expect(isHiddenFromSelector(n), n).toBe(true);
    }
  });

  it('nombres viejos retirados no aparecen en el selector', () => {
    for (const n of ['Press Banca Inclinado', 'Curl Femoral', 'Extensiones de Cuádriceps', 'Cruce de Poleas', 'Plancha Abdominal']) {
      expect(isHiddenFromSelector(n), n).toBe(true);
    }
  });

  it('las variantes de una familia se ofrecen juntas (8.1: familia = intercambiables)', () => {
    expect(familyVariants('Curl Femoral').map((r) => r.name).sort())
      .toEqual(['Curl Femoral Acostado', 'Curl Femoral Sentado', 'Nordic Curl']);
    expect(familyVariants('curl femoral')).toHaveLength(3); // sin mayúsculas
    expect(familyVariants('Familia inexistente')).toEqual([]);
  });

  it('tableFamilyOf y canonicalExerciseName', () => {
    expect(tableFamilyOf('press banca')).toBe('Press Banca');
    expect(tableFamilyOf('Mi Ejercicio')).toBeNull();
    expect(canonicalExerciseName('pajaros')).toBe('Pájaros');
    expect(canonicalExerciseName('Mi Ejercicio')).toBe('Mi Ejercicio');
  });

  it('ninguna variante repite nombre (identidad única)', () => {
    const names = FAMILY_TABLE.map((r) => r.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

// ── Grupo muscular: es de la FAMILIA ─────────────────────────────────────────────────────────
describe('resolveMuscleGroup — el grupo es de la familia (8.1)', () => {
  for (const [group, families] of Object.entries(GRUPO_POR_FAMILIA)) {
    it(`las familias de ${group} resuelven a ${group}`, () => {
      for (const f of families) {
        expect(FAMILY_NAMES, f).toContain(f);
        const variante = familyVariants(f)[0].name;
        expect(resolveMuscleGroup(variante), `${f} › ${variante}`).toEqual({ group, source: 'familia' });
      }
    });
  }

  it('Handstand y Reverse Front Fly son Hombros', () => {
    expect(resolveMuscleGroup('Handstand').group).toBe('shoulders');
    expect(resolveMuscleGroup('Reverse Front Fly').group).toBe('shoulders');
  });

  it('el grupo de la familia manda aunque el ejercicio tenga otro en su metadata', () => {
    setMeta('Press Banca', { muscleGroup: 'arms' });
    expect(resolveMuscleGroup('Press Banca')).toEqual({ group: 'chest', source: 'familia' });
  });

  it('una familia propia del atleta usa el muscleGroup del ejercicio', () => {
    setMeta('Mi Ejercicio', { family: 'Mi Familia', muscleGroup: 'back' });
    expect(resolveMuscleGroup('Mi Ejercicio')).toEqual({ group: 'back', source: 'metadata' });
  });

  it('un ejercicio sin familia de tabla ni grupo propio queda sin grupo (nunca se infiere por el nombre)', () => {
    expect(resolveMuscleGroup('Press Algo Raro')).toEqual({ group: undefined, source: null });
    expect(resolveMuscleGroup('Sentadilla Zercher')).toEqual({ group: undefined, source: null });
  });

  it('el atleta puede mover un ejercicio a una familia del Catálogo y hereda su grupo', () => {
    setMeta('Sentadilla Zercher', { family: 'Sentadilla' });
    expect(resolveMuscleGroup('Sentadilla Zercher')).toEqual({ group: 'legs', source: 'familia' });
    expect(familyDefaultGroup('Sentadilla Zercher')).toBe('legs');
  });
});

// ── Familia ─────────────────────────────────────────────────────────────────────────────────
describe('resolveFamily', () => {
  it('una variante del Catálogo resuelve a su familia, sin importar mayúsculas ni tildes', () => {
    expect(resolveFamily('Sentadilla Hack')).toBe('Sentadilla');
    expect(resolveFamily('pajaros')).toBe('Pájaros');
  });

  it('la familia que eligió el atleta manda sobre la tabla', () => {
    setMeta('Sentadilla Hack', { family: 'Mi Familia' });
    expect(resolveFamily('Sentadilla Hack')).toBe('Mi Familia');
  });

  it('un nombre desconocido es una familia de uno: devuelve su propio nombre', () => {
    expect(resolveFamily('Sentadilla Zercher')).toBe('Sentadilla Zercher');
    expect(resolveFamily('')).toBe('');
    expect(resolveFamily(undefined)).toBe('');
  });
});

describe('matchFamily — `familia:` del Coach (Contrato §3)', () => {
  it('SENTADILLA → Sentadilla, sin crear familia nueva', () => {
    expect(matchFamily('SENTADILLA')).toEqual({ name: 'Sentadilla', isNew: false });
    expect(matchFamily('  curl de biceps ')).toEqual({ name: 'Curl de Bíceps', isNew: false });
    expect(matchFamily('Jalon')).toEqual({ name: 'Jalón', isNew: false });
  });

  it('"Sentadila" (mal escrita) crea una familia nueva con el texto tal cual', () => {
    expect(matchFamily('Sentadila')).toEqual({ name: 'Sentadila', isNew: true });
  });

  it('reconoce también las familias propias del atleta', () => {
    setMeta('Mi Ejercicio', { family: 'Mi Familia' });
    expect(matchFamily('mi familia')).toEqual({ name: 'Mi Familia', isNew: false });
  });

  it('texto vacío no es una familia', () => {
    expect(matchFamily('')).toEqual({ name: '', isNew: false });
    expect(matchFamily('   ')).toEqual({ name: '', isNew: false });
    expect(matchFamily(undefined)).toEqual({ name: '', isNew: false });
  });
});

// ── Unilateral (Contrato §3, Catálogo 8.6) ──────────────────────────────────────────────────
describe('isUnilateral — un lado a la vez', () => {
  it('mancuernas simultáneas son bilaterales', () => {
    expect(isUnilateral('Press Banca', 'dumbbell')).toBe(false);
    expect(isUnilateral('Press Militar', 'dumbbell')).toBe(false);
    expect(isUnilateral('Curl de Bíceps', 'dumbbell')).toBe(false);
  });

  it.each(CATALOGO_83.filter((r) => r[3] === 'sí'))('%s › %s es unilateral con cualquiera de sus implementos', (_f, name, impl) => {
    for (const id of idsOf(impl)) expect(isUnilateral(name, id), `${name} con ${id}`).toBe(true);
    expect(isUnilateral(name, null)).toBe(true);
  });

  it.each(CATALOGO_83.filter((r) => r[3] === 'con polea'))('%s › %s es unilateral SOLO con polea', (_f, name, impl) => {
    expect(isUnilateral(name, 'cable')).toBe(true);
    for (const id of idsOf(impl).filter((i) => i !== 'cable')) expect(isUnilateral(name, id), `${name} con ${id}`).toBe(false);
    expect(isUnilateral(name, null)).toBe(false); // sin implemento conocido no se afirma
  });

  it('el Curl de Bíceps con polea es a una mano; con barra o mancuernas, bilateral (8.6)', () => {
    expect(isUnilateral('Curl de Bíceps', 'cable')).toBe(true);
    expect(isUnilateral('Curl de Bíceps', 'barbell')).toBe(false);
  });

  it('las variantes bilaterales del Catálogo no son unilaterales', () => {
    for (const [, name, impl, uni] of CATALOGO_83.filter((r) => !r[3])) {
      for (const id of idsOf(impl)) expect(isUnilateral(name, id), `${name} con ${id}`).toBe(false);
    }
  });

  it('tableIsUnilateral ignora lo que configure el atleta', () => {
    setMeta('Press Banca', { unilateral: true });
    expect(tableIsUnilateral('Press Banca', 'barbell')).toBe(false);
    expect(isUnilateral('Press Banca', 'barbell')).toBe(true);
  });
});

describe('unilateral: override del atleta (true | [implementos] | false)', () => {
  it('true: unilateral con cualquier implemento', () => {
    setMeta('Press Banca', { unilateral: true });
    expect(unilateralSpec('Press Banca')).toBe(true);
    expect(isUnilateral('Press Banca', 'dumbbell')).toBe(true);
  });

  it('[implementos]: solo con esos', () => {
    setMeta('Press Banca', { unilateral: ['dumbbell'] });
    expect(unilateralSpec('Press Banca')).toEqual(['dumbbell']);
    expect(isUnilateral('Press Banca', 'dumbbell')).toBe(true);
    expect(isUnilateral('Press Banca', 'barbell')).toBe(false);
    expect(isUnilateral('Press Banca', null)).toBe(false);
  });

  it('false: bilateral aunque la tabla diga unilateral', () => {
    setMeta('Remo Mancuerna', { unilateral: false });
    expect(unilateralSpec('Remo Mancuerna')).toBe(false);
    expect(isUnilateral('Remo Mancuerna', 'dumbbell')).toBe(false);
  });

  it('el override con lista no comparte referencia con lo guardado', () => {
    setMeta('Press Banca', { unilateral: ['dumbbell'] });
    const spec = unilateralSpec('Press Banca');
    spec.push('cable');
    expect(unilateralSpec('Press Banca')).toEqual(['dumbbell']);
  });

  it('clearMetaFields quita el override y vuelve a mandar la tabla', () => {
    setMeta('Remo Mancuerna', { unilateral: false, family: 'Remo' });
    expect(clearMetaFields('Remo Mancuerna', ['unilateral'])).toBe(true);
    expect(isUnilateral('Remo Mancuerna', 'dumbbell')).toBe(true);
    expect(resolveFamily('Remo Mancuerna')).toBe('Remo'); // no toca otros campos
    expect(clearMetaFields('Remo Mancuerna', ['unilateral'])).toBe(false);
  });

  it('la marca heredada bilateral:false solo vale para ejercicios propios, no para los del Catálogo', () => {
    setMeta('Mi Ejercicio', { bilateral: false });
    expect(isUnilateral('Mi Ejercicio', null)).toBe(true);
    setMeta('Press Banca', { bilateral: false });
    expect(isUnilateral('Press Banca', 'barbell')).toBe(false);
  });

  it('un ejercicio propio sin nada es bilateral', () => {
    expect(isUnilateral('Mi Ejercicio', 'dumbbell')).toBe(false);
  });
});

describe('getMeasurement — ejercicios por tiempo (8.8)', () => {
  it('las variantes de tiempo del Catálogo vienen como tiempo, sin metadata', () => {
    for (const [, name, , , time] of CATALOGO_83) expect(getMeasurement(name), name).toBe(time ? 'time' : 'reps');
  });
  it('un ejercicio propio sin configurar queda sin medición (undefined), no "reps"', () => {
    expect(getMeasurement('Mi Ejercicio')).toBeUndefined();
  });
  it('lo que configura el atleta manda sobre la tabla', () => {
    setMeta('Plancha', { measurement: 'reps' });
    expect(getMeasurement('Plancha')).toBe('reps');
  });
});
