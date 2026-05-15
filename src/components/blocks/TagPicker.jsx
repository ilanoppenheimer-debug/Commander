import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TAG_OPTIONS, TAG_LABELS, TAG_DESCRIPTIONS } from '../../constants/blockTemplates';

export const TagPicker = ({ value, onChange, onClose, anchorEl }) => {
  const popoverRef = useRef(null);
  const [openUp, setOpenUp] = useState(false);

  // Determine whether to open upward based on available space below
  useEffect(() => {
    const anchor = anchorEl || popoverRef.current?.previousElementSibling;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUp(spaceBelow < 320);
  }, [anchorEl]);

  // Close on outside click/touch
  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    // defer so the opening click doesn't immediately close
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  const positionClass = openUp ? 'bottom-full mb-1' : 'top-full mt-1';

  return (
    <div
      ref={popoverRef}
      className={`absolute left-0 ${positionClass} bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl z-[60] min-w-[220px]`}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Tipo de ejercicio</div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white p-0.5">
            <X size={12} />
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {TAG_OPTIONS.map(tag => (
          <button
            key={tag}
            onClick={() => { onChange(tag); onClose?.(); }}
            className={`w-full px-3 py-2 text-left rounded-lg transition-colors ${
              value === tag
                ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
                : 'hover:bg-slate-800 text-slate-300 border border-transparent'
            }`}
          >
            <div className="text-sm font-medium">{TAG_LABELS[tag]}</div>
            <div className="text-[10px] text-slate-500 leading-tight">{TAG_DESCRIPTIONS[tag]}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
