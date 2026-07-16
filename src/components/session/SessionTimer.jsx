import { useState, useEffect } from "react";

const formatElapsed = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// Isolated so its 1Hz tick doesn't re-render the rest of ActiveSession's tree
// (exercise list, modals) — display only, nothing persisted here.
export function SessionTimer({ startTime }) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    startTime ? Math.floor((Date.now() - new Date(startTime).getTime()) / 1000) : 0
  );

  useEffect(() => {
    if (!startTime) return;
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <span className="text-[11px] text-slate-500 font-mono leading-none shrink-0">
      {formatElapsed(elapsedSec)}
    </span>
  );
}
