import { useState, useEffect, useMemo } from 'react';
import { computeExercise1RM, estimate1RM } from '../../utils/strengthMath';
import { ExerciseSearchInput } from './ExerciseSearchInput';
import { WorkSetsTable } from './WorkSetsTable';

export const Mode2Calc = ({ history, barUnit, preselectedExercise, preselected1RM, onClearPreselection }) => {
  const [exerciseName, setExerciseName] = useState(preselectedExercise || '');
  const [weight, setWeight] = useState('');
  const [reps,   setReps]   = useState('');
  const [rpe,    setRpe]    = useState('');

  // Autocompletar con top set al recibir preselección
  useEffect(() => {
    if (preselectedExercise) {
      setExerciseName(preselectedExercise);
      const data = computeExercise1RM(preselectedExercise, history, { weeksBack: 12 });
      const topSet = data?.topSets?.[0];
      if (topSet) {
        setWeight(String(topSet.weight ?? ''));
        setReps(String(topSet.reps ?? ''));
        setRpe(topSet.rpe ? String(topSet.rpe) : '');
      }
    }
  }, [preselectedExercise]); // eslint-disable-line react-hooks/exhaustive-deps

  const computed1RM = useMemo(
    () => estimate1RM(weight, reps, rpe !== '' ? rpe : null),
    [weight, reps, rpe]
  );

  const usingEpley = computed1RM !== null && rpe === '';

  const handleExerciseChange = (name) => {
    setExerciseName(name);
    if (onClearPreselection) onClearPreselection();

    if (!name) {
      setWeight('');
      setReps('');
      setRpe('');
      return;
    }

    const data = computeExercise1RM(name, history, { weeksBack: 12 });
    const topSet = data?.topSets?.[0];
    if (topSet) {
      setWeight(String(topSet.weight ?? ''));
      setReps(String(topSet.reps ?? ''));
      setRpe(topSet.rpe ? String(topSet.rpe) : '');
    }
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Selector de ejercicio */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">
          Ejercicio
        </label>
        <ExerciseSearchInput
          value={exerciseName}
          onChange={handleExerciseChange}
          history={history}
        />
      </div>

      {/* Inputs del set */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: `Peso (${barUnit})`, value: weight, setter: setWeight, placeholder: '100', step: '0.5', inputMode: 'decimal' },
          { label: 'Reps',             value: reps,   setter: setReps,   placeholder: '5',   step: '1',   inputMode: 'numeric' },
          { label: 'RPE (opcional)',   value: rpe,    setter: setRpe,    placeholder: '—',   step: '0.5', inputMode: 'decimal' },
        ].map(({ label, value, setter, placeholder, step, inputMode }) => (
          <div key={label}>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block leading-tight">
              {label}
            </label>
            <input
              type="number"
              step={step}
              inputMode={inputMode}
              value={value}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2.5 text-center text-lg font-bold tabular-nums text-slate-100 focus:border-accent-500 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {/* 1RM calculado */}
      {computed1RM !== null && computed1RM > 0 && (
        <div className="bg-gradient-to-br from-accent-900/30 to-slate-900 border border-accent-500/30 rounded-2xl p-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-accent-400 mb-1">
            1RM estimado
          </div>
          <div className="text-4xl font-black text-accent-500 tabular-nums leading-none">
            {Math.round(computed1RM)}
            <span className="text-base text-slate-400 ml-2">{barUnit}</span>
          </div>
          {usingEpley && (
            <div className="text-[9px] text-amber-400/80 mt-2">
              Usando Epley (sin RPE). Más preciso con RPE registrado.
            </div>
          )}
        </div>
      )}

      {/* Tabla de series de trabajo */}
      {computed1RM !== null && computed1RM > 0 && (
        <WorkSetsTable oneRM={computed1RM} barUnit={barUnit} />
      )}
    </div>
  );
};
