import React, { useMemo, useState, useRef, useCallback } from "react";
import { Dumbbell, X, Search, Plus, Trash2, Star, ChevronDown, ChevronRight } from "lucide-react";
import { DEFAULT_EXERCISE_DB, catalogMuscleFor } from "../../constants/gymConstants";
import { sameExercise, normalizeExerciseName } from "../../utils/exerciseName";
import { SELECTOR_TABLE_NAMES, isHiddenFromSelector, familyGroup } from "../../constants/exerciseFamilies";
import { defaultImplement } from "../../utils/exerciseVariant";
import { getExerciseDetails, getGroupDetails } from "../../features/exerciseMeta.jsx";
import Modal from "../ui/Modal";
import CreateExerciseModal from "./CreateExerciseModal";
import { toggleFavorite, isFavorite, saveExerciseMeta, getExerciseMeta, resolveFamily, familyDefaultGroup } from "../../constants/exerciseMetadata";

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

  // Catalogue + families table (the new variants live only there) + the athlete's own exercises,
  // without the ones taken out of the selector (old / duplicated / hidden: see exerciseFamilies.js).
  const allExerciseNames = useMemo(() => {
    const safeCustom = Array.isArray(customExercises) ? customExercises.filter(Boolean) : [];
    const deduped = [...DEFAULT_EXERCISE_DB, ...SELECTOR_TABLE_NAMES, ...safeCustom]
      .filter(e => !isHiddenFromSelector(e))
      .filter((e, _, arr) => arr.findIndex(x => sameExercise(x, e)) === arr.indexOf(e));
    return [...new Set(deduped)].sort((a, b) => a.localeCompare(b, 'es'));
  }, [customExercises]);

  // Family of every name (metadata.family -> table -> the name itself) and its size in the list.
  const familyOf = useMemo(() => {
    const map = new Map();
    for (const n of allExerciseNames) map.set(n, resolveFamily(n));
    return map;
  }, [allExerciseNames, favVersion]);
  const familySize = useMemo(() => {
    const sizes = new Map();
    for (const f of familyOf.values()) { const k = normalizeExerciseName(f); sizes.set(k, (sizes.get(k) || 0) + 1); }
    return sizes;
  }, [familyOf]);

  // Muscle of a name for the tabs: its own (catalogue / metadata), else the default of its family
  // (families table or the family the athlete chose). Own always wins.
  const muscleOf = useCallback((name) => (
    catalogMuscleFor(name) || getExerciseMeta(name)?.muscleGroup || familyDefaultGroup(name) || null
  ), [favVersion]);

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
    const q = normalizeExerciseName(search);
    // When searching, bypass tab and search all — by the name AND by the family name
    // ("Split" finds Sentadilla Búlgara).
    if (q) return allExerciseNames.filter(e => normalizeExerciseName(e).includes(q) || normalizeExerciseName(familyOf.get(e) ?? '').includes(q));

    switch (activeTab) {
      case 'recent': return recentExercises.length ? recentExercises : allExerciseNames.slice(0, 20);
      case 'favorites': return allExerciseNames.filter(e => isFavorite(e));
      case 'all': return allExerciseNames;
      default: {
        const expected = MUSCLE_TAB_MAP[activeTab];
        if (!expected) return allExerciseNames;
        const expectedArr = Array.isArray(expected) ? expected : [expected];
        return allExerciseNames.filter(e => {
          const m = muscleOf(e);
          return m && expectedArr.includes(m);
        });
      }
    }
  }, [search, activeTab, allExerciseNames, recentExercises, favVersion, familyOf, muscleOf]);

  // Grouped by family (collapsible) except in the flat lists (Recientes, Favoritos). When searching, the
  // families with matches are expanded by themselves. A family
  // with a single variant is a plain row.
  const searching = !!search.trim();
  const flat = activeTab === 'recent' || activeTab === 'favorites';
  const [openFamilies, setOpenFamilies] = useState(() => new Set());
  const toggleFamily = (key) => setOpenFamilies(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const groups = useMemo(() => {
    if (flat && !searching) return [];
    const byKey = new Map();
    for (const n of filteredExercises) {
      const label = familyOf.get(n) ?? n;
      const key = normalizeExerciseName(label);
      if (!byKey.has(key)) byKey.set(key, { key, label, names: [], total: familySize.get(key) || 1 });
      byKey.get(key).names.push(n);
    }
    const list = [...byKey.values()];
    for (const g of list) {
      // Icon of the family = its muscle group: the family's default, else the most common one of its variants.
      const counts = new Map();
      for (const n of g.names) { const m = muscleOf(n); if (m) counts.set(m, (counts.get(m) || 0) + 1); }
      g.group = familyGroup(g.label) || [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }
    return list.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [flat, searching, filteredExercises, familyOf, familySize, muscleOf]);

  const removeCustom = (e, exName) => {
    e.stopPropagation();
    if (removeCustomExercise) removeCustomExercise(exName);
    else if (setCustomExercises) setCustomExercises(prev => Array.isArray(prev) ? prev.filter(ex => ex !== exName) : []);
  };

  // The exercise goes out with the implement it should start with (see defaultImplement).
  const pick = (name) => onSelect(name, defaultImplement(name, history));

  const handleFavToggle = useCallback((e, exName) => {
    e.stopPropagation();
    toggleFavorite(exName);
    setFavVersion(v => v + 1);
  }, []);

  const handleCreateSave = (name, meta) => {
    setShowCreateModal(false);
    setEditingExName(null);
    if (!meta) { pick(name); return; }
    if (addCustomExercise) addCustomExercise(name);
    else if (setCustomExercises) setCustomExercises(prev => [...(Array.isArray(prev) ? prev : []), name]);
    pick(name);
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
                {(() => {
                  const row = (ex) => {
                    const isCustom = Array.isArray(customExercises) && customExercises.includes(ex);
                    return (
                      <ExerciseRow
                        key={ex}
                        ex={ex}
                        details={getExerciseDetails(ex)}
                        fav={isFavorite(ex)}
                        isCustom={isCustom}
                        onSelect={pick}
                        onFavToggle={handleFavToggle}
                        onRemove={removeCustom}
                        onLongPress={() => { setEditingExName(ex); setShowCreateModal(true); }}
                      />
                    );
                  };
                  if (flat && !searching) return filteredExercises.map(row);
                  return groups.map(g => {
                    if (g.total <= 1 && g.names.length === 1) return row(g.names[0]);
                    const open = searching || openFamilies.has(g.key);
                    const details = getGroupDetails(g.group);
                    return (
                      <div key={g.key}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={open}
                          onClick={() => !searching && toggleFamily(g.key)}
                          onKeyDown={(e) => { if (!searching && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleFamily(g.key); } }}
                          className="flex items-center justify-between p-3 bg-slate-800/40 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`p-2 rounded-lg border shrink-0 ${details.bg} ${details.border} ${details.color}`}>{details.icon}</div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-slate-100 font-bold text-sm truncate">{g.label}</span>
                              <span className={`text-[9px] uppercase font-bold tracking-widest opacity-80 ${details.color}`}>{g.names.length} {g.names.length === 1 ? 'variante' : 'variantes'}</span>
                            </div>
                          </div>
                          {open ? <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2" /> : <ChevronRight size={16} className="text-slate-400 shrink-0 ml-2" />}
                        </div>
                        {open && <div className="ml-5 pl-2 border-l border-slate-700/60 space-y-0.5">{g.names.map(row)}</div>}
                      </div>
                    );
                  });
                })()}
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
          customExerciseNames={Array.isArray(customExercises) ? customExercises : []}
          onSave={editingExName ? handleEditSave : handleCreateSave}
          onClose={() => { setShowCreateModal(false); setEditingExName(null); }}
        />
      )}
    </>
  );
};

export default ExerciseSelectorModal;
