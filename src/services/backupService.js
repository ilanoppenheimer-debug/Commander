import { db } from '../db/database';
import { logger } from './logger';
import { buildFilename } from '../utils/downloadNaming';

const APP_VERSION = '14.1';
const MAX_AUTO_BACKUPS = 7;

const sha256 = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const createBackup = async () => {
  const [history, routines, customExercises, settings, logs, blocks] = await Promise.all([
    db.history.toArray(),
    db.routines.toArray(),
    db.customExercises.toArray(),
    db.settings.toArray(),
    db.logs.orderBy('_id').reverse().limit(200).toArray(),
    db.blocks.toArray(),
  ]);

  const data = { history, routines, customExercises, settings, logs, blocks };
  const dataStr = JSON.stringify(data);
  const checksum = await sha256(dataStr);

  return {
    version: 1,
    appVersion: APP_VERSION,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    counts: {
      history: history.length,
      routines: routines.length,
      customExercises: customExercises.length,
      blocks: blocks.length,
    },
    checksum,
    data,
  };
};

export const validateBackup = async (backupObj) => {
  if (!backupObj || typeof backupObj !== 'object') return { valid: false, error: 'Formato inválido' };
  if (!backupObj.version || !backupObj.data) return { valid: false, error: 'Campos faltantes' };

  const dataStr = JSON.stringify(backupObj.data);
  const expectedChecksum = await sha256(dataStr);
  if (backupObj.checksum && backupObj.checksum !== expectedChecksum) {
    return { valid: false, error: 'Checksum no coincide — archivo posiblemente corrupto' };
  }
  return { valid: true };
};

export const restoreFromBackup = async (backupObj) => {
  const validation = await validateBackup(backupObj);
  if (!validation.valid) throw new Error(validation.error);

  const { history, routines, customExercises, settings, blocks } = backupObj.data;
  const hasBlocks = Array.isArray(blocks);

  await db.transaction('rw', db.history, db.routines, db.customExercises, db.settings, db.blocks, async () => {
    await Promise.all([
      db.history.clear(),
      db.routines.clear(),
      db.customExercises.clear(),
      db.settings.clear(),
      // Old backups (pre-14.2) omit blocks — leave db.blocks intact in that case.
      ...(hasBlocks ? [db.blocks.clear()] : []),
    ]);
    if (Array.isArray(history)) await db.history.bulkPut(history);
    if (Array.isArray(routines)) await db.routines.bulkPut(routines);
    if (Array.isArray(customExercises)) await db.customExercises.bulkPut(customExercises);
    if (Array.isArray(settings)) await db.settings.bulkPut(settings);
    if (hasBlocks) await db.blocks.bulkPut(blocks);
  });

  logger.info('Backup restored', {
    historySessions: history?.length || 0,
    blocksRestored: hasBlocks ? blocks.length : 'not in backup — left intact',
    timestamp: backupObj.timestamp,
  });
};

export const downloadBackupAsFile = async () => {
  const backup = await createBackup();
  const json = JSON.stringify(backup, null, 2);
  const filename = buildFilename('backup', '', 'json');
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
};

export const parseBackupFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch {
        reject(new Error('JSON inválido'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsText(file);
  });

// ── Auto-backups (stored in Dexie backups table) ───────────────────────────

export const createAutoBackup = async (trigger = 'manual') => {
  try {
    const snapshot = await createBackup();
    const entry = { ...snapshot, trigger, createdAt: new Date().toISOString() };
    await db.backups.add(entry);

    const all = await db.backups.orderBy('createdAt').toArray();
    if (all.length > MAX_AUTO_BACKUPS) {
      const toDelete = all.slice(0, all.length - MAX_AUTO_BACKUPS);
      await Promise.all(toDelete.map(b => db.backups.delete(b.id)));
    }

    logger.info('Auto-backup created', { trigger });
    return { success: true };
  } catch (e) {
    logger.error('Auto-backup failed', { error: String(e) });
    return { success: false, error: String(e) };
  }
};

export const listAutoBackups = () =>
  db.backups.orderBy('createdAt').reverse().toArray();

export const restoreFromAutoBackup = async (backupId) => {
  const entry = await db.backups.get(backupId);
  if (!entry) throw new Error('Backup no encontrado');
  await createAutoBackup('pre-restore');
  await restoreFromBackup(entry);
};

export const downloadAutoBackupAsFile = async (backup) => {
  const label = backup.trigger ? backup.trigger.replace(/-/g, '_') : 'auto';
  const filename = buildFilename(`backup_${label}`, '', 'json');
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
};
