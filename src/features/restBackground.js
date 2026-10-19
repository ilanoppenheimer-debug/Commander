import { vibrateAlarm, stopVibration } from '../services/audioService';

// Rest timer outside the app. On every set completion BOTH start, inside the same tap:
//
//  - Player notification (always): a near-silent looping <audio> + Media Session metadata /
//    position / actions, so Android treats the page as "playing media" and keeps it alive
//    with the app in the background or the screen locked.
//  - Picture-in-Picture (best effort): the timer is drawn on a <canvas>, captureStream()
//    feeds a <video> and requestPictureInPicture() floats it over other apps. If it can't
//    open (unsupported, rejected, no gesture) the notification carries on alone, without a
//    visible error (the reason goes to console.info). Android closes the PiP when the
//    screen locks and it can't be reopened without a gesture: the notification covers that.
//
// Dismissing without opening the app:
//  - while COUNTING, "pause" is ignored (pausing the silent audio would let Android freeze
//    the page) and "stop" skips the rest;
//  - while the ALARM sounds, pause/stop (and closing the PiP window) silence it and
//    release everything.
//
// Everything lives in memory (module state + blob URLs); nothing is written to storage.

// Amplitud del audio "silencioso": NO es 0 a propósito. Chrome decide si una página está
// reproduciendo audio midiendo la potencia real de la salida; con silencio digital exacto
// (muestras en 0) puede no contarla como audible y Android vuelve a congelar la página con
// la pantalla bloqueada. 0.003 (~ -50 dBFS, un seno de 30 Hz que los parlantes de un celular
// ni reproducen) es inaudible y alcanzó en las pruebas en un Android real.
const SILENT_AMPLITUDE = 0.003;
const ALARM_CAP_MS = 30000;
const ALARM_VIBRATE_REPEAT_MS = 5000;

let state = null; // { mode: 'media', cleanup: [fn], getSnapshot, actions, alarming, pip: {...} | null, ... }
const note = (msg) => console.info('[restBg]', msg);
export const bgAlarming = () => !!state?.alarming;
// With the notification active the alarm is played by the <audio> element itself (the thing
// Android keeps alive), so the regular WebAudio alarm is skipped to avoid doubling it.
export const bgHandlesAlarm = () => state?.mode === 'media';

export const bgSupport = () => ({
  pip: typeof document !== 'undefined' && !!document.pictureInPictureEnabled && typeof HTMLVideoElement !== 'undefined' && 'requestPictureInPicture' in HTMLVideoElement.prototype,
  captureStream: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
  mediaSession: typeof navigator !== 'undefined' && 'mediaSession' in navigator,
  positionState: typeof navigator !== 'undefined' && !!navigator.mediaSession && 'setPositionState' in navigator.mediaSession,
});

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// ── Tiny WAV synth (no dependencies) ─────────────────────────────────────────────────
const makeWavUrl = (seconds, sampleRate, sampleAt) => {
  const n = Math.floor(seconds * sampleRate);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(sampleAt(i / sampleRate) * 32767), true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
};
const silentUrl = () => makeWavUrl(10, 8000, (t) => SILENT_AMPLITUDE * Math.sin(2 * Math.PI * 30 * t));
// 5 pulses of 880 Hz (0.3 s on, 0.7 s off) — same cadence as playTacticalAlarm
const alarmUrl = () => makeWavUrl(5, 22050, (t) => ((t % 1) < 0.3 ? 0.8 * Math.sin(2 * Math.PI * 880 * t) : 0));

// ── Notification artwork (the picture shown on the lock screen) ──────────────────────
const wrapText = (ctx, text, maxWidth) => {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
};
const makeArtwork = ({ done, name }) => {
  try {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = done ? '#f59e0b' : '#0f172a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.textAlign = 'center';
    ctx.fillStyle = done ? '#000' : '#fbbf24';
    ctx.font = `bold ${done ? 150 : 88}px system-ui, sans-serif`;
    ctx.fillText(done ? '¡FIN!' : 'DESCANSO', 256, done ? 270 : 230);
    if (name) {
      ctx.fillStyle = done ? '#1c1917' : '#cbd5e1';
      ctx.font = 'bold 40px system-ui, sans-serif';
      wrapText(ctx, name, 440).forEach((l, i) => ctx.fillText(l, 256, 340 + i * 48));
    }
    return c.toDataURL('image/png');
  } catch { return null; }
};

