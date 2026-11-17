import { db } from '../../db/database';
import { DEFAULT_EXERCISE_DB } from '../../constants/gymConstants';
import { FAMILY_TABLE, FAMILY_NAMES, familyVariants, getFamilyEntry } from '../../constants/exerciseFamilies';
import { TAXONOMY_RULES } from '../taxonomyMapping';
import { normalizeExerciseName } from '../exerciseName';
import { resolveHistoryEquipment } from '../exerciseVariant';

// Filler words that never identify an exercise ("Remo con mancuerna" ≈ "Remo mancuerna").
const STOPWORDS = new Set(['con', 'de', 'en', 'a', 'la', 'el']);

// Looser than the app's identity: also ignores punctuation and filler words. Only used to
// decide the "probable" tier and to score fuzzy candidates — never to treat two names as
// the same exercise on its own.
// Simple plural: "mancuernas" = "mancuerna" (words of 4+ letters ending in a single s; "press" stays).
const singular = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const looseWords = (name) =>
  normalizeExerciseName(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOPWORDS.has(w)).map(singular);
const looseKey = (name) => looseWords(name).join(' ');

const scoreSimilarity = (candidateLoose, importedLoose, importedWords) => {
  let score = 0;
  for (const word of importedWords) {
    if (candidateLoose.includes(word)) score += 10;
  }
  if (importedLoose && candidateLoose && (candidateLoose.includes(importedLoose) || importedLoose.includes(candidateLoose))) score += 20;
  return score;
};

// Old names -> the variant they became (+ the implement they carried). Starts from the phase-2 rules
// (taxonomyMapping.js: `to`, and `all` when the variant has one implement) and is completed with the old
// names of the Catálogo 8.4 (implement when they carry one; reviewed by hand; the rules are not touched, the
// phase-2 migration plan is hashed on them).
const OLD_NAME_OVERRIDES = [
  { from: ['Press Banca Inclinado'], to: 'Press Inclinado', equipment: 'barbell' },
  { from: ['Press Inclinado Mancuernas'], to: 'Press Inclinado', equipment: 'dumbbell' },
  { from: ['Curl de Bíceps con Barra', 'Curl de bicep con barra', 'Curl de biceps con barra'], to: 'Curl de Bíceps', equipment: 'barbell' },
  { from: ['Curl de Bíceps en Polea'], to: 'Curl de Bíceps', equipment: 'cable' },
  { from: ['Curl de Bíceps Bayesiano'], to: 'Curl Bayesiano', equipment: 'cable' },
  { from: ['Elevaciones laterales con polea'], to: 'Elevaciones Laterales', equipment: 'cable' },
  { from: ['Cruce de Poleas'], to: 'Aperturas', equipment: 'cable' },
  { from: ['Remo en Punta', 'Remo con Landmine'], to: 'Remo Landmine', equipment: 'landmine' },
  { from: ['Extensión de Tríceps con Mancuerna'], to: 'Rompecráneos', equipment: 'dumbbell' },
  { from: ['Jalón en Polea a una mano'], to: 'Jalón a una mano', equipment: 'cable' },
  { from: ['Tuck Front Lever'], to: 'Front Lever Tuck', equipment: 'bodyweight' },
  { from: ['Plancha Abdominal', 'Core Anti-extensión'], to: 'Plancha', equipment: 'bodyweight' },
  // Catálogo 8.4 "Absorbe" without a single implement (the phase-2 rules leave them "sin resolver"):
  // Remo en Polea is the canonical one; Hammer curwl is the typo of Hammer curl (an exercise of its own).
  { from: ['Remo Polea / Landmine', 'Remo en Polea / Landmine', 'Lanemine row'], to: 'Remo en Polea', equipment: null },
  { from: ['Hammer curwl'], to: 'Hammer Curl', equipment: null },
];
const OLD_NAME_BY_KEY = (() => {
  const m = new Map();
  for (const r of TAXONOMY_RULES) for (const from of r.from) m.set(normalizeExerciseName(from), { to: r.to, equipment: r.all || null });
  for (const r of OLD_NAME_OVERRIDES) for (const from of r.from) m.set(normalizeExerciseName(from), { to: r.to, equipment: r.equipment });
  return m;
})();

// The athlete's own rows that are the same exercise as a variant of the table (normalized) are the table's
// variant, not another exercise: they are left out of the pool (nothing is deleted or modified).
export const isTableDuplicate = (name) => !!getFamilyEntry(name);

/**
 * Tiers, strongest first:
 *  - exact:    same exercise for the app (normalizeExerciseName equal) — applied silently.
 *  - family:   the name is a family of the table (not a variant): with several variants it is `fuzzy` with
 *              `family` set and the family's variants as the only options; with one it is `probable`.
 *  - rule:     an old name of the phase-2 rules (taxonomyMapping.js): `probable`, preselecting the new
 *              variant (`viaRule`), with the rule's implement as `suggestedEquipment` when it has one.
 *  - probable: equal once punctuation, filler words and simple plurals are ignored, and only ONE catalog
 *              name qualifies — applied by default, visible and changeable in the wizard.
 *  - fuzzy:    similar names, no default — pending until the athlete picks (or the Coach's
 *              name is kept as a new exercise). `contained` = the candidates whose whole name
 *              contains (or is contained in) the imported one — the only fuzzy ones worth a
 *              "¿Es X?" prompt when creating an exercise by hand.
 *  - none:     nothing similar.
 * Synchronous and pure: `allNames` is the pool to compare against.
 */
