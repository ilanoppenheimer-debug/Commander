import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  Target,
  Loader2,
  Info,
  Flame,
  Link as LinkIcon,
  ChevronDown,
  BarChart2,
  Trash2,
  X,
  Shield,
  AlertTriangle,
  Sparkles,
  Check,
  Timer,
  Plus,
  StickyNote,
  RefreshCw,
} from "lucide-react";
import { CustomNumPad } from "./keypad/CustomNumPad";
import { SetRow } from "./session/SetRow";
import { NoteModal } from "./session/NoteModal";
import { BlockBanner } from "./blocks/BlockBanner";
import { BlockCreateModal } from "./blocks/BlockCreateModal";
import { TagPicker } from "./blocks/TagPicker";
import { BlockColorDot } from "./blocks/BlockColorDot";
import { useActiveBlocks } from "../hooks/useActiveBlocks";
import {
  findBlockForExercise,
  calculateBackoffSuggestion,
  findTopSetInExercise,
} from "../utils/blocksMath";
import { getExerciseMeta, saveExerciseMeta } from "../constants/exerciseMetadata";
import { TAG_LABELS } from "../constants/blockTemplates";

import InputGroup from "./ui/InputGroup";
import ToggleSwitch from "./ui/ToggleSwitch";
import InfoModal from "./ui/InfoModal";
import Modal from "./ui/Modal";
import ExerciseHistoryModal from "./modals/ExerciseHistoryModal";
import ExerciseSelectorModal from "./modals/ExerciseSelectorModal";
import PostSessionReport from "./PostSessionReport";
import { EQUIPMENT_TYPES } from "../constants/gymConstants";
import { getExerciseDetails } from "../features/exerciseMeta.jsx";
import { callGeminiAPI } from "../services/aiService";
import { buildSessionAnalysis } from "../ai/sessionAnalysis";
import { getTopHistoricalSet } from "../utils/strengthMath";
import { requestSessionBriefing } from "../ai/sessionBriefing";
import { useSessionStore } from "../stores/sessionStore";
import { UpdateRoutineModal } from "./routineUpdate/UpdateRoutineModal";
import { db } from "../db/database";

// Pure function — derives an exercise with placeholder fields computed from history + blocks.
// Never writes to the Zustand store. Returns same reference if nothing changed.
function recalculatePlaceholdersForExercise(ex, history, activeBlocks) {
  if (!ex || !Array.isArray(ex.sets) || ex.sets.length === 0) return ex;

  const exMeta = getExerciseMeta(ex.name);
  const exerciseForCalc = { ...ex, metadata: exMeta };
  const block = findBlockForExercise(exerciseForCalc, Array.isArray(activeBlocks) ? activeBlocks : []);
  const topHistorical = getTopHistoricalSet(ex.name, history);

  const buildFallback = () => {
    if (!topHistorical) return ex;
    if (parseFloat(ex.sets[0]?.weight) > 0) return ex;
    const newSets = ex.sets.map((s, i) => i === 0 ? { ...s, placeholder: topHistorical } : s);
    const changed = newSets.some((s, i) =>
      JSON.stringify(s?.placeholder) !== JSON.stringify(ex.sets[i]?.placeholder)
    );
    return changed ? { ...ex, sets: newSets } : ex;
  };

  if (!block) return buildFallback();

  const topSet = findTopSetInExercise(ex);
  const hasExplicitTop = ex.sets.some(s => (s?.type || '').toLowerCase() === 'top');

  const newSets = ex.sets.map((set, i) => {
    if (!set) return set;
    const hasTypedValue = parseFloat(set.weight) > 0 || parseInt(set.reps, 10) > 0;
    if (hasTypedValue) {
      if (set.placeholder) {
        const { placeholder: _ph, ...rest } = set;
        return rest;
      }
      return set;
    }

    const isTop = set === topSet || (!hasExplicitTop && i === 0);
    if (isTop) {
      // TOP: show historical memory, not a block-generated weight suggestion.
      // topHistorical is { weight, reps, rpe } — no sourceBlockColor by design.
      if (!topHistorical) return set;
      return { ...set, placeholder: topHistorical };
    }

    // Back sets: reactive to the real typed TOP weight only (no block suggestion fallback).
    // If top hasn't been typed yet, calculateBackoffSuggestion returns null → no placeholder.
    const backoffSuggestion = calculateBackoffSuggestion(topSet, null, block, exerciseForCalc);
    if (!backoffSuggestion) return set;
    return {
      ...set,
      placeholder: {
        weight:           backoffSuggestion.weight,
        reps:             backoffSuggestion.reps,
        rpe:              backoffSuggestion.rpe,
        sourceBlockColor: backoffSuggestion.sourceBlockColor,
      },
    };
  });

  const changed = newSets.some((s, i) =>
    JSON.stringify(s?.placeholder) !== JSON.stringify(ex.sets[i]?.placeholder)
  );
  return changed ? { ...ex, sets: newSets } : ex;
}

