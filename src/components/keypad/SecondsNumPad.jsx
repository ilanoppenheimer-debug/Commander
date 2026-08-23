import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { KeypadGrid } from './KeypadGrid';

const MAX_SECONDS = 3599; // ~59:59 — sane ceiling against a runaway digit mash, same idea as CustomNumPad's per-field MAX

/**
 * Single-field counterpart of CustomNumPad, for entering a hold's duration by hand
 * instead of running the timer. Reuses KeypadGrid as-is (digit grid, backspace,
 * confirm) rather than re-laying it out — KeypadDisplay/KeypadIncrements are not
 * reused because both are wired specifically to the weight/reps/rpe triplet
 * (field-switching, per-equipment increment presets) that doesn't apply here.
 */
export const SecondsNumPad = ({ open, onClose, initialValue, setIndex, onSave }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [animateIn,    setAnimateIn]    = useState(false);
  const [draft,        setDraft]        = useState('');

  useEffect(() => {
    let timer;
    if (open) {
      setDraft(initialValue != null && initialValue !== '' ? String(initialValue) : '');
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

  const handleDigit = (d) => {
    const next = draft + d;
    const num = parseInt(next, 10);
    if (!isNaN(num) && num > MAX_SECONDS) return;
    setDraft(next);
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const handleBackspace = () => {
    setDraft(draft.slice(0, -1));
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const handleClearField = () => setDraft('');

  const handleSave = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) onSave(String(n));
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
            <div className="text-sm font-bold text-slate-200">Tiempo (segundos)</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-1 text-slate-500 hover:text-slate-200 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-xl py-4 text-center bg-slate-900 border-2 border-accent-500 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]">
            <div className="text-[9px] uppercase tracking-widest font-bold text-accent-500">Segundos</div>
            <div className="text-3xl font-black tabular-nums mt-0.5 leading-none text-accent-400">
              {draft || '—'}
              <span className="inline-block w-px h-6 bg-accent-500 ml-0.5 animate-pulse align-middle" />
            </div>
          </div>
        </div>

        <KeypadGrid
          integerOnly
          onDigit={handleDigit}
          onDot={() => {}}
          onBackspace={handleBackspace}
          onClearField={handleClearField}
          onNext={handleSave}
          onSave={handleSave}
        />
      </div>
    </>,
    document.body
  );
};
