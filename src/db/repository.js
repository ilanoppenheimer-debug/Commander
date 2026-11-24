import { db } from './database';

// ── History ────────────────────────────────────────────────────────────────
export const saveSession = (session) =>
  db.history.put({ ...session, updatedAt: new Date().toISOString() });

export const deleteSession = (historyId) =>
  db.history.where('historyId').equals(historyId).delete();

export const getSessionById = (historyId) =>
  db.history.where('historyId').equals(historyId).first();

export const getAllHistory = () =>
  db.history.orderBy('completedAt').reverse().toArray();

// ── Routines ───────────────────────────────────────────────────────────────
// `routines` tiene clave autoincremental (_id) e índice NO único en routineId, así que un `put` sin _id
// siempre INSERTA. Para que guardar una rutina con un id que ya existe (import en modo "replace") la
// ACTUALICE en vez de agregar otra fila, se busca por routineId y se reutiliza su _id.
//  - Si la rutina trae _id (viene de la lista y se edita), manda ese: se actualiza esa fila.
//  - Si no trae _id y ya hay fila(s) con ese routineId, se actualiza una sola (la de mayor _id): no se tocan
//    las demás. Los duplicados que ya existan en la base se resuelven aparte, no acá.
//  - lastPerformed / archived se conservan de la fila existente cuando la rutina entrante no los define
//    (un replace no debe borrar cuándo la hiciste ni desarchivarla).
export const saveRoutine = (routine) =>
  db.transaction('rw', db.routines, async () => {
    const now = new Date().toISOString();
    let existing = null;
    if (routine._id == null && routine.id != null) {
      const rows = await db.routines.where('routineId').equals(routine.id).toArray();
      existing = rows.reduce((best, r) => (!best || r._id > best._id ? r : best), null);
    }
    const row = { ...routine };
    if (existing) {
      row._id = existing._id;
      for (const k of ['lastPerformed', 'archived']) {
        if (row[k] === undefined && existing[k] !== undefined) row[k] = existing[k];
      }
    }
    return db.routines.put({
      ...row,
      routineId: routine.id,
      updatedAt: now,
      createdAt: routine.createdAt || now,
    });
  });

export const deleteRoutine = (routineId) =>
  db.routines.where('routineId').equals(routineId).delete();

export const getAllRoutines = () => db.routines.toArray();

// ── Custom Exercises ───────────────────────────────────────────────────────
export const getCustomExercises = () =>
  db.customExercises.toArray().then(rows => rows.map(r => r.name));

export const addCustomExercise = (name) =>
  db.customExercises.put({ name });

export const removeCustomExercise = (name) =>
  db.customExercises.where('name').equals(name).delete();

// ── Settings ───────────────────────────────────────────────────────────────
export const getSetting = async (key) => {
  const row = await db.settings.get(key);
  return row?.value;
};

export const setSetting = (key, value) =>
  db.settings.put({ key, value });

export const deleteSetting = (key) =>
  db.settings.delete(key);

// ── Bulk operations ────────────────────────────────────────────────────────
export const getDatabaseCounts = async () => ({
  history:         await db.history.count(),
  routines:        await db.routines.count(),
  customExercises: await db.customExercises.count(),
  logs:            await db.logs.count(),
});

export const clearAllData = () =>
  db.transaction('rw', db.history, db.routines, db.customExercises, db.settings, db.logs,
    () => Promise.all([
      db.history.clear(),
      db.routines.clear(),
      db.customExercises.clear(),
      db.settings.clear(),
      db.logs.clear(),
    ])
  );
