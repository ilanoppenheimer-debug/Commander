/**
 * Parser de rutinas en formato Iron Commander v4.
 * Sin IA, regex/heurística pura.
 *
 * Formato esperado:
 *   ---
 *   nombre: TORSO A
 *   fecha: 2026-05-10
 *   foco: Single de aproximación en banca
 *   duracion_min: 60
 *   mesociclo: Peaking
 *   sesion_num: 4
 *   sesion_total: 12
 *   contexto: |
 *     S4. Última: 112×2@RPE10.
 *   ---
 *
 *   # CALENTAMIENTO
 *   - Rotación de hombro × 15
 *
 *   # EJERCICIO: Banca Plana
 *   - equipo: barbell
 *   - tag: main_lift
 *   - descanso: 180s
 *   - nota_ejercicio: Foco en velocidad.
 *
 *   | Set | Tipo | Peso | Reps | RPE | Descanso |
 *   |-----|------|------|------|-----|----------|
 *   | 1 | warmup | 60 | 5 | - | 90s |
 *   | 6 | top | 110-113 | 1 | 8.5 | - |
 *
 *   ## Decisión adaptativa
 *   - Si 108 sale limpio: subir a 113
 *
 *   # NOTAS DE CIERRE
 *   Volumen reducido a propósito.
 */

import { TAG_OPTIONS } from '../../constants/blockTemplates';

const VALID_EQUIPMENT = ['barbell', 'smith', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bodyweight', 'other'];
const VALID_SET_TYPES = ['warmup', 'top', 'back', 'normal', 'drop', 'amrap', 'myo'];

// ── Block YAML helpers ────────────────────────────────────────────────────────

const parseInlineArray = (str) => {
  const s = str.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return null;
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(item => {
    const t = item.trim();
    const n = Number(t);
    return isNaN(n) ? t : n;
  });
};

// Parses 2-space-indented subkeys of the `bloque:` block (including the
// 4-space-indented `params:` sub-object). No defaults — absent keys are absent.
const parseBlockYaml = (lines) => {
  const raw = {};
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^  ([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const val = m[2].trim();

    if (val === '') {
      // sub-object (e.g. params:) — collect 4-space-indented lines
      const subLines = [];
      i++;
      while (i < lines.length && lines[i].startsWith('    ')) {
        subLines.push(lines[i]);
        i++;
      }
      const sub = {};
      for (const sl of subLines) {
        const sm = sl.match(/^    ([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
        if (!sm) continue;
        const arr = parseInlineArray(sm[2].trim());
        if (arr !== null) { sub[sm[1]] = arr; continue; }
        const n = Number(sm[2].trim());
        sub[sm[1]] = isNaN(n) ? sm[2].trim() : n;
      }
      raw[key] = sub;
    } else {
      const arr = parseInlineArray(val);
      if (arr !== null) { raw[key] = arr; i++; continue; }
      const n = Number(val);
      raw[key] = isNaN(n) ? val : n;
      i++;
    }
  }
  return raw;
};

// Maps raw YAML field names → app block field names.
// Only sets fields that are present in raw — never invents defaults.
const buildBlockMeta = (raw) => {
  if (!raw || raw.id == null) return null;
  const meta = { coachId: String(raw.id) };
  if (raw.nombre    !== undefined) meta.name           = raw.nombre;
  if (raw.cierra    !== undefined) meta.closesCoachId  = String(raw.cierra);
  if (raw.tipo      !== undefined) meta.type           = raw.tipo;
  if (raw.inicio    !== undefined) meta.startedAt      = raw.inicio;
  if (raw.sesiones_objetivo !== undefined) meta.sessionsTarget = raw.sesiones_objetivo;
  if (Array.isArray(raw.aplica_a))  meta.appliesTo    = raw.aplica_a;
  if (raw.fase      !== undefined) meta.fase           = raw.fase;
  if (raw.semana    !== undefined) meta.currentWeek    = raw.semana;

  if (raw.params && typeof raw.params === 'object') {
    const p = {};
    if (Array.isArray(raw.params.reps_rango))       p.repsRange       = raw.params.reps_rango;
    if (Array.isArray(raw.params.rpe_rango))        p.rpeRange        = raw.params.rpe_rango;
    if (raw.params.backoff_pct !== undefined)       p.backoffPctOfTop = raw.params.backoff_pct;
    if (Object.keys(p).length > 0) meta.params = p;
  }

  return meta;
};

export const parseRoutineMarkdown = (markdown) => {
  const result = { success: false, routine: null, warnings: [], errors: [] };

  if (!markdown || typeof markdown !== 'string') {
    result.errors.push('Input vacío o inválido');
    return result;
  }

  try {
    const yamlMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!yamlMatch) {
      result.errors.push('Falta bloque YAML inicial entre --- separadores');
      return result;
    }

    const metadata = parseYamlMetadata(yamlMatch[1], result.warnings);
    if (!metadata.nombre) {
      result.errors.push('Falta campo "nombre" en YAML');
      return result;
    }

    const body = markdown.slice(yamlMatch[0].length);

    const calentamiento = extractCalentamiento(body);
    const exercises = extractExercises(body, result.warnings);
    const notasCierre = extractNotasCierre(body);

    if (exercises.length === 0) {
      result.errors.push('No se encontraron ejercicios');
      return result;
    }

    result.routine = {
      id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: metadata.nombre,
      sourceDate: metadata.fecha || null,
      focus: metadata.foco || '',
      duration: metadata.duracion_min || null,
      contextNotes: metadata.contexto || '',
      mesociclo: metadata.mesociclo || null,
      sessionNum: metadata.sesion_num || null,
      sessionTotal: metadata.sesion_total || null,
      blockMeta: buildBlockMeta(metadata._bloque),
      warmup: calentamiento,
      exercises,
      closingNotes: notasCierre,
      importedAt: new Date().toISOString(),
    };

    result.success = true;
  } catch (e) {
    result.errors.push(`Error parseando: ${e.message}`);
  }

  return result;
};

const parseYamlMetadata = (yamlText, warnings) => {
  const metadata = {};
  const lines = yamlText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }

    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!match) { warnings.push(`Línea YAML no reconocida: "${line}"`); i++; continue; }

    const key = match[1];
    let value = match[2].trim();

    if (key === 'bloque' && value === '') {
      const subLines = [];
      i++;
      while (i < lines.length && lines[i].startsWith('  ')) {
        subLines.push(lines[i]);
        i++;
      }
      metadata._bloque = parseBlockYaml(subLines);
      continue;
    }

    if (value === '|') {
      const multilineLines = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(nextLine) && !nextLine.startsWith(' ')) break;
        multilineLines.push(nextLine.replace(/^  /, ''));
        i++;
      }
      value = multilineLines.join('\n').trim();
    } else {
      i++;
    }

    if (key === 'duracion_min' || key === 'sesion_num' || key === 'sesion_total') {
      const num = parseInt(value, 10);
      metadata[key] = isNaN(num) ? null : num;
    } else {
      metadata[key] = value;
    }
  }

  return metadata;
};

