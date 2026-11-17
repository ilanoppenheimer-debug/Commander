// "Exportar ejercicios" (Ajustes -> Datos): the exercise list as plain text, grouped
// Familia -> Variante -> implementos, with the muscle group of the family. READ ONLY: nothing is
// written anywhere. It is the list the Coach is shown to know which names, families and implements
// exist (the athlete's own exercises included, with the family they resolve to).
import { DEFAULT_EXERCISE_DB, EQUIPMENT_TYPES } from '../constants/gymConstants';
import { SELECTOR_TABLE_NAMES, isHiddenFromSelector, getFamilyEntry, familyGroup } from '../constants/exerciseFamilies';
import { resolveFamily, resolveMuscleGroup, getMeasurement, getExerciseMeta, unilateralSpec, MUSCLE_GROUP_OPTIONS } from '../constants/exerciseMetadata';
import { resolveHistoryEquipment, EQUIPMENT_LABEL_ES } from './exerciseVariant';
import { normalizeExerciseName, sameExercise } from './exerciseName';
import { localDateStr } from './localDate';

const norm = normalizeExerciseName;
const eqLabel = (id) => EQUIPMENT_LABEL_ES[id] || EQUIPMENT_TYPES.find(e => e.id === id)?.label || id;
const groupLabel = (id) => MUSCLE_GROUP_OPTIONS.find(m => m.id === id)?.label || 'Sin grupo';
const byEs = (a, b) => a.localeCompare(b, 'es');

// Sessions per exercise (identity = normalized name) and, per implement, how many sessions used it.
export function historyUsage(history) {
  const usage = new Map();
  for (const session of Array.isArray(history) ? history : []) {
    const seenInSession = new Map();
    for (const ex of Array.isArray(session?.exercises) ? session.exercises : []) {
      if (!ex?.name) continue;
      const key = norm(ex.name);
      const eq = resolveHistoryEquipment(ex);
      const set = seenInSession.get(key) || new Set();
      set.add(eq || '');
      seenInSession.set(key, set);
    }
    for (const [key, eqs] of seenInSession) {
      const u = usage.get(key) || { sessions: 0, byEquipment: new Map() };
      u.sessions += 1;
      for (const e of eqs) u.byEquipment.set(e, (u.byEquipment.get(e) || 0) + 1);
      usage.set(key, u);
    }
  }
  return usage;
}

// Every exercise name worth listing: what the selector offers + the ones that only exist in the history.
export function exportableNames(customExercises, history) {
  const pool = [...DEFAULT_EXERCISE_DB, ...SELECTOR_TABLE_NAMES, ...(Array.isArray(customExercises) ? customExercises.filter(Boolean) : [])]
    .filter(n => !isHiddenFromSelector(n));
  const out = [];
  const push = (n) => { if (!out.some(x => sameExercise(x, n))) out.push(n); };
  pool.forEach(push);
  const spelled = new Map();
  for (const s of Array.isArray(history) ? history : []) for (const ex of s?.exercises || []) if (ex?.name && !spelled.has(norm(ex.name))) spelled.set(norm(ex.name), ex.name);
  spelled.forEach(push);
  return out;
}

// Pure: { customExercises, history, now } -> { text, families, variants, withHistory }.
export function buildExerciseExport({ customExercises = [], history = [], now = new Date() } = {}) {
  const usage = historyUsage(history);
  const selectorNames = new Set([...DEFAULT_EXERCISE_DB, ...SELECTOR_TABLE_NAMES, ...customExercises].filter(n => !isHiddenFromSelector(n)).map(norm));
  const names = exportableNames(customExercises, history);

  const fams = new Map();
  for (const name of names) {
    const family = resolveFamily(name);
    const k = norm(family);
    const f = fams.get(k) || { family, variants: [] };
    f.variants.push(name);
    fams.set(k, f);
  }

  const rows = [...fams.values()].map(f => {
    const group = familyGroup(f.family) || f.variants.map(n => resolveMuscleGroup(n).group).find(Boolean) || null;
    return { ...f, group };
  }).sort((a, b) => byEs(a.family, b.family));

  let variantCount = 0;
  let withHistory = 0;
  const lines = [];
  for (const f of rows) {
    lines.push(`${f.family.toUpperCase()} — ${groupLabel(f.group)}`);
    for (const name of f.variants.sort(byEs)) {
      variantCount++;
      const u = usage.get(norm(name));
      if (u) withHistory++;
      const entry = getFamilyEntry(name);
      const meta = getExerciseMeta(name);
      const time = getMeasurement(name) === 'time';
      const offered = entry ? entry.equipment : (meta.equipment ? [meta.equipment] : []);
      const used = u ? [...u.byEquipment.entries()].filter(([e]) => e).sort((a, b) => b[1] - a[1]).map(([e]) => e) : [];
      const parts = [];
      // Implement first, then the measurement: "Plancha — peso corporal · tiempo". A timed exercise is not
      // split by implement, so what was used in the history is not listed for it.
      if (offered.length) parts.push(offered.map(eqLabel).join(', '));
      if (time) parts.push('tiempo');
      const extra = used.filter(e => !offered.includes(e));
      if (!time && extra.length) parts.push(`${offered.length ? 'usado también con' : 'usado con'}: ${extra.map(eqLabel).join(', ')}`);
      else if (!time && !offered.length) parts.push('sin implemento definido');
      const uni = unilateralSpec(name);
      if (Array.isArray(uni) && uni.length) parts.push(`unilateral con ${uni.map(eqLabel).join(', ')}`);
      else if (uni === true) parts.push('unilateral');
      const flags = [];
      if (u) flags.push(`${u.sessions} ${u.sessions === 1 ? 'sesión' : 'sesiones'}`);
      if (!entry && !selectorNames.has(norm(name))) flags.push('fuera del selector');
      else if (!entry) flags.push('propio');
      lines.push(`  ${u ? '●' : '○'} ${name} — ${parts.join(' · ')}${flags.length ? `  [${flags.join(', ')}]` : ''}`);
    }
    lines.push('');
  }

  // Local date, the same helper the file name uses (downloadNaming -> localDateStr).
  const day = localDateStr(now);
  const header = [
    `EJERCICIOS — Iron Commander (${day})`,
    `${rows.length} familias · ${variantCount} variantes · ${withHistory} con historial`,
    '● = tiene historial · ○ = sin historial. Familia → variante → implementos. El grupo muscular es el de la familia.',
    'Un ejercicio con "implemento" distinto es otra variante para los números (1RM, top sets): el nombre va igual y el implemento en `equipo`.',
    '',
  ];
  return { text: [...header, ...lines].join('\n').replace(/\n+$/, '\n'), families: rows.length, variants: variantCount, withHistory };
}
