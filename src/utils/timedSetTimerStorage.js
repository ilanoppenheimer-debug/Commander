// Persisted TimedSetRow timers (localStorage). A key is `<prefix><exerciseId>_<setIndex>`
// with a 1-based setIndex, and exercise ids are NOT unique across sessions started from
// the same routine (startSession clones the routine's ids) — so any key that outlives
// the session or the set that created it can resurface on an unrelated set later.
// TimedSetRow itself only clears a key when the athlete confirms/discards/cancels.
export const TIMER_KEY_PREFIX = 'ironcmdr_timedset_timer_';

export const timerKey = (exerciseId, setIndex) => `${TIMER_KEY_PREFIX}${exerciseId}_${setIndex}`;

const allTimerKeys = () => {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(TIMER_KEY_PREFIX)) keys.push(k);
    }
  } catch { /* storage unavailable */ }
  return keys;
};

const removeKeys = (keys) => { try { keys.forEach(k => localStorage.removeItem(k)); } catch { /* non-blocking */ } };

export const clearAllTimedSetTimers = () => removeKeys(allTimerKeys());

export const clearTimedSetTimersForExercise = (exerciseId) =>
  removeKeys(allTimerKeys().filter(k => k.startsWith(`${TIMER_KEY_PREFIX}${exerciseId}_`)));

// Removing the set at 0-based `removedIdx` (of `setCount` sets before the removal): drop
// its timer and slide every later set's timer one index down, so a pending/running timer
// stays attached to the set it belongs to once the indexes shift.
export const shiftTimedSetTimersAfterRemoval = (exerciseId, removedIdx, setCount) => {
  try {
    localStorage.removeItem(timerKey(exerciseId, removedIdx + 1));
    for (let i = removedIdx + 1; i < setCount; i++) {
      const from = timerKey(exerciseId, i + 1);
      const value = localStorage.getItem(from);
      localStorage.removeItem(from);
      if (value != null) localStorage.setItem(timerKey(exerciseId, i), value);
    }
  } catch { /* non-blocking */ }
};
