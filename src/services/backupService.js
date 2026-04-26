import { db } from '../db/database';
import { logger } from './logger';

const APP_VERSION = '14.1';

const sha256 = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const createBackup = async () => {
  const [history, routines, customExercises, settings, logs] = await Promise.all([
    db.history.toArray(),
    db.routines.toArray(),
    db.customExercises.toArray(),
    db.settings.toArray(),
    db.logs.orderBy('_id').reverse().limit(200).toArray(),
  ]);

  const data = { history, routines, customExercises, settings, logs };
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

  const { history, routines, customExercises, settings } = backupObj.data;

  await db.transaction('rw', db.history, db.routines, db.customExercises, db.settings, async () => {
    await Promise.all([
      db.history.clear(),
      db.routines.clear(),
      db.customExercises.clear(),
      db.settings.clear(),
    ]);
    if (Array.isArray(history)) await db.history.bulkPut(history);
    if (Array.isArray(routines)) await db.routines.bulkPut(routines);
    if (Array.isArray(customExercises)) await db.customExercises.bulkPut(customExercises);
    if (Array.isArray(settings)) await db.settings.bulkPut(settings);
  });

  logger.info('Backup restored', {
    historySessions: history?.length || 0,
    timestamp: backupObj.timestamp,
  });
};

export const downloadBackupAsFile = async () => {
  const backup = await createBackup();
  const json = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  const filename = `iron-cmdr-backup-${date}.json`;
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
