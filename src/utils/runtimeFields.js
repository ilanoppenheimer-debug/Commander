// Campos que SOLO tienen sentido dentro de la sesión que los generó y no deben viajar de una sesión a una
// plantilla ni de una plantilla a la sesión siguiente:
//   ejercicio: finishedAt (cuándo lo cerraste), exerciseNotes (la nota del atleta de esa sesión)
//   set:       completed, seconds (resultado de un hold), companionValue, rpe (el RPE que registraste)
// NO se tocan los campos del Coach: notes / decisionAdaptativa del ejercicio, y planned / plannedRpe /
// targetSeconds / restSeconds / type del set. `notes` del ejercicio es la nota_ejercicio del import; la nota del
// atleta es OTRO campo (exerciseNotes).
// Pura: devuelve copias nuevas, no muta la entrada.
//
// `keepRpe`: en una rutina IMPORTADA el `rpe` de un set es el RPE que prescribió el Coach (un valor simple viaja
// como rpe; un rango, como plannedRpe), así que al iniciar una sesión desde una importación se conserva.
export const stripRuntimeFields = (exercises, { keepRpe = false } = {}) => {
  if (!Array.isArray(exercises)) return exercises;
  return exercises.map((ex) => {
    if (!ex || typeof ex !== 'object') return ex;
    // eslint-disable-next-line no-unused-vars
    const { finishedAt, exerciseNotes, ...rest } = ex;
    return {
      ...rest,
      sets: Array.isArray(ex.sets) ? ex.sets.map((s) => stripSet(s, keepRpe)) : ex.sets,
    };
  });
};

const stripSet = (s, keepRpe) => {
  if (!s || typeof s !== 'object') return s;
  // eslint-disable-next-line no-unused-vars
  const { seconds, companionValue, rpe, completed, ...rest } = s;
  const out = { ...rest, completed: false };
  if (keepRpe) { if (rpe !== undefined) out.rpe = rpe; } else out.rpe = '';
  return out;
};
