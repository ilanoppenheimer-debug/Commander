// ==========================================
// CÁLCULO DE DISCOS PARA BARRA
// ==========================================

export function calculatePlates(targetWeight, barWeight, availablePlates) {
  const weightPerSide = (targetWeight - barWeight) / 2;

  if (weightPerSide <= 0) {
    return {};
  }

  const result = {};
  let remaining = weightPerSide;

  // ordenar discos de mayor a menor
  const sortedPlates = Object.keys(availablePlates)
    .map(Number)
    .sort((a, b) => b - a);

  for (const plate of sortedPlates) {
    const availablePairs = Math.floor(availablePlates[plate] / 2);
    const neededPairs = Math.floor(remaining / plate);
    const usedPairs = Math.min(availablePairs, neededPairs);

    if (usedPairs > 0) {
      result[plate] = usedPairs * 2;
      remaining -= usedPairs * plate;
    }
  }

  return result;
}