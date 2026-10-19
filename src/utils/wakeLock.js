// Screen Wake Lock shared by every feature that needs the screen to stay on while it runs
// (the rest timer, and the hold timer of a timed set). One browser lock is held while at
// least ONE owner needs it; it is dropped when the last owner releases. Chrome drops the
// lock by itself when the tab is hidden, so it is asked for again when the page becomes
// visible and somebody still holds it. Silently does nothing where the API doesn't exist.
const holders = new Set();
let sentinel = null;
let requesting = false;
let listening = false;

const drop = () => {
  const s = sentinel;
  sentinel = null;
  if (s) { try { Promise.resolve(s.release()).catch(() => {}); } catch { /* ignore */ } }
};

const ensure = async () => {
  if (holders.size === 0 || sentinel || requesting) return;
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  requesting = true;
  try {
    const s = await navigator.wakeLock.request('screen');
    if (holders.size === 0) { try { Promise.resolve(s.release()).catch(() => {}); } catch { /* ignore */ } return; } // everyone left while asking
    sentinel = s;
    console.info('[wakeLock] acquired');
    s.addEventListener?.('release', () => {
      if (sentinel === s) sentinel = null;
      console.info('[wakeLock] released');
    });
  } catch { /* denied / unsupported: not worth breaking a timer */ } finally {
    requesting = false;
  }
};

const listen = () => {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ensure(); });
};

export const acquireWakeLock = (owner) => { holders.add(owner); listen(); ensure(); };

export const releaseWakeLock = (owner) => {
  holders.delete(owner);
  if (holders.size === 0) drop();
};

// A session ending (finish / discard / start) drops every owner at once.
export const releaseAllWakeLocks = () => { holders.clear(); drop(); };
