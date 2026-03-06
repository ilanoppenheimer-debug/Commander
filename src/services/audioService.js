export const playTacticalAlarm = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(0, ctx.currentTime + 0.11);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(0, ctx.currentTime + 0.31);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);

  } catch (e) {
    console.log("Audio no permitido", e);
  }
};