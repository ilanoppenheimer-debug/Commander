import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { diffRoutineVsSession, updateRoutineFromSession } from '../../utils/routineUpdate';
import { formatWeight, formatReps, formatRpe } from '../../utils/formatters';

export const UpdateRoutineModal = ({ open, onClose, routine, session, onUpdated, barUnit = 'kg' }) => {
  const [changes, setChanges] = useState([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open && routine && session) {
      setChanges(diffRoutineVsSession(routine, session));
    }
  }, [open, routine, session]);

  const handleConfirm = async () => {
    setUpdating(true);
    const result = await updateRoutineFromSession(routine.id, session);
    setUpdating(false);
    if (result.ok) {
      onUpdated?.(result.routine);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />

      <div
        className="relative w-full max-w-md max-h-[85vh] bg-slate-950 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Actualizar plantilla</h2>
            <p className="text-xs text-slate-500">{routine?.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {changes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No hay cambios para aplicar
            </div>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                Cambios detectados ({changes.length})
              </div>

              {changes.map((change, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
                  {change.type === 'add_exercise' && (
                    <div>
                      <span className="text-emerald-400 font-bold">+ Agregar ejercicio:</span>{' '}
                      <span className="text-slate-200">{change.exercise.name}</span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {change.sets.length} sets nuevos
                      </div>
                    </div>
                  )}
                  {change.type === 'add_set' && (
                    <div>
                      <span className="text-emerald-400 font-bold">+ Set:</span>{' '}
                      <span className="text-slate-200">{change.exerciseName}</span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {formatWeight(change.set.weight, barUnit)} × {formatReps(change.set.reps)} @ RPE {formatRpe(change.set.rpe)}
                      </div>
                    </div>
                  )}
                  {change.type === 'update_set' && (
                    <div>
                      <div className="text-slate-200 font-bold mb-1">
                        {change.exerciseName} · Set {change.setIndex + 1}
                      </div>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="text-red-400 line-through">
                          {formatWeight(change.before.weight, barUnit)} × {formatReps(change.before.reps)} @ RPE {formatRpe(change.before.rpe)}
                        </span>
                        <span className="text-emerald-400">
                          → {formatWeight(change.after.weight, barUnit)} × {formatReps(change.after.reps)} @ RPE {formatRpe(change.after.rpe)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 text-xs text-amber-300 flex gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  Backup automático antes de aplicar. Esto sobrescribe los targets de la plantilla.
                  Los ejercicios que no están en esta sesión se mantienen.
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={updating || changes.length === 0}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Save size={16} />
            {updating ? 'Aplicando...' : 'Aplicar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};
