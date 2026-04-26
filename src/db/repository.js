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
export const saveRoutine = (routine) => {
  const now = new Date().toISOString();
  return db.routines.put({
    ...routine,
    routineId: routine.id,
    updatedAt: now,
    createdAt: routine.createdAt || now,
  });
};

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
