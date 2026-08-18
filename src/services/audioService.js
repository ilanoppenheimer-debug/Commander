const getCtx = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
};

const beep = (ctx, freq, start, duration, vol = 0.3) => {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
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
      for (let i = 0; i < ALARM_PULSE_COUNT; i++) {
        beep(ctx, 880, t + i * ALARM_PULSE_INTERVAL, ALARM_PULSE_DURATION, 0.35);
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
    if (ctx) beep(ctx, 440, ctx.currentTime, 0.15, 0.15);
    if (navigator.vibrate) navigator.vibrate(80);
  } catch {}
};
