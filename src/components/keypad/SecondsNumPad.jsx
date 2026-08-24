import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { KeypadGrid } from './KeypadGrid';

const MAX_MINUTES = 59; // ~59:59 total — sane ceiling against a runaway digit mash, same idea as CustomNumPad's per-field MAX
const MAX_SECONDS = 3599;

const UNIT_PREF_KEY = 'ironcmdr_seconds_pad_unit';
const getRememberedUnit = () => {
  try { return localStorage.getItem(UNIT_PREF_KEY) === 'min' ? 'min' : 's'; } catch { return 's'; }
};
const rememberUnit = (unit) => {
  try { localStorage.setItem(UNIT_PREF_KEY, unit); } catch {}
};

/**
 * Single-field counterpart of CustomNumPad, for entering a hold's duration by hand
 * instead of running the timer (or correcting one already confirmed). Reuses
 * KeypadGrid as-is (digit grid, backspace, confirm) rather than re-laying it out —
 * KeypadDisplay/KeypadIncrements are not reused because both are wired specifically
 * to the weight/reps/rpe triplet (field-switching, per-equipment increment presets)
 * that doesn't apply here. No `onNext` is passed to KeypadGrid — its "SIG →" button
 * is for jumping to the next of several fields, and there's only one here; KeypadGrid
 * already renders that button inert (no onClick) when onNext is omitted, since it's
 * shared layout with CustomNumPad's 3-field flow and isn't ours to remove.
 *
 * Segundos/Minutos toggle: `initialValue` is always raw seconds (the only unit the
 * data model ever stores or reads elsewhere — reports/export/blockReport are
 * untouched by this). When editing an existing value, the toggle always starts on
 * Segundos and pre-fills the exact stored number, so correcting a value never shows
 * a lossily-rounded minutes conversion. For a fresh entry (no initialValue), it
 * starts on whichever unit was last used (remembered in localStorage, default
 * Segundos) — a rest-hold athlete typing "20" every time shouldn't have to re-tap
 * the toggle every set. Switching units mid-entry clears the draft rather than
 * trying to convert partially-typed digits.
 */
export const SecondsNumPad = ({ open, onClose, initialValue, setIndex, onSave }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [animateIn,    setAnimateIn]    = useState(false);
  const [draft,        setDraft]        = useState('');
  const [unit,         setUnit]         = useState('s');

  useEffect(() => {
    let timer;
    if (open) {
      const hasInitial = initialValue != null && initialValue !== '';
      setUnit(hasInitial ? 's' : getRememberedUnit());
      setDraft(hasInitial ? String(initialValue) : '');
      setShouldRender(true);
      timer = setTimeout(() => setAnimateIn(true), 10);
    } else {
      setAnimateIn(false);
      timer = setTimeout(() => setShouldRender(false), 220);
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!shouldRender) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [shouldRender]);

  const maxForUnit = unit === 'min' ? MAX_MINUTES : MAX_SECONDS;

  const handleDigit = (d) => {
    const next = draft + d;
    const num = parseInt(next, 10);
    if (!isNaN(num) && num > maxForUnit) return;
    setDraft(next);
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const handleBackspace = () => {
    setDraft(draft.slice(0, -1));
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const handleClearField = () => setDraft('');

  const handleSwitchUnit = (next) => {
    if (next === unit) return;
    setUnit(next);
    setDraft('');
  };

  const handleSave = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) {
      const totalSeconds = unit === 'min' ? n * 60 : n;
      onSave(String(totalSeconds));
      rememberUnit(unit);
    }
    onClose();
  };

  if (!shouldRender) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[48] transition-opacity duration-200"
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          opacity: animateIn ? 1 : 0,
          pointerEvents: animateIn ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      <div
        className={`fixed bottom-0 left-0 right-0 z-[49] bg-slate-950 border-t border-slate-800 rounded-t-2xl shadow-2xl transition-transform duration-200 ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-[9px] uppercase tracking-widest font-black text-accent-500">SET {setIndex}</span>
            <div className="text-sm font-bold text-slate-200">Tiempo</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-1 text-slate-500 hover:text-slate-200 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-4 pb-2">
          <div className="rounded-xl py-4 text-center bg-slate-900 border-2 border-accent-500 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]">
            <div className="text-[9px] uppercase tracking-widest font-bold text-accent-500">
              {unit === 'min' ? 'Minutos' : 'Segundos'}
            </div>
            <div className="text-3xl font-black tabular-nums mt-0.5 leading-none text-accent-400">
              {draft || '—'}
              <span className="inline-block w-px h-6 bg-accent-500 ml-0.5 animate-pulse align-middle" />
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 flex gap-2">
          <button
            onClick={() => handleSwitchUnit('s')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
              unit === 's' ? 'bg-accent-600 text-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Segundos
          </button>
          <button
            onClick={() => handleSwitchUnit('min')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
              unit === 'min' ? 'bg-accent-600 text-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Minutos
          </button>
        </div>

        <KeypadGrid
          integerOnly
          onDigit={handleDigit}
          onDot={() => {}}
          onBackspace={handleBackspace}
          onClearField={handleClearField}
          onSave={handleSave}
        />
      </div>
    </>,
    document.body
  );
};