export const FinishMissionModal = ({
  sessionName,
  onConfirm,
  onDiscard,
  onCancel,
  analysis,
  barUnit,
}) => {
  const [name, setName] = useState(sessionName || "Entrenamiento Libre");
  const [saveTemplate, setSaveTemplate] = useState(false);

  const hasVolume = analysis?.totalVolume > 0;
  const isEmpty = !analysis || (analysis.totalSets === 0 && !hasVolume);

  return (
    <Modal isOpen onClose={onCancel} size="md" align="center">
      <div
        className="bg-slate-900 w-full max-h-[90vh] rounded-2xl border border-accent-500/50 shadow-[0_0_50px_rgb(var(--accent-500)/0.2)] flex flex-col"
      >
        {/* Sticky header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Target className="text-accent-500" size={20} /> Misión Completada
          </h2>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition">
            <X size={22} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {isEmpty && (
            <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-700/40 rounded-xl p-3 text-amber-300 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Esta sesión no tiene sets registrados. ¿Querés descartarla?</span>
            </div>
          )}

          {analysis && hasVolume && (
            <PostSessionReport analysis={analysis} barUnit={barUnit} />
          )}

          <InputGroup
            label="Nombre del Registro"
            value={name}
            onChange={setName}
            placeholder="Ej: Empuje Pesado"
          />

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <ToggleSwitch
              checked={saveTemplate}
              onChange={setSaveTemplate}
              label="Guardar como Plantilla"
            />
            <p className="text-[9px] text-slate-500 mt-2 ml-1">
              Aparecerá en "Mis Plantillas" para repetirla otro día.
            </p>
          </div>
        </div>

        {/* Sticky footer — always visible */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onConfirm(name, saveTemplate)}
            className={`w-full py-3 font-bold uppercase rounded-xl transition active:scale-95 ${
              isEmpty
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
                : 'bg-accent-600 hover:bg-accent-500 text-black shadow-lg shadow-accent-900/20'
            }`}
          >
            Guardar en Historial
          </button>
          <button
            onClick={onDiscard}
            className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold uppercase rounded-xl border border-red-900/50 transition active:scale-95"
          >
            Descartar Sesión
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 text-slate-400 font-bold hover:text-white transition text-sm"
          >
            Volver a entrenar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default function ActiveSession({
  onFinishMission,
  onDiscardSession,
  history,
  athleteProfile,
  customExercises,
  addCustomExercise,
  removeCustomExercise,
  barUnit,
  showNotify,
  globalIncrementOverrides = {},
}) {
  // ── Zustand store ──────────────────────────────────────────────────────────
  const session          = useSessionStore(s => s.session);
  const storeAddEx       = useSessionStore(s => s.addExercise);
  const storeUpdateEx    = useSessionStore(s => s.updateExercise);
  const storeRemoveEx    = useSessionStore(s => s.removeExercise);
  const storeAddSet      = useSessionStore(s => s.addSet);
  const storeUpdateSet   = useSessionStore(s => s.updateSet);
  const storeRemoveSet         = useSessionStore(s => s.removeSet);
  const storeToggleCompleted   = useSessionStore(s => s.toggleSetCompleted);
  const storeCycleType         = useSessionStore(s => s.cycleSetType);
  const storeToggleSS    = useSessionStore(s => s.toggleSuperset);
  const storeSetWarmup   = useSessionStore(s => s.setWarmupPlan);
  const storeSetBriefing = useSessionStore(s => s.setBriefing);
  const storeSetSubjState= useSessionStore(s => s.setSubjectiveState);

  const exercises        = session?.exercises ?? [];
  const warmupPlan       = session?.warmupPlan ?? null;
  const briefing         = session?.briefing ?? null;
  const subjectiveState  = session?.subjectiveState ?? '';

  // ── Local UI state (ephemeral, not persisted) ─────────────────────────────
  const [isAnalyzing,       setIsAnalyzing]       = useState(false);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);
  const [briefingError,     setBriefingError]     = useState(null);
  const [showBriefingInput, setShowBriefingInput] = useState(false);
  const [showExSelector,    setShowExSelector]    = useState(false);
  const [editingExId,       setEditingExId]       = useState(null);
  const [selectedExHistory, setSelectedExHistory] = useState(null);
  const [showFinishModal,   setShowFinishModal]   = useState(false);
  const [showUpdateRoutine, setShowUpdateRoutine] = useState(false);
  const [originRoutine,     setOriginRoutine]     = useState(null);

  useEffect(() => {
    if (session?.routineId) {
      db.routines.where('routineId').equals(session.routineId).first()
        .then(r => setOriginRoutine(r ?? null)).catch(() => {});
    } else {
      setOriginRoutine(null);
    }
  }, [session?.routineId]);

  // ── Active blocks ──────────────────────────────────────────────────────────
  const [blocksRefresh,  setBlocksRefresh]  = useState(0);
  const { blocks: activeBlocks }            = useActiveBlocks(blocksRefresh);
  const [tagPickerExId,       setTagPickerExId]       = useState(null);
  const [showCreateBlockModal, setShowCreateBlockModal] = useState(false);
  const [exerciseNoteFor,     setExerciseNoteFor]     = useState(null);

  // Placeholder-enriched exercises — derived state, never written back to the store.
  const exercisesWithPlaceholders = useMemo(
    () => (Array.isArray(exercises) ? exercises : []).map(
      ex => recalculatePlaceholdersForExercise(ex, history, activeBlocks)
    ),
    [exercises, history, activeBlocks]
  );

  // ── Custom keypad state ────────────────────────────────────────────────────
  const [keypadState, setKeypadState] = useState({
    open: false, exerciseId: null, setIndex: -1, activeField: 'weight',
  });

  const openKeypad = useCallback((exerciseId, setIdx, field, enrichedSet) => {
    // Auto-populate from placeholder when the field is empty
    if (enrichedSet?.placeholder) {
      const ph = enrichedSet.placeholder;
      const fields = ['weight', 'reps', 'rpe'];
      for (const f of fields) {
        const isEmpty = enrichedSet[f] === null || enrichedSet[f] === undefined || enrichedSet[f] === '' || enrichedSet[f] === 0;
        const suggested = ph[f];
        if (isEmpty && suggested != null && suggested !== '' && parseFloat(suggested) > 0) {
          storeUpdateSet(exerciseId, setIdx, f, suggested);
        }
      }
    }
    setKeypadState({ open: true, exerciseId, setIndex: setIdx, activeField: field });
  }, [storeUpdateSet]);

  const closeKeypad = useCallback(() => {
    setKeypadState(prev => ({ ...prev, open: false }));
  }, []);

  const switchKeypadField = useCallback((field) => {
    setKeypadState(prev => ({ ...prev, activeField: field }));
  }, []);

  const advanceKeypad = useCallback(() => {
    setKeypadState(prev => {
      const order = ['weight', 'reps', 'rpe'];
      const curIdx = order.indexOf(prev.activeField);
      if (curIdx < order.length - 1) {
        return { ...prev, activeField: order[curIdx + 1] };
      }
      // Last field: try next set
      const ex = exercises.find(e => e.id === prev.exerciseId);
      const sets = Array.isArray(ex?.sets) ? ex.sets : [];
      if (prev.setIndex < sets.length - 1) {
        return { ...prev, setIndex: prev.setIndex + 1, activeField: 'weight' };
      }
      return { ...prev, open: false };
    });
  }, [exercises]);

  const updateSetField = useCallback((exId, setIdx, field, value) => {
    storeUpdateSet(exId, setIdx, field, value);
  }, [storeUpdateSet]);

  const getPreviousPerformance = (exName) => {
    if (!exName || !Array.isArray(history) || history.length === 0) return null;
    for (let i = 0; i < history.length; i++) {
      const pastSession = history[i];
      if (!pastSession || !Array.isArray(pastSession.exercises)) continue;
      const pastEx = pastSession.exercises.find(
        (e) => e && String(e.name).toLowerCase() === String(exName).toLowerCase()
      );
      if (pastEx && Array.isArray(pastEx.sets) && pastEx.sets.length > 0) {
        const maxSet = pastEx.sets.reduce((max, cur) => {
          const cw = parseFloat(cur?.weight) || 0;
          const mw = parseFloat(max?.weight) || 0;
          return cw > mw ? cur : max;
        }, pastEx.sets[0]);
        if (maxSet && parseFloat(maxSet.weight) > 0) {
          return `Top Previo: ${parseFloat(maxSet.weight)}${barUnit} x ${parseFloat(maxSet.reps)}`;
        }
      }
    }
    return null;
  };

  const fetchBriefing = async () => {
    if (exercises.length === 0) { setBriefingError("Agrega ejercicios primero"); return; }
    setIsLoadingBriefing(true);
    setBriefingError(null);
    try {
      const result = await requestSessionBriefing({
        sessionName: session?.name,
        exercises,
        history,
        athleteProfile,
        subjectiveState: subjectiveState.trim() || null,
      });
      if (!result) {
        setBriefingError("Respuesta de IA inválida. Intenta de nuevo.");
      } else {
        storeSetBriefing(result);
        setShowBriefingInput(false);
      }
    } catch (err) {
      setBriefingError(err?.message || "Error al generar briefing");
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  const applyBriefingSuggestions = () => {
    if (!briefing?.perExercise || briefing.perExercise.length === 0) return;
    exercises.forEach((ex) => {
      const sug = briefing.perExercise.find(
        (p) => p?.name?.toLowerCase() === ex.name?.toLowerCase()
      );
      if (!sug) return;
      const w = parseFloat(sug.suggestedWeight) || 0;
      const r = parseFloat(sug.reps) || 0;
      if (w <= 0 && r <= 0) return;
      const sets = Array.isArray(ex.sets) && ex.sets.length > 0 ? [...ex.sets] : [{ weight: 0, reps: 0, rpe: 0, type: "normal" }];
      sets[0] = { ...sets[0], weight: w || sets[0].weight, reps: r || sets[0].reps };
      storeUpdateEx(ex.id, { sets });
    });
    showNotify?.("Sugerencias aplicadas al primer set", "success");
  };

  const generateWarmup = async () => {
    if (exercises.length === 0) { showNotify?.("Agrega ejercicios para generar el calentamiento", "info"); return; }
    setIsAnalyzing(true);
    const exerciseList = exercises.map((e) => e?.name || "").join(", ");
    try {
      const plan = await callGeminiAPI(`Genera un protocolo de calentamiento (máx 4 puntos) para: ${exerciseList}. Tono militar.`);
      storeSetWarmup({ title: "Protocolo de Activación", content: plan });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectExercise = (exName) => {
    if (editingExId !== null) {
      storeUpdateEx(editingExId, { name: exName });
    } else {
      storeAddEx(exName);
    }
    setShowExSelector(false);
    setEditingExId(null);
  };

  const handleAddSet = (exId) => {
    const ex = exercises.find(e => e.id === exId);
    const safeSets = Array.isArray(ex?.sets) ? ex.sets : [];
    const lastSet = safeSets.length > 0 ? safeSets[safeSets.length - 1] : null;
    storeAddSet(exId, {
      weight: '', reps: '', rpe: '',
      type: lastSet?.type || 'normal',
      completed: false,
    });
  };

  const isLastInSupersetGroup = useCallback((exercise, allExercises) => {
    if (!exercise?.supersetId) return true;
    const group = (Array.isArray(allExercises) ? allExercises : []).filter(e => e?.supersetId === exercise.supersetId);
    if (group.length <= 1) return true;
    return group[group.length - 1]?.id === exercise.id;
  }, []);

  const handleCompleteSet = useCallback((ex, setIdx) => {
    const safeSets = Array.isArray(ex.sets) ? ex.sets : [];
    const wasCompleted = safeSets[setIdx]?.completed;
    storeToggleCompleted(ex.id, setIdx);

    if (!wasCompleted) {
      if (navigator.vibrate) navigator.vibrate(50);
      // Trigger rest timer if this exercise is last in its superset group
      if (isLastInSupersetGroup(ex, exercises)) {
        const restSecs = ex.restSeconds ?? 90;
        window.dispatchEvent(new CustomEvent('iron-cmdr:start-rest-timer', {
          detail: { seconds: restSecs, exerciseName: ex.name }
        }));
      }
    }
  }, [storeToggleCompleted, isLastInSupersetGroup, exercises]);

  if (!session) return null;

  return (
    <div className="animate-fade-in pb-24 pt-4">
      {warmupPlan && (
        <InfoModal data={warmupPlan} onClose={() => storeSetWarmup(null)} />
      )}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 size={48} className="text-accent-500 animate-spin mb-4" />
          <p className="text-accent-500 font-mono font-bold animate-pulse">PROCESANDO INTELIGENCIA...</p>
        </div>
      )}

      {showExSelector && (
        <ExerciseSelectorModal
          onClose={() => setShowExSelector(false)}
          onSelect={handleSelectExercise}
          customExercises={customExercises}
          addCustomExercise={addCustomExercise}
          removeCustomExercise={removeCustomExercise}
          history={history}
        />
      )}

      {selectedExHistory && (
        <ExerciseHistoryModal
          exName={selectedExHistory}
          history={history}
          barUnit={barUnit}
          onClose={() => setSelectedExHistory(null)}
        />
      )}

      {showFinishModal && (
        <FinishMissionModal
          sessionName={session.name}
          onConfirm={(name, saveAsTemplate) => onFinishMission(name, exercises, saveAsTemplate)}
          onDiscard={onDiscardSession}
          onCancel={() => setShowFinishModal(false)}
          analysis={buildSessionAnalysis({ sessionName: session.name, currentExercises: exercises, history })}
          barUnit={barUnit}
        />
      )}

      <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-2 mb-4 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white uppercase tracking-wider leading-none truncate">
                {session.name || "Misión"}
              </h2>
              {activeBlocks.length > 0 && (
                <span className="text-[11px] text-slate-500 font-normal normal-case tracking-normal leading-none shrink-0">
                  · {activeBlocks[0].name} {activeBlocks[0].sessionsLogged}/{activeBlocks[0].sessionsTarget ?? '∞'}
                  {activeBlocks.length > 1 && <span className="ml-1">+{activeBlocks.length - 1}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* BRIEFING IA and CALENTAMIENTO buttons hidden — keep functions/state for future use
        <div className="flex gap-2 border-t border-slate-800 pt-3 flex-wrap">
          <button
            onClick={() => setShowBriefingInput((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-accent-400 bg-slate-800 border border-accent-500/40 px-3 py-2 rounded-lg hover:bg-slate-700 hover:border-accent-500 transition"
          >
            {isLoadingBriefing ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />} BRIEFING IA
          </button>
          <button
            onClick={generateWarmup}
            className="flex items-center gap-2 text-xs font-bold text-orange-400 bg-slate-800 border border-orange-500/40 px-3 py-2 rounded-lg hover:bg-slate-700 hover:border-orange-500 transition"
          >
            <Flame size={14} /> CALENTAMIENTO
          </button>
        </div>
        */}

        {showBriefingInput && !briefing && (
          <div className="bg-slate-950 border border-accent-500/30 rounded-lg p-3 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-accent-400">
              ¿Cómo te sentís hoy? (opcional)
            </label>
            <input
              type="text"
              value={subjectiveState}
              onChange={(e) => storeSetSubjState(e.target.value)}
              placeholder="ej: dormí poco, lumbar cargada…"
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
            />
            <button
              onClick={fetchBriefing}
              disabled={isLoadingBriefing}
              className="w-full py-2 bg-accent-600 text-black rounded font-bold text-xs uppercase hover:bg-accent-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoadingBriefing ? <><Loader2 size={14} className="animate-spin" /> Analizando historial…</> : <><Sparkles size={14} /> Generar briefing</>}
            </button>
            {briefingError && (
              <div className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertTriangle size={10} /> {briefingError}
              </div>
            )}
          </div>
        )}

        {briefing && (
          <div className="bg-slate-950 border border-accent-500/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-400 flex items-center gap-1">
                <Shield size={10} /> Briefing de Misión
              </span>
              <button onClick={() => storeSetBriefing(null)} className="text-slate-500 hover:text-white">
                <X size={12} />
              </button>
            </div>
            {briefing.fatigueWarning && (
              <div className="bg-orange-900/30 border border-orange-500/40 rounded p-2 text-[11px] text-orange-200 flex items-start gap-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{briefing.fatigueWarning}</span>
              </div>
            )}
            {briefing.generalAdvice && <p className="text-xs text-slate-300 italic">{briefing.generalAdvice}</p>}
            {Array.isArray(briefing.perExercise) && briefing.perExercise.length > 0 && (
              <div className="space-y-1">
                {briefing.perExercise.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-1 last:border-0">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-slate-200 font-medium truncate">{p.name}</div>
                      {p.note && <div className="text-[9px] text-slate-500 italic truncate">{p.note}</div>}
                    </div>
                    <div className="text-accent-400 font-mono shrink-0">
                      {p.suggestedWeight || 0}{barUnit} × {p.reps || 0} @RPE{p.rpe || "-"}
                    </div>
                  </div>
                ))}
                <button
                  onClick={applyBriefingSuggestions}
                  className="w-full mt-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-accent-600 text-black rounded hover:bg-accent-500 transition"
                >
                  Aplicar al primer set
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {activeBlocks.length === 0 && (
        <button
          onClick={() => setShowCreateBlockModal(true)}
          className="w-full mb-3 text-[10px] text-slate-500 hover:text-accent-400 flex items-center justify-center gap-1 transition py-1"
        >
          Modo libre · <span className="underline">crear bloque</span>
        </button>
      )}

      <div className="space-y-1 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:items-start">
        {exercisesWithPlaceholders.map((ex, index) => {
          if (!ex) return null;
          const isSupersetTop    = ex.supersetId != null && exercises[index + 1]?.supersetId === ex.supersetId;
          const isSupersetBottom = ex.supersetId != null && exercises[index - 1]?.supersetId === ex.supersetId;
          const isInSuperset     = isSupersetTop || isSupersetBottom;
          // Compute group size and position for badge/label
          const groupExercises   = ex.supersetId ? exercises.filter(e => e?.supersetId === ex.supersetId) : [];
          const groupSize        = groupExercises.length;
          const groupPos         = ex.supersetId ? groupExercises.findIndex(e => e?.id === ex.id) + 1 : 0;
          const isGroupFirst     = isSupersetTop && !isSupersetBottom;
          const groupBadge       = groupSize === 2 ? 'DUETO' : groupSize === 3 ? 'TRISET' : groupSize >= 4 ? `GIANT SET (${groupSize})` : null;
          const safeSets = Array.isArray(ex.sets) ? ex.sets : [];
          const details  = getExerciseDetails(ex.name);
          const exMeta   = getExerciseMeta(ex.name);
          const hasActiveBlock = !!findBlockForExercise({ ...ex, metadata: exMeta }, activeBlocks);
          const prevPerformance = hasActiveBlock ? null : getPreviousPerformance(ex.name);

          return (
            <div key={ex.id || index} className={`relative pl-4 ${isInSuperset ? 'lg:col-span-2' : ''}`}>
              {isInSuperset && (
                <div className={`absolute left-0 w-1 bg-accent-500 ${isSupersetTop && isSupersetBottom ? "top-0 bottom-0" : isSupersetTop ? "top-1/2 bottom-[-10px]" : "top-[-10px] bottom-1/2"}`}></div>
              )}
              {isInSuperset && (
                <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900 border-2 border-accent-500 rounded-full flex items-center justify-center z-10">
                  <LinkIcon size={8} className="text-accent-500" />
                </div>
              )}

              {isGroupFirst && groupBadge && (
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="bg-accent-900/30 border border-accent-500/40 text-accent-400 text-[10px] uppercase tracking-widest font-bold rounded px-2 py-1">
                    {groupBadge}
                  </span>
                </div>
              )}

              <div className={`bg-slate-800 rounded-xl overflow-hidden border shadow-md transition-all ${isInSuperset ? "border-accent-500/30" : "border-slate-700"} mb-4`}>
                <div className="p-3 bg-slate-900/50 flex items-start justify-between border-b border-slate-700">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${details.dotBg || 'bg-slate-500'}`} />
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{details.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingExId(ex.id); setShowExSelector(true); }}
                        className="text-left font-bold text-white text-lg leading-tight truncate hover:text-accent-500 transition-colors"
                        title="Cambiar Ejercicio"
                      >
                        {ex.name || "Ejercicio Desconocido"}
                      </button>
                        {isInSuperset && groupPos > 0 && (
                          <span className="text-[9px] text-accent-400 font-mono shrink-0">{groupPos}/{groupSize}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <div className="relative">
                          <select
                            value={ex.equipment || "barbell"}
                            onChange={(e) => storeUpdateEx(ex.id, { equipment: e.target.value })}
                            className="appearance-none bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2 py-1 pr-6 rounded border border-slate-600 focus:outline-none focus:border-accent-500 cursor-pointer"
                          >
                            {EQUIPMENT_TYPES.map((eq) => (
                              <option key={eq.id} value={eq.id}>{eq.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Rest timer badge */}
                        <div className="relative group/rest">
                          <button
                            onClick={() => {
                              const presets = [30, 60, 90, 120, 180, 240, 300];
                              const cur = ex.restSeconds ?? 90;
                              const idx = presets.indexOf(cur);
                              const next = presets[(idx + 1) % presets.length];
                              storeUpdateEx(ex.id, { restSeconds: next });
                            }}
                            className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-700 hover:border-accent-500/60 hover:text-accent-400 transition font-mono"
                            title="Toca para cambiar descanso"
                          >
                            <Timer size={10} /> {ex.restSeconds ?? 90}s
                          </button>
                        </div>

                        {/* Tag button */}
                        <div className="relative">
                          {(() => {
                            const exMeta = getExerciseMeta(ex.name);
                            const tag = exMeta?.defaultTag;
                            const isImplicit = !tag;
                            const block = activeBlocks.find(b => Array.isArray(b.appliesTo) && b.appliesTo.includes(tag || 'accessory'));
                            return (
                              <>
                                <button
                                  onClick={() => setTagPickerExId(tagPickerExId === ex.id ? null : ex.id)}
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded border border-slate-700/50 hover:border-slate-600 transition"
                                >
                                  <BlockColorDot color={isImplicit ? '#475569' : (block?.color || '#64748b')} size={6} />
                                  <span className={isImplicit ? 'text-slate-600 italic' : 'text-slate-500'}>
                                    {tag ? TAG_LABELS[tag] : 'accessory?'}
                                  </span>
                                </button>
                                {tagPickerExId === ex.id && (
                                  <TagPicker
                                    value={tag || 'accessory'}
                                    onChange={(newTag) => {
                                      const meta = getExerciseMeta(ex.name);
                                      saveExerciseMeta(ex.name, { ...meta, defaultTag: newTag, tagAssignedAt: new Date().toISOString() });
                                      setTagPickerExId(null);
                                      setBlocksRefresh(r => r + 1);
                                    }}
                                    onClose={() => setTagPickerExId(null)}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {prevPerformance && (
                          <button
                            onClick={() => setSelectedExHistory(ex.name)}
                            className="flex items-center gap-1 text-[10px] text-sky-400 bg-sky-900/20 px-1.5 py-0.5 rounded border border-sky-500/30 hover:bg-sky-900/40 transition mt-1"
                          >
                            <BarChart2 size={10} /> {prevPerformance}
                          </button>
                        )}
                      </div>
                    </div>

                  <div className="flex flex-col items-end gap-1 ml-2">
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={() => setExerciseNoteFor(ex.id)}
                        className={`p-1.5 rounded transition ${ex.exerciseNotes?.trim() ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-slate-400'}`}
                        aria-label="Nota del ejercicio"
                      >
                        <StickyNote size={14} />
                      </button>
                      <button
                        onClick={() => storeToggleSS(index)}
                        className={`p-1.5 rounded transition ${isSupersetTop ? "text-accent-500 bg-accent-900/20" : "text-slate-600 hover:text-accent-500 hover:bg-slate-700"}`}
                      >
                        <LinkIcon size={14} />
                      </button>
                      <button
                        onClick={() => storeRemoveEx(ex.id)}
                        className="p-1.5 rounded text-slate-600 hover:text-red-500 hover:bg-slate-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  {safeSets.map((s, i) => {
                    if (!s) return null;
                    return (
                      <SetRow
                        key={i}
                        set={s}
                        setIndex={i + 1}
                        onToggleCompleted={() => handleCompleteSet(ex, i)}
                        onTapField={(field) => openKeypad(ex.id, i, field, s)}
                        onCycleType={() => storeCycleType(ex.id, i)}
                        onDelete={() => storeRemoveSet(ex.id, i)}
                        onSaveNote={(text) => storeUpdateSet(ex.id, i, 'notes', text)}
                        barUnit={barUnit}
                      />
                    );
                  })}
                  <button
                    onClick={() => handleAddSet(ex.id)}
                    className="w-full h-10 flex items-center justify-center gap-1 text-slate-500 hover:text-accent-400 hover:bg-slate-900/50 transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    <Plus size={13} /> Serie
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2">
        <button
          onClick={() => { setEditingExId(null); setShowExSelector(true); }}
          className="w-full py-3 bg-slate-800 text-slate-300 rounded-lg font-bold text-sm uppercase border border-slate-700 hover:bg-slate-700 transition"
        >
          + Ejercicio
        </button>
        <button
          onClick={() => setShowFinishModal(true)}
          className="w-full py-3 bg-accent-600 text-black rounded-lg font-bold text-sm uppercase shadow-lg shadow-accent-900/20 hover:bg-accent-500 transition"
        >
          Finalizar Misión
        </button>
        {session.routineId && originRoutine && (
          <button
            onClick={() => setShowUpdateRoutine(true)}
            className="md:col-span-2 w-full py-2.5 bg-slate-800 text-slate-400 rounded-lg font-bold text-xs border border-slate-700 hover:bg-slate-700 hover:text-slate-200 transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={13} /> Actualizar plantilla
          </button>
        )}
      </div>

      {showUpdateRoutine && (
        <UpdateRoutineModal
          open={showUpdateRoutine}
          onClose={() => setShowUpdateRoutine(false)}
          routine={originRoutine}
          session={session}
          onUpdated={() => setShowUpdateRoutine(false)}
          barUnit={barUnit}
        />
      )}

      <div className="h-16"></div>

      {showCreateBlockModal && (
        <BlockCreateModal
          open={showCreateBlockModal}
          onClose={() => setShowCreateBlockModal(false)}
          onCreated={() => {
            setShowCreateBlockModal(false);
            setBlocksRefresh(r => r + 1);
          }}
        />
      )}

      {exerciseNoteFor && (() => {
        const noteEx = exercises.find(e => e.id === exerciseNoteFor);
        if (!noteEx) return null;
        return (
          <NoteModal
            open
            onClose={() => setExerciseNoteFor(null)}
            initialText={noteEx.exerciseNotes || ''}
            title={`Nota — ${noteEx.name}`}
            onSave={(text) => {
              storeUpdateEx(exerciseNoteFor, { exerciseNotes: text });
              setExerciseNoteFor(null);
            }}
          />
        );
      })()}

      {/* Custom Keypad */}
      {keypadState.open && (() => {
        const kpEx = exercises.find(e => e.id === keypadState.exerciseId);
        const kpSet = kpEx?.sets?.[keypadState.setIndex];
        const kpPrev = keypadState.setIndex > 0 ? kpEx?.sets?.[keypadState.setIndex - 1] : null;
        if (!kpEx || !kpSet) return null;
        return (
          <CustomNumPad
            open={keypadState.open}
            onClose={closeKeypad}
            set={kpSet}
            exerciseName={kpEx.name}
            equipment={kpEx.equipment || 'barbell'}
            exerciseMeta={null}
            globalOverrides={globalIncrementOverrides}
            activeField={keypadState.activeField}
            setIndex={keypadState.setIndex + 1}
            prevSet={kpPrev}
            onChange={(field, value) => updateSetField(kpEx.id, keypadState.setIndex, field, value)}
            onSave={closeKeypad}
            onNext={advanceKeypad}
            onSwitchField={switchKeypadField}
          />
        );
      })()}
    </div>
  );
}
