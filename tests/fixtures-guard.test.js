import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// El repo es público: los tests solo pueden usar datos sintéticos. Este guardián falla si
// aparece algo con forma de backup real (claves del archivo de backup, JSON/zip pegados,
// fixtures enormes). No prueba que los datos sean inventados; atrapa el descuido típico.
const ROOT = new URL('.', import.meta.url).pathname;
const SELF = 'fixtures-guard.test.js';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(ROOT).filter((p) => !p.endsWith(SELF));

// Claves de nivel superior de un backup (src/services/backupService.js).
const BACKUP_KEYS = ['"checksum"', '"appVersion"', '"userAgent"', '"customExercises"', '"exerciseMetadata"'];

describe('guardián de fixtures', () => {
  it('hay archivos de test que revisar', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('solo hay código (.js) en tests/: nada de .json, .zip, .csv ni copias de backup', () => {
    const bad = files.filter((p) => !p.endsWith('.js')).map((p) => relative(ROOT, p));
    expect(bad).toEqual([]);
  });

  it('ningún archivo contiene claves de backup', () => {
    const hits = [];
    for (const p of files) {
      const txt = readFileSync(p, 'utf8');
      for (const k of BACKUP_KEYS) if (txt.includes(k)) hits.push(`${relative(ROOT, p)}: ${k}`);
    }
    expect(hits).toEqual([]);
  });

  it('ningún archivo es sospechosamente grande (>100 KB)', () => {
    const big = files.filter((p) => statSync(p).size > 100 * 1024).map((p) => relative(ROOT, p));
    expect(big).toEqual([]);
  });
});
