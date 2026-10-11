import { formatSetSummary } from './formatters';
import { normalizeExerciseName } from './exerciseName';
import { computeExercise1RM } from './strengthMath';
import { getExerciseMeta } from '../constants/exerciseMetadata';

// ONE formatter for "what did I do on this exercise, session by session". Used by the
// Coach context ("Últimos registros por ejercicio") and by "Enviar al Coach" in the
// exercise history — both must print the same line, so it lives here and nowhere else.
// Display-only: stored data is never touched.

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const formatShortDate = (iso) => {
  if (!iso) return '?';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_ES[d.getMonth()]}`;
};

// The session type is whatever comes before the first "—", "·", "." or "/" separator, or
// the whole name if there's none. Printed as written. See contextGenerator for grouping.
export const extractPrefix = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const sepMatch = raw.match(/[—·./]/);
  const prefix = sepMatch ? raw.slice(0, sepMatch.index) : raw;
  return prefix.trim().replace(/\s+/g, ' ');
};

// Real data has strings like '012', '037.5', '07': Number() and back to text. Returns
// null when it isn't a finite number (empty, garbage).
const numText = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? String(n) : null;
};

const num = (v) => { const t = numText(v); return t === null ? 0 : Number(t); };

const isWorkSet = (s) => {
  if (!s || s.type === 'warmup' || s.completed === false) return false;
  return num(s.reps) > 0 || num(s.seconds) > 0;
};

const hasLoad = (s) => num(s?.weight) > 0;

// "47.5×10@7.5", bodyweight "PC×12", timed sets through formatSetSummary (time + companion).
// `plus` prefixes external load with "+" (for the "con lastre" tail on bodyweight movements).
const formatCompactSet = (s, companion, plus = false) => {
  if (num(s.reps) <= 0) return formatSetSummary(s, 'kg', companion);
  const w = hasLoad(s) ? `${plus ? '+' : ''}${numText(s.weight)}` : 'PC';
  const rpe = numText(s.rpe);
  return `${w}×${numText(s.reps)}${rpe && Number(rpe) > 0 ? `@${rpe}` : ''}`;
};

const MAX_SETS = 4;
const formatSets = (sets, companion, plus = false) => {
  const shown = sets.slice(0, MAX_SETS).map(s => formatCompactSet(s, companion, plus)).join(', ');
  return sets.length > MAX_SETS ? `${shown} (+${sets.length - MAX_SETS})` : shown;
};

/**
 * Every appearance of exercises in `history`, newest first, grouped by identity.
 * Returns Map<normalizedName, Appearance[]>; Appearance = { time, iso, sessionName,
 * sessionType, name (spelling used that day), sets (work sets only) }.
 * `sinceMs` limits the window; `include(exercise)` filters which exercises are kept.
 */
export const collectAppearances = (history, { sinceMs = 0, include = () => true } = {}) => {
  const byKey = new Map();
  for (const session of Array.isArray(history) ? history : []) {
    const iso = session?.completedAt || session?.createdAt;
    const time = Date.parse(iso || '') || 0;
    if (time < sinceMs) continue;
    for (const ex of (Array.isArray(session.exercises) ? session.exercises : [])) {
      if (!ex?.name || !Array.isArray(ex.sets) || !include(ex)) continue;
      const sets = ex.sets.filter(isWorkSet);
      if (sets.length === 0) continue;
      const key = normalizeExerciseName(ex.name);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ time, iso, sessionName: session.name || '', sessionType: extractPrefix(session.name), name: ex.name, equipment: ex.equipment || null, sets });
    }
  }
  for (const apps of byKey.values()) apps.sort((a, b) => b.time - a.time);
  return byKey;
};

// "47.5×10@7.5, 47.5×10@8 (15-sep, TORSO A)"
// `equipmentLabel` (optional) goes last inside the parens: "(15-sep, TORSO A, mancuerna)".
export const formatAppearance = (app, companion, equipmentLabel) => {
  const type = app.sessionType ? `, ${app.sessionType}` : '';
  const eq = equipmentLabel ? `, ${equipmentLabel}` : '';
  return `${formatSets(app.sets, companion)} (${formatShortDate(app.iso)}${type}${eq})`;
};

const isBodyweightOnly = (app) => !app.sets.some(hasLoad) && app.sets.some(s => num(s.reps) > 0);

/**
 * Line body for the latest appearance (apps = newest first):
 *   "PC×10@7.5, PC×8 (06-oct, PULL) · con lastre: +10×6@8 (15-sep)"
 * The tail appears only when the latest appearance had no external load and an earlier
 * one in `apps` did — "last time I did it bodyweight" must not hide the loaded numbers.
 */
export const formatLatestEntry = (apps, companion) => {
  const latest = apps[0];
  let out = formatAppearance(latest, companion);
  if (isBodyweightOnly(latest)) {
    const loaded = apps.slice(1).find(a => a.sets.some(hasLoad));
    if (loaded) {
      const loadedSets = loaded.sets.filter(hasLoad);
      out += ` · con lastre: ${formatSets(loadedSets, companion, true)} (${formatShortDate(loaded.iso)})`;
    }
  }
  return out;
};

const EQUIPMENT_SHORT = {
  barbell: 'barra', dumbbell: 'mancuerna', machine: 'máquina', cable: 'polea',
  smith: 'multipower', kettlebell: 'kettlebell', bodyweight: 'peso corporal',
};

/**
 * Text for "Enviar al Coach": the last `count` appearances of one exercise (spelling
 * variants are one exercise), same line format as the Coach context. Returns null when
 * there is nothing logged.
 *  - Equipment is printed on each line only when the sent appearances disagree.
 *  - The 1RM line only for barbell/dumbbell (same criterion as the session report) and
 *    only when computeExercise1RM has a value.
 */
export const buildExerciseShareText = (exName, history, { count = 6 } = {}) => {
  const all = collectAppearances(history).get(normalizeExerciseName(exName)) || [];
  const apps = all.slice(0, count);
  if (apps.length === 0) return null;

  const metaEquipment = getExerciseMeta(exName).equipment || null;
  const equipOf = (a) => a.equipment || metaEquipment;
  const mixed = new Set(apps.map(equipOf)).size > 1;
  const companion = getExerciseMeta(exName).companion;

  const display = apps[0].name;
  const variants = [...new Set(apps.map(a => a.name))].filter(n => n !== display);

  const out = [`Historial de ${display}${variants.length ? ` (también registrado como: ${variants.join(', ')})` : ''}`];

  const equipment = equipOf(apps[0]);
  if (equipment === 'barbell' || equipment === 'dumbbell') {
    const orm = computeExercise1RM(display, history, { weeksBack: 12 });
    if (orm.current1RM != null && orm.sampleSize >= 1) {
      out.push(`1RM estimado: ${Math.round(orm.current1RM * 2) / 2} kg (N=${orm.sampleSize}, últimas 12 semanas) — referencia, no máximo del día`);
    }
  }

  out.push(`Últimas ${apps.length} apariciones:`);
  for (const a of apps) {
    const eq = mixed ? (EQUIPMENT_SHORT[equipOf(a)] || equipOf(a) || 'sin equipo') : null;
    out.push(`- ${formatAppearance(a, companion, eq)}`);
  }
  return out.join('\n');
};
