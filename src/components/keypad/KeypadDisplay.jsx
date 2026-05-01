import { formatNumber } from './keypadConfig';

const FIELD_LABELS = { weight: 'KG', reps: 'REPS', rpe: 'RPE' };

export const KeypadDisplay = ({ set, activeField, onSwitchField }) => (
  <div className="grid grid-cols-3 gap-2 px-4 py-3">
    {['weight', 'reps', 'rpe'].map(field => {
      const isActive = field === activeField;
      const raw = set?.[field];
      const displayValue = isActive ? String(raw ?? '') : formatNumber(raw);

      return (
        <button
          key={field}
          onClick={() => onSwitchField(field)}
          className={`rounded-xl py-3 transition-all text-center ${
            isActive
              ? 'bg-slate-900 border-2 border-accent-500 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
              : 'bg-slate-900/60 border border-slate-800'
          }`}
        >
          <div className={`text-[9px] uppercase tracking-widest font-bold ${isActive ? 'text-accent-500' : 'text-slate-500'}`}>
            {FIELD_LABELS[field]}
          </div>
          <div className={`text-2xl font-black tabular-nums mt-0.5 leading-none ${isActive ? 'text-accent-400' : 'text-slate-300'}`}>
            {displayValue || '—'}
            {isActive && (
              <span className="inline-block w-px h-5 bg-accent-500 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        </button>
      );
    })}
  </div>
);
