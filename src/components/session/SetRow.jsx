import { CheckCircle2, Circle, X as XIcon } from 'lucide-react';
import { formatNumber } from '../keypad/keypadConfig';

// Matches SET_TYPES from gymConstants
const TYPE_STYLES = {
  top:      'bg-amber-500/20 border-amber-500/50 text-amber-400',
  backoff:  'bg-blue-500/20 border-blue-500/50 text-blue-400',
  warmup:   'bg-slate-700/50 border-slate-600 text-slate-400',
  drop:     'bg-purple-500/20 border-purple-500/50 text-purple-400',
  amrap:    'bg-rose-500/20 border-rose-500/50 text-rose-400',
};

const TYPE_LABELS = {
  top: 'TOP', backoff: 'BACK', warmup: 'W', drop: 'DROP', amrap: 'AMRAP',
};

/**
 * SetRow — 56px tall.
 * Grid: [check 36px] [tag 52px] [weight 1fr] [reps 1fr] [rpe 52px] [del 32px]
 */
export const SetRow = ({ set, setIndex, onToggleCompleted, onTapField, onCycleType, onDelete, barUnit = 'kg' }) => {
  const isDone  = !!set?.completed;
  const type    = set?.type && set.type !== 'normal' ? set.type : null;
  const tagStyle = type ? (TYPE_STYLES[type] || TYPE_STYLES.warmup) : null;
  const tagLabel = type ? (TYPE_LABELS[type] || type.toUpperCase().slice(0, 4)) : null;

  const weight = formatNumber(set?.weight) || '—';
  const reps   = formatNumber(set?.reps)   || '—';
  const rpe    = set?.rpe ? String(set.rpe) : '—';

  const muted  = isDone ? 'opacity-50' : '';
  const strike = isDone ? 'line-through' : '';

  const fieldBtn = (field, value, extraClass = '') => (
    <button
      onClick={() => !isDone && onTapField(field)}
      className={`h-10 rounded-lg text-sm font-bold tabular-nums transition-colors flex items-center justify-center
        ${isDone ? 'bg-slate-900/30 text-slate-500 cursor-default' : 'bg-slate-900/60 hover:bg-slate-900 active:bg-slate-800 border border-slate-800 text-slate-100'}
        ${muted} ${strike} ${extraClass}`}
    >
      {value}
    </button>
  );

  return (
    <div
      className={`grid items-center gap-1 px-2 border-b border-slate-900/80 last:border-0 ${isDone ? 'bg-emerald-950/20' : ''}`}
      style={{ gridTemplateColumns: '36px 52px 1fr 1fr 52px 32px', height: '56px' }}
    >
      {/* Check */}
      <button
        onClick={onToggleCompleted}
        className="flex items-center justify-center w-9 h-10 rounded-lg active:scale-90 transition-transform"
        aria-label={isDone ? 'Desmarcar' : 'Completar'}
      >
        {isDone
          ? <CheckCircle2 size={21} className="text-emerald-400" />
          : <Circle      size={21} className="text-slate-600" />
        }
      </button>

      {/* Tag / set number */}
      <button
        onClick={onCycleType}
        className="flex items-center justify-center h-10 rounded-lg transition-colors active:scale-95"
        aria-label="Cambiar tipo de set"
      >
        {tagLabel
          ? <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${tagStyle}`}>{tagLabel}</span>
          : <span className="text-[11px] text-slate-600 font-bold">{setIndex}</span>
        }
      </button>

      {/* Weight */}
      {fieldBtn('weight', weight)}

      {/* Reps */}
      {fieldBtn('reps', reps)}

      {/* RPE */}
      {fieldBtn('rpe', `@${rpe}`, 'text-xs')}

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex items-center justify-center w-8 h-10 text-slate-600 hover:text-red-400 active:scale-90 transition-colors"
        aria-label="Eliminar serie"
      >
        <XIcon size={15} />
      </button>
    </div>
  );
};
