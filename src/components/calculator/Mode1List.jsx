import { useState, useMemo } from 'react';
import { List } from 'lucide-react';
import { computeAll1RMs } from '../../utils/strengthMath';
import { getExerciseMeta, getTracked1RM, setTracked1RM, hasAnyTracked1RMSelection } from '../../constants/exerciseMetadata';
import { Exercise1RMCard } from './Exercise1RMCard';
import { Exercise1RMDetail } from './Exercise1RMDetail';
import { TimeframeSelector } from './TimeframeSelector';

const TIMEFRAMES = [
  { id: '6w',  label: '6 sem',  weeks: 6  },
  { id: '12w', label: '12 sem', weeks: 12 },
  { id: 'all', label: 'Todo',   weeks: null },
];

// Same criterion as the export: only barbell/dumbbell load is comparable session to
// session. Used ONLY as a display-time default before the user has picked anything —
// never written to metadata, so it costs nothing to change later.
const isComparableEquipment = (eq) => eq === 'barbell' || eq === 'dumbbell';

export const Mode1List = ({ history, barUnit, onCalcRequest }) => {
  const [timeframe, setTimeframe]           = useState('12w');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [showAll, setShowAll]               = useState(false);

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

  const principalList = useMemo(
    () => all1RMs.filter(e => isEffectivelyTracked(e.name)),
    [all1RMs, hasSelection] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filtered = useMemo(() => {
    const source = showAll ? all1RMs : principalList;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return source;
    return source.filter(e => e.name.toLowerCase().includes(q));
  }, [all1RMs, principalList, showAll, searchQuery]);

  const handleLongPress = (exerciseName) => {
    setTracked1RM(exerciseName, !isEffectivelyTracked(exerciseName));
    setSelectionVersion(v => v + 1);
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

      <input
        type="search"
        placeholder="Buscar ejercicio..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent-500 focus:outline-none"
      />

      {all1RMs.length > principalList.length && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
        >
          <List size={12} />
          {showAll ? 'Ver seleccionados' : `Todos (${all1RMs.length})`}
        </button>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {!Array.isArray(history) || history.length === 0
            ? 'Aún no tenés sesiones registradas. Hacé al menos una para ver tus 1RM estimados.'
            : showAll
              ? 'No hay ejercicios con suficiente data para estimar 1RM en este período.'
              : 'Ningún ejercicio seleccionado todavía. Tocá "Todos" y mantené presionado el que quieras seguir.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ex => (
            <Exercise1RMCard
              key={ex.name}
              exercise={ex}
              barUnit={barUnit}
              onClick={() => setSelectedExercise(ex)}
              onLongPress={() => handleLongPress(ex.name)}
            />
          ))}
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-center pt-4 pb-2">
        {showAll
          ? 'Mantené presionado un ejercicio para sumarlo o sacarlo de tu lista.'
          : 'Mantené presionado un ejercicio para sacarlo de tu lista — no afecta tu historial ni el export.'}
        {' '}Estimaciones basadas en tabla RPE (RTS/Tuchscherer) o Epley si no hay RPE.
        Excluye sets &lt; 50% del peso máximo, RPE &lt; 6 y reps &gt; 12.
      </div>
    </div>
  );
};