const setMetadata = (snap, done) => {
  if (!bgSupport().mediaSession) return;
  try {
    const art = makeArtwork({ done, name: snap.name });
    const artwork = [
      ...(art ? [{ src: art, sizes: '512x512', type: 'image/png' }] : []),
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: done ? `¡FIN! · ${snap.name || 'Descanso terminado'}` : (snap.name ? `Descanso · ${snap.name}` : 'Descanso'),
      artist: done ? (snap.next ? `Sigue: ${snap.next}` : 'Descanso terminado') : 'Iron Commander',
      album: done ? 'Tocá APAGAR en la notificación o abrí la app' : 'Timer de descanso',
      artwork,
    });
  } catch { /* metadata is cosmetic */ }
};

// ── Release everything ───────────────────────────────────────────────────────────────
export const stopBackground = (finalNote = '') => {
  if (!state) return;
  const s = state;
  state = null;
  for (const fn of s.cleanup.slice().reverse()) { try { fn(); } catch { /* best effort */ } }
  if (finalNote) note(finalNote);
};

// ── Media Session actions shared by both experiments ─────────────────────────────────
const keepPlaying = () => {
  const el = state?.audio || state?.video;
  if (el && el.paused) el.play().catch(() => {});
};
const installActions = (st) => {
  if (!bgSupport().mediaSession) return [];
  const ms = navigator.mediaSession;
  const onPause = () => {
    if (state !== st) return;
    if (st.alarming) { note('Pausa durante la alarma → apagada.'); st.actions.onDismiss?.(); }
    else { note('Pausa ignorada: la cuenta sigue (el audio no se corta).'); keepPlaying(); }
  };
  const onStopAction = () => {
    if (state !== st) return;
    if (st.alarming) { note('Stop durante la alarma → apagada.'); st.actions.onDismiss?.(); }
    else { note('Stop: descanso saltado.'); st.actions.onStop?.(); }
  };
  const handlers = { pause: onPause, stop: onStopAction, play: () => { keepPlaying(); } };
  const registered = [];
  for (const [a, h] of Object.entries(handlers)) {
    try { ms.setActionHandler(a, h); registered.push(a); } catch { /* unsupported action */ }
  }
  st.cleanup.push(() => { for (const a of registered) { try { ms.setActionHandler(a, null); } catch { /* ignore */ } } });
  return registered;
};

// ── A) Picture-in-Picture ────────────────────────────────────────────────────────────
const drawFrame = (ctx, w, h, { remainingSecs, totalSecs, name }, done) => {
  ctx.fillStyle = done ? '#f59e0b' : '#0f172a';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = done ? '#000' : '#94a3b8';
  ctx.font = 'bold 20px system-ui, sans-serif';
  const label = (name || 'Descanso').length > 26 ? `${(name || '').slice(0, 25)}…` : (name || 'Descanso');
  ctx.fillText(label, w / 2, 34);
  ctx.fillStyle = done ? '#000' : (remainingSecs <= 10 ? '#ef4444' : '#fff');
  ctx.font = `bold ${done ? 40 : 84}px ui-monospace, monospace`;
  ctx.fillText(done ? '¡FIN!' : fmt(remainingSecs), w / 2, done ? h / 2 + 14 : h / 2 + 30);
  if (!done && totalSecs > 0) {
    const p = Math.min(1, Math.max(0, 1 - remainingSecs / totalSecs));
    ctx.fillStyle = '#1e293b'; ctx.fillRect(20, h - 28, w - 40, 8);
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(20, h - 28, (w - 40) * p, 8);
  }
};

// Best effort, attached to the running media state. Must run inside the user gesture that
// started the rest (the tap on a set's check button).
const releasePip = (st, note) => {
  const pip = st.pip;
  if (!pip) return;
  st.pip = null;
  for (const fn of pip.cleanup.slice().reverse()) { try { fn(); } catch { /* best effort */ } }
  if (note && state === st) note(note);
};

