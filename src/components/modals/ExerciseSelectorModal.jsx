import React, { useMemo, useState } from "react";
import { Dumbbell, X, Search, Plus, Trash2 } from "lucide-react";
import { DEFAULT_EXERCISE_DB } from "../../constants/gymConstants";
import { getExerciseDetails } from "../../features/exerciseMeta.jsx";

const ExerciseSelectorModal = ({
  onClose,
  onSelect,
  customExercises,
  // New Dexie-backed API
  addCustomExercise,
  removeCustomExercise,
  // Legacy API (kept for backward compat)
  setCustomExercises,
}) => {
  const [search, setSearch] = useState("");

  const allExercises = useMemo(() => {
    const safeCustom = Array.isArray(customExercises)
      ? customExercises.filter(Boolean)
      : [];
    const normalizedSet = new Set([...DEFAULT_EXERCISE_DB, ...safeCustom].map(e => e.toLowerCase()));
    const deduped = [...DEFAULT_EXERCISE_DB, ...safeCustom].filter((e, _, arr) => {
      const lower = e.toLowerCase();
      const firstIdx = arr.findIndex(x => x.toLowerCase() === lower);
      return arr.indexOf(e) === firstIdx;
    });
    const list = [...new Set(deduped)].sort();

    return list.filter(
      (e) =>
        e &&
        String(e).toLowerCase().includes((search || "").toLowerCase())
    );
  }, [search, customExercises]);

  const handleAddCustom = () => {
    const newEx = search.trim();
    if (!newEx || allExercises.some(e => e.toLowerCase() === newEx.toLowerCase())) return;
    if (addCustomExercise) {
      addCustomExercise(newEx);
    } else if (setCustomExercises) {
      setCustomExercises((prev) => [...(Array.isArray(prev) ? prev : []), newEx]);
    }
    onSelect(newEx);
  };

  const removeCustom = (e, exName) => {
    e.stopPropagation();
    if (removeCustomExercise) {
      removeCustomExercise(exName);
    } else if (setCustomExercises) {
      setCustomExercises((prev) => Array.isArray(prev) ? prev.filter((ex) => ex !== exName) : []);
    }
  };

  const exactMatch = allExercises.find(
    (e) => e && String(e).toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md md:max-w-2xl max-h-[85vh] min-h-[420px] rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Dumbbell className="text-accent-500" size={20} /> Repertorio
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 shrink-0 border-b border-slate-800 bg-slate-900/50">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar ejercicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-accent-500 transition-colors placeholder-slate-600"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 overscroll-contain">
          {allExercises.length > 0 ? (
            <div className="space-y-1">
              {allExercises.map((ex) => {
                const isCustom =
                  Array.isArray(customExercises) && customExercises.includes(ex);
                const details = getExerciseDetails(ex);

                return (
                  <div
                    key={ex}
                    onClick={() => onSelect(ex)}
                    className="flex items-center justify-between p-3 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg border ${details.bg} ${details.border} ${details.color}`}
                      >
                        {details.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-medium">{ex}</span>
                        <span
                          className={`text-[9px] uppercase font-bold tracking-widest opacity-80 ${details.color}`}
                        >
                          {details.label}
                        </span>
                      </div>
                    </div>

                    {isCustom && (
                      <button
                        onClick={(e) => removeCustom(e, ex)}
                        className="p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar personalizado"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 px-4">
              <p className="text-slate-500 mb-4">
                No se encontraron resultados para "{search}"
              </p>
            </div>
          )}
        </div>

        {search.trim() && !exactMatch && (
          <div className="shrink-0 border-t border-slate-800 p-3 bg-slate-900/90">
            <button
              onClick={handleAddCustom}
              className="w-full py-3 bg-accent-600/10 border border-dashed border-accent-500/50 text-accent-500 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-accent-600/20 transition-colors"
            >
              <Plus size={18} /> Añadir "{search}" a mi Repertorio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseSelectorModal;
