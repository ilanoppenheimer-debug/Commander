import { db } from '../database';
import { logger } from '../../services/logger';

const MIGRATION_FLAG = 'cleanupResidualBlocksV1';

// Reviewed by hand against a 09-ago backup — not inferred, not pattern-matched. Two of
// these share coachId '2A' with the ACTIVE Bloque 2A (blk-1783982980087-dxxik, never
// touched here): a future Coach import doing a coachId lookup could land on one of
// these drafts instead of the active block. Deleting them closes that.
const TARGET_BLOCK_IDS = [
  'blk-1778755286511-zwuyu', // MESO 1: Base (repetido), draft, 0 sesiones
  'blk-1784290840702-j7l1j', // Bloque 2A, draft, 0 sesiones
  'blk-1785357914380-y5b8o', // Bloque 2A, draft, 0 sesiones
];

/**
 * One-time cleanup: deletes the 3 residual draft blocks above, IF (and only if) each
 * still has zero sessions attributed to it in db.history — the review backup is from
 * 09-ago, so this is re-verified live rather than trusted blindly. The 10 archived/
 * completed MESO blocks are deliberately left alone (not in TARGET_BLOCK_IDS at all):
 * not rewriting the past, and they don't get in anyone's way archived.
 * Idempotent via db.settings flag, same shape as migrateBackfillBlock2A.
 */
export const migrateCleanupResidualBlocks = async () => {
  const flag = await db.settings.get(MIGRATION_FLAG);
  if (flag?.value === true) {
    return { ran: false, reason: 'already-migrated' };
  }

  try {
    const { createAutoBackup } = await import('../../services/backupService');
    const backupResult = await createAutoBackup('pre-limpieza-bloques');
    if (!backupResult?.success) {
      logger.error('migrateCleanupResidualBlocks: backup failed, aborting', { error: backupResult?.error });
      return { ran: false, reason: 'backup-failed', error: backupResult?.error };
    }
  } catch (e) {
    logger.error('migrateCleanupResidualBlocks: backup threw, aborting', { error: String(e) });
    return { ran: false, reason: 'backup-failed', error: String(e) };
  }

  let deleted = 0;
  let skippedNotFound = 0;
  let skippedHasSessions = 0;

  for (const blockId of TARGET_BLOCK_IDS) {
    const block = await db.blocks.get(blockId);
    if (!block) {
      skippedNotFound++;
      logger.warn('migrateCleanupResidualBlocks: block not found', { blockId });
      continue;
    }

    // Live re-check, not a trust of the reviewed list — the list is from a backup that
    // may be stale by the time this actually runs.
    const attributedCount = await db.history.filter(
      s => Array.isArray(s.blockIds) && s.blockIds.includes(blockId)
    ).count();
    if (attributedCount > 0) {
      skippedHasSessions++;
      logger.warn('migrateCleanupResidualBlocks: block has attributed sessions, refusing to delete', { blockId, attributedCount });
      continue;
    }

    await db.blocks.delete(blockId);
    deleted++;
  }

  await db.settings.put({ key: MIGRATION_FLAG, value: true });
  logger.info('migrateCleanupResidualBlocks', { deleted, skippedNotFound, skippedHasSessions });

  return { ran: true, deleted, skippedNotFound, skippedHasSessions };
};
