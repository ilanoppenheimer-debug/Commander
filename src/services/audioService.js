// One AudioContext for the whole app (browsers cap how many can exist, and a new one per
// alert was never closed). Every alarm plays through its own gain "bus" so stopAlarm()
// can silence pulses that are already scheduled on the context timeline — scheduled
// oscillators can't be cancelled one by one, but disconnecting their bus silences them.
let sharedCtx = null;
const activeBuses = new Set();

const getCtx = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AC();
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  } catch { return null; }
};

const beep = (ctx, bus, freq, start, duration, vol = 0.3) => {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(bus);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.02);
    gain.gain.linearRampToValueAtTime(vol, start + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.start(start);
    osc.stop(start + duration);
  } catch {}
};

const newBus = (ctx, lifetimeSecs) => {
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  activeBuses.add(bus);
  setTimeout(() => { activeBuses.delete(bus); try { bus.disconnect(); } catch {} }, (lifetimeSecs + 1) * 1000);
  return bus;
};

// 5 pulses, 1s apart, 0.3s each — spans ~4.3s (start of pulse 1 to end of pulse 5),
// close enough to the ~5s target that it reads as one sustained alarm, not a chime.
const ALARM_PULSE_COUNT = 5;
const ALARM_PULSE_INTERVAL = 1.0;
const ALARM_PULSE_DURATION = 0.3;

// Vibrate pattern synced to the same 5 pulses: 300ms on (matches ALARM_PULSE_DURATION)
// / 700ms off (fills out the 1s interval), ending on an "on" segment.
const ALARM_VIBRATE_PATTERN = [300, 700, 300, 700, 300, 700, 300, 700, 300];

export const playTacticalAlarm = () => {
  try {
    const ctx = getCtx();
    if (ctx) {
      const t = ctx.currentTime;
      const bus = newBus(ctx, ALARM_PULSE_COUNT * ALARM_PULSE_INTERVAL);
      for (let i = 0; i < ALARM_PULSE_COUNT; i++) {
        beep(ctx, bus, 880, t + i * ALARM_PULSE_INTERVAL, ALARM_PULSE_DURATION, 0.35);
      }
    }
    if (navigator.vibrate) navigator.vibrate(ALARM_VIBRATE_PATTERN);
  } catch (e) {
    console.warn('Audio failed:', e);
    if (navigator.vibrate) navigator.vibrate(ALARM_VIBRATE_PATTERN);
  }
};

export const playPreAlert = () => {
  try {
    const ctx = getCtx();
    if (ctx) beep(ctx, newBus(ctx, 0.15), 440, ctx.currentTime, 0.15, 0.15);
    if (navigator.vibrate) navigator.vibrate(80);
  } catch {}
};

// Silences every alarm/pre-alert still scheduled or sounding, and cancels vibration.
export const stopAlarm = () => {
  for (const bus of activeBuses) { try { bus.disconnect(); } catch {} }
  activeBuses.clear();
  try { if (navigator.vibrate) navigator.vibrate(0); } catch {}
};