const attachPip = async (st) => {
  if (st.pip) return true; // already open: the next set just keeps it
  const sup = bgSupport();
  if (!sup.pip || !sup.captureStream) { console.info('[restBg] PiP no disponible', sup); return false; }

  const W = 320, H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pip = { cleanup: [], draw: null };
  st.pip = pip;

  pip.draw = () => drawFrame(ctx, W, H, st.getSnapshot(), st.alarming);
  pip.draw();
  const drawTimer = setInterval(pip.draw, 250);
  pip.cleanup.push(() => clearInterval(drawTimer));

  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  video.setAttribute('autopictureinpicture', '');
  try { video.autoPictureInPicture = true; } catch { /* attribute only exists in some builds */ }
  video.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  const stream = canvas.captureStream(5);
  video.srcObject = stream;
  document.body.appendChild(video);
  pip.cleanup.push(() => { stream.getTracks().forEach(t => t.stop()); video.srcObject = null; video.remove(); });

  // Does the browser accept the "enter PiP automatically on leaving" handler at all?
  let autoNote = 'enterpictureinpicture: no soportado';
  try {
    navigator.mediaSession.setActionHandler('enterpictureinpicture', () => { video.requestPictureInPicture().catch(() => {}); });
    autoNote = 'enterpictureinpicture: aceptado';
    pip.cleanup.push(() => { try { navigator.mediaSession.setActionHandler('enterpictureinpicture', null); } catch { /* ignore */ } });
  } catch { /* unsupported action name throws */ }

  try {
    await video.play();
    await video.requestPictureInPicture();
  } catch (e) {
    console.info('[restBg] PiP rechazado', e?.name, e?.message);
    releasePip(st);
    return false;
  }
  if (state !== st || st.pip !== pip) { releasePip(st); return false; } // the rest ended meanwhile

  // Closing the floating window: with the alarm sounding it is "apagar" (everything is
  // released); while counting it only drops the PiP (notification and timer carry on).
  // Coming back to the app through the window (visible page) must not wipe the end alert.
  const onLeave = () => {
    if (state !== st || st.pip !== pip) return;
    const vis = document.visibilityState;
    if (st.alarming && vis !== 'visible') {
      note(`Ventana flotante cerrada durante la alarma (visibilityState=${vis}) → apagada.`);
      st.actions.onDismiss?.();
    } else if (st.alarming) {
      releasePip(st, 'PiP cerrado al volver a la app: la alerta queda en pantalla.');
    } else {
      releasePip(st, `PiP cerrado (visibilityState=${vis}): sigue la notificación.`);
    }
  };
  video.addEventListener('leavepictureinpicture', onLeave);
  pip.cleanup.push(() => video.removeEventListener('leavepictureinpicture', onLeave));
  pip.cleanup.push(() => { if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {}); });
  note(`PiP abierto (${autoNote}).`);
  return true;
};

