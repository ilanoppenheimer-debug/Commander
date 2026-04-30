import { useState } from 'react';
import { Mode1List } from './calculator/Mode1List';
import { Mode2Calc } from './calculator/Mode2Calc';

export default function StrengthCalculator({ history, barUnit = 'kg' }) {
  const [mode, setMode] = useState('list');
  const [preselectedExercise, setPreselectedExercise] = useState(null);
  const [preselected1RM,      setPreselected1RM]      = useState(null);

  const switchToCalc = (exerciseName, oneRM) => {
    setPreselectedExercise(exerciseName);
    setPreselected1RM(oneRM);
    setMode('calc');
  };

  return (
    <div className="animate-fade-in">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4 bg-slate-900 p-1 rounded-xl border border-slate-800">
        {[
          { id: 'list', label: 'Mis 1RM' },
          { id: 'calc', label: 'Calculadora' },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${
              mode === m.id
                ? 'bg-accent-600 text-black shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'list' ? (
        <Mode1List
          history={history}
          barUnit={barUnit}
          onCalcRequest={switchToCalc}
        />
      ) : (
        <Mode2Calc
          history={history}
          barUnit={barUnit}
          preselectedExercise={preselectedExercise}
          preselected1RM={preselected1RM}
          onClearPreselection={() => {
            setPreselectedExercise(null);
            setPreselected1RM(null);
          }}
        />
      )}
    </div>
  );
}
