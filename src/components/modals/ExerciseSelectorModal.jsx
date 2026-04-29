import React, { useMemo, useState, useRef, useCallback } from "react";
import { Dumbbell, X, Search, Plus, Trash2, Star } from "lucide-react";
import { DEFAULT_EXERCISE_DB, EXERCISE_TO_MUSCLE } from "../../constants/gymConstants";
import { getExerciseDetails } from "../../features/exerciseMeta.jsx";
import Modal from "../ui/Modal";
import CreateExerciseModal from "./CreateExerciseModal";
import { toggleFavorite, isFavorite, saveExerciseMeta } from "../../constants/exerciseMetadata";

const TABS = [
  { id: 'recent',    label: 'Recientes' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'chest',     label: 'Pecho' },
  { id: 'back',      label: 'Espalda' },
  { id: 'legs',      label: 'Piernas' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'arms',      label: 'Brazos' },
  { id: 'core',      label: 'Core' },
  { id: 'all',       label: 'Todos' },
];

const MUSCLE_TAB_MAP = {
  chest: 'chest', back: 'back', legs: ['legs', 'glutes', 'hamstrings'],
  shoulders: 'shoulders', arms: 'arms', core: 'core',
};

function useLongPress(callback, ms = 500) {
  const timerRef = useRef();
  const cancel = () => clearTimeout(timerRef.current);
  return {
    onMouseDown: () => { timerRef.current = setTimeout(callback, ms); },
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: (e) => { e.preventDefault(); timerRef.current = setTimeout(callback, ms); },
    onTouchEnd: cancel,
  };
}

