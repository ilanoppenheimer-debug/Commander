import { db } from '../../db/database';
import { createBackup, downloadBackupAsFile } from '../backupService';
import { isSignedIn, performDriveBackup } from '../googleDriveService';
import { logger } from '../logger';
import { DEFAULT_EXERCISE_DB } from '../../constants/gymConstants';
import { collectCustomExercises } from './normalizer';

const STRONG_ID_PREFIX = 'strong-import-';

/**
 * Check how many Strong sessions already exist in Dexie.
 */
export async function checkExistingStrongSessions() {
  const all = await db.history
    .filter(s => typeof s.historyId === 'string' && s.historyId.startsWith(STRONG_ID_PREFIX))
    .toArray();
  return all.length;
}

/**
 * @param {object[]} normalizedSessions
 * @param {object[]} selectedRoutines   — array of { suggestedName (editable), templateExercises, ... }
 * @param {{ skipDuplicates: boolean }} options
 * @param {function}  onProgress        — called with (current, total) during import
 */
export async function importToDexie(normalizedSessions, selectedRoutines, options = {}, onProgress) {
  const { skipDuplicates = true } = options;
  const t0 = Date.now();

  // ── Step 1: pre-import backup ────────────────────────────────────────────
  const driveConnected = await isSignedIn().catch(() => false);
  let backupFilename = null;

  try {
    if (driveConnected) {
      const backup = await createBackup();
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
      const filename = `pre-import-strong-${timestamp}.json`;
      await performDriveBackup(backup);
      backupFilename = filename;
      logger.info('Pre-import Drive backup created', { filename });
    } else {
      // Fallback: local download backup
      backupFilename = await downloadBackupAsFile();
      logger.info('Pre-import local backup downloaded', { backupFilename });
    }
  } catch (err) {
    throw new Error(`Backup pre-import falló: ${err.message}. Import abortado para proteger tus datos.`);
  }

  // ── Step 2: idempotence check ────────────────────────────────────────────
  let sessionsToImport = normalizedSessions;
  let sessionsSkipped = 0;

  if (skipDuplicates) {
    const existingIds = new Set(
      (await db.history
        .filter(s => typeof s.historyId === 'string' && s.historyId.startsWith(STRONG_ID_PREFIX))
        .toArray()
      ).map(s => s.historyId)
    );

    sessionsToImport = normalizedSessions.filter(s => !existingIds.has(s.historyId));
    sessionsSkipped = normalizedSessions.length - sessionsToImport.length;
  } else {
    // Re-import with a new timestamp suffix to avoid PK collision
    const suffix = `-reimport-${Date.now()}`;
    sessionsToImport = normalizedSessions.map(s => ({
      ...s,
      historyId: s.historyId + suffix,
    }));
  }

  // ── Step 3: resolve custom exercises ─────────────────────────────────────
  const customExNamesToAdd = collectCustomExercises(sessionsToImport, DEFAULT_EXERCISE_DB);

  // ── Step 4: write everything in a Dexie transaction ──────────────────────
  await db.transaction('rw', db.history, db.routines, db.customExercises, db.logs, async () => {
    const total = sessionsToImport.length;
    let done = 0;

    for (const session of sessionsToImport) {
      await db.history.put({
        ...session,
        updatedAt: new Date().toISOString(),
      });
      done++;
      if (onProgress) onProgress(done, total);
    }

    // Insert selected routines
    const now = new Date().toISOString();
    for (let i = 0; i < (selectedRoutines || []).length; i++) {
      const r = selectedRoutines[i];
      const routineId = `routine-strong-${Date.now()}-${i}`;
      await db.routines.put({
        id:            routineId,
        routineId,
        name:          r.suggestedName || `Rutina Strong ${i + 1}`,
        exercises:     Array.isArray(r.templateExercises) ? r.templateExercises : [],
        createdAt:     now,
        updatedAt:     now,
        fromStrongImport: true,
      });
    }

    // Add custom exercises (idempotent — table has unique &name)
    for (const name of customExNamesToAdd) {
      await db.customExercises.put({ name }).catch(() => {});
    }

    // Write import log entry
    await db.logs.put({
      timestamp:  new Date().toISOString(),
      level:      'info',
      message:    `Strong import: ${sessionsToImport.length} sesiones, ${selectedRoutines?.length || 0} plantillas, ${customExNamesToAdd.length} ejercicios custom`,
      data: {
        sessionsImported:      sessionsToImport.length,
        sessionsSkipped,
        routinesCreated:       selectedRoutines?.length || 0,
        customExercisesAdded:  customExNamesToAdd.length,
        backupFilename,
      },
    });
  });

  const durationMs = Date.now() - t0;

  logger.info('Strong import completed', {
    sessionsImported: sessionsToImport.length,
    sessionsSkipped,
    routinesCreated:  selectedRoutines?.length || 0,
    customExercisesAdded: customExNamesToAdd.length,
    durationMs,
  });

  return {
    sessionsImported:      sessionsToImport.length,
    sessionsSkipped,
    routinesCreated:       selectedRoutines?.length || 0,
    customExercisesAdded:  customExNamesToAdd.length,
    durationMs,
  };
}
