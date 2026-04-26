import React, { useMemo, useState } from "react";
import { Dumbbell, X, Search, Plus, Trash2, ChevronDown } from "lucide-react";
import { DEFAULT_EXERCISE_DB } from "../../constants/gymConstants";
import { getExerciseDetails } from "../../features/exerciseMeta.jsx";

const EQUIPMENT_OPTIONS = [
  { id: 'barbell',    label: 'Barra' },
  { id: 'dumbbell',  label: 'Mancuernas' },
  { id: 'cable',     label: 'Polea' },
  { id: 'machine',   label: 'Máquina' },
  { id: 'bodyweight',label: 'Peso Corporal' },
  { id: 'other',     label: 'Otro' },
];

const ExerciseSelectorModal = ({
  onClose,
  onSelect,
  customExercises,
  addCustomExercise,
  removeCustomExercise,
  setCustomExercises,
}) => {
  const [search, setSearch] = useState("");
  const [newEquipment, setNewEquipment] = useState("barbell");

  const allExercises = useMemo(() => {
    const safeCustom = Array.isArray(customExercises) ? customExercises.filter(Boolean) : [];
    const deduped = [...DEFAULT_EXERCISE_DB, ...safeCustom].filter((e, _, arr) => {
      const lower = e.toLowerCase();
      return arr.findIndex(x => x.toLowerCase() === lower) === arr.indexOf(e);
    });
    return [...new Set(deduped)].sort().filter(
      (e) => e && String(e).toLowerCase().includes((search || "").toLowerCase())
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
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md md:max-w-2xl h-[85vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="shrink-0 border-b border-slate-800">
          <div className="p-4 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Dumbbell className="text-accent-500" size={20} /> Seleccionar Ejercicio
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X size={22} />
            </button>
          </div>
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                autoFocus
                type="text"
                placeholder="Buscar ejercicio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-accent-500 transition-colors placeholder-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 overscroll-contain">
          {allExercises.length > 0 ? (
            <div className="space-y-0.5">
              {allExercises.map((ex) => {
                const isCustom = Array.isArray(customExercises) && customExercises.includes(ex);
                const details = getExerciseDetails(ex);
                return (
                  <div
                    key={ex}
                    onClick={() => onSelect(ex)}
                    className="flex items-center justify-between p-3 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg border ${details.bg} ${details.border} ${details.color}`}>
                        {details.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-medium text-sm">{ex}</span>
                        <span className={`text-[9px] uppercase font-bold tracking-widest opacity-80 ${details.color}`}>
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
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : search.trim() ? (
            <div className="text-center py-10 px-4">
              <p className="text-slate-500 mb-2 text-sm">No se encontró <span className="text-white font-bold">"{search}"</span></p>
              <p className="text-slate-600 text-xs mb-6">Podés agregarlo como ejercicio personalizado</p>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 text-left max-w-xs mx-auto">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agregar "{search.trim()}"</p>
                <div className="relative">
                  <select
                    value={newEquipment}
                    onChange={(e) => setNewEquipment(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-accent-500"
                  >
                    {EQUIPMENT_OPTIONS.map(eq => <option key={eq.id} value={eq.id}>{eq.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
                <button
                  onClick={handleAddCustom}
                  className="w-full py-2.5 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Plus size={16} /> Crear ejercicio
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-600 text-sm">Sin ejercicios</div>
          )}
        </div>

        {/* Sticky footer: quick-add when there's search with no exact match but results exist */}
        {search.trim() && !exactMatch && allExercises.length > 0 && (
          <div className="shrink-0 border-t border-slate-800 p-3 bg-slate-900/90">
            <button
              onClick={handleAddCustom}
              className="w-full py-2.5 bg-accent-600/10 border border-dashed border-accent-500/50 text-accent-500 rounded-xl font-bold text-sm flex justify-center items-center gap-2 hover:bg-accent-600/20 transition-colors"
            >
              <Plus size={16} /> Añadir "{search.trim()}" a mi Repertorio
            </button>
          </div>
        )}

        <div className="shrink-0 px-4 py-2 border-t border-slate-800/50 text-center">
          <span className="text-[10px] text-slate-600">{allExercises.length} ejercicios</span>
        </div>
      </div>
    </div>
  );
};

export default ExerciseSelectorModal;
