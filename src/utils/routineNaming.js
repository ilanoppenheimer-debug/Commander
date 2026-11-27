// Identidad de un nombre de plantilla: sin mayúsculas, tildes ni espacios repetidos. ÚNICA fuente para la regla
// "no hay dos plantillas ACTIVAS con el mismo nombre" (crear, renombrar, guardar como plantilla, desarchivar,
// clonar, import) y para la deduplicación (utils/routineDedupe.js). Las archivadas pueden repetir nombre.
export const normalizeRoutineName = (name) =>
  (name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// La plantilla ACTIVA que ya usa ese nombre (normalizado), o null. `excludeId` es el `id` de la propia plantilla
// (para que renombrarla a su mismo nombre, o con otras mayúsculas, no choque consigo misma).
export const findActiveByName = (name, routines, excludeId = null) => {
  const key = normalizeRoutineName(name);
  if (!key) return null;
  return (Array.isArray(routines) ? routines : []).find((r) =>
    r && !r.archived && (excludeId == null || (r.id ?? r.routineId) !== excludeId) && normalizeRoutineName(r.name) === key
  ) || null;
};

// "Base", y si ya existe: "Base 2", "Base 3"… (para plantillas creadas sin nombre elegido por el usuario).
export const uniqueRoutineName = (base, routines) => {
  let name = base, n = 1;
  while (findActiveByName(name, routines)) name = `${base} ${++n}`;
  return name;
};

// Name for a cloned routine: "X (copia)", then "X (copia 2)", "X (copia 3)"…
// Cloning a copy strips its suffix first, so copies never nest. Compara por nombre normalizado (como la regla de
// nombres únicos): "Café" y "cafe (COPIA)" cuentan como la misma familia.
export const nextCopyName = (routineName, routines) => {
  const baseName = (routineName || 'Rutina').replace(/\s*\(copia(\s*\d+)?\)\s*$/i, '');
  const nBase = normalizeRoutineName(baseName);
  const esc = nBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${esc}\\s*\\(copia(?:\\s*(\\d+))?\\)$`);
  let maxNum = 0;
  for (const r of routines) {
    const m = normalizeRoutineName(r.name).match(regex);
    if (m) maxNum = Math.max(maxNum, m[1] ? parseInt(m[1], 10) : 1);
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
