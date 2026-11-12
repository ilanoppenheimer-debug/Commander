// Rest timer outside the app: a floating Picture-in-Picture window.
//
// The timer is drawn on a <canvas>, captureStream() feeds a muted <video> and
// requestPictureInPicture() floats it over other apps. Keeping that playing video is what
// lets Android keep the page alive with the athlete in another app. It must start inside the
// tap on a set's check (user gesture). If it can't open (unsupported, rejected, no gesture) the
// count carries on inside the app, without a visible error (the reason goes to console.info).
//
// There is NO <audio> here and no Media Session notification: a playing <audio> takes Android's
// audio focus and pauses the music app. The pre-alert and the alarm are short <audio> clips
// (services/audioService.js) that make the music duck and come back by itself.
//
// While the alarm sounds, closing the floating window (away from the app) silences it and
// releases everything. Everything lives in memory; nothing is written to storage.

const ALARM_CAP_MS = 30000;

let state = null; // { cleanup: [fn], getSnapshot, actions, alarming, pip: {...} | null }
const note = (msg) => console.info('[restBg]', msg);
export const bgAlarming = () => !!state?.alarming;

const bgSupport = () => ({
  pip: typeof document !== 'undefined' && !!document.pictureInPictureEnabled && typeof HTMLVideoElement !== 'undefined' && 'requestPictureInPicture' in HTMLVideoElement.prototype,
  captureStream: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
});

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// ── Release everything ───────────────────────────────────────────────────────────────
export const stopBackground = (finalNote = '') => {
  if (!state) return;
  const s = state;
  state = null;
  for (const fn of s.cleanup.slice().reverse()) { try { fn(); } catch { /* best effort */ } }
  if (finalNote) note(finalNote);
};

// ── Picture-in-Picture ───────────────────────────────────────────────────────────────
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

// Best effort. Must run inside the user gesture that started the rest (the tap on a set's check button).
const releasePip = (st, msg) => {
  const pip = st.pip;
  if (!pip) return;
  st.pip = null;
  for (const fn of pip.cleanup.slice().reverse()) { try { fn(); } catch { /* best effort */ } }
  if (msg && state === st) note(msg);
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
  // released); while counting it only drops the PiP (the timer carries on in the app).
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
      releasePip(st, `PiP cerrado (visibilityState=${vis}): la cuenta sigue dentro de la app.`);
    }
  };
  video.addEventListener('leavepictureinpicture', onLeave);
  pip.cleanup.push(() => video.removeEventListener('leavepictureinpicture', onLeave));
  pip.cleanup.push(() => { if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {}); });
  note(`PiP abierto (${autoNote}).`);
  return true;
};


// Entry point, called from the tap on a set's "complete". A rest that is still counting keeps
// its window; the next set only refreshes what it shows.
export const startBackground = async ({ getSnapshot, onStop, onDismiss }) => {
  if (state && !state.alarming) {
    state.getSnapshot = getSnapshot; state.actions = { onStop, onDismiss };
    note('PiP: descanso nuevo, la ventana sigue.');
    return !!state.pip;
  }
  stopBackground();
  const st = { cleanup: [], getSnapshot, actions: { onStop, onDismiss }, alarming: false, pip: null };
  state = st;
  st.cleanup.push(() => releasePip(st));
  const ok = await attachPip(st);
  if (!ok && state === st) stopBackground('PiP: la ventana no se abrió; la cuenta sigue dentro de la app.');
  return ok;
};

// ── Timer reached 0 ──────────────────────────────────────────────────────────────────
// The floating window flips to ¡FIN! at once. The sound (short <audio> clips) and the vibration
// are played by the timer itself; this only holds the window open for up to 30 s.
export const bgComplete = () => {
  if (!state) return;
  const st = state;
  st.alarming = true;
  st.pip?.draw();
  const cap = setTimeout(() => stopBackground('Ventana de fondo cerrada por el tope de 30 s.'), ALARM_CAP_MS);
  st.cleanup.push(() => clearTimeout(cap));
  note('fin del descanso: alarma de clips <audio> cortos (tope 30 s)');
};
