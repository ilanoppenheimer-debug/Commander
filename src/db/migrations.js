import { db } from './database';
import { logger } from '../services/logger';

const SANITATION_FLAG = 'sanitizedInvalidSets_v1';

/**
 * One-time sanitization: clamps RPE ≤ 10, reps ≤ 99, weight ≤ 999 in all persisted sets.
 * Created to fix values entered before range validation was added.
 */
export const sanitizeInvalidSetValues = async () => {
  try {
    const flag = await db.settings.get(SANITATION_FLAG);
    if (flag?.value === true) return { ran: false };

    let fixedCount = 0;

    const clamp = (set) => {
      let changed = false;
      const rpe = parseFloat(set.rpe);
      if (!isNaN(rpe) && rpe > 10) { set.rpe = 10; changed = true; fixedCount++; }
      const reps = parseInt(set.reps, 10);
      if (!isNaN(reps) && reps > 99) { set.reps = 99; changed = true; fixedCount++; }
      const w = parseFloat(set.weight);
      if (!isNaN(w) && w > 999) { set.weight = 999; changed = true; fixedCount++; }
      return changed;
    };

    // History
    const sessions = await db.history.toArray();
    for (const session of sessions) {
      if (!Array.isArray(session.exercises)) continue;
      let dirty = false;
      for (const ex of session.exercises) {
        if (!Array.isArray(ex.sets)) continue;
        for (const s of ex.sets) { if (clamp(s)) dirty = true; }
      }
      if (dirty) await db.history.put(session);
    }

    // Active session in settings
    const activeSetting = await db.settings.get('activeSession');
    if (activeSetting?.value && Array.isArray(activeSetting.value.exercises)) {
      let dirty = false;
      for (const ex of activeSetting.value.exercises) {
        if (!Array.isArray(ex.sets)) continue;
        for (const s of ex.sets) { if (clamp(s)) dirty = true; }
      }
      if (dirty) await db.settings.put({ key: 'activeSession', value: activeSetting.value });
    }

    await db.settings.put({ key: SANITATION_FLAG, value: true });
    logger.info('sanitizeInvalidSetValues', { fixedCount });
    return { ran: true, fixedCount };
  } catch (e) {
    logger.error('sanitizeInvalidSetValues failed', { error: String(e) });
    return { ran: false, error: String(e) };
  }
};

const MIGRATION_FLAG = 'MIGRATED_TO_DEXIE_V1';
const MIGRATION_FLAG_V2 = 'MIGRATED_ROUTINE_IDS_V2';
const SOURCE_KEY = 'IronSuiteDataV14';

// One-shot migration: replace hardcoded "routine-1" (and similar) IDs with unique UUIDs
export const fixHardcodedRoutineIds = async () => {
  if (localStorage.getItem(MIGRATION_FLAG_V2)) return;
  try {
    const routines = await db.routines.toArray();
    const toFix = routines.filter(r => r.routineId === 'routine-1' || r.id === 'routine-1');
    if (toFix.length > 0) {
      await db.transaction('rw', db.routines, async () => {
        for (const r of toFix) {
          const newId = `routine-${crypto.randomUUID()}`;
          await db.routines.where('routineId').equals(r.routineId || r.id).delete();
          await db.routines.put({ ...r, id: newId, routineId: newId });
        }
      });
      logger.info('Migrated hardcoded routine IDs', { fixed: toFix.length });
    }
    localStorage.setItem(MIGRATION_FLAG_V2, '1');
  } catch (e) {
    logger.error('fixHardcodedRoutineIds failed', { error: String(e) });
  }
};

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
