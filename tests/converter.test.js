import { describe, it, expect } from 'vitest';
import { parseRoutineMarkdown } from '../src/utils/routineImport/parser.js';
import { convertImportedToRoutine, syncExerciseMetadataFromImport, detectMeasurementSignals } from '../src/utils/routineImport/converter.js';
import { getExerciseMeta, resolveFamily, resolveMuscleGroup, isUnilateral } from '../src/constants/exerciseMetadata.js';
import { routineMd, exBlock, simpleEx, setMeta } from './fixtures/builders.js';

// Contrato v1.8.4 §3 (equipo, familia, unilateral) y §4 / §4b (tiempos). Se usa el modo 'temporary': convierte
// sin guardar en Dexie.
const parse = (md) => parseRoutineMarkdown(md).routine;
const convert = (md, mappings = {}, overrides = {}) => convertImportedToRoutine(parse(md), mappings, overrides, 'temporary');

describe('convertImportedToRoutine (modo temporal, sin guardar)', () => {
  it('conserva nombre, equipo y descanso; el equipo ausente queda null, nunca barra', async () => {
    const r = await convert(routineMd({ exercises: [
      exBlock({ name: 'Press Banca', bullets: ['equipo: dumbbell', 'descanso: 120s'], rows: [['normal', '30', '10', '8', '90s']] }),
      exBlock({ name: 'Remo con Barra', bullets: ['descanso: 90s'], rows: [['normal', '60', '8', '8', '90s']] }),
    ] }));
    expect(r.exercises.map((e) => [e.name, e.equipment, e.restSeconds])).toEqual([['Press Banca', 'dumbbell', 120], ['Remo con Barra', null, 90]]);
    expect(r.isImported).toBe(true);
  });

  it('usa el nombre resuelto por el matcher, o el que eligió la atleta, no el literal del Coach', async () => {
    const md = routineMd({ exercises: [simpleEx({ name: 'Curl de Bíceps con Barra' })] });
    expect((await convert(md, { 'Curl de Bíceps con Barra': { exerciseName: 'Curl de Bíceps' } })).exercises[0].name).toBe('Curl de Bíceps');
    expect((await convert(md, { 'Curl de Bíceps con Barra': { exerciseName: 'Curl de Bíceps' } }, { 'Curl de Bíceps con Barra': 'Hammer Curl' })).exercises[0].name).toBe('Hammer Curl');
    expect((await convert(md)).exercises[0].name).toBe('Curl de Bíceps con Barra');
  });

  it('el protocolo quitado del nombre va al INICIO de la nota, sin pisar la del Coach', async () => {
    const md = routineMd({ exercises: [exBlock({ name: 'Dominadas — Test Máximo', bullets: ['equipo: bodyweight', 'descanso: 120s', 'nota_ejercicio: Sin kipping'], rows: [['normal', 'PC', '8', '9', '120s']] })] });
    const r = await convert(md, { 'Dominadas — Test Máximo': { exerciseName: 'Dominadas', strippedNote: 'Test Máximo' } });
    expect(r.exercises[0].notes).toBe('Test Máximo\nSin kipping');
  });

  it('si la atleta dejó el nombre del Coach como ejercicio nuevo, la nota no se toca', async () => {
    const md = routineMd({ exercises: [exBlock({ name: 'Dominadas — Test Máximo', bullets: ['equipo: bodyweight', 'descanso: 120s'], rows: [['normal', 'PC', '8', '9', '120s']] })] });
    const nombre = 'Dominadas — Test Máximo';
    const r = await convert(md, { [nombre]: { exerciseName: 'Dominadas', strippedNote: 'Test Máximo' } }, { [nombre]: nombre });
    expect(r.exercises[0].notes).toBe('');
  });

  it('el plan por set se guarda aparte: Peso, Reps y RPE como los escribió el Coach (§4)', async () => {
    const md = routineMd({ exercises: [exBlock({ name: 'Sentadilla', bullets: ['equipo: barbell', 'descanso: 180s'], rows: [['top', '137.5', '6', '7.5–8', '180s']] })] });
    const s = (await convert(md)).exercises[0].sets[0];
    expect(s).toMatchObject({ type: 'top', weight: '137.5', reps: '6', completed: false });
    expect(s.planned).toEqual({ weight: '137.5', reps: '6', rpeText: '7.5–8' });
    expect(s.plannedRpe).toBe('7.5');
    expect(s.rpe).toBe('');
    expect(s.restSeconds).toBe(180);
  });

  it('tiempos (§4b): el objetivo es el límite inferior de un rango; `máx s` no tiene objetivo', async () => {
    const targets = {};
    for (const reps of ['38s', '45seg', '10min', '30-40s', '1-2min', 'máx s']) {
      const md = routineMd({ exercises: [exBlock({ name: 'Handstand', bullets: ['equipo: bodyweight', 'descanso: 60s'], rows: [['normal', '-', reps, '-', '60s']] })] });
      const s = (await convert(md)).exercises[0].sets[0];
      targets[reps] = s.targetSeconds ?? null;
      expect(s.reps, reps).toBe('');
    }
    expect(targets).toEqual({ '38s': 38, '45seg': 45, '10min': 600, '30-40s': 30, '1-2min': 60, 'máx s': null });
  });

  it('el `unilateral` del YAML se acepta pero NO tiene efecto: la app lo sabe por su tabla (§3)', async () => {
    const md = routineMd({ exercises: [exBlock({ name: 'Press Banca', bullets: ['equipo: barbell', 'unilateral: true', 'descanso: 90s'], rows: [['normal', '100', '5', '8', '90s']] })] });
    const r = await convert(md);
    expect(r.exercises[0].name).toBe('Press Banca');
    syncExerciseMetadataFromImport(parse(md).exercises[0]);
    expect(isUnilateral('Press Banca', 'barbell')).toBe(false);
    expect(getExerciseMeta('Press Banca').unilateral).toBeUndefined();
  });

  it('un superset por letra: miembros consecutivos comparten supersetId; el resto no', async () => {
    const a = (name, g) => exBlock({ name, bullets: ['equipo: cable', ...(g ? [`superset: ${g}`] : []), 'descanso: 60s'], rows: [['normal', '20', '10', '8', '60s']] });
    const r = await convert(routineMd({ exercises: [a('Aperturas', 'A'), a('Pájaros', 'A'), a('Facepull', null), a('Curl Bayesiano', 'B'), a('Hammer Curl', 'B')] }));
    const ids = r.exercises.map((e) => e.supersetId);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).toBeUndefined();
    expect(ids[3]).toBe(ids[4]);
    expect(ids[3]).not.toBe(ids[0]);
    expect(r.exercises.every((e) => !('_supersetGroup' in e))).toBe(true);
  });

  it('no filtra campos internos del parser (_rawReps, _rawMax) a lo que se guarda', async () => {
    const md = routineMd({ exercises: [exBlock({ name: 'Handstand', bullets: ['equipo: bodyweight', 'descanso: 60s'], rows: [['normal', '-', '30s', '-', '60s']] })] });
    const s = (await convert(md)).exercises[0].sets[0];
    expect(Object.keys(s).filter((k) => k.startsWith('_'))).toEqual([]);
  });

  it('sin rutina, null', async () => {
    expect(await convertImportedToRoutine(null)).toBeNull();
  });
});

