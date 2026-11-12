import { makeWavUrl } from '../utils/wavSynth';

// One AudioContext for the whole app (browsers cap how many can exist, and a new one per
// alert was never closed). Every alarm plays through its own gain "bus" so stopAlarm()
// can silence pulses that are already scheduled on the context timeline — scheduled
// oscillators can't be cancelled one by one, but disconnecting their bus silences them.
let sharedCtx = null;
const activeBuses = new Set();

// The rest alarm and pre-alert do NOT use this context any more: they play short <audio>
// clips (see "Short clips" below), because on Android a long-lived running AudioContext made
// the music app lose audio focus. What still uses it (the hold-target beep and the clip fallback) is short, and the context is SUSPENDED as soon as nothing sounds, so it
// is never left running through a rest. getCtx() resumes it on the next use.
let idleSuspendTimer = null;
const scheduleIdleSuspend = (secs) => {
  if (idleSuspendTimer) clearTimeout(idleSuspendTimer);
  idleSuspendTimer = setTimeout(() => {
    idleSuspendTimer = null;
    try { if (sharedCtx && sharedCtx.state === 'running') sharedCtx.suspend(); } catch { /* ignore */ }
  }, (secs + 0.3) * 1000);
};

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

// ── Short clips ──────────────────────────────────────────────────────────────────────
// Same tone, envelope and level as the old WebAudio beeps, rendered once into tiny WAVs and
// played with <audio>: a short media element asks Android for transient audio focus (the music
// ducks and comes back by itself) where a long-lived WebAudio context did not.
const clipCache = new Map();
const clipUrl = (key, freq, duration, peak, attack, release) => {
  if (!clipCache.has(key)) {
    clipCache.set(key, makeWavUrl(duration, 22050, (t) => {
      const env = Math.min(1, t / attack, (duration - t) / release);
      return peak * Math.max(0, env) * Math.sin(2 * Math.PI * freq * t);
    }));
  }
  return clipCache.get(key);
};
const alarmPulseUrl = (i) => {
  const f = ALARM_TONE.freqs[i % ALARM_TONE.freqs.length];
  return clipUrl(`alarm${f}`, f, ALARM_PULSE_DURATION, ALARM_TONE.peak, ALARM_TONE.attack, ALARM_TONE.release);
};
const PRE_ALERT = { freq: 440, duration: 0.15, peak: 0.15, attack: 0.02, release: 0.05 };
const preAlertUrl = () => clipUrl('prealert', PRE_ALERT.freq, PRE_ALERT.duration, PRE_ALERT.peak, PRE_ALERT.attack, PRE_ALERT.release);

const activeClips = new Set();
const pendingPulses = new Set();
// Plays one clip; if the browser refuses (autoplay policy, no Audio) `fallback` runs instead.
const playClip = (url, fallback) => {
  try {
    const a = new Audio(url);
    a.volume = 1;
    activeClips.add(a);
    const done = () => { activeClips.delete(a); };
    a.addEventListener('ended', done);
    a.addEventListener('error', done);
    const p = a.play();
    if (p && p.catch) p.catch(() => { done(); try { fallback?.(); } catch { /* ignore */ } });
  } catch { try { fallback?.(); } catch { /* ignore */ } }
};

export const playTacticalAlarm = () => {
  // 5 short clips, one per pulse, 1 s apart (the same cadence as before). stopAlarm() cancels
  // the ones not yet played and cuts the one sounding.
  for (let i = 0; i < ALARM_PULSE_COUNT; i++) {
    const fire = () => playClip(alarmPulseUrl(i), () => playWebAudioPulse(i));
    if (i === 0) fire();
    else {
      const id = setTimeout(() => { pendingPulses.delete(id); fire(); }, i * ALARM_PULSE_INTERVAL * 1000);
      pendingPulses.add(id);
    }
  }
  try { if (navigator.vibrate) navigator.vibrate(ALARM_VIBRATE_PATTERN); } catch { /* ignore */ }
};

// Fallback for a pulse the browser would not play as <audio>: the old WebAudio beep.
const playWebAudioPulse = (i) => {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = newBus(ctx, ALARM_PULSE_DURATION);
  beep(ctx, bus, ALARM_TONE.freqs[i % ALARM_TONE.freqs.length], ctx.currentTime, ALARM_PULSE_DURATION, ALARM_TONE.peak, ALARM_TONE.attack, ALARM_TONE.release);
  scheduleIdleSuspend(ALARM_PULSE_DURATION);
};

// Vibration alone (same pattern as the alarm), for callers that play the alarm sound some
// other way (the background <audio> path in features/restBackground.js, "Pantalla bloqueada").
export const vibrateAlarm = () => {
  try { if (navigator.vibrate) navigator.vibrate(ALARM_VIBRATE_PATTERN); } catch {}
};
export const stopVibration = () => {
  try { if (navigator.vibrate) navigator.vibrate(0); } catch {}
};

// Short "you reached the target" signal for a hold timer (not the rest alarm): two
// quick tones from the alarm family (2.4 then 3.2 kHz, same attack/release/peak), well
// under a second, plus a short vibration. Plays once; the caller decides when.
const HOLD_BEEP_DURATION = 0.16;
const HOLD_BEEP_GAP = 0.08;
const HOLD_VIBRATE_PATTERN = [140, 70, 140];
export const playHoldTargetBeep = () => {
  try {
    const ctx = getCtx();
    if (ctx) {
      const t = ctx.currentTime;
      const bus = newBus(ctx, 2 * HOLD_BEEP_DURATION + HOLD_BEEP_GAP);
      ALARM_TONE.freqs.forEach((f, i) => {
        beep(ctx, bus, f, t + i * (HOLD_BEEP_DURATION + HOLD_BEEP_GAP), HOLD_BEEP_DURATION, ALARM_TONE.peak, ALARM_TONE.attack, ALARM_TONE.release);
      });
      scheduleIdleSuspend(2 * HOLD_BEEP_DURATION + HOLD_BEEP_GAP);
    }
    if (navigator.vibrate) navigator.vibrate(HOLD_VIBRATE_PATTERN);
  } catch {
    try { if (navigator.vibrate) navigator.vibrate(HOLD_VIBRATE_PATTERN); } catch {}
  }
};

export const playPreAlert = () => {
  // One short clip (440 Hz, 0.15 s, same level as before); the old WebAudio beep only if the
  // browser refuses the <audio>.
  playClip(preAlertUrl(), () => {
    const ctx = getCtx();
    if (ctx) { beep(ctx, newBus(ctx, 0.15), 440, ctx.currentTime, 0.15, 0.15); scheduleIdleSuspend(0.15); }
  });
  try { if (navigator.vibrate) navigator.vibrate(80); } catch { /* ignore */ }
};

// Silences every alarm/pre-alert still scheduled or sounding, and cancels vibration.
export const stopAlarm = () => {
  for (const id of pendingPulses) clearTimeout(id);
  pendingPulses.clear();
  for (const a of activeClips) { try { a.pause(); } catch { /* ignore */ } }
  activeClips.clear();
  for (const bus of activeBuses) { try { bus.disconnect(); } catch {} }
  activeBuses.clear();
  try { if (navigator.vibrate) navigator.vibrate(0); } catch {}
};
