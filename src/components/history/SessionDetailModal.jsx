import React, { useState } from 'react';
import { X, Edit3, Trash2, Save, FileText, TrendingUp, AlertTriangle, Check, Share2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { deleteSession, saveRoutine } from '../../db/repository';
import { createBackup, downloadBackupAsFile } from '../../services/backupService';
import { isSignedIn, performDriveBackup } from '../../services/googleDriveService';
import { SessionExportModal } from './SessionExportModal';

function formatSet(s, barUnit = 'kg') {
  const type = s.type && s.type !== 'normal' ? s.type.toUpperCase() : '';
  const w = s.weight > 0 ? `${s.weight}${barUnit}` : 'PC';
  const rpe = s.rpe > 0 ? ` @${s.rpe}` : '';
  return { type, display: `${w} × ${s.reps}${rpe}` };
}

const SET_TYPE_COLORS = {
  top:     'text-amber-400',
  warmup:  'text-slate-400',
  backoff: 'text-slate-400',
  back:    'text-slate-400',
  drop:    'text-red-400',
  amrap:   'text-purple-400',
  normal:  'text-slate-400',
};

export default function SessionDetailModal({ session, barUnit = 'kg', onClose, onEdit, onDeleted, onOpenTrend, onGoToRoutines }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  const totalSets = exercises.reduce((sum, ex) => sum + (Array.isArray(ex?.sets) ? ex.sets.length : 0), 0);
  const totalVolume = exercises.reduce((sum, ex) =>
    sum + (Array.isArray(ex?.sets) ? ex.sets.reduce((s2, s) => s2 + (s.weight || 0) * (s.reps || 0), 0) : 0), 0
  );

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const driveOk = await isSignedIn().catch(() => false);
      if (driveOk) {
        const backup = await createBackup();
        await performDriveBackup(backup);
      } else {
        await downloadBackupAsFile();
      }
      await deleteSession(session.historyId);
      onDeleted?.();
      onClose();
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicateAsTemplate = async () => {
    const newRoutine = {
      id: `routine-${crypto.randomUUID()}`,
      name: `${session.name || 'Sesión'} (Plantilla)`,
      lastPerformed: null,
      exercises: exercises.map((ex, i) => ({
        id: `ex-${i}-${Date.now()}`,
        name: ex.name,
        equipment: ex.equipment || 'other',
        sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({
          weight: 0,
          reps: s.reps || 0,
          rpe: 0,
          type: 'normal',
        })) : [],
      })),
    };
    await saveRoutine(newRoutine);
    onClose();
    onGoToRoutines?.(newRoutine.name);
  };

  return (
    <Modal isOpen onClose={onClose} size="xl">
      <div className="bg-slate-900 w-full max-h-[92vh] rounded-t-2xl sm:rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        {/* Sticky header */}
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="font-bold text-white text-lg leading-tight truncate">
                {session.name || 'Entrenamiento Libre'}
              </h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-accent-500 font-mono">
                  {session.completedAt ? new Date(session.completedAt).toLocaleString('es-AR') : '—'}
                </span>
                {session.durationSec > 0 && (
                  <span className="text-[10px] text-slate-500">{Math.round(session.durationSec / 60)} min</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition shrink-0">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {session.workoutNotes && (
            <div className="flex items-start gap-2 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-300">
              <FileText size={14} className="shrink-0 mt-0.5 text-slate-500" />
              <span>{session.workoutNotes}</span>
            </div>
          )}

          {exercises.map((ex, exIdx) => {
            const sets = Array.isArray(ex?.sets) ? ex.sets : [];
            const vol = sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0);
            return (
              <div key={ex?.id || exIdx} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-sm">{ex?.name || 'Ejercicio'}</span>
                      {ex?.equipment && (
                        <span className="ml-2 text-[9px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {ex.equipment}
                        </span>
                      )}
                    </div>
                    {onOpenTrend && (
                      <button
                        onClick={() => onOpenTrend(ex.name)}
                        className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
                      >
                        <TrendingUp size={12} /> Progreso
                      </button>
                    )}
                  </div>
                  {ex?.exerciseNotes && ex.exerciseNotes.trim() && (
                    <div className="mt-2 px-2 py-1.5 bg-slate-900/50 border-l-2 border-amber-500/40 rounded text-xs text-slate-300 italic">
                      {ex.exerciseNotes.trim()}
                    </div>
                  )}
                </div>

                {sets.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-slate-700/40">
                          <th className="pl-4 py-2 text-left w-8">#</th>
                          <th className="py-2 text-left">Tipo</th>
                          <th className="py-2 text-right">Peso</th>
                          <th className="py-2 text-right">Reps</th>
                          <th className="py-2 text-right">RPE</th>
                          <th className="pr-4 py-2 text-right">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sets.map((s, si) => {
                          const typeColor = SET_TYPE_COLORS[s.type] || SET_TYPE_COLORS.normal;
                          return (
                            <tr key={si} className="border-b border-slate-700/30 last:border-0">
                              <td className="pl-4 py-2 text-slate-600">{si + 1}</td>
                              <td className={`py-2 font-bold text-[10px] uppercase ${typeColor}`}>
                                {s.type && s.type !== 'normal' ? s.type : '—'}
                              </td>
                              <td className="py-2 text-right text-slate-300 font-mono">
                                {parseFloat(s.weight) > 0 ? `${parseFloat(s.weight)}${barUnit}` : 'PC'}
                              </td>
                              <td className="py-2 text-right text-slate-300 font-mono">
                                {s.reps != null && s.reps !== '' ? (parseInt(s.reps, 10) || s.reps) : '—'}
                              </td>
                              <td className="py-2 text-right text-slate-500">
                                {parseFloat(s.rpe) > 0 ? parseFloat(s.rpe) : '—'}
                              </td>
                              <td className="pr-4 py-2 text-right text-[10px] max-w-[80px] truncate">
                                {s.notes?.trim()
                                  ? <span className="text-amber-400/80" title={s.notes}>{s.notes.length > 28 ? s.notes.slice(0, 28) + '…' : s.notes}</span>
                                  : <span className="text-slate-700">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {vol > 0 && (
                  <div className="px-4 py-2 bg-slate-900/40 text-[10px] text-slate-500">
                    Volumen: <span className="text-slate-400 font-mono">{vol.toLocaleString()}</span> kg-rep en {sets.length} series
                  </div>
                )}
              </div>
            );
          })}

          {/* Session summary */}
          {totalVolume > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-black text-white">{totalSets}</div>
                <div className="text-[10px] text-slate-500 uppercase">Series</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-white">{totalVolume.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 uppercase">Vol. kg-rep</div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="p-4 border-t border-slate-800 shrink-0 space-y-2">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-red-300 text-center font-bold">
                ¿Borrar esta sesión? No se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition">
                  {deleting ? 'Borrando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Share2 size={14} /> Compartir con coach
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit?.(session)}
                  className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={14} /> Editar
                </button>
                <button
                  onClick={handleDuplicateAsTemplate}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Save size={14} /> Guardar como rutina
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-red-900/30 text-red-400 font-bold text-sm rounded-xl transition border border-slate-700 hover:border-red-700/50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showExportModal && (
        <SessionExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          session={session}
        />
      )}
    </Modal>
  );
}
