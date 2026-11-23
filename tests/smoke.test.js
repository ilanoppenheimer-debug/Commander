import { describe, it, expect } from 'vitest';

// Humo: los módulos que se van a testear cargan en Node. Los tres últimos importan
// `db` (Dexie) a nivel de módulo; este test comprueba que eso no revienta sin IndexedDB.
describe('los módulos de lógica cargan en Node', () => {
  it('exerciseVariant', async () => {
    const m = await import('../src/utils/exerciseVariant.js');
    expect(typeof m.makeSessionLabeler).toBe('function');
  });
  it('exerciseMetadata (usa localStorage)', async () => {
    const m = await import('../src/constants/exerciseMetadata.js');
    expect(typeof m.resolveFamily).toBe('function');
  });
  it('strengthMath', async () => {
    const m = await import('../src/utils/strengthMath.js');
    expect(typeof m.computeExercise1RM).toBe('function');
  });
  it('parser', async () => {
    const m = await import('../src/utils/routineImport/parser.js');
    expect(typeof m.parseRoutineMarkdown).toBe('function');
  });
  it('exerciseMatching (importa db)', async () => {
    const m = await import('../src/utils/routineImport/exerciseMatching.js');
    expect(typeof m.scoreCandidates).toBe('function');
  });
  it('contextGenerator (importa db)', async () => {
    const m = await import('../src/utils/routineImport/contextGenerator.js');
    expect(typeof m.buildSeriesPorEjercicio).toBe('function');
  });
  it('converter (importa db)', async () => {
    const m = await import('../src/utils/routineImport/converter.js');
    expect(typeof m.syncExerciseMetadataFromImport).toBe('function');
  });
});