function ExerciseRow({ ex, details, fav, isCustom, onSelect, onFavToggle, onRemove, onLongPress }) {
  const longPress = useLongPress(onLongPress);
  return (
    <div
      onClick={() => onSelect(ex)}
      className="flex items-center justify-between p-3 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors group"
      {...longPress}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`p-2 rounded-lg border shrink-0 ${details.bg} ${details.border} ${details.color}`}>
          {details.icon}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-slate-200 font-medium text-sm truncate">{ex}</span>
          <span className={`text-[9px] uppercase font-bold tracking-widest opacity-80 ${details.color}`}>{details.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button
          onClick={e => onFavToggle(e, ex)}
          className={`p-1.5 transition ${fav ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500 opacity-0 group-hover:opacity-100'}`}
        >
          <Star size={14} fill={fav ? 'currentColor' : 'none'} />
        </button>
        {isCustom && (
          <button onClick={e => { e.stopPropagation(); onRemove(e, ex); }} className="p-1.5 text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

const ExerciseSelectorModal = ({
  onClose,
  onSelect,
  customExercises,
  addCustomExercise,
  removeCustomExercise,
  setCustomExercises,
  history = [],
}) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState('recent');
  const [favVersion, setFavVersion] = useState(0); // force re-render on favorite toggle
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExName, setEditingExName] = useState(null);

  const allExerciseNames = useMemo(() => {
    const safeCustom = Array.isArray(customExercises) ? customExercises.filter(Boolean) : [];
    const deduped = [...DEFAULT_EXERCISE_DB, ...safeCustom].filter((e, _, arr) => {
      const lower = e.toLowerCase();
      return arr.findIndex(x => x.toLowerCase() === lower) === arr.indexOf(e);
    });
    return [...new Set(deduped)].sort();
  }, [customExercises]);

  // Recent: exercises used in last 4 weeks
  const recentExercises = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];
    const cutoff = Date.now() - 28 * 86400000;
    const seen = new Map();
    const sorted = [...history].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    for (const session of sorted) {
      if (new Date(session.completedAt).getTime() < cutoff) continue;
      for (const ex of (session.exercises || [])) {
        if (ex?.name && !seen.has(ex.name)) seen.set(ex.name, session.completedAt);
      }
    }
    return [...seen.keys()].filter(n => allExerciseNames.includes(n));
  }, [history, allExerciseNames]);

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    // When searching, bypass tab and search all
    if (q) return allExerciseNames.filter(e => e.toLowerCase().includes(q));

    switch (activeTab) {
      case 'recent': return recentExercises.length ? recentExercises : allExerciseNames.slice(0, 20);
      case 'favorites': return allExerciseNames.filter(e => isFavorite(e));
      case 'all': return allExerciseNames;
      default: {
        const expected = MUSCLE_TAB_MAP[activeTab];
        if (!expected) return allExerciseNames;
        const expectedArr = Array.isArray(expected) ? expected : [expected];
        return allExerciseNames.filter(e => {
          const m = EXERCISE_TO_MUSCLE[e];
          return m && expectedArr.includes(m);
        });
      }
    }
  }, [search, activeTab, allExerciseNames, recentExercises, favVersion]);

  const removeCustom = (e, exName) => {
    e.stopPropagation();
    if (removeCustomExercise) removeCustomExercise(exName);
    else if (setCustomExercises) setCustomExercises(prev => Array.isArray(prev) ? prev.filter(ex => ex !== exName) : []);
  };

  const handleFavToggle = useCallback((e, exName) => {
    e.stopPropagation();
    toggleFavorite(exName);
    setFavVersion(v => v + 1);
  }, []);

  const handleCreateSave = (name, meta) => {
    setShowCreateModal(false);
    setEditingExName(null);
    if (!meta) { onSelect(name); return; }
    if (addCustomExercise) addCustomExercise(name);
    else if (setCustomExercises) setCustomExercises(prev => [...(Array.isArray(prev) ? prev : []), name]);
    onSelect(name);
  };

  const handleEditSave = (name, meta) => {
    setEditingExName(null);
    setShowCreateModal(false);
    setFavVersion(v => v + 1);
  };

  return (
    <>
      <Modal isOpen onClose={onClose} size="2xl">
        <div className="bg-slate-900 w-full h-[85vh] sm:max-h-[82vh] rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl">
          {/* Header */}
          <div className="shrink-0 border-b border-slate-800">
            <div className="p-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Dumbbell className="text-accent-500" size={20} /> Seleccionar Ejercicio
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-600/10 border border-accent-500/40 text-accent-400 text-xs font-bold rounded-lg hover:bg-accent-600/20 transition"
                >
                  <Plus size={12} /> Crear
                </button>
                <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition">
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Search */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar ejercicio..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-8 pr-4 text-white text-sm focus:outline-none focus:border-accent-500 placeholder-slate-600"
                />
              </div>
            </div>
            {/* Tabs (only when not searching) */}
            {!search.trim() && (
              <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase whitespace-nowrap transition-colors shrink-0 ${activeTab === tab.id ? 'bg-accent-600 text-black' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 overscroll-contain">
            {filteredExercises.length > 0 ? (
              <div className="space-y-0.5">
                {filteredExercises.map(ex => {
                  const isCustom = Array.isArray(customExercises) && customExercises.includes(ex);
                  const details = getExerciseDetails(ex);
                  const fav = isFavorite(ex);
                  return (
                    <ExerciseRow
                      key={ex}
                      ex={ex}
                      details={details}
                      fav={fav}
                      isCustom={isCustom}
                      onSelect={onSelect}
                      onFavToggle={handleFavToggle}
                      onRemove={removeCustom}
                      onLongPress={() => { setEditingExName(ex); setShowCreateModal(true); }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 px-4 text-slate-500 text-sm">
                {search.trim()
                  ? <><span className="block mb-3">No se encontró "<span className="text-white font-bold">{search}</span>"</span>
                      <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-black text-xs font-bold rounded-xl transition">
                        <Plus size={12} className="inline mr-1" /> Crear "{search.trim()}"
                      </button></>
                  : activeTab === 'favorites' ? 'No hay favoritos aún. Toca ★ en un ejercicio.'
                  : activeTab === 'recent' ? 'Sin sesiones recientes.'
                  : 'Sin ejercicios en este grupo.'
                }
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 py-2 border-t border-slate-800/50 text-center">
            <span className="text-[10px] text-slate-600">{filteredExercises.length} ejercicios · tap largo para editar</span>
          </div>
        </div>
      </Modal>

      {showCreateModal && (
        <CreateExerciseModal
          existingName={editingExName}
          allExerciseNames={allExerciseNames}
          onSave={editingExName ? handleEditSave : handleCreateSave}
          onClose={() => { setShowCreateModal(false); setEditingExName(null); }}
        />
      )}
    </>
  );
};

export default ExerciseSelectorModal;
