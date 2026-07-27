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

// Reactive — re-runs automatically on any db.blocks write (activate/pause/complete/
// edit), unlike hooks/useActiveBlocks.js which is an imperative fetch-on-demand hook
// meant for ActiveSession's one-shot-per-session use. Named distinctly to avoid
// confusion with that other hook.
export const useActiveBlocksLive = () =>
  useLiveQuery(
    () => db.blocks.where('status').equals('active').toArray(),
    []
  );
