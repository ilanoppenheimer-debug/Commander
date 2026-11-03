import { db } from '../database';
import { logger } from '../../services/logger';
import { useSessionStore } from '../../stores/sessionStore';
import { loadExerciseMeta, replaceAllExerciseMeta } from '../../constants/exerciseMetadata';
import { planTaxonomyMigration } from '../../utils/taxonomyMigration';
import { TAXONOMY_FLAG } from '../../utils/taxonomyMapping';

// Exercise taxonomy, phase 2: renames to the variant, the real implement per appearance, the
// metadata fold-ins and the removal of verified duplicate sessions. All of the logic is the pure
// planTaxonomyMigration (reviewed against the athlete's backup in a Node dry-run); this file is
// only the IO around it.
//
// NOT run at startup: it is triggered from Datos, after the athlete downloaded a backup, and it
// takes its own automatic backup too. Idempotent (a second run plans nothing). Append-only
// spirit: only name/equipment change; the only deletions are copies proven identical.

const loadState = async () => {
  const [history, routines, customRows] = await Promise.all([db.history.toArray(), db.routines.toArray(), db.customExercises.toArray()]);
  return { history, routines, customRows, plan: null };
};
const toInput = (s) => ({ history: s.history, routines: s.routines, customExercises: s.customRows.map(r => r.name), metadata: loadExerciseMeta() });

/** Read-only: what the migration would do right now, on the live data. Writes nothing. */
export const previewTaxonomyMigration = async () => {
  const state = await loadState();
  const plan = planTaxonomyMigration(toInput(state));
  const flag = await db.settings.get(TAXONOMY_FLAG);
  return { plan, appliedBefore: flag?.value?.appliedAt || null };
};

const activeSessionExists = async () => {
  if (useSessionStore.getState().session) return true;
  const saved = await db.settings.get('activeSession');
  return !!saved?.value;
};

/**
 * Applies the migration. `backupDownloaded` must be true: the athlete's own downloaded backup is
 * the rollback. Aborts (writing nothing) on: no download, an active session, a plan whose
 * verification fails, or a failed automatic backup. After writing, it re-plans from the stored
 * data and requires a no-op plan with matching totals.
 */
export const applyTaxonomyMigration = async ({ backupDownloaded } = {}) => {
  if (backupDownloaded !== true) return { ok: false, reason: 'backup-not-downloaded' };
  if (await activeSessionExists()) return { ok: false, reason: 'active-session' };

  const state = await loadState();
  const plan = planTaxonomyMigration(toInput(state));
  if (plan.noop) return { ok: true, ran: false, reason: 'nothing-to-do' };
  if (!plan.verification.ok) {
    logger.error('migrateTaxonomyV1: verification failed, aborting', { problems: plan.verification.problems.slice(0, 5) });
    return { ok: false, reason: 'verification-failed', problems: plan.verification.problems };
  }

  try {
    const { createAutoBackup } = await import('../../services/backupService');
    const backup = await createAutoBackup('pre-taxonomia-v1');
    if (!backup?.success) return { ok: false, reason: 'backup-failed', error: backup?.error };
  } catch (e) {
    return { ok: false, reason: 'backup-failed', error: String(e) };
  }

  // Rows keep their _id (primary key) and their updatedAt: this is a data fix, not an edit.
  const removedPk = plan.history.removed.map(r => r._id);
  const changedRows = plan.history.changed;
  const changedRoutines = plan.routines.next.filter((r, i) => r !== state.routines[i]);
  const customByName = new Map(state.customRows.map(r => [r.name, r]));
  try {
    await db.transaction('rw', db.history, db.routines, db.customExercises, db.settings, async () => {
      if (removedPk.length) await db.history.bulkDelete(removedPk);
      if (changedRows.length) await db.history.bulkPut(changedRows);
      if (changedRoutines.length) await db.routines.bulkPut(changedRoutines);
      const toDelete = plan.customExercises.remove.map(n => customByName.get(n)?._id).filter(v => v !== undefined);
      if (toDelete.length) await db.customExercises.bulkDelete(toDelete);
      for (const name of plan.customExercises.add) await db.customExercises.put({ name });
      await db.settings.put({ key: TAXONOMY_FLAG, value: { appliedAt: new Date().toISOString(), sessionsRemoved: removedPk.length, appearancesChanged: plan.history.changes.length } });
    });
    replaceAllExerciseMeta(plan.metadata.next);
  } catch (e) {
    logger.error('migrateTaxonomyV1 failed while writing', { error: String(e) });
    return { ok: false, reason: 'write-failed', error: String(e) };
  }

  // Post-check on what is really stored.
  const after = await loadState();
  const recheck = planTaxonomyMigration(toInput(after));
  const expected = plan.report.totalsAfter, got = recheck.report.totalsBefore;
  const totalsOk = Object.keys(expected).every(k => Math.abs(expected[k] - got[k]) < 1e-6);
  if (!recheck.noop || !totalsOk) {
    logger.error('migrateTaxonomyV1: post-check failed', { noop: recheck.noop, totalsOk });
    return { ok: false, reason: 'post-check-failed', hint: 'Restaurá el backup descargado.' };
  }
  logger.info('migrateTaxonomyV1 applied', { sessionsRemoved: removedPk.length, appearances: plan.history.changes.length });
  return { ok: true, ran: true, summary: summarizePlan(plan) };
};

export const summarizePlan = (plan) => ({
  sessionsRemoved: plan.history.removed.length,
  sessionsTouched: plan.history.changed.length,
  renamed: plan.history.changes.filter(c => c.renamed).length,
  equipmentChanged: plan.history.changes.filter(c => c.eqChanged).length,
  routinesRenamed: plan.routines.renamed,
  metadataKeys: plan.metadata.moves.length,
  customAdded: plan.customExercises.add.length,
  customRemoved: plan.customExercises.remove.length,
});
