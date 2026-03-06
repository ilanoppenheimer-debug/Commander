export function getSessionAdvice({ exercise, sets, history }) {

  if (!Array.isArray(sets) || sets.length === 0) {
    return null;
  }

  const avgRPE =
    sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / sets.length;

  const topWeight = Math.max(...sets.map(s => Number(s.weight) || 0));

  // Fatiga básica
  if (avgRPE >= 9.5) {
    return {
      type: "fatigue",
      message: "Fatiga muy alta. Reduce 2-5% el peso o corta el volumen."
    };
  }

  // Muy fácil
  if (avgRPE <= 6.5) {
    return {
      type: "underload",
      message: "Demasiado fácil. Puedes subir peso en la próxima serie."
    };
  }

  // Zona óptima
  return {
    type: "optimal",
    message: "Carga adecuada. Mantén el plan."
  };
}