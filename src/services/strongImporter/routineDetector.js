/**
 * Compute a session's "signature": top-3 exercises by total volume (weight × reps).
 */
function sessionSignature(session) {
  const volumes = (session.exercises || []).map(ex => {
    const vol = (ex.sets || []).reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
    return { name: ex.name, vol };
  });
  volumes.sort((a, b) => b.vol - a.vol);
  return volumes.slice(0, 3).map(v => v.name);
}

function sigOverlap(sigA, sigB) {
  const setA = new Set(sigA);
  return sigB.filter(e => setA.has(e)).length;
}

function suggestName(topExercises) {
  const top = (topExercises || []).map(e => e.toLowerCase());
  const has = (kw) => top.some(e => e.includes(kw));

  if (has('sentadilla') && !has('búlgara') && !has('goblet')) return 'Pierna A — Sentadilla';
  if (has('peso muerto') && !has('rumano'))                     return 'Pierna B — Peso Muerto';
  if (has('peso muerto rumano'))                               return 'Pierna — Posterior';
  if (has('press banca') && !has('inclinado'))                 return 'Empuje — Pecho';
  if (has('press banca inclinado'))                            return 'Empuje — Inclinado';
  if (has('press militar'))                                    return 'Empuje — Hombros';
  if (has('dominadas') && (has('remo') || has('jalón')))       return 'Tirón — Espalda';
  if (has('dominadas'))                                        return 'Tirón — Dominadas';
  if (has('jalón'))                                            return 'Tirón — Espalda';
  if (has('remo con barra'))                                   return 'Tirón — Remo';
  if (has('hip thrust'))                                       return 'Glúteos';
  if (has('curl') && has('tríceps'))                           return 'Brazos';
  if (has('curl'))                                             return 'Bíceps';
  if (has('tríceps') || has('triceps'))                        return 'Tríceps';
  if (has('elevaciones laterales'))                            return 'Hombros';
  if (topExercises.length > 0)                                 return `Día de ${topExercises[0]}`;
  return 'Rutina Sin Nombre';
}

/**
 * Average reps for an exercise across the last N appearances in sessions.
 */
function avgRepsForExercise(exName, sessions, lastN = 5) {
  const repsList = [];
  for (const s of sessions) {
    for (const ex of s.exercises || []) {
      if (ex.name === exName && ex.sets?.length > 0) {
        const avgR = Math.round(ex.sets.reduce((sum, s) => sum + (s.reps || 0), 0) / ex.sets.length);
        repsList.push({ reps: avgR, setCount: ex.sets.length });
        break;
      }
    }
    if (repsList.length >= lastN) break;
  }
  if (repsList.length === 0) return { reps: 8, setCount: 3 };
  const avgReps = Math.round(repsList.reduce((sum, r) => sum + r.reps, 0) / repsList.length);
  const avgSets = Math.round(repsList.reduce((sum, r) => sum + r.setCount, 0) / repsList.length);
  return { reps: avgReps || 8, setCount: avgSets || 3 };
}

/**
 * @param {object[]} normalizedSessions
 * @returns {object[]} top-8 routine candidates
 */
export function detectRoutines(normalizedSessions) {
  // Compute signatures
  const withSigs = normalizedSessions.map(s => ({
    session: s,
    sig: sessionSignature(s),
  }));

  // Cluster: group sessions by signature overlap
  const clusters = []; // { sig: [], sessions: [] }

  for (const { session, sig } of withSigs) {
    if (sig.length === 0) continue;

    let bestCluster = null;
    let bestOverlap = 0;

    for (const cluster of clusters) {
      const overlap = sigOverlap(sig, cluster.sig);
      if (overlap >= 2 && overlap > bestOverlap) {
        bestCluster = cluster;
        bestOverlap = overlap;
      }
    }

    if (bestCluster) {
      bestCluster.sessions.push(session);
      // Update cluster sig to be the most common top-3 exercises across all sessions
      bestCluster._allSigs.push(sig);
      bestCluster.sig = clusterRepresentativeSig(bestCluster._allSigs);
    } else {
      clusters.push({
        sig,
        sessions: [session],
        _allSigs: [sig],
      });
    }
  }

  // Filter to clusters with ≥ 5 sessions, sort by count desc, take top 8
  const candidates = clusters
    .filter(c => c.sessions.length >= 5)
    .sort((a, b) => b.sessions.length - a.sessions.length)
    .slice(0, 8);

  return candidates.map((cluster, idx) => {
    const sessions = cluster.sessions;
    const dates = sessions.map(s => s.completedAt).sort();

    // Union all exercises
    const exCounts = {};
    for (const s of sessions) {
      for (const ex of s.exercises || []) {
        exCounts[ex.name] = (exCounts[ex.name] || 0) + 1;
      }
    }
    const allExercises = Object.keys(exCounts).sort((a, b) => exCounts[b] - exCounts[a]);

    // Top exercises by frequency
    const topExercises = allExercises.slice(0, 3);

    // Build template exercises (exercises appearing in ≥ 50% of sessions)
    const threshold = Math.ceil(sessions.length * 0.5);
    const templateExNames = allExercises.filter(e => exCounts[e] >= threshold);

    // For each template exercise, find equipment and avg reps from the last 5 sessions
    const templateExercises = templateExNames.map(exName => {
      const exEntry = sessions.flatMap(s => s.exercises || []).find(e => e.name === exName);
      const { reps, setCount } = avgRepsForExercise(exName, sessions, 5);
      return {
        id: `tpl-${idx}-${exName.replace(/\s+/g, '-').toLowerCase()}`,
        name: exName,
        equipment: exEntry?.equipment || 'other',
        sets: Array.from({ length: setCount }, () => ({
          weight: 0, reps, rpe: 0, type: 'normal',
        })),
      };
    });

    return {
      suggestedName: suggestName(topExercises),
      sessionCount: sessions.length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      topExercises,
      allExercises,
      templateExercises,
    };
  });
}

function clusterRepresentativeSig(allSigs) {
  const counts = {};
  for (const sig of allSigs) {
    for (const ex of sig) counts[ex] = (counts[ex] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}
