import { create } from 'zustand';
import { setSetting, deleteSetting } from '../db/repository';
import { SET_TYPES } from '../constants/gymConstants';
import { getExerciseMeta } from '../constants/exerciseMetadata';
import { clearRestTimerStorage } from '../utils/restTimerStorage';
import { stopBackground } from '../features/restBackground';
import { releaseAllWakeLocks } from '../utils/wakeLock';
import { clearAllTimedSetTimers, clearTimedSetTimersForExercise, shiftTimedSetTimersAfterInsertion, shiftTimedSetTimersAfterRemoval } from '../utils/timedSetTimerStorage';

let _debounceTimer = null;
let _deleteToken = 0;

const persistToDb = (session) => {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    try {
      if (session) {
        await setSetting('activeSession', session);
      } else {
        await deleteSetting('activeSession');
      }
    } catch { /* non-critical */ }
  }, 500);
};

export const useSessionStore = create((set, get) => ({
  session: null,
  // True once the saved session (if any) has been loaded — consumers that must not act on
  // the initial null (the rest timer's restore) wait for it.
  hydrated: false,
  // Bumped by startSession only (never persisted, not part of `session`): App watches it to
  // show the "raise the media volume" hint once per started session, not on a reload.
  volumeHintNonce: 0,
  // The single undoable delete (a set or a whole exercise); a new delete replaces it. Not
  // persisted and not part of `session` — it only lives while the toast is on screen.
  lastDeleted: null,

  hydrateFromDb: async () => {
    try {
      const { getSetting } = await import('../db/repository');
      const saved = await getSetting('activeSession');
      if (saved) set({ session: saved });
    } finally {
      set({ hydrated: true });
    }
  },

  startSession: (routine) => {
    // Timers left behind by a session that never cleaned up (closed app, pre-fix leftovers)
    // must not attach to this session's reused exercise ids.
    clearAllTimedSetTimers();
    clearRestTimerStorage();
    stopBackground(); // audio, PiP and Media Session of the rest timer die with the session
    releaseAllWakeLocks(); // and so does every screen wake lock (rest timer, timed-set holds)
    const session = {
      id: `session-${Date.now()}`,
      name: routine?.name || 'Entrenamiento Libre',
      routineId: routine?.id ?? null,
      sessionNum: routine?.sessionNum ?? null,
      // Coach text shown (folded) during the session. Copied from the routine at start, so
      // routines imported before this existed need no re-import. Warm-up text stays out.
      contextNotes: routine?.contextNotes || '',
      closingNotes: routine?.closingNotes || '',
      exercises: routine?.exercises
        ? JSON.parse(JSON.stringify(routine.exercises)).map(ex => ({
            ...ex,
            sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({ ...s, completed: false })) : ex.sets,
          }))
        : [],
      startTime: new Date().toISOString(),
      phaseEnabledExIds: routine?.exercises?.map(e => e.id) ?? [],
      warmupPlan: null,
      briefing: null,
      subjectiveState: '',
    };
    set({ session, volumeHintNonce: get().volumeHintNonce + 1, lastDeleted: null });
    persistToDb(session);
  },

  updateSession: (updater) => {
    const next = typeof updater === 'function' ? updater(get().session) : updater;
    set({ session: next });
    persistToDb(next);
  },

  setWarmupPlan: (plan) => {
    const s = get().session;
    if (!s) return;
    const next = { ...s, warmupPlan: plan };
    set({ session: next });
    persistToDb(next);
  },

  setBriefing: (briefing) => {
    const s = get().session;
    if (!s) return;
    const next = { ...s, briefing };
    set({ session: next });
    persistToDb(next);
  },

  setSubjectiveState: (text) => {
    const s = get().session;
    if (!s) return;
    const next = { ...s, subjectiveState: text };
    set({ session: next });
    persistToDb(next);
  },

  addExercise: (name, equipment) => {
    const s = get().session;
    if (!s) return;
    const newId = Date.now();
    // Explicit equipment (e.g. from a Coach import) wins. Otherwise fall back to
    // whatever the user last configured for this exercise — metadata is a default,
    // not an imposition. No metadata either: null ("sin definir"), never a guessed barbell.
    const resolvedEquipment = equipment || getExerciseMeta(name)?.equipment || null;
    const restDefaults = { barbell: 180, smith: 180, dumbbell: 120, kettlebell: 120, landmine: 120, machine: 90, cable: 90, bodyweight: 60, band: 60 };
    const newEx = { id: newId, name, equipment: resolvedEquipment, restSeconds: restDefaults[resolvedEquipment] ?? 90, sets: [{ weight: 0, reps: 0, rpe: 0, type: 'normal', completed: false }] };
    const next = {
      ...s,
      exercises: [...s.exercises, newEx],
      phaseEnabledExIds: [...s.phaseEnabledExIds, newId],
    };
    set({ session: next });
    persistToDb(next);
  },

  updateExercise: (exId, changes) => {
    const s = get().session;
    if (!s) return;
    const next = { ...s, exercises: s.exercises.map(e => e.id === exId ? { ...e, ...changes } : e) };
    set({ session: next });
    persistToDb(next);
  },

  removeExercise: (exId) => {
    const s = get().session;
    if (!s) return;
    const index = s.exercises.findIndex(e => e.id === exId);
    if (index < 0) return;
    const record = {
      token: ++_deleteToken,
      kind: 'exercise',
      index,
      exercise: s.exercises[index],
      phaseEnabled: s.phaseEnabledExIds.includes(exId),
    };
    clearTimedSetTimersForExercise(exId);
    const next = {
      ...s,
      exercises: s.exercises.filter(e => e.id !== exId),
      phaseEnabledExIds: s.phaseEnabledExIds.filter(id => id !== exId),
    };
    set({ session: next, lastDeleted: record });
    persistToDb(next);
    return record;
  },

  moveExercise: (index, direction) => {
    const s = get().session;
    if (!s) return;
    const target = index + direction;
    if (target < 0 || target >= s.exercises.length) return;
    const newExs = [...s.exercises];
    [newExs[index], newExs[target]] = [newExs[target], newExs[index]];

    const cleanedExs = newExs.map((ex, i) => {
      if (ex.supersetId == null) return ex;
      const sharesWithPrev = i > 0 && newExs[i - 1]?.supersetId === ex.supersetId;
      const sharesWithNext = i < newExs.length - 1 && newExs[i + 1]?.supersetId === ex.supersetId;
      if (!sharesWithPrev && !sharesWithNext) return { ...ex, supersetId: null };
      return ex;
    });

    const next = { ...s, exercises: cleanedExs };
    set({ session: next });
    persistToDb(next);
  },

  addSet: (exId, setData) => {
    const s = get().session;
    if (!s) return;
    const next = {
      ...s,
      exercises: s.exercises.map(e => {
        if (e.id !== exId) return e;
        return { ...e, sets: [...(Array.isArray(e.sets) ? e.sets : []), setData || { weight: 0, reps: 0, rpe: 0, type: 'normal', completed: false }] };
      }),
    };
    set({ session: next });
    persistToDb(next);
  },

  updateSet: (exId, idx, field, val) => {
    const s = get().session;
    if (!s) return;
    const next = {
      ...s,
      exercises: s.exercises.map(e => {
        if (e.id !== exId) return e;
        const newSets = [...(Array.isArray(e.sets) ? e.sets : [])];
        newSets[idx] = { ...newSets[idx], [field]: val };
        return { ...e, sets: newSets };
      }),
    };
    set({ session: next });
    persistToDb(next);
  },

  removeSet: (exId, idx) => {
    const s = get().session;
    if (!s) return;
    const ex = s.exercises.find(e => e.id === exId);
    if (!ex || !Array.isArray(ex.sets) || idx < 0 || idx >= ex.sets.length) return;
    const record = { token: ++_deleteToken, kind: 'set', exId, idx, set: ex.sets[idx] };
    shiftTimedSetTimersAfterRemoval(exId, idx, ex.sets.length);
    const next = {
      ...s,
      exercises: s.exercises.map(e => {
        if (e.id !== exId) return e;
        const newSets = [...(Array.isArray(e.sets) ? e.sets : [])];
        newSets.splice(idx, 1);
        return { ...e, sets: newSets };
      }),
    };
    set({ session: next, lastDeleted: record });
    persistToDb(next);
    return record;
  },

  // Puts back what the last delete took out, byte-for-byte (the stored set / exercise
  // object itself), at its old position. State only: it never goes through
  // handleCompleteSet, so a restored completed set does not start a rest timer or emit any
  // completion event. A running hold is not restored — its timer key was removed on delete.
  // Returns the record that was restored (or null if the token is stale / target is gone).
  undoLastDelete: (token) => {
    const { session: s, lastDeleted: rec } = get();
    if (!s || !rec || rec.token !== token) return null;
    let next;
    if (rec.kind === 'exercise') {
      if (s.exercises.some(e => e.id === rec.exercise.id)) return null;
      const exercises = [...s.exercises];
      exercises.splice(Math.min(rec.index, exercises.length), 0, rec.exercise);
      next = {
        ...s,
        exercises,
        phaseEnabledExIds: rec.phaseEnabled ? [...s.phaseEnabledExIds, rec.exercise.id] : s.phaseEnabledExIds,
      };
    } else {
      const ex = s.exercises.find(e => e.id === rec.exId);
      if (!ex) return null;
      const sets = [...(Array.isArray(ex.sets) ? ex.sets : [])];
      const at = Math.min(rec.idx, sets.length);
      sets.splice(at, 0, rec.set);
      shiftTimedSetTimersAfterInsertion(rec.exId, at, sets.length);
      next = { ...s, exercises: s.exercises.map(e => (e.id === rec.exId ? { ...e, sets } : e)) };
    }
    set({ session: next, lastDeleted: null });
    persistToDb(next);
    return rec;
  },

  toggleSetCompleted: (exId, idx) => {
    const s = get().session;
    if (!s) return;
    const next = {
      ...s,
      exercises: s.exercises.map(e => {
        if (e.id !== exId) return e;
        const newSets = [...(Array.isArray(e.sets) ? e.sets : [])];
        newSets[idx] = { ...newSets[idx], completed: !newSets[idx]?.completed };
        return { ...e, sets: newSets };
      }),
    };
    set({ session: next });
    persistToDb(next);
  },

  cycleSetType: (exId, idx) => {
    const s = get().session;
    if (!s) return;
    const typeKeys = Object.keys(SET_TYPES);
    const next = {
      ...s,
      exercises: s.exercises.map(e => {
        if (e.id !== exId) return e;
        const newSets = [...(Array.isArray(e.sets) ? e.sets : [])];
        const cur = Object.keys(SET_TYPES).find(k => SET_TYPES[k].id === (newSets[idx]?.type || 'normal')) || 'NORMAL';
        const nextTypeKey = typeKeys[(typeKeys.indexOf(cur) + 1) % typeKeys.length];
        newSets[idx] = { ...newSets[idx], type: SET_TYPES[nextTypeKey].id };
        return { ...e, sets: newSets };
      }),
    };
    set({ session: next });
    persistToDb(next);
  },

  toggleSuperset: (index) => {
    const s = get().session;
    if (!s || index >= s.exercises.length - 1) return;
    const newExs = [...s.exercises];
    const current = { ...newExs[index] };
    const next2 = { ...newExs[index + 1] };

    if (current.supersetId && next2.supersetId === current.supersetId) {
      next2.supersetId = null;
      const prev = index > 0 ? newExs[index - 1] : null;
      if (!prev || prev.supersetId !== current.supersetId) current.supersetId = null;
    } else {
      const newId = current.supersetId || `ss-${Date.now()}`;
      current.supersetId = newId;
      next2.supersetId = newId;
    }
    newExs[index] = current;
    newExs[index + 1] = next2;

    const nextState = { ...s, exercises: newExs };
    set({ session: nextState });
    persistToDb(nextState);
  },

  togglePhaseForEx: (exId) => {
    const s = get().session;
    if (!s) return;
    const ids = s.phaseEnabledExIds || [];
    const next = {
      ...s,
      phaseEnabledExIds: ids.includes(exId) ? ids.filter(id => id !== exId) : [...ids, exId],
    };
    set({ session: next });
    persistToDb(next);
  },

  finishExercise: (exId) => {
    const s = get().session;
    if (!s) return;
    const next = {
      ...s,
      exercises: s.exercises.map(e =>
        e.id !== exId ? e : { ...e, finishedAt: e.finishedAt ? null : new Date().toISOString() }
      ),
    };
    set({ session: next });
    persistToDb(next);
  },

  // Toggles finishedAt on every exercise sharing supersetId, in one atomic update —
  // avoids a flicker where members briefly disagree if this looped finishExercise
  // per member instead. Same field as finishExercise, no new persisted concept: if
  // the group is later unlinked, each exercise already has its own real finishedAt.
  finishSupersetGroup: (supersetId) => {
    const s = get().session;
    if (!s || !supersetId) return;
    const allFinished = s.exercises
      .filter(e => e.supersetId === supersetId)
      .every(e => e.finishedAt);
    const stamp = allFinished ? null : new Date().toISOString();
    const next = {
      ...s,
      exercises: s.exercises.map(e =>
        e.supersetId === supersetId ? { ...e, finishedAt: stamp } : e
      ),
    };
    set({ session: next });
    persistToDb(next);
  },

  finishSession: () => {
    clearAllTimedSetTimers();
    clearRestTimerStorage();
    stopBackground(); // audio, PiP and Media Session of the rest timer die with the session
    releaseAllWakeLocks(); // and so does every screen wake lock (rest timer, timed-set holds)
    set({ session: null, lastDeleted: null });
    persistToDb(null);
  },

  discardSession: () => {
    clearAllTimedSetTimers();
    clearRestTimerStorage();
    stopBackground(); // audio, PiP and Media Session of the rest timer die with the session
    releaseAllWakeLocks(); // and so does every screen wake lock (rest timer, timed-set holds)
    set({ session: null, lastDeleted: null });
    persistToDb(null);
  },
}));
