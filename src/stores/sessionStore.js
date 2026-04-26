import { create } from 'zustand';
import { setSetting, deleteSetting } from '../db/repository';
import { SET_TYPES } from '../constants/gymConstants';

let _debounceTimer = null;

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

  hydrateFromDb: async () => {
    const { getSetting } = await import('../db/repository');
    const saved = await getSetting('activeSession');
    if (saved) set({ session: saved });
  },

  startSession: (routine) => {
    const session = {
      id: `session-${Date.now()}`,
      name: routine?.name || 'Entrenamiento Libre',
      exercises: routine?.exercises
        ? JSON.parse(JSON.stringify(routine.exercises))
        : [],
      startTime: new Date().toISOString(),
      phaseEnabledExIds: routine?.exercises?.map(e => e.id) ?? [],
      warmupPlan: null,
      briefing: null,
      subjectiveState: '',
    };
    set({ session });
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

  addExercise: (name) => {
    const s = get().session;
    if (!s) return;
    const newId = Date.now();
    const newEx = { id: newId, name, equipment: 'barbell', sets: [{ weight: 0, reps: 0, rpe: 0, type: 'normal' }] };
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
    const next = {
      ...s,
      exercises: s.exercises.filter(e => e.id !== exId),
      phaseEnabledExIds: s.phaseEnabledExIds.filter(id => id !== exId),
    };
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
        return { ...e, sets: [...(Array.isArray(e.sets) ? e.sets : []), setData || { weight: 0, reps: 0, rpe: 0, type: 'normal' }] };
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
    const next = {
      ...s,
      exercises: s.exercises.map(e => {
        if (e.id !== exId) return e;
        const newSets = [...(Array.isArray(e.sets) ? e.sets : [])];
        newSets.splice(idx, 1);
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

  finishSession: () => {
    set({ session: null });
    persistToDb(null);
  },

  discardSession: () => {
    set({ session: null });
    persistToDb(null);
  },
}));
