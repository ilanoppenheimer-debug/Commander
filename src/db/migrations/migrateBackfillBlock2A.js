import { db } from '../database';
import { logger } from '../../services/logger';

const MIGRATION_FLAG = 'backfillBlock2ABlockIdsV1';
const TARGET_BLOCK_ID = 'blk-1783982980087-dxxik';

// Sessions that predate the blockIds field, identified and approved by hand
// (see PARTE A of the fix/contador-bloque sprint) — not inferred, not pattern-matched.
const TARGET_HISTORY_IDS = [
  'hist-1780971920589', 'hist-1781047093626', 'hist-1781458490176',
  'hist-1781739213079', 'hist-1781823466943', 'hist-1782065350905',
  'hist-1782262187244', 'hist-1782429540009', 'hist-1782867929001',
  'hist-1783477140370', 'hist-1783556909615', 'hist-1783876122011',
];

/**
 * One-time backfill: stamps blockIds: [TARGET_BLOCK_ID] on the 12 known pre-existing
 * Bloque 2A sessions above. Touches ONLY the blockIds field — no other field on these
 * sessions is read or written. Idempotent via db.settings flag.
 */
export const migrateBackfillBlock2A = async () => {
  const flag = await db.settings.get(MIGRATION_FLAG);
  if (flag?.value === true) {
    return { ran: false, reason: 'already-migrated' };
  }

  try {
    const { createAutoBackup } = await import('../../services/backupService');
    const backupResult = await createAutoBackup('pre-backfill-block2a');
    if (!backupResult?.success) {
      logger.error('migrateBackfillBlock2A: backup failed, aborting', { error: backupResult?.error });
      return { ran: false, reason: 'backup-failed', error: backupResult?.error };
    }
  } catch (e) {
    logger.error('migrateBackfillBlock2A: backup threw, aborting', { error: String(e) });
    return { ran: false, reason: 'backup-failed', error: String(e) };
  }

  let stamped = 0;
  let skippedNotFound = 0;
  let skippedAlreadyStamped = 0;

  for (const historyId of TARGET_HISTORY_IDS) {
    const session = await db.history.where('historyId').equals(historyId).first();
    if (!session) {
      skippedNotFound++;
      logger.warn('migrateBackfillBlock2A: session not found', { historyId });
      continue;
    }

    const existingBlockIds = Array.isArray(session.blockIds) ? session.blockIds : [];
    if (existingBlockIds.length > 0) {
      skippedAlreadyStamped++;
      logger.warn('migrateBackfillBlock2A: session already has blockIds, skipping', { historyId, existingBlockIds });
      continue;
    }

    await db.history.put({ ...session, blockIds: [TARGET_BLOCK_ID] });
    stamped++;
  }

  await db.settings.put({ key: MIGRATION_FLAG, value: true });
  logger.info('migrateBackfillBlock2A', { stamped, skippedNotFound, skippedAlreadyStamped });

  return { ran: true, stamped, skippedNotFound, skippedAlreadyStamped };
};
