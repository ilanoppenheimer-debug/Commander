import React, { useState, useReducer, useRef, useCallback } from 'react';
import { AlertTriangle, X, Plus, Trash2, ChevronDown, ChevronUp, Check, Save } from 'lucide-react';
import Modal from '../ui/Modal';
import { saveSession } from '../../db/repository';
import { createBackup, downloadBackupAsFile } from '../../services/backupService';
import { isSignedIn, performDriveBackup } from '../../services/googleDriveService';
import ExerciseSelectorModal from '../modals/ExerciseSelectorModal';
import InputGroup from '../ui/InputGroup';
import { SET_TYPES } from '../../constants/gymConstants';

function sessReducer(state, action) {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'ADD_EXERCISE':
      return {
        ...state,
        exercises: [...state.exercises, {
          id: `edit-ex-${Date.now()}-${Math.random()}`,
          name: action.name,
          equipment: action.equipment || 'other',
          sets: [{ weight: 0, reps: 0, rpe: 0, type: 'normal', notes: '' }],
        }],
      };
    case 'REMOVE_EXERCISE':
      return { ...state, exercises: state.exercises.filter(ex => ex.id !== action.exId) };
    case 'UPDATE_SET': {
      return {
        ...state,
        exercises: state.exercises.map(ex =>
          ex.id !== action.exId ? ex : {
            ...ex,
            sets: ex.sets.map((s, i) => i !== action.setIdx ? s : { ...s, [action.field]: action.value }),
          }
        ),
      };
    }
    case 'ADD_SET': {
      return {
        ...state,
        exercises: state.exercises.map(ex =>
          ex.id !== action.exId ? ex : {
            ...ex,
            sets: [...ex.sets, { weight: 0, reps: 0, rpe: 0, type: 'normal', notes: '' }],
          }
        ),
      };
    }
    case 'REMOVE_SET': {
      return {
        ...state,
        exercises: state.exercises.map(ex =>
          ex.id !== action.exId ? ex : {
            ...ex,
            sets: ex.sets.filter((_, i) => i !== action.setIdx),
          }
        ),
      };
    }
    default:
      return state;
  }
}

export default function SessionEditor({ session, barUnit = 'kg', onSaved, onCancel, customExercises, addCustomExercise, removeCustomExercise }) {
  const [state, dispatch] = useReducer(sessReducer, {
    ...session,
    exercises: Array.isArray(session.exercises)
      ? session.exercises.map(ex => ({ ...ex, sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({ ...s })) : [] }))
      : [],
  });

  const [saving, setSaving] = useState(false);
  const [showExSelector, setShowExSelector] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isDirty = JSON.stringify(state) !== JSON.stringify(session);

  const handleSave = async () => {
    setSaving(true);
    try {
      const driveOk = await isSignedIn().catch(() => false);
      if (driveOk) {
        const backup = await createBackup();
        await performDriveBackup(backup);
      } else {
        await downloadBackupAsFile();
      }
      await saveSession({ ...state, updatedAt: new Date().toISOString() });
      onSaved?.(state);
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setConfirmCancel(true);
    } else {
      onCancel?.();
    }
  };

  const handleSelectExercise = (name) => {
    dispatch({ type: 'ADD_EXERCISE', name });
    setShowExSelector(false);
  };

  return (
    <>
    <Modal isOpen onClose={handleCancel} closeOnBackdrop={false}>
      <div className="bg-slate-900 w-full max-h-[95vh] rounded-t-2xl sm:rounded-2xl border border-amber-500/40 shadow-2xl flex flex-col">
        {/* Warning banner */}
        <div className="bg-amber-950/40 border-b border-amber-700/40 px-4 py-2 flex items-center gap-2 text-amber-300 text-xs shrink-0">
          <AlertTriangle size={14} className="shrink-0" />
          <span>Editando sesión histórica del {session.completedAt ? new Date(session.completedAt).toLocaleDateString('es-AR') : '—'}. Los cambios alteran tu registro permanente.</span>
        </div>

        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 shrink-0">
          <input
            value={state.name}
            onChange={(e) => dispatch({ type: 'SET_NAME', value: e.target.value })}
            className="flex-1 bg-transparent font-bold text-white text-lg border-b border-transparent focus:border-accent-500 focus:outline-none transition"
          />
          <button onClick={handleCancel} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {state.exercises.map((ex, exIdx) => (
            <div key={ex.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800 border-b border-slate-700/60">
                <span className="font-bold text-white text-sm">{ex.name}</span>
                <button
                  onClick={() => dispatch({ type: 'REMOVE_EXERCISE', exId: ex.id })}
                  className="p-1 text-slate-600 hover:text-red-400 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="p-3 space-y-2">
                {ex.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-600 w-4 shrink-0 text-center">{si + 1}</span>
                    <input
                      type="number"
                      value={s.weight || ''}
                      onChange={(e) => dispatch({ type: 'UPDATE_SET', exId: ex.id, setIdx: si, field: 'weight', value: parseFloat(e.target.value) || 0 })}
                      placeholder="kg"
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white text-xs text-center focus:border-accent-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={s.reps || ''}
                      onChange={(e) => dispatch({ type: 'UPDATE_SET', exId: ex.id, setIdx: si, field: 'reps', value: parseInt(e.target.value) || 0 })}
                      placeholder="reps"
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white text-xs text-center focus:border-accent-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={s.rpe || ''}
                      onChange={(e) => dispatch({ type: 'UPDATE_SET', exId: ex.id, setIdx: si, field: 'rpe', value: parseFloat(e.target.value) || 0 })}
                      placeholder="RPE"
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white text-xs text-center focus:border-accent-500 focus:outline-none"
                    />
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_SET', exId: ex.id, setIdx: si })}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition ml-auto"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => dispatch({ type: 'ADD_SET', exId: ex.id })}
                  className="w-full py-1.5 text-[11px] text-slate-500 hover:text-accent-400 border border-dashed border-slate-700 hover:border-accent-500/50 rounded-lg transition flex items-center justify-center gap-1"
                >
                  <Plus size={12} /> Añadir serie
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowExSelector(true)}
            className="w-full py-3 border border-dashed border-slate-600 hover:border-accent-500/60 text-slate-500 hover:text-accent-400 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Agregar ejercicio
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 shrink-0 space-y-2">
          {confirmCancel ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-300 text-center">¿Descartar cambios sin guardar?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCancel(false)} className="flex-1 py-2 bg-slate-700 text-white font-bold text-sm rounded-xl">Seguir editando</button>
                <button onClick={onCancel} className="flex-1 py-2 bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition">Descartar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleCancel} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-black font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                {saving ? 'Guardando...' : <><Save size={14} /> Guardar Cambios</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>

      {showExSelector && (
        <ExerciseSelectorModal
          onClose={() => setShowExSelector(false)}
          onSelect={handleSelectExercise}
          customExercises={customExercises}
          addCustomExercise={addCustomExercise}
          removeCustomExercise={removeCustomExercise}
        />
      )}
    </>
  );
}

