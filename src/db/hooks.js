import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';

export const useHistory = () =>
  useLiveQuery(
    () => db.history.orderBy('completedAt').reverse().toArray(),
    []
  );

export const useRoutines = () =>
  useLiveQuery(
    () => db.routines.toArray(),
    []
  );

export const useCustomExercises = () =>
  useLiveQuery(
    () => db.customExercises.toArray().then(rows => rows.map(r => r.name)),
    []
  );
