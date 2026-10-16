// SPIKE — rest timer outside the app. Two independent experiments behind two buttons in
// the expanded timer; nothing here runs unless one of them is pressed.
//
//  A) Picture-in-Picture: the timer is drawn on a <canvas>, captureStream() feeds a <video>
//     and requestPictureInPicture() floats it over other apps.
//  B) Player notification: a near-silent looping <audio> + Media Session metadata /
//     position / stop action, so Android treats the page as "playing media".
//
// Both are about one question: does the page keep running (timer ticking, alarm sounding)
// while the app is in the background or the screen is locked? The module records what it
// observes (ticks while hidden, lateness of the end) so the result can be read off the
// status line instead of guessed.

const SILENT_AMPLITUDE = 0.003; // ~ -50 dBFS, inaudible on a phone; 0 = digital silence
// (Chrome decides "audible" from measured output power: digital silence may not count.)
const ALARM_CAP_MS = 30000;

let state = null; // { mode: 'pip' | 'media', cleanup: [fn], ... }
let status = '';
const listeners = new Set();
const logLines = [];
// Keeps the last few lines (start, what came back from the background, how late the end
// was) so they are all readable on return; an empty string clears everything.
const setStatus = (s) => {
  if (!s) logLines.length = 0; else { logLines.push(s); if (logLines.length > 4) logLines.shift(); }
  status = logLines.join('\n');
  listeners.forEach(l => l(status));
};
export const getBgStatus = () => status;
export const onBgStatus = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const bgMode = () => state?.mode ?? null;
// In media mode the alarm is played by the <audio> element itself (the thing Android keeps
// alive), so the regular WebAudio alarm is skipped to avoid doubling it.
export const bgHandlesAlarm = () => state?.mode === 'media';

export const bgSupport = () => ({
  pip: typeof document !== 'undefined' && !!document.pictureInPictureEnabled && typeof HTMLVideoElement !== 'undefined' && 'requestPictureInPicture' in HTMLVideoElement.prototype,
  captureStream: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
  mediaSession: typeof navigator !== 'undefined' && 'mediaSession' in navigator,
  positionState: typeof navigator !== 'undefined' && !!navigator.mediaSession && 'setPositionState' in navigator.mediaSession,
  autoPipAttr: typeof HTMLVideoElement !== 'undefined' && 'autoPictureInPicture' in HTMLVideoElement.prototype,
});

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const clock = (t = Date.now()) => new Date(t).toLocaleTimeString('es-AR', { hour12: false });

// ── Observation: ticks while hidden, lateness of the end ─────────────────────────────
const startObserver = (snapshot) => {
  const obs = { ticks: 0, hiddenAt: null, hiddenTicks: 0, expectedEnd: snapshot().endsAt, lastLine: '' };
  const tick = setInterval(() => {
    obs.ticks++;
    if (document.visibilityState === 'hidden') obs.hiddenTicks++;
    const s = snapshot();
    if (s.remainingSecs > 0) obs.expectedEnd = s.endsAt; // follows +/-15 s adjustments
  }, 500);
  const onVis = () => {
    if (document.visibilityState === 'hidden') { obs.hiddenAt = Date.now(); obs.hiddenTicks = 0; return; }
    if (obs.hiddenAt) {
      const secs = Math.round((Date.now() - obs.hiddenAt) / 1000);
      // a 500 ms interval should fire ~2 times per second if the page kept running
      obs.lastLine = `Volví tras ${secs} s: ${obs.hiddenTicks} ticks en segundo plano (esperados ~${secs * 2}).`;
      setStatus(`${state?.mode === 'pip' ? 'PiP' : 'Media'}: ${obs.lastLine}`);
      obs.hiddenAt = null;
    }
  };
  document.addEventListener('visibilitychange', onVis);
  obs.stop = () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVis); };
  return obs;
};

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

// ── Release everything ───────────────────────────────────────────────────────────────
export const stopBackground = () => {
  if (!state) return;
  const s = state;
  state = null;
  for (const fn of s.cleanup.reverse()) { try { fn(); } catch { /* best effort */ } }
  setStatus('');
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

export const startPip = async ({ getSnapshot }) => {
  stopBackground();
  const sup = bgSupport();
  if (!sup.pip || !sup.captureStream) { setStatus(`PiP no disponible (pip=${sup.pip}, captureStream=${sup.captureStream})`); return false; }

  const W = 320, H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const cleanup = [];
  const obs = startObserver(getSnapshot);
  cleanup.push(() => obs.stop());
  state = { mode: 'pip', cleanup, canvas, ctx, obs, W, H };

  const draw = () => drawFrame(ctx, W, H, getSnapshot(), state?.done === true);
  draw();
  const drawTimer = setInterval(draw, 250);
  cleanup.push(() => clearInterval(drawTimer));

  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  video.setAttribute('autopictureinpicture', '');
  try { video.autoPictureInPicture = true; } catch { /* attribute only exists in some builds */ }
  video.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  const stream = canvas.captureStream(5);
  video.srcObject = stream;
  document.body.appendChild(video);
  cleanup.push(() => { stream.getTracks().forEach(t => t.stop()); video.srcObject = null; video.remove(); });

  // Does the browser accept the "enter PiP automatically on leaving" handler at all?
  let autoNote = 'handler enterpictureinpicture: no soportado';
  try {
    navigator.mediaSession.setActionHandler('enterpictureinpicture', () => { video.requestPictureInPicture().catch(() => {}); });
    autoNote = 'handler enterpictureinpicture: aceptado (¿entra solo al salir? probalo)';
    cleanup.push(() => { try { navigator.mediaSession.setActionHandler('enterpictureinpicture', null); } catch { /* ignore */ } });
  } catch { /* unsupported action name throws */ }

  try {
    await video.play();
    await video.requestPictureInPicture(); // needs the click that called startPip
  } catch (e) {
    setStatus(`PiP falló: ${e?.name || 'error'} — ${e?.message || ''}`);
    stopBackground();
    return false;
  }
  const onLeave = () => { if (!state) return; setStatus('PiP cerrado por el usuario (el timer sigue en la app).'); stopBackground(); };
  video.addEventListener('leavepictureinpicture', onLeave);
  cleanup.push(() => video.removeEventListener('leavepictureinpicture', onLeave));
  cleanup.push(() => { if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {}); });
  setStatus(`PiP activo. ${autoNote}. Salí de la app y mirá la ventana flotante.`);
  return true;
};

