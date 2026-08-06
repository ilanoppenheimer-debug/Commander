import { useState, useMemo } from 'react';
import { Pencil, Check } from 'lucide-react';
import { computeAll1RMs } from '../../utils/strengthMath';
import {
  getExerciseMeta, getTracked1RM, setTracked1RM, hasAnyTracked1RMSelection,
  getSort1RMCriterion, setSort1RMCriterion,
} from '../../constants/exerciseMetadata';
import { Exercise1RMCard } from './Exercise1RMCard';
import { Exercise1RMDetail } from './Exercise1RMDetail';
import { TimeframeSelector } from './TimeframeSelector';

const TIMEFRAMES = [
  { id: '6w',  label: '6 sem',  weeks: 6  },
  { id: '12w', label: '12 sem', weeks: 12 },
  { id: 'all', label: 'Todo',   weeks: null },
];

const SORT_CRITERIA = [
  { id: '1rm',    label: '1RM' },
  { id: 'az',     label: 'A-Z' },
  { id: 'recent', label: 'Recientes' },
];

// Same criterion as the export: only barbell/dumbbell load is comparable session to
// session. Used ONLY as a display-time default before the user has picked anything —
// never written to metadata, so it costs nothing to change later.
const isComparableEquipment = (eq) => eq === 'barbell' || eq === 'dumbbell';

const sortByCriterion = (list, criterion) => {
  const copy = [...list];
  if (criterion === 'az') copy.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  else if (criterion === 'recent') copy.sort((a, b) => new Date(b.newestDate || 0) - new Date(a.newestDate || 0));
  else copy.sort((a, b) => b.current1RM - a.current1RM); // '1rm', default
  return copy;
};

export const Mode1List = ({ history, barUnit, onCalcRequest }) => {
  const [timeframe, setTimeframe]           = useState('12w');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [editMode, setEditMode]             = useState(false);
  const [sortCriterion, setSortCriterionState] = useState(() => getSort1RMCriterion());

  const tf = TIMEFRAMES.find(t => t.id === timeframe);

  const all1RMs = useMemo(
    () => computeAll1RMs(history, { weeksBack: tf?.weeks }),
    [history, tf?.weeks]
  );

  // First-seen equipment per exercise name, resolved from the session data itself
  // (falls back to global metadata below) — same precedence chain used everywhere
  // else: session-persisted value wins, metadata is fallback only for old sessions.
  const equipmentByName = useMemo(() => {
    const map = new Map();
    (Array.isArray(history) ? history : []).forEach(session => {
      (Array.isArray(session?.exercises) ? session.exercises : []).forEach(ex => {
        if (ex?.name && ex.equipment && !map.has(ex.name)) map.set(ex.name, ex.equipment);
      });
    });
    return map;
  }, [history]);

  const resolveEquipment = (name) =>
    equipmentByName.get(name) || getExerciseMeta(name)?.equipment || null;

  // Has the user EVER explicitly picked anything, anywhere? Once true, the
  // barbell/dumbbell default stops applying globally — including for exercises never
  // touched, e.g. a brand-new Coach import. Before that, nothing has been curated yet,
  // so falling back per-exercise to the equipment default keeps the list non-empty.
  const hasSelection = useMemo(
    () => hasAnyTracked1RMSelection(),
    [selectionVersion] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isEffectivelyTracked = (name) => {
    const explicit = getTracked1RM(name);
    if (typeof explicit === 'boolean') return explicit;
    if (hasSelection) return false; // curation started elsewhere — untouched means hidden
    return isComparableEquipment(resolveEquipment(name));
  };

  const trackedList   = useMemo(
    () => sortByCriterion(all1RMs.filter(e => isEffectivelyTracked(e.name)), sortCriterion),
    [all1RMs, hasSelection, sortCriterion] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const untrackedList = useMemo(
    () => sortByCriterion(all1RMs.filter(e => !isEffectivelyTracked(e.name)), sortCriterion),
    [all1RMs, hasSelection, sortCriterion] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const applySearch = (list) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(e => e.name.toLowerCase().includes(q));
  };

  const visibleTracked   = applySearch(trackedList);
  const visibleUntracked = applySearch(untrackedList);

  const handleToggle = (exerciseName) => {
    setTracked1RM(exerciseName, !isEffectivelyTracked(exerciseName));
    setSelectionVersion(v => v + 1);
  };

  const handleSortChange = (criterion) => {
    setSortCriterionState(criterion);
    setSort1RMCriterion(criterion);
  };

  if (selectedExercise) {
    return (
      <Exercise1RMDetail
        exerciseName={selectedExercise.name}
        history={history}
        timeframe={tf}
        barUnit={barUnit}
        onBack={() => setSelectedExercise(null)}
        onCalcRequest={onCalcRequest}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      <TimeframeSelector
        options={TIMEFRAMES}
        value={timeframe}
        onChange={setTimeframe}
      />

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Buscar ejercicio..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent-500 focus:outline-none"
        />
        <button
          onClick={() => setEditMode(v => !v)}
          className={`shrink-0 flex items-center gap-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
            editMode ? 'bg-accent-600 text-black' : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          {editMode ? <Check size={14} /> : <Pencil size={14} />}
          {editMode ? 'Listo' : 'Editar'}
        </button>
      </div>

      {editMode && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 px-1">
            Ordenar por
          </div>
          <TimeframeSelector
            options={SORT_CRITERIA}
            value={sortCriterion}
            onChange={handleSortChange}
          />
        </div>
      )}

      {editMode ? (
        <>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 px-1">
              Tu lista ({trackedList.length})
            </div>
            {visibleTracked.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                Nada seleccionado todavía — sumá desde "Agregar" abajo.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleTracked.map(ex => (
                  <Exercise1RMCard
                    key={ex.name}
                    exercise={ex}
                    barUnit={barUnit}
                    editMode
                    selected
                    onToggle={() => handleToggle(ex.name)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 px-1 pt-2">
              Agregar ({untrackedList.length})
            </div>
            {visibleUntracked.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                No hay más ejercicios con 1RM calculado para sumar.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleUntracked.map(ex => (
                  <Exercise1RMCard
                    key={ex.name}
                    exercise={ex}
                    barUnit={barUnit}
                    editMode
                    selected={false}
                    onToggle={() => handleToggle(ex.name)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-600 text-center pt-2 pb-2">
            "−" saca de esta lista, "+" suma. No borra el ejercicio, ni su historial, ni afecta el export.
          </div>
        </>
      ) : visibleTracked.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {!Array.isArray(history) || history.length === 0
            ? 'Aún no tenés sesiones registradas. Hacé al menos una para ver tus 1RM estimados.'
            : 'Ningún ejercicio seleccionado todavía. Tocá "Editar" para sumar.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleTracked.map(ex => (
            <Exercise1RMCard
              key={ex.name}
              exercise={ex}
              barUnit={barUnit}
              onClick={() => setSelectedExercise(ex)}
            />
          ))}
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-center pt-4 pb-2">
        Estimaciones basadas en tabla RPE (RTS/Tuchscherer) o Epley si no hay RPE.
        Excluye sets &lt; 50% del peso máximo, RPE &lt; 6 y reps &gt; 12.
      </div>
    </div>
  );
};
