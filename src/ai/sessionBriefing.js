import { callGeminiAPI } from "../services/aiService";

const MAX_HISTORY_PER_EXERCISE = 5;

const summarizeExerciseHistory = (exerciseName, history) => {
  if (!exerciseName || !Array.isArray(history)) return [];
  const rows = [];

  for (const session of history) {
    if (rows.length >= MAX_HISTORY_PER_EXERCISE) break;
    const ex = (session.exercises || []).find(
      (e) => e?.name?.toLowerCase() === exerciseName.toLowerCase()
    );
    if (!ex || !Array.isArray(ex.sets)) continue;

    const tops = ex.sets.reduce(
      (acc, s) => {
        const w = parseFloat(s?.weight) || 0;
        const r = parseFloat(s?.reps) || 0;
        const rpe = parseFloat(s?.rpe) || 0;
        if (w > acc.weight) return { weight: w, reps: r, rpe };
        return acc;
      },
      { weight: 0, reps: 0, rpe: 0 }
    );
    if (tops.weight <= 0) continue;

    rows.push({
      date: session.completedAt
        ? new Date(session.completedAt).toISOString().slice(0, 10)
        : "?",
      topWeight: tops.weight,
      reps: tops.reps,
      rpe: tops.rpe,
      totalSets: ex.sets.length,
    });
  }

  return rows;
};

const buildSystemContext = ({ mode, exercises, history, athleteProfile }) => {
  const exerciseSummaries = (exercises || [])
    .filter((e) => e?.name)
    .map((e) => {
      const past = summarizeExerciseHistory(e.name, history);
      const pastText =
        past.length > 0
          ? past
              .map(
                (p) =>
                  `${p.date}: top ${p.topWeight}×${p.reps} @RPE${p.rpe || "-"} (${p.totalSets} sets)`
              )
              .join("; ")
          : "sin historial";
      return `- ${e.name}: ${pastText}`;
    })
    .join("\n");

  const profileText = athleteProfile
    ? `Perfil: ${athleteProfile.totalSessions} sesiones totales, ${athleteProfile.totalSets} series, RPE promedio ${athleteProfile.avgRPE?.toFixed(1) || "n/d"}.`
    : "Perfil: sin datos aún.";

  const modeText = mode
    ? `Fase activa: ${mode.label || "estándar"} | RPE objetivo ${mode.rpe || "?"} | rango reps ${mode.repRange || "?"} | sets ${mode.sets || "?"}`
    : "Fase activa: estándar";

  return [
    "Eres un coach de fuerza que planifica sesiones. Analiza el historial y responde SOLO con JSON válido.",
    profileText,
    modeText,
    "Historial reciente por ejercicio:",
    exerciseSummaries || "(sin ejercicios)",
  ].join("\n");
};

const buildUserQuery = ({ sessionName, subjectiveState }) => {
  const parts = [
    `Prepara el briefing para la sesión "${sessionName || "Entrenamiento"}".`,
    subjectiveState
      ? `Estado subjetivo del atleta: "${subjectiveState}".`
      : "",
    "",
    "Devuelve JSON con esta forma exacta:",
    `{
  "fatigueWarning": string | null,
  "generalAdvice": string,
  "perExercise": [
    { "name": string, "suggestedWeight": number, "reps": number, "rpe": number, "note": string }
  ]
}`,
    "Los pesos deben ser coherentes con el historial (sin inventar). Si no hay historial para un ejercicio, usa 0 y explica en note que es primera vez.",
    "Responde ÚNICAMENTE con el JSON, sin markdown ni texto adicional.",
  ];
  return parts.filter(Boolean).join("\n");
};

const parseBriefingResponse = (text) => {
  if (!text) return null;
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  const tryParse = (str) => {
    try {
      const p = JSON.parse(str);
      if (!p || typeof p !== "object") return null;
      return {
        fatigueWarning: p.fatigueWarning || null,
        generalAdvice: p.generalAdvice || "",
        perExercise: Array.isArray(p.perExercise) ? p.perExercise : [],
      };
    } catch { return null; }
  };

  // Attempt 1: direct parse
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Attempt 2: extract first {...} block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    const fromBlock = tryParse(match[0]);
    if (fromBlock) return fromBlock;
  }

  console.error("Briefing parse failed after all attempts", cleaned.slice(0, 200));
  return null;
};

export const requestSessionBriefing = async ({
  sessionName,
  exercises,
  mode,
  history,
  athleteProfile,
  subjectiveState,
}) => {
  const systemContext = buildSystemContext({
    mode,
    exercises,
    history,
    athleteProfile,
  });
  const userQuery = buildUserQuery({ sessionName, subjectiveState });

  const text = await callGeminiAPI({
    systemContext,
    userQuery,
    useCache: !subjectiveState,
  });

  return parseBriefingResponse(text);
};
