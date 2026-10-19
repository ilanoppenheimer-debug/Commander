import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/**
 * Full-screen view of a timed set's hold, readable from the floor at 1-2 m: huge digits,
 * and the whole lower half of the screen is the stop button. It owns NO timing logic —
 * TimedSetRow keeps the state machine and the persistence, and `onStop` is the very same
 * function the row's ■ button calls (stop → pending value, cancel during the 5 s
 * countdown). Same look family as the rest timer's alert (slate/amber, black weights).
 */
export const TimedHoldOverlay = ({
  exerciseName, setIndex, phase, countdownLeft, elapsedSeconds, targetSeconds,
  mode, showToggle, onModeChange, onStop, onMinimize,
}) => {
  const target = Number(targetSeconds) > 0 ? Number(targetSeconds) : 0;
  const isCountdown = phase === 'countdown';
  const timerMode = mode === 'timer' && target > 0;
  const over = !isCountdown && timerMode && elapsedSeconds >= target;

  let badge, digits, digitsClass, sub = null, progress = null;
  if (isCountdown) {
    badge = 'Preparate'; digits = String(countdownLeft); digitsClass = 'text-[200px] text-sky-400';
    if (target) sub = `obj ${mmss(target)}`;
  } else if (timerMode) {
    if (over) {
      badge = 'Pasaste el objetivo'; digits = `+${mmss(elapsedSeconds - target)}`; digitsClass = 'text-[112px] text-orange-400';
      sub = `obj ${mmss(target)} · total ${mmss(elapsedSeconds)}`;
    } else {
      badge = 'Faltan'; digits = mmss(target - elapsedSeconds); digitsClass = 'text-[128px] text-white';
      sub = `obj ${mmss(target)}`;
      progress = Math.min(100, (elapsedSeconds / target) * 100);
    }
  } else {
    badge = 'Tiempo'; digits = mmss(elapsedSeconds); digitsClass = 'text-[128px] text-sky-400';
    if (target) sub = `obj ${mmss(target)}`;
  }

  return createPortal(
    <div
      role="dialog"
      aria-label="Hold en curso"
      className={`fixed inset-0 z-[130] flex flex-col text-white ${over ? 'bg-[#1c0f02]' : 'bg-slate-950'}`}
    >
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5">
        <div className="min-w-0 text-xs font-bold leading-snug text-slate-400">
          Set {setIndex}
          <span className="block truncate text-[15px] text-white">{exerciseName}</span>
        </div>
        <button
          onClick={onMinimize}
          aria-label="Minimizar"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-slate-300"
        >
          <ChevronDown size={16} /> Minimizar
        </button>
      </div>

      {showToggle && (
        <div className="mx-3.5 mt-3 flex h-11 overflow-hidden rounded-xl border border-slate-700" role="group" aria-label="Modo">
          {[['timer', 'Temporizador'], ['stopwatch', 'Cronómetro']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => onModeChange(value)}
              aria-pressed={mode === value}
              className={`flex-1 text-[13px] font-bold ${mode === value ? 'bg-sky-900 text-sky-300' : 'bg-slate-900 text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-2.5 text-center">
        <div className={`text-[15px] font-extrabold uppercase tracking-[0.14em] ${over ? 'text-orange-400' : isCountdown ? 'text-sky-400' : 'text-slate-400'}`}>{badge}</div>
        <div className={`font-mono font-black leading-none tracking-tighter tabular-nums ${digitsClass}`}>{digits}</div>
        {sub && <div className="font-mono text-[22px] font-bold text-slate-400">{sub}</div>}
        {progress != null && (
          <div className="h-2 w-[300px] max-w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-amber-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <button
        onClick={onStop}
        aria-label={isCountdown ? 'Cancelar timer' : 'Detener timer'}
        className={`mx-3.5 mb-3.5 flex h-1/2 flex-col items-center justify-center rounded-[22px] text-[44px] font-black tracking-wide text-white active:scale-[0.99] ${
          isCountdown ? 'bg-slate-700' : over ? 'bg-orange-600' : 'bg-red-600'
        }`}
      >
        {isCountdown ? 'CANCELAR' : 'DETENER'}
        {!isCountdown && <span className="text-[13px] font-semibold tracking-normal opacity-80">guarda {mmss(elapsedSeconds)}</span>}
      </button>
    </div>,
    document.body,
  );
};
