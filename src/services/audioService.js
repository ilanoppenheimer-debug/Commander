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

const beep = (ctx, bus, freq, start, duration, vol = 0.3, attack = 0.02, release = 0.05) => {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(bus);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + attack);
    gain.gain.linearRampToValueAtTime(vol, start + duration - release);
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

// The alarm tone. Phone speakers are weak below ~1 kHz and the ear is most sensitive at
// 2-4 kHz, so the pulses alternate 2.4 / 3.2 kHz; the 5 ms attack makes each beep cut
// through (and the 15 ms release avoids a click); the peak is near full scale because the
// web can't touch the media volume, so the signal itself has to be as loud as it can be.
// Shared with the background <audio> alarm (features/restBackground.js) so both sound alike.
export const ALARM_TONE = {
  freqs: [2400, 3200],
  peak: 0.9,
  attack: 0.005,
  release: 0.015,
  pulses: ALARM_PULSE_COUNT,
  interval: ALARM_PULSE_INTERVAL,
  duration: ALARM_PULSE_DURATION,
};

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
        beep(ctx, bus, ALARM_TONE.freqs[i % ALARM_TONE.freqs.length], t + i * ALARM_PULSE_INTERVAL, ALARM_PULSE_DURATION, ALARM_TONE.peak, ALARM_TONE.attack, ALARM_TONE.release);
      }
    }
    if (navigator.vibrate) navigator.vibrate(ALARM_VIBRATE_PATTERN);
  } catch (e) {
    console.warn('Audio failed:', e);
    if (navigator.vibrate) navigator.vibrate(ALARM_VIBRATE_PATTERN);
  }
};

// Vibration alone (same pattern as the alarm), for callers that play the alarm sound some
// other way (the background <audio> path in features/restBackground.js).
export const vibrateAlarm = () => {
  try { if (navigator.vibrate) navigator.vibrate(ALARM_VIBRATE_PATTERN); } catch {}
};
export const stopVibration = () => {
  try { if (navigator.vibrate) navigator.vibrate(0); } catch {}
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
