import { useState, useMemo } from 'react';
import { computeAll1RMs } from '../../utils/strengthMath';
import { Exercise1RMCard } from './Exercise1RMCard';
import { Exercise1RMDetail } from './Exercise1RMDetail';
import { TimeframeSelector } from './TimeframeSelector';

const TIMEFRAMES = [
  { id: '6w',  label: '6 sem',  weeks: 6  },
  { id: '12w', label: '12 sem', weeks: 12 },
  { id: 'all', label: 'Todo',   weeks: null },
];

export const Mode1List = ({ history, barUnit, onCalcRequest }) => {
  const [timeframe, setTimeframe]           = useState('12w');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');

  const tf = TIMEFRAMES.find(t => t.id === timeframe);

  const all1RMs = useMemo(
    () => computeAll1RMs(history, { weeksBack: tf?.weeks }),
    [history, tf?.weeks]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all1RMs;
    return all1RMs.filter(e => e.name.toLowerCase().includes(q));
  }, [all1RMs, searchQuery]);

  if (selectedExercise) {
    return (
      <Exercise1RMDetail
        exerciseName={selectedExercise.name}
        history={history}
        timeframe={tf}
        barUnit={barUnit}
        onBack={() => setSelectedExercise(null)}
        onCalcRequest={onCalcRequest}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      <TimeframeSelector
        options={TIMEFRAMES}
        value={timeframe}
        onChange={setTimeframe}
      />

      <input
        type="search"
        placeholder="Buscar ejercicio..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent-500 focus:outline-none"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {!Array.isArray(history) || history.length === 0
            ? 'Aún no tenés sesiones registradas. Hacé al menos una para ver tus 1RM estimados.'
            : 'No hay ejercicios con suficiente data para estimar 1RM en este período.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ex => (
            <Exercise1RMCard
              key={ex.name}
              exercise={ex}
              barUnit={barUnit}
              onClick={() => setSelectedExercise(ex)}
            />
          ))}
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-center pt-4 pb-2">
        Estimaciones basadas en tabla RPE (RTS/Tuchscherer) o Epley si no hay RPE.
        Excluye sets &lt; 50% del peso máximo, RPE &lt; 6 y reps &gt; 12.
      </div>
    </div>
  );
};
