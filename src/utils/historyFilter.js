import { sameExercise } from './exerciseName';

const PERIOD_DAYS = { week: 7, month: 30, '3m': 90, '6m': 180, year: 365 };

// Filter + sort pipeline of the History tab. Pure: `now` is injectable for tests.
export const filterAndSortHistory = (
  history,
  { search, exFilter, period, sort },
  now = Date.now()
) => {
  return history.filter(h => {
    if (search && !((h.name || '').toLowerCase().includes(search.toLowerCase()))) return false;
    if (exFilter && !((h.exercises || []).some(ex => sameExercise(ex?.name, exFilter)))) return false;
    if (period !== 'all') {
      const days = PERIOD_DAYS[period];
      if (days && h.completedAt && (now - new Date(h.completedAt).getTime()) > days * 86400000) return false;
    }
    return true;
  }).slice().sort((a, b) => {
    if (sort === 'oldest') return new Date(a.completedAt) - new Date(b.completedAt);
    if (sort === 'volume') {
      const vol = h => (h.exercises || []).reduce((s, ex) => s + (ex?.sets || []).reduce((s2, set) => s2 + (set.weight || 0) * (set.reps || 0), 0), 0);
      return vol(b) - vol(a);
    }
    return new Date(b.completedAt) - new Date(a.completedAt);
  });
};