// The variant, among `names`, used most recently in the history, with the implement of that appearance.
const lastUsedVariant = (history, names) => {
  const byKey = new Map(names.map(n => [normalizeExerciseName(n), n]));
  let best = null;
  for (const session of Array.isArray(history) ? history : []) {
    const t = Date.parse(session?.completedAt || session?.createdAt || '') || 0;
    for (const ex of (Array.isArray(session?.exercises) ? session.exercises : [])) {
      const name = ex?.name && byKey.get(normalizeExerciseName(ex.name));
      if (name && (!best || t > best.t)) best = { t, name, equipment: resolveHistoryEquipment(ex) };
    }
  }
  return best;
};

export const scoreCandidates = (importedName, allNames, { history } = {}) => {
  if (!importedName) return { type: 'none' };

  const identity = normalizeExerciseName(importedName);
  const exact = allNames.find(n => normalizeExerciseName(n) === identity);
  if (exact) return { type: 'exact', exerciseName: exact };

  const importedWords = looseWords(importedName);
  const importedLoose = importedWords.join(' ');
  const inPool = (n) => allNames.find(x => normalizeExerciseName(x) === normalizeExerciseName(n));

  // An old name (phase-2 rules + Catálogo 8.4): the variant it became and the implement it carried.
  const old = OLD_NAME_BY_KEY.get(identity);
  const oldTarget = old && inPool(old.to);
  const oldFields = oldTarget ? { viaRule: true, ...(old.equipment ? { suggestedEquipment: old.equipment, suggestedFrom: 'regla' } : {}) } : {};

  // A family name (and not a variant): only its variants are offered (the history-only ones — hidden rows
  // such as "Cardio (sin especificar)" — are not). Preselected: the variant of the family used most recently
  // in the history (with the implement of that use); a family with no history, the variant of the old-name
  // rule when there is one; otherwise none.
  const familyName = FAMILY_NAMES.find(f => normalizeExerciseName(f) === identity);
  if (familyName) {
    const variants = familyVariants(familyName).filter(r => r.inSelector && inPool(r.name)).map(r => inPool(r.name));
    if (variants.length === 1) return { type: 'probable', exerciseName: variants[0], alternatives: [], viaFamily: familyName, ...oldFields };
    if (variants.length > 1) {
      const used = lastUsedVariant(history, variants);
      if (used) {
        return {
          type: 'probable', exerciseName: used.name, alternatives: variants.filter(v => v !== used.name), family: familyName, viaHistory: true,
          ...(used.equipment ? { suggestedEquipment: used.equipment, suggestedFrom: 'historial' } : {}),
        };
      }
      if (oldTarget && variants.includes(oldTarget)) {
        return { type: 'probable', exerciseName: oldTarget, alternatives: variants.filter(v => v !== oldTarget), family: familyName, ...oldFields };
      }
      return { type: 'fuzzy', candidates: variants, contained: [], family: familyName };
    }
  }

  if (oldTarget) return { type: 'probable', exerciseName: oldTarget, alternatives: [], ...oldFields };

  const ranked = allNames
    .map(n => ({ name: n, score: scoreSimilarity(looseKey(n), importedLoose, importedWords) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const probableMatches = importedLoose ? allNames.filter(n => looseKey(n) === importedLoose) : [];
  if (probableMatches.length === 1) {
    const probable = probableMatches[0];
    return {
      type: 'probable',
      exerciseName: probable,
      alternatives: ranked.map(c => c.name).filter(n => n !== probable).slice(0, 3),
    };
  }

  if (ranked.length > 0) {
    const contained = ranked
      .filter(c => { const k = looseKey(c.name); return importedLoose && k && (k.includes(importedLoose) || importedLoose.includes(k)); })
      .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
      .map(c => c.name);
    return { type: 'fuzzy', candidates: ranked.slice(0, 5).map(c => c.name), contained };
  }
  return { type: 'none' };
};

export const findExerciseMatch = async (importedName, { history } = {}) => {
  if (!importedName) return { type: 'none' };

  let customNames = [];
  try {
    const rows = await db.customExercises.toArray();
    customNames = rows.map(r => r.name).filter(Boolean).filter(n => !isTableDuplicate(n));
  } catch { /* ignore */ }

  // The families table's variants count too (a YAML with "Sissy Squat" is not a new exercise), the
  // hidden ones included: they still resolve to their name.
  const allNames = [...new Set([...(Array.isArray(DEFAULT_EXERCISE_DB) ? DEFAULT_EXERCISE_DB : []), ...FAMILY_TABLE.map(r => r.name), ...customNames])];
  let hist = history;
  if (hist === undefined) { try { hist = await db.history.toArray(); } catch { hist = []; } }
  return scoreCandidates(importedName, allNames, { history: hist });
};

export const matchRoutineExercises = async (routine) => {
  if (!Array.isArray(routine?.exercises)) return { mappings: {}, allExact: false };

  const mappings = {};
  let exactCount = 0;
  let history = [];
  try { history = await db.history.toArray(); } catch { /* ignore */ }

  for (const ex of routine.exercises) {
    const match = await findExerciseMatch(ex.name, { history });
    mappings[ex.name] = match;
    if (match.type === 'exact') exactCount++;
  }

  return { mappings, allExact: exactCount === routine.exercises.length };
};
