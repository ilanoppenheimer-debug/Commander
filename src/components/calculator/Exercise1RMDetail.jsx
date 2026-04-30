import { useState } from 'react';
import { ArrowLeft, TrendingUp, Calculator } from 'lucide-react';
import { computeExercise1RM } from '../../utils/strengthMath';
import TrendModal from '../modals/TrendModal';

export const Exercise1RMDetail = ({ exerciseName, history, timeframe, barUnit, onBack, onCalcRequest }) => {
  const [showTrend, setShowTrend] = useState(false);

  const data = computeExercise1RM(exerciseName, history, { weeksBack: timeframe?.weeks });

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <div className="text-sm font-bold uppercase tracking-wider text-slate-200 truncate">
          {exerciseName}
        </div>
      </div>

      {data.current1RM === null ? (
        <div className="bg-slate-900/50 rounded-xl p-6 text-center text-slate-500 text-sm">
          No hay sets predictivos en este período. Probá con un timeframe más amplio.
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-accent-900/30 to-slate-900 border border-accent-500/30 rounded-2xl p-6 text-center">
            <div className="text-[10px] uppercase tracking-widest text-accent-400 mb-2">
              1RM Estimado
            </div>
            <div className="text-5xl font-black text-accent-500 tabular-nums leading-none">
              {Math.round(data.current1RM)}
              <span className="text-lg text-slate-400 ml-2">{barUnit}</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Basado en {data.sampleSize} {data.sampleSize === 1 ? 'set' : 'sets'} · {timeframe?.label || 'todo el historial'}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 px-1">
              Sets que generaron este 1RM
            </div>
            <div className="space-y-2">
              {data.topSets.map((set, idx) => (
                <div
                  key={`${set._sessionId}-${idx}`}
                  className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm text-slate-200">
                      <span className="tabular-nums font-medium">{set.weight}</span>{barUnit}
                      {' × '}
                      <span className="tabular-nums font-medium">{set.reps}</span>
                      {set.rpe ? (
                        <span className="text-slate-500"> @ RPE {set.rpe}</span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {formatDate(set._date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent-500 tabular-nums">
                      {Math.round(set._est1RM)}
                    </div>
                    <div className="text-[8px] text-slate-600 uppercase">
                      {barUnit} est.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => setShowTrend(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-slate-200 transition-colors"
            >
              <TrendingUp size={16} />
              Ver evolución
            </button>

            <button
              onClick={() => onCalcRequest(exerciseName, data.current1RM)}
              className="w-full bg-accent-600 hover:bg-accent-500 text-black rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors"
            >
              <Calculator size={16} />
              Calcular series de trabajo
            </button>
          </div>
        </>
      )}

      {showTrend && (
        <TrendModal
          exName={exerciseName}
          history={history}
          barUnit={barUnit}
          onClose={() => setShowTrend(false)}
        />
      )}
    </div>
  );
};
