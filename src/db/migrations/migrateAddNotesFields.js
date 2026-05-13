import { db } from '../database';

export const migrateAddNotesFields = async () => {
  const flag = await db.settings.get('addNotesFieldsMigratedV1');
  if (flag?.value === true) {
    return { ran: false, reason: 'already-migrated' };
  }

  try {
    const { createAutoBackup } = await import('../../services/backupService');
    await createAutoBackup('pre-notes-fields-migration');
  } catch (e) {
    console.warn('[migration notes] backup failed:', e);
  }

  let sessionsUpdated = 0;

  const allSessions = await db.history.toArray();
  for (const session of allSessions) {
    let changed = false;
    if (Array.isArray(session.exercises)) {
      for (const ex of session.exercises) {
        if (ex.exerciseNotes === undefined) {
          ex.exerciseNotes = '';
          changed = true;
        }
        if (Array.isArray(ex.sets)) {
          for (const set of ex.sets) {
            if (set.notes === undefined) {
              set.notes = '';
              changed = true;
            }
          }
        }
      }
    }
    if (changed) {
      await db.history.put(session);
      sessionsUpdated++;
    }
  }

  await db.settings.put({ key: 'addNotesFieldsMigratedV1', value: true });
  console.log('[migration notes]', { sessionsUpdated });

  return { ran: true, sessionsUpdated };
};