describe('syncExerciseMetadataFromImport — lo que el import escribe en la metadata', () => {
  const imp = (extra) => ({ name: 'Sentadilla Zercher', ...extra });

  it('tag y equipo del Coach se guardan con su origen "coach-import"', () => {
    syncExerciseMetadataFromImport(imp({ tagSuggested: 'secondary', equipment: 'barbell' }));
    expect(getExerciseMeta('Sentadilla Zercher')).toMatchObject({ defaultTag: 'secondary', tagAssignedBy: 'coach-import', equipment: 'barbell', equipmentAssignedBy: 'coach-import' });
  });

  it('un tag o equipo elegido a mano por la atleta NO se pisa', () => {
    setMeta('Sentadilla Zercher', { defaultTag: 'accessory', tagOverride: true, equipment: 'dumbbell', equipmentOverride: true });
    syncExerciseMetadataFromImport(imp({ tagSuggested: 'secondary', equipment: 'barbell' }));
    expect(getExerciseMeta('Sentadilla Zercher')).toMatchObject({ defaultTag: 'accessory', equipment: 'dumbbell' });
  });

  it('sigue el nombre resuelto, no la grafía del Coach', () => {
    syncExerciseMetadataFromImport({ name: 'Curl de Bíceps con Barra', tagSuggested: 'isolation', equipment: 'barbell' }, 'Curl de Bíceps');
    expect(getExerciseMeta('Curl de Bíceps').defaultTag).toBe('isolation');
    expect(getExerciseMeta('Curl de Bíceps con Barra')).toEqual({});
  });

  it('`familia:` de un ejercicio nuevo: queda en su familia y hereda el grupo de la familia (§3)', () => {
    syncExerciseMetadataFromImport(imp({ familia: 'SENTADILLA' }));
    expect(resolveFamily('Sentadilla Zercher')).toBe('Sentadilla');
    expect(resolveMuscleGroup('Sentadilla Zercher')).toEqual({ group: 'legs', source: 'familia' });
    expect(getExerciseMeta('Sentadilla Zercher').familyAssignedBy).toBe('coach-import');
  });

  it('una familia nueva (mal escrita) queda sin grupo muscular hasta que la atleta elija', () => {
    syncExerciseMetadataFromImport(imp({ familia: 'Sentadila' }));
    expect(resolveFamily('Sentadilla Zercher')).toBe('Sentadila');
    expect(resolveMuscleGroup('Sentadilla Zercher')).toEqual({ group: undefined, source: null });
  });

  it('NUNCA pisa la familia que ya tiene (elegida por la atleta o de un import anterior)', () => {
    setMeta('Sentadilla Zercher', { family: 'Mi Familia' });
    syncExerciseMetadataFromImport(imp({ familia: 'Sentadilla' }));
    expect(resolveFamily('Sentadilla Zercher')).toBe('Mi Familia');
  });

  it('en ejercicios del Catálogo, `familia:` se ignora', () => {
    syncExerciseMetadataFromImport({ name: 'Remo con Barra', familia: 'Press Banca' });
    expect(resolveFamily('Remo con Barra')).toBe('Remo');
    expect(getExerciseMeta('Remo con Barra').family).toBeUndefined();
  });

  it('una familia igual al nombre del ejercicio no se guarda (es el valor por defecto)', () => {
    syncExerciseMetadataFromImport({ name: 'Sentadilla Zercher', familia: 'Sentadilla Zercher' });
    expect(getExerciseMeta('Sentadilla Zercher').family).toBeUndefined();
  });

  it('un YAML sin `familia:` no escribe familia', () => {
    syncExerciseMetadataFromImport(imp({ tagSuggested: 'secondary' }));
    expect(getExerciseMeta('Sentadilla Zercher').family).toBeUndefined();
  });

  it('sin nombre no hace nada', () => {
    expect(() => syncExerciseMetadataFromImport({})).not.toThrow();
  });
});

