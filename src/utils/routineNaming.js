// Name for a cloned routine: "X (copia)", then "X (copia 2)", "X (copia 3)"…
// Cloning a copy strips its suffix first, so copies never nest.
export const nextCopyName = (routineName, routines) => {
  const baseName = (routineName || 'Rutina').replace(/\s*\(copia(\s*\d+)?\)\s*$/i, '');
  const esc = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${esc}\\s*\\(copia(\\s*\\d+)?\\)\\s*$`, 'i');
  let maxNum = 0;
  for (const r of routines) {
    if (r.name === `${baseName} (copia)`) maxNum = Math.max(maxNum, 1);
    const m = (r.name || '').match(regex);
    if (m && m[1]) {
      const n = parseInt(m[1].trim(), 10);
      if (!isNaN(n)) maxNum = Math.max(maxNum, n);
    }
  }
  return maxNum === 0 ? `${baseName} (copia)` : `${baseName} (copia ${maxNum + 1})`;
};

// Fila nueva para "Clonar plantilla". Las filas de la lista traen _id (clave de Dexie): si viajara en la copia,
// el guardado sobrescribiría la original en vez de crear otra. Tampoco se heredan routineId / updatedAt.
export const buildRoutineClone = (routine, routines, { id, now }) => {
  // eslint-disable-next-line no-unused-vars
  const { _id, routineId, updatedAt, ...rest } = routine;
  return {
    ...rest,
    id,
    name: nextCopyName(routine.name, routines),
    lastPerformed: null,
    createdAt: now,
  };
};