const extractCalentamiento = (body) => {
  const match = body.match(/^# CALENTAMIENTO\s*\n([\s\S]*?)(?=\n# )/m);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(l => l.length > 0);
};

const extractExercises = (body, warnings) => {
  const blocks = [];
  // Split on exercise headers; keep content between consecutive # EJERCICIO headers
  const parts = body.split(/^# EJERCICIO:\s*/m);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const nameEnd = part.indexOf('\n');
    if (nameEnd === -1) continue;
    const name = part.slice(0, nameEnd).trim();
    // Stop content at next top-level # heading (except ## which belongs to this exercise)
    const content = part.slice(nameEnd + 1);
    blocks.push({ name, content });
  }

  return blocks
    .map((block, idx) => parseExerciseBlock(block, idx, warnings))
    .filter(Boolean);
};

const parseExerciseBlock = ({ name, content }, idx, warnings) => {
  const metadata = {};
  const metaLines = content.match(/^- ([a-zA-Z_]+):\s*(.+)$/gm) || [];

  for (const line of metaLines) {
    const m = line.match(/^- ([a-zA-Z_]+):\s*(.+)$/);
    if (m) metadata[m[1]] = m[2].trim();
  }

  // Table of sets — look for | Set | header
  const tableMatch = content.match(/\| Set \|[\s\S]*?\n\|[-|\s]+\n([\s\S]*?)(?=\n## |\n# |$)/);
  if (!tableMatch) {
    warnings.push(`Ejercicio "${name}" sin tabla de sets, se omite`);
    return null;
  }

  const sets = parseSetsTable(tableMatch[1], idx, warnings);

  // Adaptive decision
  const decisionMatch = content.match(/^##\s*Decisi[oó]n adaptativa\s*\n([\s\S]*?)(?=\n## |\n# |$)/m);
  let decisionAdaptativa = null;
  if (decisionMatch) {
    decisionAdaptativa = decisionMatch[1]
      .split('\n')
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(l => l.length > 0);
  }

  const equipment = VALID_EQUIPMENT.includes(metadata.equipo) ? metadata.equipo : 'barbell';
  if (metadata.equipo && !VALID_EQUIPMENT.includes(metadata.equipo)) {
    warnings.push(`Equipo desconocido "${metadata.equipo}" en "${name}", default barbell`);
  }

  const tagValue = metadata.tag;
  const validTag = TAG_OPTIONS.includes(tagValue) ? tagValue : null;

  return {
    id: `imp-ex-${Date.now()}-${idx}`,
    name,
    equipment,
    tagSuggested: validTag,
    restSeconds: parseRestSeconds(metadata.descanso) || 90,
    notes: metadata.nota_ejercicio || '',
    decisionAdaptativa: decisionAdaptativa || null,
    unilateral: metadata.unilateral === 'true',
    sets,
  };
};

const parseSetsTable = (tableContent, exerciseIdx, warnings) => {
  const rows = tableContent
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && !l.match(/^[\|\-\s]+$/));

  return rows
    .map((row, rowIdx) => {
      const cells = row.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      // Expect: Set | Tipo | Peso | Reps | RPE | Descanso (at least 5 cells)
      if (cells.length < 5) {
        warnings.push(`Fila incompleta ejercicio ${exerciseIdx} fila ${rowIdx}`);
        return null;
      }
      const [, type, peso, reps, rpe, descanso] = cells;
      return parseSet({ type, peso, reps, rpe, descanso }, rowIdx, warnings);
    })
    .filter(Boolean);
};

const parseSet = ({ type, peso, reps, rpe, descanso }, idx, warnings) => {
  const set = {
    id: `imp-set-${Date.now()}-${idx}`,
    type: 'normal',
    weight: '',
    reps: '',
    rpe: '',
    completed: false,
    notes: '',
  };

  const normalizedType = (type || '').toLowerCase().trim();
  if (VALID_SET_TYPES.includes(normalizedType)) {
    set.type = normalizedType;
  } else if (normalizedType && normalizedType !== '-') {
    warnings.push(`Tipo desconocido "${type}", default normal`);
  }

  const notesParts = [];

  const pesoTrimmed = (peso || '').trim();
  if (pesoTrimmed && pesoTrimmed !== '-') {
    if (/^\d+(\.\d+)?$/.test(pesoTrimmed)) {
      set.weight = pesoTrimmed;
    } else if (/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(pesoTrimmed)) {
      notesParts.push(`Peso planeado: ${pesoTrimmed} kg`);
    } else {
      warnings.push(`Peso no parseable: "${peso}"`);
    }
  }

  const repsTrimmed = (reps || '').trim();
  if (repsTrimmed && repsTrimmed !== '-') {
    if (repsTrimmed.toUpperCase() === 'AMRAP') {
      set.type = 'amrap';
    } else if (/^\d+$/.test(repsTrimmed)) {
      set.reps = repsTrimmed;
    } else if (/^\d+-\d+$/.test(repsTrimmed)) {
      notesParts.push(`Reps planeadas: ${repsTrimmed}`);
    } else {
      warnings.push(`Reps no parseables: "${reps}"`);
    }
  }

  const rpeTrimmed = (rpe || '').trim();
  if (rpeTrimmed && rpeTrimmed !== '-') {
    if (/^\d+(\.\d+)?$/.test(rpeTrimmed)) {
      set.rpe = rpeTrimmed;
    } else if (/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(rpeTrimmed)) {
      notesParts.push(`RPE objetivo: ${rpeTrimmed}`);
    } else {
      warnings.push(`RPE no parseable: "${rpe}"`);
    }
  }

  set.notes = notesParts.join(' · ');

  const descansoTrimmed = (descanso || '').trim();
  if (descansoTrimmed && descansoTrimmed !== '-') {
    const restSec = parseRestSeconds(descansoTrimmed);
    if (restSec) set.restSeconds = restSec;
  }

  return set;
};

export const parseRestSeconds = (str) => {
  if (!str) return null;
  const t = str.trim().toLowerCase();
  const sMatch = t.match(/^(\d+)\s*s$/);
  if (sMatch) return parseInt(sMatch[1], 10);
  const minMatch = t.match(/^(\d+)\s*min$/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;
  const rangeMin = t.match(/^(\d+)\s*-\s*(\d+)\s*min$/);
  if (rangeMin) return parseInt(rangeMin[1], 10) * 60;
  const num = t.match(/^(\d+)$/);
  if (num) return parseInt(num[1], 10);
  return null;
};

const extractNotasCierre = (body) => {
  const match = body.match(/^# NOTAS DE CIERRE\s*\n([\s\S]*)$/m);
  if (!match) return '';
  return match[1].trim();
};
