import { X } from 'lucide-react';

const FIELD_LABELS = { weight: 'Peso', reps: 'Reps', rpe: 'RPE' };

export const IncrementSelector = ({ field, equipment, options, currentSmall, currentLarge, target, onSelect, onClose }) => {
  const targetLabel = target === 'small' ? 'Chico' : 'Grande';
  const currentValue = target === 'small' ? currentSmall : currentLarge;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed bottom-28 left-4 right-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[61] max-w-sm mx-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
              Incremento {targetLabel}
            </div>
            <div className="text-sm text-slate-200 font-bold">
              {FIELD_LABELS[field] || field}
              {equipment && <span className="text-slate-500 font-normal"> · {equipment}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-3 grid grid-cols-3 gap-2">
          {(options || []).map(opt => (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              className={`py-3 rounded-xl font-bold tabular-nums text-sm transition-colors ${
                opt === currentValue
                  ? 'bg-accent-600 text-black'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              ±{opt}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
