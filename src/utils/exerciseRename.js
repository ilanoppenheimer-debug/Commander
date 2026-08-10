import { db } from '../db/database';
import { removeCustomExercise, addCustomExercise } from '../db/repository';
import { useSessionStore } from '../stores/sessionStore';
import { getExerciseMeta, saveExerciseMeta, deleteExerciseMeta, mergeExerciseMeta } from '../constants/exerciseMetadata';
import { createAutoBackup } from '../services/backupService';
import { logger } from '../services/logger';

// Custom-only for now: DEFAULT_EXERCISE_DB / EXERCISE_TO_MUSCLE in gymConstants.js are
// hardcoded arrays, not data — a renamed catalogue exercise would fall out of them
// (muscle-group classification, tab membership) with no way to fix it at runtime. Scope
// stays custom until that's addressed separately.
export const canRenameExercise = async (name) => {
  const count = await db.customExercises.where('name').equals(name).count();
  return count > 0;
};

/**
 * Computes what a rename WOULD do, without writing anything. Used both to render the
 * confirmation screen and, re-run internally by renameExercise right before it writes,
 * as the live guard — a preview shown to the user seconds earlier is not trusted blindly
 * at write time.
 */
export const previewRenameExercise = async (oldName, newName) => {
  const trimmedNew = (newName || '').trim();
  if (!trimmedNew) return { ok: false, reason: 'empty-name' };
  if (trimmedNew === oldName) return { ok: false, reason: 'same-name' };

  const isCustom = await canRenameExercise(oldName);
  if (!isCustom) return { ok: false, reason: 'not-custom' };

  const activeSession = useSessionStore.getState().session;
  const activeSessionHasIt = Array.isArray(activeSession?.exercises)
    && activeSession.exercises.some(ex => ex?.name === oldName);
  if (activeSessionHasIt) return { ok: false, reason: 'active-session-conflict' };

  const [historyRows, routineRows, targetCount] = await Promise.all([
    db.history.toArray(),
    db.routines.toArray(),
    db.customExercises.where('name').equals(trimmedNew).count(),
  ]);

  const sessionsAffected = historyRows.filter(
    s => Array.isArray(s.exercises) && s.exercises.some(ex => ex?.name === oldName)
  ).length;
  const routinesAffected = routineRows.filter(
    r => Array.isArray(r.exercises) && r.exercises.some(ex => ex?.name === oldName)
  ).length;

  const willMerge = targetCount > 0;
  const mergedMetaPreview = willMerge
    ? mergeExerciseMeta(getExerciseMeta(oldName), getExerciseMeta(trimmedNew))
    : null;

  return {
    ok: true,
    oldName,
    newName: trimmedNew,
    sessionsAffected,
    routinesAffected,
    willMerge,
    mergedMetaPreview,
  };
};

/**
 * Renames a custom exercise everywhere it's used as identity: db.history, db.routines,
 * db.customExercises, and the localStorage metadata blob. Does NOT touch db.backups
 * (historical snapshots, same principle as the block cleanup — not rewriting the past)
 * and does NOT touch an in-progress session (blocked by the live guard below instead).
 *
 * Re-runs previewRenameExercise internally right before writing — the guard that
 * matters (not custom, active-session conflict) is checked live, not trusted from a
 * preview the caller may be holding onto from moments earlier.
 */
export const renameExercise = async (oldName, newName) => {
  const preview = await previewRenameExercise(oldName, newName);
  if (!preview.ok) return preview;

  const { oldName: from, newName: to, willMerge } = preview;

  const backupResult = await createAutoBackup('pre-rename-exercise');
  if (!backupResult?.success) {
    logger.error('renameExercise: backup failed, aborting', { from, to, error: backupResult?.error });
    return { ok: false, reason: 'backup-failed', error: backupResult?.error };
  }

  let sessionsChanged = 0;
  const historyRows = await db.history.toArray();
  for (const row of historyRows) {
    if (!Array.isArray(row.exercises)) continue;
    let changed = false;
    const nextExercises = row.exercises.map(ex => {
      if (ex?.name === from) { changed = true; return { ...ex, name: to }; }
      return ex;
    });
    if (changed) {
      await db.history.put({ ...row, exercises: nextExercises });
      sessionsChanged++;
    }
  }

  let routinesChanged = 0;
  const routineRows = await db.routines.toArray();
  for (const row of routineRows) {
    if (!Array.isArray(row.exercises)) continue;
    let changed = false;
    const nextExercises = row.exercises.map(ex => {
      if (ex?.name === from) { changed = true; return { ...ex, name: to }; }
      return ex;
    });
    if (changed) {
      await db.routines.put({ ...row, exercises: nextExercises });
      routinesChanged++;
    }
  }

  // Unique index on customExercises.name: always drop the old row. Only add the new
  // one if it's not already there — if willMerge, the target row already exists and a
  // second put with the same name would just be redundant (harmless but pointless).
  await removeCustomExercise(from);
  if (!willMerge) {
    await addCustomExercise(to);
  }

  const merged = mergeExerciseMeta(getExerciseMeta(from), willMerge ? getExerciseMeta(to) : {});
  saveExerciseMeta(to, merged);
  deleteExerciseMeta(from);

  logger.info('renameExercise', { from, to, sessionsChanged, routinesChanged, willMerge });

  return { ok: true, from, to, sessionsChanged, routinesChanged, willMerge };
};
