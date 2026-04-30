import { calcWorkWeight } from '../../utils/strengthMath';

const REPS_RANGES = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const RPE_RANGES = [7, 7.5, 8, 8.5, 9, 9.5, 10];

export const WorkSetsTable = ({ oneRM, barUnit }) => {
  const formatWeight = (w) => {
    if (!w || isNaN(w) || w <= 0) return '—';
    const rounded = Math.round(w / 2.5) * 2.5;
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 px-1">
        Series de trabajo (peso en {barUnit})
      </div>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2 px-2 text-slate-500 font-bold sticky left-0 bg-slate-950 w-10">
                Reps
              </th>
              {RPE_RANGES.map(rpe => (
                <th key={rpe} className="text-center py-2 px-1 text-slate-500 font-normal min-w-[42px]">
                  @{rpe}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REPS_RANGES.map((reps, rowIdx) => (
              <tr key={reps} className={rowIdx % 2 === 0 ? 'bg-slate-950/40' : ''}>
                <td className="py-2 px-2 text-slate-400 sticky left-0 bg-slate-950 font-bold border-r border-slate-800/50">
                  {reps}
                </td>
                {RPE_RANGES.map(rpe => {
                  const w = calcWorkWeight(oneRM, reps, rpe);
                  return (
                    <td key={rpe} className="text-center py-2 px-1 tabular-nums text-slate-200">
                      {formatWeight(w)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[9px] text-slate-600 text-center mt-2 px-2">
        Filas = repeticiones · Columnas = RPE objetivo. Pesos redondeados a múltiplos de 2.5 {barUnit}.
      </div>
    </div>
  );
};
