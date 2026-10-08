import { db } from '../../db/database';
import { DEFAULT_EXERCISE_DB } from '../../constants/gymConstants';
import { normalizeExerciseName } from '../exerciseName';

// Filler words that never identify an exercise ("Remo con mancuerna" ≈ "Remo mancuerna").
const STOPWORDS = new Set(['con', 'de', 'en', 'a', 'la', 'el']);

// Looser than the app's identity: also ignores punctuation and filler words. Only used to
// decide the "probable" tier and to score fuzzy candidates — never to treat two names as
// the same exercise on its own.
const looseWords = (name) =>
  normalizeExerciseName(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOPWORDS.has(w));
const looseKey = (name) => looseWords(name).join(' ');

const scoreSimilarity = (candidateLoose, importedLoose, importedWords) => {
  let score = 0;
  for (const word of importedWords) {
    if (candidateLoose.includes(word)) score += 10;
  }
  if (importedLoose && candidateLoose && (candidateLoose.includes(importedLoose) || importedLoose.includes(candidateLoose))) score += 20;
  return score;
};

/**
 * Tiers, strongest first:
 *  - exact:    same exercise for the app (normalizeExerciseName equal) — applied silently.
 *  - probable: equal once punctuation and filler words are ignored, and only ONE catalog
 *              name qualifies — applied by default, visible and changeable in the wizard.
 *  - fuzzy:    similar names, no default — pending until the athlete picks (or the Coach's
 *              name is kept as a new exercise).
 *  - none:     nothing similar.
 */
export const findExerciseMatch = async (importedName) => {
  if (!importedName) return { type: 'none' };

  let customNames = [];
  try {
    const rows = await db.customExercises.toArray();
    customNames = rows.map(r => r.name).filter(Boolean);
  } catch { /* ignore */ }

  const allNames = [...new Set([...(Array.isArray(DEFAULT_EXERCISE_DB) ? DEFAULT_EXERCISE_DB : []), ...customNames])];

  const identity = normalizeExerciseName(importedName);
  const exact = allNames.find(n => normalizeExerciseName(n) === identity);
  if (exact) return { type: 'exact', exerciseName: exact };

  const importedWords = looseWords(importedName);
  const importedLoose = importedWords.join(' ');

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

  if (ranked.length > 0) return { type: 'fuzzy', candidates: ranked.slice(0, 5).map(c => c.name) };
  return { type: 'none' };
};

export const matchRoutineExercises = async (routine) => {
  if (!Array.isArray(routine?.exercises)) return { mappings: {}, allExact: false };

  const mappings = {};
  let exactCount = 0;

  for (const ex of routine.exercises) {
    const match = await findExerciseMatch(ex.name);
    mappings[ex.name] = match;
    if (match.type === 'exact') exactCount++;
  }

  return { mappings, allExact: exactCount === routine.exercises.length };
};
