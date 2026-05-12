import { ChevronRight } from 'lucide-react';
import { getExerciseDetails } from '../../features/exerciseMeta';

export const Exercise1RMCard = ({ exercise, barUnit, onClick }) => {
  const details = getExerciseDetails(exercise.name);

  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3 transition-colors text-left"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${details?.bg || 'bg-slate-800'} ${details?.color || 'text-slate-400'}`}>
        {details?.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-100 truncate">
          {exercise.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-slate-500">
            {exercise.sampleSize} {exercise.sampleSize === 1 ? 'set' : 'sets'}
          </span>
          <span className={`text-[10px] font-bold ${
            exercise.sampleSize < 3 ? 'text-amber-400' :
            exercise.sampleSize < 6 ? 'text-slate-400' :
            'text-emerald-400'
          }`}>
            · confianza {exercise.sampleSize < 3 ? 'baja' : exercise.sampleSize < 6 ? 'media' : 'alta'}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-xl font-black text-accent-500 tabular-nums">
          {Math.round(exercise.current1RM)}
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">
          {barUnit} 1RM
        </div>
      </div>

      <ChevronRight size={16} className="text-slate-600 shrink-0" />
    </button>
  );
};
