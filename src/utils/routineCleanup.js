import { db } from '../db/database';
import { deleteRoutine } from '../db/repository';

const normalize = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_\.]+/g, ' ')
    .replace(/\(plantilla\)|\(copia(\s*\d+)?\)|\(copy\)|\(repetido(\s*\d+)?\)|\d+$/g, '')
    .trim();
};

export const findDuplicatesAndShells = async () => {
  const routines = await db.routines.toArray();

  const groups = new Map();
  const emptyShells = [];

  for (const routine of routines) {
    const exCount = Array.isArray(routine.exercises) ? routine.exercises.length : 0;
    if (exCount === 0) {
      emptyShells.push(routine);
      continue;
    }

    const key = normalize(routine.name);
    if (!key) continue;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(routine);
  }

  const duplicateGroups = new Map();
  for (const [key, list] of groups.entries()) {
    if (list.length >= 2) {
      duplicateGroups.set(key, list);
    }
  }

  return { duplicateGroups, emptyShells };
};

export const pickPrimaryRoutine = (routines) => {
  if (!Array.isArray(routines) || routines.length === 0) return null;

  return routines
    .map(r => ({
      routine: r,
      score:
        (Array.isArray(r.exercises) ? r.exercises.length : 0) * 10 +
        (r.lastPerformed ? new Date(r.lastPerformed).getTime() / 1e10 : 0) +
        (Array.isArray(r.exercises)
          ? r.exercises.reduce((sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0)
          : 0),
    }))
    .sort((a, b) => b.score - a.score)[0].routine;
};

export const bulkDeleteRoutines = async (routineIds) => {
  if (!Array.isArray(routineIds) || routineIds.length === 0) return { deleted: 0 };

  try {
    const { createAutoBackup } = await import('../services/backupService');
    await createAutoBackup('pre-routine-cleanup');
  } catch (e) {
    console.warn('[cleanup] backup failed:', e);
  }

  let deleted = 0;
  for (const id of routineIds) {
    try {
      await deleteRoutine(id);
      deleted++;
    } catch (e) {
      console.error('[cleanup] delete failed:', id, e);
    }
  }

  return { deleted };
};
