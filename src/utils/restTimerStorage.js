// The rest timer persists itself in localStorage so it survives a reload mid-countdown.
// That key must never outlive the session it was started in.
export const REST_TIMER_KEY = 'ironcmdr_active_timer';

export const clearRestTimerStorage = () => {
  try { localStorage.removeItem(REST_TIMER_KEY); } catch { /* non-blocking */ }
};
