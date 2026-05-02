import Dexie from 'dexie';

/**
 * Block schema:
 * {
 *   id: string,                    // 'blk-' + timestamp + random
 *   name: string,
 *   type: string,                  // 'peaking'|'accumulation'|'intensification'|'hypertrophy'|
 *                                  //   'deload'|'maintenance'|'conditioning'|'custom'
 *   appliesTo: string[],           // ['main_lift', 'accessory', ...]
 *   color: string,                 // hex '#f59e0b'
 *   status: string,                // 'draft'|'active'|'paused'|'completed'|'archived'
 *   createdAt: ISO string,
 *   startedAt: ISO string | null,
 *   completedAt: ISO string | null,
 *   sessionsTarget: number | null,
 *   sessionsLogged: number,
 *   params: { setsRange, repsRange, rpeRange, intensityRange, weightProgression,
 *             weeklyMod, cnsLoad, suggestedFrequency, notes },
 *   fatigueSignals: { rpeOverTargetCount, progressStallSessions, lastChecked }
 * }
 */

export const db = new Dexie('IronCommanderDB');

db.version(1).stores({
  history:         '++_id, historyId, completedAt, name',
  routines:        '++_id, routineId, name',
  customExercises: '++_id, &name',
  settings:        'key',
  logs:            '++_id, timestamp, level',
});

db.version(2).stores({
  history:         '++_id, historyId, completedAt, name',
  routines:        '++_id, routineId, name',
  customExercises: '++_id, &name',
  settings:        'key',
  logs:            '++_id, timestamp, level',
  backups:         '++id, createdAt, trigger',
});

db.version(3).stores({
  history:         '++_id, historyId, completedAt, name',
  routines:        '++_id, routineId, name',
  customExercises: '++_id, &name',
  settings:        'key',
  logs:            '++_id, timestamp, level',
  backups:         '++id, createdAt, trigger',
  blocks:          'id, status, *appliesTo, startedAt, completedAt',
});
