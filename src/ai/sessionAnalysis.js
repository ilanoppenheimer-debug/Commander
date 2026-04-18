import { calculate1RM } from "../utils/strengthMath";

const DAY_MS = 24 * 60 * 60 * 1000;

const sessionVolume = (session) => {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  let volume = 0;
  let sets = 0;
  exercises.forEach((ex) => {
    (ex?.sets || []).forEach((s) => {
      const w = parseFloat(s?.weight) || 0;
      const r = parseFloat(s?.reps) || 0;
      if (w > 0 && r > 0) {
        volume += w * r;
        sets++;
      }
    });
  });
  return { volume, sets };
};

export const analyzeCurrentSession = (currentExercises) => {
  return sessionVolume({ exercises: currentExercises });
};

export const rollingVolumeAverage = (history, weeks = 4) => {
  if (!Array.isArray(history) || history.length === 0) return 0;
  const cutoff = Date.now() - weeks * 7 * DAY_MS;
  const recent = history.filter((h) => {
    const t = new Date(h?.completedAt || 0).getTime();
    return t && t >= cutoff;
  });
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, h) => sum + sessionVolume(h).volume, 0);
  return total / recent.length;
};

const bestSetStats = (sets) => {
  let bestWeight = 0;
  let bestReps = 0;
  let best1RM = 0;
  (sets || []).forEach((s) => {
    const w = parseFloat(s?.weight) || 0;
    const r = parseFloat(s?.reps) || 0;
    const rpe = parseFloat(s?.rpe) || 0;
    if (w <= 0 || r <= 0) return;
    if (w > bestWeight) bestWeight = w;
    if (r > bestReps) bestReps = r;
    const est = calculate1RM(w, r, rpe || 10, "hybrid");
    if (est > best1RM) best1RM = est;
  });
  return { bestWeight, bestReps, best1RM };
};

export const findPRs = (currentExercises, history) => {
  const prs = [];
  const safeHistory = Array.isArray(history) ? history : [];

  (currentExercises || []).forEach((ex) => {
    if (!ex?.name) return;
    const current = bestSetStats(ex.sets);
    if (current.bestWeight === 0) return;

    let hist = { bestWeight: 0, bestReps: 0, best1RM: 0 };
    safeHistory.forEach((session) => {
      (session.exercises || []).forEach((pastEx) => {
        if (pastEx?.name !== ex.name) return;
        const s = bestSetStats(pastEx.sets);
        if (s.bestWeight > hist.bestWeight) hist.bestWeight = s.bestWeight;
        if (s.bestReps > hist.bestReps) hist.bestReps = s.bestReps;
        if (s.best1RM > hist.best1RM) hist.best1RM = s.best1RM;
      });
    });

    const exercisePRs = [];
    if (current.bestWeight > hist.bestWeight) {
      exercisePRs.push({
        kind: "weight",
        value: current.bestWeight,
        prev: hist.bestWeight,
      });
    }
    if (current.best1RM > hist.best1RM && hist.best1RM > 0) {
      exercisePRs.push({
        kind: "1RM",
        value: Math.round(current.best1RM * 10) / 10,
        prev: Math.round(hist.best1RM * 10) / 10,
      });
    }
    if (exercisePRs.length > 0) {
      prs.push({ exercise: ex.name, records: exercisePRs });
    }
  });

  return prs;
};

export const compareWithLastSession = (
  currentSessionName,
  currentExercises,
  history
) => {
  if (!currentSessionName || !Array.isArray(history)) return null;
  const matches = history.filter((h) => h?.name === currentSessionName);
  if (matches.length === 0) return null;

  const last = matches.reduce((latest, s) => {
    const t = new Date(s?.completedAt || 0).getTime();
    const lt = new Date(latest?.completedAt || 0).getTime();
    return t > lt ? s : latest;
  }, matches[0]);

  const pastVolume = sessionVolume(last).volume;
  const currentVolume = sessionVolume({ exercises: currentExercises }).volume;

  const exerciseComparisons = [];
  (currentExercises || []).forEach((ex) => {
    const pastEx = (last.exercises || []).find((p) => p?.name === ex?.name);
    if (!pastEx) return;
    const currentStats = bestSetStats(ex.sets);
    const pastStats = bestSetStats(pastEx.sets);
    if (currentStats.bestWeight === 0 && pastStats.bestWeight === 0) return;
    exerciseComparisons.push({
      name: ex.name,
      currentTop: currentStats.bestWeight,
      pastTop: pastStats.bestWeight,
      currentReps: currentStats.bestReps,
      pastReps: pastStats.bestReps,
    });
  });

  return {
    lastDate: last.completedAt || null,
    pastVolume,
    currentVolume,
    exerciseComparisons,
  };
};

export const buildSessionAnalysis = ({
  sessionName,
  currentExercises,
  history,
}) => {
  const { volume, sets } = analyzeCurrentSession(currentExercises);
  const avg = rollingVolumeAverage(history, 4);
  const prs = findPRs(currentExercises, history);
  const comparison = compareWithLastSession(
    sessionName,
    currentExercises,
    history
  );

  return {
    volume,
    sets,
    rollingAverage4w: avg,
    volumeDeltaPct: avg > 0 ? ((volume - avg) / avg) * 100 : null,
    prs,
    comparison,
  };
};
