import { calculate1RM } from "../../utils/strengthMath";

export function buildAthleteProfile(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  const exerciseStats = {};
  let totalSets = 0;
  let totalVolume = 0;
  let totalRPE = 0;
  let rpeCount = 0;

  history.forEach(session => {
    session.exercises?.forEach(ex => {
      if (!exerciseStats[ex.name]) {
        exerciseStats[ex.name] = {
          sessions: 0,
          totalSets: 0,
          bestWeight: 0,
          best1RM: 0,
          totalVolume: 0
        };
      }

      const stat = exerciseStats[ex.name];
      stat.sessions++;

      ex.sets?.forEach(set => {
        const w = Number(set.weight) || 0;
        const r = Number(set.reps) || 0;
        const rpe = Number(set.rpe) || 0;

        totalSets++;
        totalVolume += w * r;
        stat.totalSets++;
        stat.totalVolume += w * r;

        if (w > stat.bestWeight) stat.bestWeight = w;

        const est1RM = calculate1RM(w, r, rpe, "hybrid");
        if (est1RM > stat.best1RM) stat.best1RM = est1RM;

        if (rpe > 0) {
          totalRPE += rpe;
          rpeCount++;
        }
      });
    });
  });

  return {
    totalSessions: history.length,
    totalSets,
    totalVolume,
    avgRPE: rpeCount ? totalRPE / rpeCount : 0,
    exercises: exerciseStats,
    generatedAt: new Date().toISOString()
  };
}