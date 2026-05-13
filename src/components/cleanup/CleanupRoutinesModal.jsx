import { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, FileX, Copy } from 'lucide-react';
import { findDuplicatesAndShells, pickPrimaryRoutine, bulkDeleteRoutines } from '../../utils/routineCleanup';

export const CleanupRoutinesModal = ({ open, onClose, onCleaned }) => {
  const [loading,          setLoading]          = useState(true);
  const [duplicateGroups,  setDuplicateGroups]  = useState(new Map());
  const [emptyShells,      setEmptyShells]      = useState([]);
  const [selectedToDelete, setSelectedToDelete] = useState(new Set());
  const [deleting,         setDeleting]         = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    findDuplicatesAndShells().then(result => {
      setDuplicateGroups(result.duplicateGroups);
      setEmptyShells(result.emptyShells);

      const preSelected = new Set();
      for (const shell of result.emptyShells) {
        preSelected.add(shell.id);
      }
      for (const list of result.duplicateGroups.values()) {
        const primary = pickPrimaryRoutine(list);
        for (const r of list) {
          if (r.id !== primary.id) preSelected.add(r.id);
        }
      }
      setSelectedToDelete(preSelected);
      setLoading(false);
    });
  }, [open]);

  const toggleSelected = (id) => {
    setSelectedToDelete(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedToDelete.size === 0) { onClose(); return; }
    setDeleting(true);
    try {
      const result = await bulkDeleteRoutines([...selectedToDelete]);
      onCleaned?.(result.deleted);
    } finally {
      setDeleting(false);
      onClose();
    }
  };

  if (!open) return null;

  const totalIssues = duplicateGroups.size + emptyShells.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative w-full max-w-md max-h-[90vh] bg-slate-950 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-100">Limpiar rutinas</h2>
            <p className="text-xs text-slate-500">
              {loading ? 'Analizando...' : `${totalIssues} ${totalIssues === 1 ? 'issue' : 'issues'} detectado${totalIssues !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Analizando rutinas...</div>
          ) : (
            <>
              {totalIssues === 0 && (
                <div className="text-center py-8">
                  <div className="text-emerald-400 text-2xl mb-2">✓</div>
                  <div className="text-slate-300 text-sm">Tus rutinas están limpias</div>
                </div>
              )}

              {emptyShells.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2">
                    <FileX size={12} /> Plantillas vacías ({emptyShells.length})
                  </div>
                  <div className="space-y-1">
                    {emptyShells.map(r => (
                      <label key={r.id} className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedToDelete.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                          className="accent-red-500"
                        />
                        <span className="flex-1 text-sm text-slate-300 truncate">{r.name || 'Sin nombre'}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">0 ej</span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {duplicateGroups.size > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2">
                    <Copy size={12} /> Duplicados ({duplicateGroups.size} grupos)
                  </div>
                  {[...duplicateGroups.entries()].map(([key, list]) => {
                    const primary = pickPrimaryRoutine(list);
                    return (
                      <div key={key} className="mb-3 bg-slate-900/50 border border-slate-800 rounded-lg p-2">
                        <div className="text-[10px] uppercase text-slate-500 mb-1 px-1">Grupo: {key}</div>
                        {list.map(r => {
                          const isPrimary = r.id === primary.id;
                          const exCount = Array.isArray(r.exercises) ? r.exercises.length : 0;
                          return (
                            <label
                              key={r.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer ${isPrimary ? 'bg-emerald-500/10' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedToDelete.has(r.id)}
                                onChange={() => toggleSelected(r.id)}
                                disabled={isPrimary}
                                className="accent-red-500 disabled:opacity-30"
                              />
                              <span className="flex-1 text-sm text-slate-200 truncate">
                                {r.name}
                                {isPrimary && (
                                  <span className="ml-2 text-[10px] text-emerald-400 uppercase">Principal</span>
                                )}
                              </span>
                              <span className="text-[10px] text-slate-500 shrink-0">{exCount} ej</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </section>
              )}

              {totalIssues > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 text-xs text-amber-300 flex gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Se hace backup automático antes de borrar. Los marcados "Principal" no se pueden borrar.</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || deleting || selectedToDelete.size === 0}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 size={15} />
            {deleting
              ? 'Borrando...'
              : selectedToDelete.size === 0
                ? 'Nada que borrar'
                : `Borrar (${selectedToDelete.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};
