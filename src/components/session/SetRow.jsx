import { CheckCircle2, Circle, X as XIcon } from 'lucide-react';
import { formatNumber } from '../keypad/keypadConfig';

const TYPE_STYLES = {
  top:     'bg-amber-500/20 border-amber-500/50 text-amber-300',
  backoff: 'bg-slate-700/40 border-slate-600 text-slate-400',
  back:    'bg-slate-700/40 border-slate-600 text-slate-400',
  warmup:  'bg-slate-700/50 border-slate-500 text-slate-300',
  drop:    'bg-purple-500/25 border-purple-500 text-purple-300',
  amrap:   'bg-rose-500/25 border-rose-500 text-rose-300',
};

const TYPE_LABELS = {
  top: 'TOP', backoff: 'BACK', warmup: 'W', drop: 'DROP', amrap: 'AMRAP',
};

const hasRealValue = (v) => {
  const n = parseFloat(v);
  return !isNaN(n) && n > 0;
};

/**
 * SetRow — 56px tall.
 * Grid: [check 36px] [tag 52px] [weight 1fr] [reps 1fr] [rpe 52px] [del 32px]
 *
 * set.placeholder = { weight, reps, rpe } — historical top set, shown in muted italic
 *   when the real value is empty. Stripped by updateSetField on first keystroke.
 */
export const SetRow = ({ set, setIndex, onToggleCompleted, onTapField, onCycleType, onDelete, barUnit = 'kg' }) => {
  const isDone   = !!set?.completed;
  const type     = set?.type && set.type !== 'normal' ? set.type : null;
  const tagStyle = type ? (TYPE_STYLES[type] || TYPE_STYLES.warmup) : null;
  const tagLabel = type ? (TYPE_LABELS[type] || type.toUpperCase().slice(0, 4)) : null;
  const ph       = !isDone ? (set?.placeholder ?? null) : null;

  const fieldBtnClass = isDone
    ? 'bg-emerald-950/30 border border-emerald-800/30 cursor-pointer'
    : 'bg-slate-900/60 hover:bg-slate-900 active:bg-slate-800 border border-slate-800';

  const tapAreaClass = 'relative before:absolute before:inset-0 before:-my-1.5 before:content-[\'\']';

  // Renders a field cell with real → placeholder → empty fallback
  const renderField = (realVal, phVal, prefix = '') => {
    if (hasRealValue(realVal)) {
      return (
        <span className={isDone ? 'text-slate-500' : 'text-slate-100'}>
          {prefix}{formatNumber(realVal)}
        </span>
      );
    }
    if (!isDone && phVal && hasRealValue(phVal)) {
      return (
        <span className="text-slate-500 italic font-normal text-xs">
          {prefix}{formatNumber(phVal)}
        </span>
      );
    }
    return <span className="text-slate-700 font-normal">{prefix}—</span>;
  };

  // Blue accent bar when placeholder is active (all real values empty)
  const showPlaceholderHint =
    ph &&
    !hasRealValue(set?.weight) &&
    !hasRealValue(set?.reps) &&
    !isDone;

  return (
    <div
      className={`relative grid items-center gap-1 px-2 border-b border-slate-900/80 last:border-0 ${isDone ? 'bg-emerald-950/20' : ''}`}
      style={{ gridTemplateColumns: '36px 52px 1fr 1fr 52px 32px', height: '56px' }}
    >
      {/* Placeholder hint bar */}
      {showPlaceholderHint && (
        <div
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-blue-500/40"
          title="Mostrando tu top histórico como sugerencia"
        />
      )}

      {/* Check */}
      <button
        onClick={onToggleCompleted}
        className="flex items-center justify-center w-9 h-full rounded-lg active:scale-90 transition-transform"
        aria-label={isDone ? 'Desmarcar' : 'Completar'}
      >
        {isDone
          ? <CheckCircle2 size={24} className="text-emerald-400 stroke-2" />
          : (hasRealValue(set?.weight) || hasRealValue(set?.reps))
            ? <Circle size={24} className="text-slate-400 stroke-2 fill-slate-800" />
            : <Circle size={24} className="text-slate-600 stroke-2" />
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
        {renderField(set?.weight, ph?.weight)}
      </button>

      {/* Reps */}
      <button
        onClick={() => onTapField('reps')}
        className={`h-10 rounded-lg text-sm font-bold tabular-nums flex items-center justify-center transition-colors ${fieldBtnClass} ${tapAreaClass}`}
        aria-label="Editar reps"
      >
        {renderField(set?.reps, ph?.reps)}
      </button>

      {/* RPE */}
      <button
        onClick={() => onTapField('rpe')}
        className={`h-10 rounded-lg text-xs font-bold tabular-nums flex items-center justify-center transition-colors ${fieldBtnClass} ${tapAreaClass}`}
        aria-label="Editar RPE"
      >
        {renderField(set?.rpe, ph?.rpe, '@')}
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
