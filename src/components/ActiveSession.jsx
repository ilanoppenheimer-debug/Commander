import React, { useState, useRef } from "react";
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
} from "lucide-react";

import InputGroup from "./ui/InputGroup";
import ToggleSwitch from "./ui/ToggleSwitch";
import InfoModal from "./ui/InfoModal";
import ExerciseHistoryModal from "./modals/ExerciseHistoryModal";
import ExerciseSelectorModal from "./modals/ExerciseSelectorModal";
import PostSessionReport from "./PostSessionReport";
import { EQUIPMENT_TYPES, SET_TYPES } from "../constants/gymConstants";
import { getExerciseDetails } from "../features/exerciseMeta.jsx";
import { callGeminiAPI } from "../services/aiService";
import { buildSessionAnalysis } from "../ai/sessionAnalysis";
import { suggestNextSet, getLastFilledSet } from "../ai/progressionModel";
import { requestSessionBriefing } from "../ai/sessionBriefing";
import { useSessionStore } from "../stores/sessionStore";

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

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onCancel}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center p-0 sm:p-4">
        <div
          className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-accent-500/50 shadow-[0_0_50px_rgb(var(--accent-500)/0.2)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="text-accent-500" size={20} /> Misión Completada
            </h2>
            <button onClick={onCancel} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition">
              <X size={22} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto space-y-4">
            <p className="text-xs text-slate-400">
              Revisa el resumen y elige cómo archivar el registro.
            </p>

            {analysis && (
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

          <div className="p-4 border-t border-slate-800 flex flex-col gap-2 shrink-0">
            <button
              onClick={() => onConfirm(name, saveTemplate)}
              className="w-full py-3 bg-accent-600 hover:bg-accent-500 text-black font-bold uppercase rounded-xl shadow-lg shadow-accent-900/20 transition active:scale-95"
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
              className="w-full py-3 text-slate-400 font-bold hover:text-white transition"
            >
              Volver a entrenar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ActiveSession({
  onFinishMission,
  onDiscardSession,
  mode,
  history,
  athleteProfile,
  customExercises,
  addCustomExercise,
  removeCustomExercise,
  barUnit,
  showNotify,
}) {
  // ── Zustand store ──────────────────────────────────────────────────────────
  const session          = useSessionStore(s => s.session);
  const storeAddEx       = useSessionStore(s => s.addExercise);
  const storeUpdateEx    = useSessionStore(s => s.updateExercise);
  const storeRemoveEx    = useSessionStore(s => s.removeExercise);
  const storeAddSet      = useSessionStore(s => s.addSet);
  const storeUpdateSet   = useSessionStore(s => s.updateSet);
  const storeRemoveSet   = useSessionStore(s => s.removeSet);
  const storeCycleType   = useSessionStore(s => s.cycleSetType);
  const storeToggleSS    = useSessionStore(s => s.toggleSuperset);
  const storeTogglePhase = useSessionStore(s => s.togglePhaseForEx);
  const storeSetWarmup   = useSessionStore(s => s.setWarmupPlan);
  const storeSetBriefing = useSessionStore(s => s.setBriefing);
  const storeSetSubjState= useSessionStore(s => s.setSubjectiveState);

  const exercises        = session?.exercises ?? [];
  const phaseEnabledExIds= session?.phaseEnabledExIds ?? [];
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
          return `Top Previo: ${maxSet.weight}${barUnit} x ${maxSet.reps}`;
        }
      }
    }
    return null;
  };

  const getSuggestion = (baseWeight, isPhaseEnabled) => {
    if (!mode || mode.id === "standard" || !isPhaseEnabled) return null;
    if (!baseWeight || baseWeight <= 0) return `Fase: ${mode.sets}x${mode.repRange} @ RPE ${mode.rpe}`;
    const wMod = parseFloat(mode.weightMod) || 1.0;
    const targetWeight = (parseFloat(baseWeight) * wMod).toFixed(1);
    return `Sug: ${targetWeight}${barUnit} | ${mode.sets}x${mode.repRange} @ RPE ${mode.rpe}`;
  };

  const fetchBriefing = async () => {
    if (exercises.length === 0) { setBriefingError("Agrega ejercicios primero"); return; }
    setIsLoadingBriefing(true);
    setBriefingError(null);
    try {
      const result = await requestSessionBriefing({
        sessionName: session?.name,
        exercises,
        mode,
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
    const lastFilled = getLastFilledSet(safeSets);
    const targetRPE = parseFloat(mode?.rpe) || 8;
    const suggestion = suggestNextSet({ lastSet: lastFilled, targetRPE });
    const nextSet = suggestion
      ? { weight: suggestion.weight, reps: suggestion.reps, rpe: 0, type: "normal" }
      : { weight: 0, reps: 0, rpe: 0, type: "normal" };
    storeAddSet(exId, nextSet);
  };

  const isGlobalDeload = mode?.label?.toLowerCase().includes("descarga");

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

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => showNotify("Auto-Guardado. Usa las pestañas inferiores para ir a Calculadoras sin perder tu progreso.", "info")}
            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
          >
            <Info size={20} className="text-sky-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider leading-none truncate">
              {session.name || "Misión"}
            </h2>
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Sesión Activa
            </span>
          </div>
        </div>
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

      <div className="space-y-1 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:items-start">
        {exercises.map((ex, index) => {
          if (!ex) return null;
          const isSupersetTop    = ex.supersetId != null && exercises[index + 1]?.supersetId === ex.supersetId;
          const isSupersetBottom = ex.supersetId != null && exercises[index - 1]?.supersetId === ex.supersetId;
          const safeSets = Array.isArray(ex.sets) ? ex.sets : [];
          const isPhaseEnabledForEx = isGlobalDeload || phaseEnabledExIds.includes(ex.id);
          const suggestion   = getSuggestion(safeSets[0]?.weight || 0, isPhaseEnabledForEx);
          const details      = getExerciseDetails(ex.name);
          const prevPerformance = getPreviousPerformance(ex.name);

          return (
            <div key={ex.id || index} className={`relative pl-4 ${(isSupersetTop || isSupersetBottom) ? 'lg:col-span-2' : ''}`}>
              {(isSupersetTop || isSupersetBottom) && (
                <div className={`absolute left-0 w-1 bg-accent-500 rounded-l ${isSupersetTop && isSupersetBottom ? "top-0 bottom-0" : isSupersetTop ? "top-1/2 bottom-[-10px]" : "top-[-10px] bottom-1/2"}`}></div>
              )}
              {(isSupersetTop || isSupersetBottom) && (
                <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900 border-2 border-accent-500 rounded-full flex items-center justify-center z-10">
                  <LinkIcon size={8} className="text-accent-500" />
                </div>
              )}

              <div className={`bg-slate-800 rounded-xl overflow-hidden border shadow-md transition-all ${isSupersetTop || isSupersetBottom ? "border-accent-500/30" : "border-slate-700"} mb-4`}>
                <div className="p-3 bg-slate-900/50 flex items-start justify-between border-b border-slate-700">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center border shrink-0 mt-1 shadow-inner ${details.bg} ${details.border} ${details.color}`}>
                      {details.icon}
                      <span className="text-[8px] font-bold uppercase mt-1.5 leading-none tracking-wider">{details.label}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <button
                        onClick={() => { setEditingExId(ex.id); setShowExSelector(true); }}
                        className="text-left font-bold text-white text-lg leading-tight truncate hover:text-accent-500 transition-colors"
                        title="Cambiar Ejercicio"
                      >
                        {ex.name || "Ejercicio Desconocido"}
                      </button>
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

                        {mode && mode.id !== "standard" && !isGlobalDeload && (
                          <button
                            onClick={() => storeTogglePhase(ex.id)}
                            className={`flex items-center gap-1 text-[9px] px-1.5 py-1 rounded border transition-colors font-bold uppercase tracking-wider ${isPhaseEnabledForEx ? `${mode.color} border-current bg-slate-800` : "text-slate-500 border-slate-700 bg-slate-900/50 hover:text-slate-400"}`}
                          >
                            <Target size={10} /> {isPhaseEnabledForEx ? "Fase Activa" : "Ignorar Fase"}
                          </button>
                        )}

                        {suggestion && (
                          <span className={`text-[10px] flex items-center gap-1 ${mode?.color || "text-slate-400"}`}>
                            <Info size={10} /> {suggestion}
                          </span>
                        )}

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
                  </div>

                  <div className="flex flex-col items-end gap-1 ml-2">
                    <div className="flex items-center gap-1 mt-1">
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

                <div className="p-2">
                  <div className="grid grid-cols-12 gap-1 text-[10px] text-slate-500 font-mono text-center mb-1 uppercase">
                    <div className="col-span-1">#</div>
                    <div className="col-span-2">Tag</div>
                    <div className="col-span-3">Kg</div>
                    <div className="col-span-3">Reps</div>
                    <div className="col-span-2">RPE</div>
                    <div className="col-span-1"></div>
                  </div>
                  {safeSets.map((s, i) => {
                    if (!s) return null;
                    const setType = Object.values(SET_TYPES).find((t) => t.id === (s.type || "normal")) || SET_TYPES.NORMAL;
                    return (
                      <div key={i} className={`grid grid-cols-12 gap-2 mb-2 items-center rounded px-1 py-1 ${setType.bg}`}>
                        <div className="col-span-1 text-center text-xs text-slate-500 font-bold">{i + 1}</div>
                        <div className="col-span-2 flex justify-center">
                          <button
                            onClick={() => storeCycleType(ex.id, i)}
                            className={`text-[9px] font-bold px-1 py-2 rounded border border-white/10 w-full min-h-[44px] flex items-center justify-center ${setType.color}`}
                          >
                            {setType.label || "-"}
                          </button>
                        </div>
                        <input type="number" value={s.weight === 0 ? "" : s.weight} onChange={(e) => storeUpdateSet(ex.id, i, "weight", e.target.value)} className="col-span-3 bg-slate-900 border border-slate-700 rounded p-1 text-center text-accent-500 font-bold" placeholder="0" />
                        <input type="number" value={s.reps === 0 ? "" : s.reps} onChange={(e) => storeUpdateSet(ex.id, i, "reps", e.target.value)} className="col-span-3 bg-slate-900 border border-slate-700 rounded p-1 text-center text-white" placeholder="0" />
                        <input type="number" value={s.rpe === 0 ? "" : s.rpe} onChange={(e) => storeUpdateSet(ex.id, i, "rpe", e.target.value)} className="col-span-2 bg-slate-900 border border-slate-700 rounded p-1 text-center text-slate-400 text-xs" placeholder="-" />
                        <button onClick={() => storeRemoveSet(ex.id, i)} className="col-span-1 text-slate-700 hover:text-red-500 flex items-center justify-center min-h-[44px]">
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                  {(() => {
                    const lastFilled = getLastFilledSet(safeSets);
                    const nextSuggestion = suggestNextSet({ lastSet: lastFilled, targetRPE: parseFloat(mode?.rpe) || 8 });
                    if (!nextSuggestion) return null;
                    const hintColor = nextSuggestion.shouldStop ? "text-red-400 border-red-500/40" : "text-sky-400 border-sky-500/30";
                    return (
                      <div className={`text-[10px] px-2 py-1 mt-1 border rounded bg-slate-900/60 ${hintColor}`}>
                        <span className="font-bold">Próxima:</span> {nextSuggestion.weight}{barUnit} × {nextSuggestion.reps}{" "}
                        <span className="text-slate-500">· {nextSuggestion.reason}</span>
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => handleAddSet(ex.id)}
                    className="w-full py-1 mt-1 text-xs text-slate-500 border border-dashed border-slate-700 rounded hover:text-accent-500 hover:border-accent-500 transition"
                  >
                    + Serie
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
      </div>

      <div className="h-16"></div>
    </div>
  );
}
