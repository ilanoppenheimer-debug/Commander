import { CheckCircle2, Circle, X as XIcon } from 'lucide-react';
import { formatNumber } from '../keypad/keypadConfig';

const TYPE_STYLES = {
  top:     'bg-accent-500/25 border-accent-500 text-accent-300',
  backoff: 'bg-blue-500/25 border-blue-500 text-blue-300',
  warmup:  'bg-slate-700/50 border-slate-500 text-slate-300',
  drop:    'bg-purple-500/25 border-purple-500 text-purple-300',
  amrap:   'bg-rose-500/25 border-rose-500 text-rose-300',
};

const TYPE_LABELS = {
  top: 'TOP', backoff: 'BACK', warmup: 'W', drop: 'DROP', amrap: 'AMRAP',
};

/**
 * SetRow — 56px tall.
 * Grid: [check 36px] [tag 52px] [weight 1fr] [reps 1fr] [rpe 52px] [del 32px]
 */
export const SetRow = ({ set, setIndex, onToggleCompleted, onTapField, onCycleType, onDelete, barUnit = 'kg' }) => {
  const isDone   = !!set?.completed;
  const type     = set?.type && set.type !== 'normal' ? set.type : null;
  const tagStyle = type ? (TYPE_STYLES[type] || TYPE_STYLES.warmup) : null;
  const tagLabel = type ? (TYPE_LABELS[type] || type.toUpperCase().slice(0, 4)) : null;

  // Bug 4: show guion for empty/zero values
  const wNum = parseFloat(set?.weight);
  const rNum = parseInt(set?.reps, 10);
  const eNum = parseFloat(set?.rpe);
  const weightDisplay = (!isNaN(wNum) && wNum > 0) ? formatNumber(set.weight) : null;
  const repsDisplay   = (!isNaN(rNum) && rNum > 0) ? formatNumber(set.reps)   : null;
  const rpeDisplay    = (!isNaN(eNum) && eNum > 0) ? String(set.rpe)          : null;

  // Bug 1.3: completed sets still tappeable — use color changes not line-through/opacity
  const fieldBtnClass = isDone
    ? 'bg-emerald-950/30 border border-emerald-800/30 cursor-pointer'
    : 'bg-slate-900/60 hover:bg-slate-900 active:bg-slate-800 border border-slate-800';

  const valueClass = isDone ? 'text-slate-500' : 'text-slate-100';
  const emptyClass = 'text-slate-700 font-normal';

  // Bug 1.4: extended tap area via pseudo-element trick (before absolute overlay)
  const tapAreaClass = 'relative before:absolute before:inset-0 before:-my-1.5 before:content-[\'\']';

  return (
    <div
      className={`grid items-center gap-1 px-2 border-b border-slate-900/80 last:border-0 ${isDone ? 'bg-emerald-950/20' : ''}`}
      style={{ gridTemplateColumns: '36px 52px 1fr 1fr 52px 32px', height: '56px' }}
    >
      {/* Check */}
      <button
        onClick={onToggleCompleted}
        className="flex items-center justify-center w-9 h-full rounded-lg active:scale-90 transition-transform"
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
        className="flex items-center justify-center h-full rounded-lg active:scale-95 transition-colors"
        aria-label="Cambiar tipo de set"
      >
        {tagLabel
          ? <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${tagStyle}`}>{tagLabel}</span>
          : <span className="text-[11px] text-slate-600 font-bold">{setIndex}</span>
        }
      </button>

      {/* Weight */}
      <button
        onClick={() => onTapField('weight')}
        className={`h-10 rounded-lg text-sm font-bold tabular-nums flex items-center justify-center transition-colors ${fieldBtnClass} ${tapAreaClass}`}
        aria-label="Editar peso"
      >
        {weightDisplay !== null
          ? <span className={valueClass}>{weightDisplay}</span>
          : <span className={emptyClass}>—</span>
        }
      </button>

      {/* Reps */}
      <button
        onClick={() => onTapField('reps')}
        className={`h-10 rounded-lg text-sm font-bold tabular-nums flex items-center justify-center transition-colors ${fieldBtnClass} ${tapAreaClass}`}
        aria-label="Editar reps"
      >
        {repsDisplay !== null
          ? <span className={valueClass}>{repsDisplay}</span>
          : <span className={emptyClass}>—</span>
        }
      </button>

      {/* RPE */}
      <button
        onClick={() => onTapField('rpe')}
        className={`h-10 rounded-lg text-xs font-bold tabular-nums flex items-center justify-center transition-colors ${fieldBtnClass} ${tapAreaClass}`}
        aria-label="Editar RPE"
      >
        {rpeDisplay !== null
          ? <span className={valueClass}>@{rpeDisplay}</span>
          : <span className={emptyClass}>@—</span>
        }
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex items-center justify-center w-8 h-full text-slate-600 hover:text-red-400 active:scale-90 transition-colors"
        aria-label="Eliminar serie"
      >
        <XIcon size={15} />
      </button>
    </div>
  );
};
