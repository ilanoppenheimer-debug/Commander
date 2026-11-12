import { playTacticalAlarm, playSingleBeep, stopAlarm, ALARM_TONE } from '../services/audioService';
import { makeWavUrl } from './restBackground';

// TEST ONLY (Ajustes → "Probar alarma"). Which way of sounding the end-of-rest alarm lets a
// music app (Spotify) keep playing on Android? Each variant plays ONCE when tapped; nothing
// here is wired to the real timer, so the app's behaviour is unchanged. Hypothesis under
// test: Android/Chrome gives a long sound "persistent" audio focus (pauses other apps) and a
// short one "transient, may duck". It can't be checked from docs: it is tried on the device.
//
//   a   the current Solo PiP alarm: WebAudio, 5 pulses (~4.3 s)
//   b   one WebAudio beep, 0.3 s
//   c   one <audio> clip, 0.4 s (same tone as the pulses)
//   d   the clip (c) 3 times, 0.4 s apart
//   e1  a brand-new AudioContext with latencyHint 'playback', 5 pulses, closed afterwards
//   e2  Media Session playbackState 'none' right before the alarm (a)
//   e3  navigator.audioSession.type = 'transient' (if the browser has it) + alarm (a)
//   e4  navigator.audioSession.type = 'ambient' (if the browser has it) + alarm (a)

const CLIP_SECONDS = 0.4;
const CLIP_GAP_MS = 400;
let clipUrl = null;
const getClipUrl = () => {
  if (!clipUrl) {
    clipUrl = makeWavUrl(CLIP_SECONDS, 22050, (t) => {
      const env = Math.min(1, t / ALARM_TONE.attack, (CLIP_SECONDS - t) / ALARM_TONE.release);
      return ALARM_TONE.peak * env * Math.sin(2 * Math.PI * ALARM_TONE.freqs[0] * t);
    });
  }
  return clipUrl;
};

const playClip = () => {
  const audio = new Audio(getClipUrl());
  audio.volume = 1;
  return audio.play();
};

// Own context so latencyHint 'playback' takes effect (the shared one was built with the default).
const playPulsesOnNewContext = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const ctx = new AC({ latencyHint: 'playback' });
  const start = () => {
    const t = ctx.currentTime + 0.05;
    for (let i = 0; i < ALARM_TONE.pulses; i++) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      const s = t + i * ALARM_TONE.interval; const e = s + ALARM_TONE.duration;
      osc.type = 'sine'; osc.frequency.setValueAtTime(ALARM_TONE.freqs[i % ALARM_TONE.freqs.length], s);
      gain.gain.setValueAtTime(0, s); gain.gain.linearRampToValueAtTime(ALARM_TONE.peak, s + ALARM_TONE.attack);
      gain.gain.linearRampToValueAtTime(ALARM_TONE.peak, e - ALARM_TONE.release); gain.gain.linearRampToValueAtTime(0, e);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(s); osc.stop(e);
    }
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, (ALARM_TONE.pulses * ALARM_TONE.interval + 1) * 1000);
  };
  if (ctx.state === 'suspended') ctx.resume().then(start, start); else start();
  return true;
};

const withAudioSession = (type, then) => {
  if (typeof navigator === 'undefined' || !navigator.audioSession) return false;
  const as = navigator.audioSession;
  const before = as.type;
  try { as.type = type; } catch { return false; }
  then();
  setTimeout(() => { try { as.type = before; } catch { /* ignore */ } }, (ALARM_TONE.pulses * ALARM_TONE.interval + 1) * 1000);
  return true;
};

export const ALARM_FOCUS_TESTS = [
  { id: 'a',  label: 'A · Alarma actual (WebAudio, 5 pulsos)', run: () => { playTacticalAlarm(); return true; } },
  { id: 'b',  label: 'B · Un pitido WebAudio (0,3 s)', run: () => playSingleBeep(0.3) },
  { id: 'c',  label: 'C · Clip <audio> (0,4 s)', run: () => { playClip().catch(() => {}); return true; } },
  { id: 'd',  label: 'D · Clip <audio> ×3 con pausas', run: () => {
      for (let i = 0; i < 3; i++) setTimeout(() => { playClip().catch(() => {}); }, i * (CLIP_SECONDS * 1000 + CLIP_GAP_MS));
      return true;
    } },
  { id: 'e1', label: 'E1 · AudioContext nuevo, latencyHint playback (5 pulsos)', run: playPulsesOnNewContext },
  { id: 'e2', label: 'E2 · Media Session playbackState none + alarma actual', run: () => {
      if (typeof navigator === 'undefined' || !navigator.mediaSession) return false;
      try { navigator.mediaSession.playbackState = 'none'; } catch { return false; }
      playTacticalAlarm(); return true;
    } },
  { id: 'e3', label: 'E3 · audioSession transient + alarma actual', run: () => withAudioSession('transient', playTacticalAlarm) },
  { id: 'e4', label: 'E4 · audioSession ambient + alarma actual', run: () => withAudioSession('ambient', playTacticalAlarm) },
];

// Returns true when it sounded, false when the browser lacks what the variant needs.
export const runAlarmFocusTest = (id) => {
  const t = ALARM_FOCUS_TESTS.find(x => x.id === id);
  if (!t) return false;
  try { return !!t.run(); } catch (e) { console.warn('[alarmFocusTest]', id, e); return false; }
};

export const stopAlarmFocusTests = () => { stopAlarm(); };
