import Dexie from 'dexie';

export const db = new Dexie('IronCommanderDB');

db.version(1).stores({
  history:         '++_id, historyId, completedAt, name',
  routines:        '++_id, routineId, name',
  customExercises: '++_id, &name',
  settings:        'key',
  logs:            '++_id, timestamp, level',
});