describe('detectMeasurementSignals — reps con formato de duración (§4)', () => {
  const timed = (name, reps = '25s') => ({ name, sets: [{ reps: '', _rawReps: reps }] });
  const counted = (name) => ({ name, sets: [{ reps: '8' }] });

  it('un ejercicio sin medición configurada y con reps "25s": se autoconfigura como tiempo (aviso, con opción de corregir)', () => {
    expect(detectMeasurementSignals([timed('Hollow Hold')])).toEqual([
      { exerciseName: 'Hollow Hold', type: 'auto', measurementDetected: 'time', rawSample: '25s' },
    ]);
  });

  it('un ejercicio de tiempo del Catálogo con reps numéricas: alerta, nunca sobreescribe en silencio', () => {
    expect(detectMeasurementSignals([counted('Plancha')])).toEqual([
      { exerciseName: 'Plancha', type: 'conflict', measurementDetected: 'reps', currentMeasurement: 'time', rawSample: '8' },
    ]);
  });

  it('un ejercicio configurado como repeticiones y con tiempo: alerta en sentido inverso', () => {
    setMeta('Hollow Hold', { measurement: 'reps' });
    expect(detectMeasurementSignals([timed('Hollow Hold', '30s')])[0]).toMatchObject({ type: 'conflict', measurementDetected: 'time', currentMeasurement: 'reps' });
  });

  it('un ejercicio de tiempo con tiempo, o de repeticiones con repeticiones: sin avisos', () => {
    expect(detectMeasurementSignals([timed('Plancha'), counted('Press Banca')])).toEqual([]);
  });

  it('entradas inválidas no rompen', () => {
    expect(detectMeasurementSignals(undefined)).toEqual([]);
    expect(detectMeasurementSignals([{}, null])).toEqual([]);
  });
});
