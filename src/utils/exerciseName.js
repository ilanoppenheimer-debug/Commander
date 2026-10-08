/**
 * Exercise identity. Two names that differ only in case, accents or whitespace are the
 * SAME exercise everywhere in the app (history, 1RM, placeholders, block report, Coach
 * context, exercise metadata). It is a comparison rule only — no stored name is ever
 * rewritten; history and routines keep whatever spelling they were saved with.
 *
 * Punctuation is deliberately NOT stripped here: "Press (barra)" and "Press barra" stay
 * different exercises. The import matcher uses a looser form for its "probable" tier.
 */
export const normalizeExerciseName = (name) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const sameExercise = (a, b) => {
  const na = normalizeExerciseName(a);
  return na !== '' && na === normalizeExerciseName(b);
};

/**
 * normalized name -> the spelling used by the MOST RECENT session that has it. This is
 * what reports and lists print when several spellings of one exercise exist.
 */
export const buildDisplayNameIndex = (sessions) => {
  const latest = new Map();
  for (const s of Array.isArray(sessions) ? sessions : []) {
    const t = Date.parse(s?.completedAt || s?.createdAt || '') || 0;
    for (const ex of Array.isArray(s?.exercises) ? s.exercises : []) {
      if (!ex?.name) continue;
      const key = normalizeExerciseName(ex.name);
      const cur = latest.get(key);
      if (!cur || t >= cur.t) latest.set(key, { name: ex.name, t });
    }
  }
  return new Map([...latest].map(([key, v]) => [key, v.name]));
};

export const displayNameFor = (index, name) => index.get(normalizeExerciseName(name)) ?? name;
