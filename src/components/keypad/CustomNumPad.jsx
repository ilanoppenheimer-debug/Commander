import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { KeypadDisplay } from './KeypadDisplay';
import { KeypadIncrements } from './KeypadIncrements';
import { KeypadGrid } from './KeypadGrid';
import { applyDelta, formatNumber } from './keypadConfig';

/**
 * Bottom-sheet numeric keypad for editing a set.
 *
 * Props:
 *   open, onClose, set, exerciseName, equipment, exerciseMeta, globalOverrides,
 *   activeField, setIndex (1-based), prevSet,
 *   onChange(field, value), onSave, onNext, onSwitchField, onChangeIncrement
 */
export const CustomNumPad = ({
  open,
  onClose,
  set,
  exerciseName,
  equipment,
  exerciseMeta,
  globalOverrides,
  activeField,
  setIndex,
  prevSet,
  onChange,
  onSave,
  onNext,
  onSwitchField,
  onChangeIncrement,
}) => {
  const [visible, setVisible] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (open) {
      // One-frame delay to let the element mount before starting the transition
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
    }
  }, [open]);

  // Scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Physical keyboard for desktop testing
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        const cur = String(set?.[activeField] ?? '');
        onChange(activeField, cur + e.key);
        e.preventDefault();
      } else if (e.key === '.' && (activeField === 'weight' || activeField === 'rpe')) {
        const cur = String(set?.[activeField] ?? '');
        if (!cur.includes('.')) onChange(activeField, (cur || '0') + '.');
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        const cur = String(set?.[activeField] ?? '');
        onChange(activeField, cur.slice(0, -1));
        e.preventDefault();
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        onNext();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, activeField, set, onChange, onNext, onClose]);

  const handleDigit = useCallback((d) => {
    const cur = String(set?.[activeField] ?? '');
    onChange(activeField, cur + d);
    if (navigator.vibrate) navigator.vibrate(12);
  }, [set, activeField, onChange]);

  const handleDot = useCallback(() => {
    if (activeField === 'reps') return;
    const cur = String(set?.[activeField] ?? '');
    if (cur.includes('.')) return;
    onChange(activeField, (cur || '0') + '.');
    if (navigator.vibrate) navigator.vibrate(12);
  }, [set, activeField, onChange]);

  const handleBackspace = useCallback(() => {
    const cur = String(set?.[activeField] ?? '');
    onChange(activeField, cur.slice(0, -1));
    if (navigator.vibrate) navigator.vibrate(12);
  }, [set, activeField, onChange]);

  const handleClearField = useCallback(() => {
    onChange(activeField, '');
  }, [activeField, onChange]);

  const handleIncrement = useCallback((delta) => {
    const newVal = applyDelta(set?.[activeField], delta, activeField);
    onChange(activeField, String(newVal));
    if (navigator.vibrate) navigator.vibrate(18);
  }, [set, activeField, onChange]);

  if (!open) return null;

  const tagLabel = set?.type && set.type !== 'normal' ? set.type.toUpperCase() : null;
  const prevText = prevSet
    ? `Anterior: ${formatNumber(prevSet.weight)} × ${prevSet.reps || '?'}${prevSet.rpe ? ` @ ${prevSet.rpe}` : ''}`
    : 'Primer set';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-[48] transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[49] bg-slate-950 border-t border-slate-800 rounded-t-2xl shadow-2xl transition-transform duration-200 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Context bar */}
        <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 leading-none">
              <span className="text-[9px] uppercase tracking-widest font-black text-accent-500">
                SET {setIndex}
              </span>
              {tagLabel && <span className="text-[9px] text-slate-500 uppercase">· {tagLabel}</span>}
            </div>
            <div className="text-sm font-bold text-slate-200 truncate mt-0.5">{exerciseName}</div>
            <div className="text-[10px] text-slate-500 truncate">{prevText}</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-1 text-slate-500 hover:text-slate-200 shrink-0">
            <X size={18} />
          </button>
        </div>

        <KeypadDisplay set={set} activeField={activeField} onSwitchField={onSwitchField} />

        <KeypadIncrements
          activeField={activeField}
          equipment={equipment}
          exerciseMeta={exerciseMeta}
          globalOverrides={globalOverrides}
          onIncrement={handleIncrement}
          onChangeIncrement={onChangeIncrement}
        />

        <KeypadGrid
          activeField={activeField}
          onDigit={handleDigit}
          onDot={handleDot}
          onBackspace={handleBackspace}
          onClearField={handleClearField}
          onNext={onNext}
          onSave={onSave}
        />
      </div>
    </>
  );
};
