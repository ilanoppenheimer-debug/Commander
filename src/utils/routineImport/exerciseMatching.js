import { db } from '../../db/database';
import { DEFAULT_EXERCISE_DB } from '../../constants/gymConstants';

const normalize = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const scoreSimilarity = (a, b, bWords) => {
  if (a === b) return 100;
  let score = 0;
  for (const word of bWords) {
    if (a.includes(word)) score += 10;
  }
  if (a.includes(b) || b.includes(a)) score += 20;
  return score;
};

export const findExerciseMatch = async (importedName) => {
  if (!importedName) return { type: 'none' };

  const normalized = normalize(importedName);

  let customNames = [];
  try {
    const rows = await db.customExercises.toArray();
    customNames = rows.map(r => r.name).filter(Boolean);
  } catch { /* ignore */ }

  const allNames = [...new Set([...(Array.isArray(DEFAULT_EXERCISE_DB) ? DEFAULT_EXERCISE_DB : []), ...customNames])];

  const exact = allNames.find(n => normalize(n) === normalized);
  if (exact) return { type: 'exact', exerciseName: exact };

  const bWords = normalized.split(' ').filter(w => w.length > 2);
  const candidates = allNames
    .map(n => ({ name: n, score: scoreSimilarity(normalize(n), normalized, bWords) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (candidates.length > 0) return { type: 'fuzzy', candidates: candidates.map(c => c.name) };
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
