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

export const playTacticalAlarm = () => {
  try {
    const ctx = getCtx();
    if (ctx) {
      const t = ctx.currentTime;
      beep(ctx, 660,  t,        0.15, 0.3);
      beep(ctx, 880,  t + 0.25, 0.15, 0.3);
      beep(ctx, 1100, t + 0.50, 0.4,  0.4);
    }
    if (navigator.vibrate) navigator.vibrate([150, 100, 150, 100, 400]);
  } catch (e) {
    console.warn('Audio failed:', e);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  }
};

export const playPreAlert = () => {
  try {
    const ctx = getCtx();
    if (ctx) beep(ctx, 440, ctx.currentTime, 0.15, 0.15);
    if (navigator.vibrate) navigator.vibrate(80);
  } catch {}
};
