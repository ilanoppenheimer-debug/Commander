import React, { useState, useCallback } from 'react';
import { X, Plus, Minus, Play } from 'lucide-react';
import Modal from '../ui/Modal';
import ExerciseSelectorModal from './ExerciseSelectorModal';
import { CustomNumPad } from '../keypad/CustomNumPad';
import { SetRow } from '../session/SetRow';
import { formatNumber } from '../keypad/keypadConfig';

export default function PreSessionModal({ routine, onStart, onCancel, customExercises, addCustomExercise, removeCustomExercise }) {
  const [draft, setDraft] = useState(() => ({
    ...routine,
    exercises: (Array.isArray(routine?.exercises) ? routine.exercises : []).map(ex => ({
      ...ex,
      sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({ ...s })) : [{ weight: 0, reps: 0, rpe: 0, type: 'normal', completed: false }],
    })),
  }));

  const [showExSelector, setShowExSelector] = useState(false);

  // Keypad state
  const [kp, setKp] = useState({ open: false, exIdx: -1, setIdx: -1, activeField: 'weight' });

  const openKp = useCallback((exIdx, setIdx, field) => {
    setKp({ open: true, exIdx, setIdx, activeField: field });
  }, []);

  const closeKp = useCallback(() => setKp(prev => ({ ...prev, open: false })), []);

  const advanceKp = useCallback(() => {
    setKp(prev => {
      const order = ['weight', 'reps', 'rpe'];
      const ci = order.indexOf(prev.activeField);
      if (ci < order.length - 1) return { ...prev, activeField: order[ci + 1] };
      const sets = draft.exercises[prev.exIdx]?.sets || [];
      if (prev.setIdx < sets.length - 1) return { ...prev, setIdx: prev.setIdx + 1, activeField: 'weight' };
      return { ...prev, open: false };
    });
  }, [draft.exercises]);

  const updateSet = useCallback((exIdx, setIdx, field, val) => {
    setDraft(prev => {
      const exs = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        const sets = ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: val } : s);
        return { ...ex, sets };
      });
      return { ...prev, exercises: exs };
    });
  }, []);

  const addSet = (exIdx) => {
    setDraft(prev => {
      const exs = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1] || { weight: 0, reps: 0, rpe: 0, type: 'normal' };
        return { ...ex, sets: [...ex.sets, { ...last, completed: false }] };
      });
      return { ...prev, exercises: exs };
    });
  };

  const removeLastSet = (exIdx) => {
    setDraft(prev => {
      const exs = prev.exercises.map((ex, ei) => {
        if (ei !== exIdx || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.slice(0, -1) };
      });
      return { ...prev, exercises: exs };
    });
  };

  const removeExercise = (exIdx) => {
    setDraft(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== exIdx) }));
  };

  const addExercise = (name) => {
    setDraft(prev => ({
      ...prev,
      exercises: [...prev.exercises, {
        id: `pre-${Date.now()}`,
        name,
        equipment: 'barbell',
        restSeconds: 90,
        sets: [{ weight: 0, reps: 0, rpe: 0, type: 'normal', completed: false }],
      }],
    }));
    setShowExSelector(false);
  };

  // Active keypad set (for live updates in display)
  const kpEx  = kp.open ? draft.exercises[kp.exIdx] : null;
  const kpSet = kpEx?.sets?.[kp.setIdx] ?? null;
  const kpPrev = kp.setIdx > 0 ? kpEx?.sets?.[kp.setIdx - 1] : null;

  return (
    <>
      <Modal isOpen onClose={onCancel} size="lg" align="center">
        <div className="bg-slate-900 w-full max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <h2 className="font-bold text-white text-lg truncate flex-1 mr-4">{draft.name || 'Sesión'}</h2>
            <button onClick={onCancel} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition shrink-0">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {draft.exercises.map((ex, exIdx) => (
              <div key={ex.id || exIdx} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 border-b border-slate-700/60">
                  <span className="font-bold text-white text-sm truncate flex-1">{ex.name}</span>
                  <button onClick={() => removeExercise(exIdx)} className="p-1 text-slate-600 hover:text-red-400 transition ml-2 shrink-0">
                    <X size={14} />
                  </button>
                </div>

                <div>
                  {/* Column header */}
                  <div className="grid px-2 pt-1 pb-0 text-[9px] uppercase tracking-widest text-slate-600 font-bold"
                    style={{ gridTemplateColumns: '36px 52px 1fr 1fr 52px 32px' }}>
                    <div />
                    <div className="text-center">Tag</div>
                    <div className="text-center">KG</div>
                    <div className="text-center">REPS</div>
                    <div className="text-center">RPE</div>
                    <div />
                  </div>
                  {ex.sets.map((s, si) => (
                    <SetRow
                      key={si}
                      set={s}
                      setIndex={si + 1}
                      onToggleCompleted={() => {
                        setDraft(prev => {
                          const exs = prev.exercises.map((e, ei) => {
                            if (ei !== exIdx) return e;
                            const sets = e.sets.map((st, sti) => sti === si ? { ...st, completed: !st.completed } : st);
                            return { ...e, sets };
                          });
                          return { ...prev, exercises: exs };
                        });
                      }}
                      onTapField={(field) => openKp(exIdx, si, field)}
                      onCycleType={() => {
                        const types = ['normal', 'warmup', 'top', 'backoff', 'drop', 'amrap'];
                        setDraft(prev => {
                          const exs = prev.exercises.map((e, ei) => {
                            if (ei !== exIdx) return e;
                            const sets = e.sets.map((st, sti) => {
                              if (sti !== si) return st;
                              const cur = types.indexOf(st.type || 'normal');
                              return { ...st, type: types[(cur + 1) % types.length] };
                            });
                            return { ...e, sets };
                          });
                          return { ...prev, exercises: exs };
                        });
                      }}
                      onDelete={() => {
                        setDraft(prev => {
                          const exs = prev.exercises.map((e, ei) => {
                            if (ei !== exIdx || e.sets.length <= 1) return e;
                            return { ...e, sets: e.sets.filter((_, sti) => sti !== si) };
                          });
                          return { ...prev, exercises: exs };
                        });
                      }}
                    />
                  ))}

                  <div className="flex gap-2 px-2 py-2">
                    <button
                      onClick={() => addSet(exIdx)}
                      className="flex-1 flex items-center justify-center gap-1 h-9 border border-dashed border-slate-700 hover:border-accent-500/60 text-slate-500 hover:text-accent-400 text-xs font-bold rounded-lg transition"
                    >
                      <Plus size={12} /> Serie
                    </button>
                    {ex.sets.length > 1 && (
                      <button
                        onClick={() => removeLastSet(exIdx)}
                        className="px-3 h-9 border border-dashed border-slate-700 hover:border-red-500/50 text-slate-500 hover:text-red-400 text-xs rounded-lg transition"
                      >
                        <Minus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowExSelector(true)}
              className="w-full py-3 border border-dashed border-slate-700 hover:border-accent-500/60 text-slate-500 hover:text-accent-400 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Agregar ejercicio
            </button>
          </div>

          <div className="p-4 border-t border-slate-800 shrink-0">
            <button
              onClick={() => onStart(draft)}
              className="w-full py-3.5 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-accent-900/20"
            >
              <Play size={16} fill="currentColor" /> Comenzar
            </button>
          </div>
        </div>
      </Modal>

      {showExSelector && (
        <ExerciseSelectorModal
          onClose={() => setShowExSelector(false)}
          onSelect={addExercise}
          customExercises={customExercises}
          addCustomExercise={addCustomExercise}
          removeCustomExercise={removeCustomExercise}
        />
      )}

      {kp.open && kpSet && (
        <CustomNumPad
          open={kp.open}
          onClose={closeKp}
          set={kpSet}
          exerciseName={kpEx?.name || ''}
          equipment={kpEx?.equipment || 'barbell'}
          exerciseMeta={null}
          globalOverrides={{}}
          activeField={kp.activeField}
          setIndex={kp.setIdx + 1}
          prevSet={kpPrev}
          onChange={(field, value) => updateSet(kp.exIdx, kp.setIdx, field, value)}
          onSave={closeKp}
          onNext={advanceKp}
          onSwitchField={(f) => setKp(prev => ({ ...prev, activeField: f }))}
        />
      )}
    </>
  );
}
