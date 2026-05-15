import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { TAG_OPTIONS, TAG_LABELS, TAG_DESCRIPTIONS } from '../../constants/blockTemplates';

export const TagPicker = ({ value, onChange, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[58]"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[59] bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex items-center justify-between shrink-0 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Tipo de ejercicio
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 min-h-0">
          {TAG_OPTIONS.map(tag => {
            const isSelected = value === tag;
            return (
              <button
                key={tag}
                onClick={() => { onChange(tag); onClose?.(); }}
                className={`w-full px-3 py-3 text-left rounded-xl transition-colors active:scale-[0.98] ${
                  isSelected
                    ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <div className="text-sm font-bold">{TAG_LABELS[tag]}</div>
                <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  {TAG_DESCRIPTIONS[tag]}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
};