// ── B) Player notification (silent audio + Media Session) ────────────────────────────
// Must run inside the user gesture that started the rest.
const startMediaCore = async ({ getSnapshot, onStop, onDismiss }) => {
  // A new rest while the notification is already counting: refresh it, keep the audio.
  if (state?.mode === 'media' && !state.alarming) {
    state.getSnapshot = getSnapshot; state.actions = { onStop, onDismiss };
    setMetadata(getSnapshot(), false);
    note('Media: descanso nuevo, notificación actualizada (el audio sigue).');
    return true;
  }
  stopBackground();
  const sup = bgSupport();
  const cleanup = [];
  const st = { mode: 'media', cleanup, getSnapshot, actions: { onStop, onDismiss }, alarming: false, switching: false };
  state = st;
  cleanup.push(() => releasePip(st));

  const sUrl = silentUrl();
  const aUrl = alarmUrl();
  cleanup.push(() => { URL.revokeObjectURL(sUrl); URL.revokeObjectURL(aUrl); });
  const audio = new Audio(sUrl);
  audio.loop = true;
  st.audio = audio; st.alarmSrc = aUrl;
  cleanup.push(() => { audio.pause(); audio.removeAttribute('src'); audio.load(); });

  // Android can pause the element on its own (audio focus, a call). During the count that
  // would let it freeze the page, so resume at once; during the alarm it means "apagar".
  const onNativePause = () => {
    if (state !== st || st.switching) return;
    if (st.alarming) { note('El sistema pausó el audio durante la alarma → apagada.'); st.actions.onDismiss?.(); }
    else { note('El sistema pausó el audio: reanudado.'); audio.play().catch(() => {}); }
  };
  audio.addEventListener('pause', onNativePause);
  cleanup.push(() => audio.removeEventListener('pause', onNativePause));

  try {
    await audio.play(); // needs the tap that started the rest
  } catch (e) {
    note(`Audio falló: ${e?.name || 'error'} — ${e?.message || ''}`);
    stopBackground(`Audio falló: ${e?.name || 'error'}`);
    return false;
  }

  const notes = [];
  if (sup.mediaSession) {
    const ms = navigator.mediaSession;
    const snap = getSnapshot();
    setMetadata(snap, false);
    try { ms.playbackState = 'playing'; } catch { /* ignore */ }
    notes.push('metadata OK');
    const updatePosition = () => {
      if (!sup.positionState || state !== st || st.alarming) return;
      const s = st.getSnapshot();
      const duration = Math.max(1, s.totalSecs);
      const position = Math.min(duration, Math.max(0, duration - s.remainingSecs));
      try { ms.setPositionState({ duration, playbackRate: 1, position }); } catch { /* ignore */ }
    };
    updatePosition();
    const posTimer = setInterval(updatePosition, 1000);
    cleanup.push(() => clearInterval(posTimer));
    notes.push(sup.positionState ? 'setPositionState OK' : 'sin setPositionState');
    const registered = installActions(st);
    notes.push(`acciones registradas: ${registered.join('/') || 'ninguna'}`);
    cleanup.push(() => {
      try { ms.setPositionState(); } catch { /* ignore */ }
      try { ms.playbackState = 'none'; ms.metadata = null; } catch { /* ignore */ }
    });
  } else {
    notes.push('sin Media Session');
  }
  note(`Media activa: ${notes.join(', ')}.`);
  return true;
};

// Entry point, called from the tap on a set's "complete": the notification (audio + Media
// Session) and the PiP window start together. Both sync parts run before any await, so both
// keep the tap's user activation; a PiP that can't open leaves the notification running.
export const startBackground = async (params) => {
  const mediaP = startMediaCore(params);
  const st = state;
  const pipP = st ? attachPip(st) : Promise.resolve(false);
  const [mediaOk] = await Promise.all([mediaP, pipP]);
  return mediaOk;
};

// ── Timer reached 0 ──────────────────────────────────────────────────────────────────
export const bgComplete = () => {
  if (!state) return;
  const st = state;
  st.alarming = true;
  st.pip?.draw(); // the floating window flips to ¡FIN! at once
  // media: the alarm goes through the same <audio> element that is keeping the page alive,
  // and the notification flips to "¡FIN!" (title, subtitle with what follows, big picture).
  const { audio, alarmSrc } = st;
  const snap = st.getSnapshot();
  setMetadata(snap, true);
  try {
    if (bgSupport().positionState) navigator.mediaSession.setPositionState({ duration: Math.max(1, snap.totalSecs), playbackRate: 1, position: Math.max(1, snap.totalSecs) });
  } catch { /* ignore */ }
  st.switching = true;
  try {
    audio.src = alarmSrc;
    audio.loop = true;
    audio.play().catch((e) => note(`Media: la alarma no pudo sonar (${e?.name})`));
  } catch { /* ignore */ }
  setTimeout(() => { if (state === st) st.switching = false; }, 300);
  const cap = setTimeout(() => stopBackground('Alarma de la notificación cortada por el tope de 30 s.'), ALARM_CAP_MS);
  st.cleanup.push(() => clearTimeout(cap));
  // Vibration parity with the foreground alarm (playTacticalAlarm vibrates; the <audio>
  // path doesn't). Chrome only honours it while the page is visible, so this is the
  // in-app case; in the background the sound and the notification carry the alert.
  vibrateAlarm();
  const vib = setInterval(vibrateAlarm, ALARM_VIBRATE_REPEAT_MS);
  st.cleanup.push(() => { clearInterval(vib); stopVibration(); });
  note('fin del descanso: alarma por <audio> (tope 30 s)');
};