// ── B) Player notification (silent audio + Media Session) ────────────────────────────
export const startMedia = async ({ getSnapshot, onStop }) => {
  stopBackground();
  const sup = bgSupport();
  const cleanup = [];
  const obs = startObserver(getSnapshot);
  cleanup.push(() => obs.stop());
  state = { mode: 'media', cleanup, obs };

  const sUrl = silentUrl();
  const aUrl = alarmUrl();
  cleanup.push(() => { URL.revokeObjectURL(sUrl); URL.revokeObjectURL(aUrl); });
  const audio = new Audio(sUrl);
  audio.loop = true;
  state.audio = audio; state.alarmSrc = aUrl;
  cleanup.push(() => { audio.pause(); audio.removeAttribute('src'); audio.load(); });

  try {
    await audio.play(); // needs the click that called startMedia
  } catch (e) {
    setStatus(`Audio falló: ${e?.name || 'error'} — ${e?.message || ''}`);
    stopBackground();
    return false;
  }

  const notes = [];
  if (sup.mediaSession) {
    const ms = navigator.mediaSession;
    const snap = getSnapshot();
    try {
      ms.metadata = new MediaMetadata({
        title: `Descanso · ${snap.name || 'ejercicio'}`,
        artist: 'Iron Commander',
        album: 'Timer de descanso',
        artwork: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      ms.playbackState = 'playing';
      notes.push('metadata OK');
    } catch (e) { notes.push(`metadata falló (${e?.name})`); }
    const updatePosition = () => {
      if (!sup.positionState || !state) return;
      const s = getSnapshot();
      const duration = Math.max(1, s.totalSecs);
      const position = Math.min(duration, Math.max(0, duration - s.remainingSecs));
      try { ms.setPositionState({ duration, playbackRate: 1, position }); } catch { /* ignore */ }
    };
    updatePosition();
    const posTimer = setInterval(updatePosition, 1000);
    cleanup.push(() => clearInterval(posTimer));
    notes.push(sup.positionState ? 'setPositionState OK' : 'sin setPositionState');
    const stopAction = () => { onStop?.(); };
    for (const a of ['stop', 'pause']) { try { ms.setActionHandler(a, stopAction); } catch { /* unsupported */ } }
    try { ms.setActionHandler('play', () => { audio.play().catch(() => {}); }); } catch { /* ignore */ }
    cleanup.push(() => {
      for (const a of ['stop', 'pause', 'play']) { try { ms.setActionHandler(a, null); } catch { /* ignore */ } }
      try { ms.setPositionState(); } catch { /* ignore */ }
      try { ms.playbackState = 'none'; ms.metadata = null; } catch { /* ignore */ }
    });
  } else {
    notes.push('sin Media Session');
  }
  setStatus(`Media activa: ${notes.join(', ')}. Salí de la app: debería aparecer la notificación del reproductor.`);
  return true;
};

// ── Timer reached 0 ──────────────────────────────────────────────────────────────────
export const bgComplete = () => {
  if (!state) return;
  const late = Date.now() - state.obs.expectedEnd;
  const lateTxt = `el fin se detectó a las ${clock()} (${late >= 0 ? '+' : ''}${late} ms vs. lo esperado)`;
  if (state.mode === 'pip') {
    state.done = true;
    drawFrame(state.ctx, state.W, state.H, { remainingSecs: 0, totalSecs: 0, name: 'Descanso terminado' }, true);
    setStatus(`PiP: ${lateTxt}. La alarma sale por WebAudio.`);
    return;
  }
  // media: the alarm goes through the same <audio> element that is keeping the page alive
  const { audio, alarmSrc } = state;
  try {
    audio.src = alarmSrc;
    audio.loop = true;
    audio.play().catch((e) => setStatus(`Media: la alarma no pudo sonar (${e?.name})`));
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Descanso terminado', artist: 'Iron Commander' });
    }
  } catch { /* ignore */ }
  const cap = setTimeout(() => stopBackground(), ALARM_CAP_MS);
  state.cleanup.push(() => clearTimeout(cap));
  setStatus(`Media: ${lateTxt}. Alarma por <audio> (tope 30 s).`);
};
