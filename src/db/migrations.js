import { db } from './database';
import { logger } from '../services/logger';

const MIGRATION_FLAG = 'MIGRATED_TO_DEXIE_V1';
const SOURCE_KEY = 'IronSuiteDataV14';

export const migrateFromLocalStorageIfNeeded = async () => {
  if (localStorage.getItem(MIGRATION_FLAG)) return { skipped: true };

  const raw = localStorage.getItem(SOURCE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return { skipped: true, reason: 'no source data' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.error('Migration: JSON parse failed', { error: String(e) });
    return { success: false, error: 'JSON corrupto — datos originales intactos en localStorage' };
  }

  try {
    const now = new Date().toISOString();

    await db.transaction('rw', db.history, db.routines, db.customExercises, db.settings, async () => {
      // history
      if (Array.isArray(parsed.history)) {
        const rows = parsed.history.filter(Boolean).map(h => ({
          ...h,
          createdAt: h.completedAt || now,
          updatedAt: now,
        }));
        await db.history.bulkPut(rows);
      }

      // routines
      if (Array.isArray(parsed.routines)) {
        const rows = parsed.routines.filter(Boolean).map(r => ({
          ...r,
          routineId: r.id,
          createdAt: now,
          updatedAt: now,
        }));
        await db.routines.bulkPut(rows);
      }

      // customExercises
      if (Array.isArray(parsed.customExercises)) {
        const rows = parsed.customExercises.filter(Boolean).map(name => ({ name }));
        await db.customExercises.bulkPut(rows);
      }

      // settings
      const settingsToSave = [
        'barWeight', 'barUnit', 'accent', 'activeModeId', 'activeTab',
        'historyMode', 'modes', 'inventory', 'activeSession',
      ];
      for (const key of settingsToSave) {
        if (parsed[key] !== undefined) {
          await db.settings.put({ key, value: parsed[key] });
        }
      }
    });

    // Rename (don't delete) the original data
    const backupKey = `${SOURCE_KEY}_BACKUP_${now.slice(0, 10)}`;
    localStorage.setItem(backupKey, raw);
    localStorage.setItem(MIGRATION_FLAG, '1');

    logger.info('Migration successful', {
      historySessions: parsed.history?.length || 0,
      routines: parsed.routines?.length || 0,
    });

    return { success: true };
  } catch (e) {
    logger.error('Migration: transaction failed', { error: String(e) });
    return { success: false, error: String(e) };
  }
};
