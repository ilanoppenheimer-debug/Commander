import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { KeypadDisplay } from './KeypadDisplay';
import { KeypadIncrements } from './KeypadIncrements';
import { KeypadGrid } from './KeypadGrid';
import { applyDelta, formatNumber } from './keypadConfig';

const MAX = { weight: 999, reps: 99, rpe: 10 };

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
  // shouldRender controls DOM mount/unmount (delayed unmount for exit animation)
  // animateIn controls CSS transition state
  const [shouldRender, setShouldRender] = useState(false);
  const [animateIn,    setAnimateIn]    = useState(false);

  useEffect(() => {
    let timer;
    if (open) {
      setShouldRender(true);
      // 10ms after mount: trigger CSS transition in
      timer = setTimeout(() => setAnimateIn(true), 10);
    } else {
      setAnimateIn(false);
      // Wait for exit animation (200ms) before unmounting
      timer = setTimeout(() => setShouldRender(false), 220);
    }
    return () => clearTimeout(timer);
  }, [open]);

  // Notify AdvancedTimer to hide its floating button
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('iron-cmdr:keypad-opened'));
      return () => window.dispatchEvent(new CustomEvent('iron-cmdr:keypad-closed'));
    }
  }, [open]);

  // Scroll lock tied to shouldRender so it covers the exit animation window too
  useEffect(() => {
    if (!shouldRender) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [shouldRender]);

  // Physical keyboard (desktop)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        const cur = String(set?.[activeField] ?? '');
        const next = cur + e.key;
        const num = parseFloat(next);
        if (!isNaN(num) && num > MAX[activeField]) return;
        onChange(activeField, next);
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
    const next = cur + d;
    const num = parseFloat(next);
    if (!isNaN(num) && num > MAX[activeField]) return;
    onChange(activeField, next);
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

  // Never render without the sheet — both backdrop and sheet are always together
  if (!shouldRender) return null;

  const tagLabel = set?.type && set.type !== 'normal' ? set.type.toUpperCase() : null;
  const prevText = prevSet
    ? `Anterior: ${formatNumber(prevSet.weight)} × ${prevSet.reps || '?'}${prevSet.rpe ? ` @ ${prevSet.rpe}` : ''}`
    : 'Primer set';

  return (
    <>
      {/* Backdrop — inline style so opacity-0/100 controls the whole element */}
      <div
        className={`fixed inset-0 z-[48] transition-opacity duration-200`}
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          opacity: animateIn ? 1 : 0,
          pointerEvents: animateIn ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sheet — always rendered when shouldRender=true */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[49] bg-slate-950 border-t border-slate-800 rounded-t-2xl shadow-2xl transition-transform duration-200 ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Context bar */}
        <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 leading-none">
              <span className="text-[9px] uppercase tracking-widest font-black text-accent-500">SET {setIndex}</span>
              {tagLabel && <span className="text-[9px] text-slate-500 uppercase">· {tagLabel}</span>}
            </div>
            <div className="text-sm font-bold text-slate-200 truncate mt-0.5">
              {exerciseName || <span className="text-slate-600">—</span>}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{prevText}</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-1 text-slate-500 hover:text-slate-200 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Content — always rendered (no internal null returns) */}
        {set ? (
          <>
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
          </>
        ) : (
          <div className="p-8 text-center text-slate-600 text-sm">Sin datos del set</div>
        )}
      </div>
    </>
  );
};
