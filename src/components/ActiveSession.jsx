import React, { useState, useEffect, useRef } from 'react';
import { 
  Target, Loader2, Info, Flame, Utensils, Link as LinkIcon, 
  ChevronDown, BarChart2, Wand2, RefreshCw, BrainCircuit, 
  Trash2, X, ClipboardList 
} from 'lucide-react';

import InputGroup from "./ui/InputGroup";
import ToggleSwitch from "./ui/ToggleSwitch";
import InfoModal from "./ui/InfoModal";
import ExerciseHistoryModal from "./modals/ExerciseHistoryModal";
import ExerciseSelectorModal from "./modals/ExerciseSelectorModal";
import { EQUIPMENT_TYPES, SET_TYPES } from "../constants/gymConstants";
import { getExerciseDetails } from "../features/exerciseMeta.jsx";
import { callGeminiAPI } from "../services/aiService";

// --- MODAL: FINALIZAR MISIÓN ---
export const FinishMissionModal = ({ sessionName, onConfirm, onDiscard, onCancel }) => {
    const [name, setName] = useState(sessionName || 'Entrenamiento Libre');
    const [saveTemplate, setSaveTemplate] = useState(false);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 w-full max-w-sm rounded-xl border border-amber-500/50 p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Target className="text-amber-500"/> Misión Completada</h2>
                <p className="text-xs text-slate-400 mb-6">Elige cómo quieres archivar este registro de combate.</p>
                
                <div className="space-y-4">
                    <InputGroup label="Nombre del Registro" value={name} onChange={setName} placeholder="Ej: Empuje Pesado" />
                    
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <ToggleSwitch checked={saveTemplate} onChange={setSaveTemplate} label="Guardar como Plantilla" />
                        <p className="text-[9px] text-slate-500 mt-2 ml-1">Aparecerá en "Mis Plantillas" para repetirla otro día.</p>
                    </div>

                    <div className="pt-4 flex flex-col gap-2">
                        <button onClick={() => onConfirm(name, saveTemplate)} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase rounded shadow-lg shadow-amber-900/20 transition">Guardar en Historial</button>
                        <button onClick={onDiscard} className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold uppercase rounded border border-red-900/50 transition">Descartar Sesión</button>
                        <button onClick={onCancel} className="w-full py-3 text-slate-400 font-bold hover:text-white transition">Volver a entrenar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL: ACTIVE SESSION ---
export default function ActiveSession({ sessionData, updateSessionData, onFinishMission, onDiscardSession, mode, history, customExercises, setCustomExercises, barUnit, showNotify }) {
    
    if (!sessionData) return null;

    const safeInitialExercises = Array.isArray(sessionData.exercises) ? sessionData.exercises : [];
    const [localExercises, setLocalExercises] = useState(safeInitialExercises);
    
    // Para las fases, usamos el índice ahora para evitar problemas de ID
    const [phaseEnabledExIndexes, setPhaseEnabledExIndexes] = useState(
        safeInitialExercises.map((_, i) => i)
    );

    const [loadingTipId, setLoadingTipId] = useState(null); 
    const [standardizingId, setStandardizingId] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [warmupPlan, setWarmupPlan] = useState(null);
    const [nutritionPlan, setNutritionPlan] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [showExSelector, setShowExSelector] = useState(false);
    const [editingExIndex, setEditingExIndex] = useState(null);
    const [selectedExHistory, setSelectedExHistory] = useState(null);
    const [showFinishModal, setShowFinishModal] = useState(false);

    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        updateSessionData({ ...sessionData, exercises: localExercises });
    }, [localExercises]);

    const getPreviousPerformance = (exName) => {
        if (!exName || !Array.isArray(history) || history.length === 0) return null;
        for (let i = 0; i < history.length; i++) {
            const pastSession = history[i];
            if (!pastSession || !Array.isArray(pastSession.exercises)) continue;
            const pastEx = pastSession.exercises.find(e => e && String(e.name).toLowerCase() === String(exName).toLowerCase());
            if (pastEx && Array.isArray(pastEx.sets) && pastEx.sets.length > 0) {
                const maxSet = pastEx.sets.reduce((max, current) => {
                    const currentWeight = parseFloat(current?.weight) || 0;
                    const maxWeight = parseFloat(max?.weight) || 0;
                    return currentWeight > maxWeight ? current : max;
                }, pastEx.sets[0]);
                if (maxSet && parseFloat(maxSet.weight) > 0) {
                    return `Top Previo: ${maxSet.weight}${barUnit} x ${maxSet.reps}`;
                }
            }
        }
        return null;
    };

    const getSuggestion = (baseWeight, isPhaseEnabled) => {
        if (!mode || mode.id === 'standard' || !isPhaseEnabled) return null;
        if (!baseWeight || baseWeight <= 0) return `Fase: ${mode.sets}x${mode.repRange} @ RPE ${mode.rpe}`;
        const wMod = parseFloat(mode.weightMod) || 1.0;
        const targetWeight = (parseFloat(baseWeight) * wMod).toFixed(1);
        return `Sug: ${targetWeight}${barUnit} | ${mode.sets}x${mode.repRange} @ RPE ${mode.rpe}`;
    };

    const getTacticalTip = async (exerciseName, exIdx) => {
      setLoadingTipId(exIdx);
      const prompt = `Consejo táctico de 1 frase para "${exerciseName}". Tono militar.`;
      try {
        const tip = await callGeminiAPI(prompt);
        if (tip) setAnalysisResult({ title: "Tip Táctico", content: tip });
      } catch (e) { console.error(e); } finally { setLoadingTipId(null); }
    };

    const standardizeName = async (currentName, exIdx) => {
        setStandardizingId(exIdx);
        const prompt = `Standardize this gym exercise name to Spanish (common universal term). Example: "brench pres" -> "Press Banca con Barra". Input: "${currentName}". Output ONLY the name.`;
        try {
            const standardized = await callGeminiAPI(prompt);
            if (standardized) setLocalExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, name: standardized.trim() } : e));
        } catch (e) { console.error(e); } finally { setStandardizingId(null); }
    };

    const suggestAlternative = async (currentName, exIdx) => {
        setStandardizingId(exIdx); 
        const prompt = `Sugiere UN ejercicio alternativo de gimnasio para "${currentName}" que trabaje el mismo grupo muscular principal. Devuelve SOLO el nombre del ejercicio en Español.`;
        try {
            const alternative = await callGeminiAPI(prompt);
            if (alternative) setLocalExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, name: alternative.trim() } : e));
        } catch (e) { console.error(e); } finally { setStandardizingId(null); }
    };

    const analyzeSession = async () => {
        if (localExercises.length === 0) return;
        setIsAnalyzing(true);
        const exerciseList = localExercises.map(e => `${e?.name || 'Ej'} (${e?.sets?.length || 0} series)`).join(", ");
        const prompt = `Actúa como el Iron Commander. Analiza brevemente esta sesión: ${exerciseList}. Informe de Combate breve (40 palabras). Intensidad y músculos. Tono militar.`;
        try {
            const report = await callGeminiAPI(prompt);
            setAnalysisResult({ title: "Informe de Misión", content: report });
        } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
    };

    const generateWarmup = async () => {
        if (localExercises.length === 0) return;
        setIsAnalyzing(true);
        const exerciseList = localExercises.map(e => e?.name || '').join(", ");
        const prompt = `Genera un protocolo de calentamiento (máx 4 puntos) para: ${exerciseList}. Tono militar.`;
        try {
            const plan = await callGeminiAPI(prompt);
            setWarmupPlan({ title: "Protocolo de Activación", content: plan });
        } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
    };

    const generateNutrition = async () => {
        setIsAnalyzing(true);
        const prompt = `Sugiere una comida post-entrenamiento táctica (breve) para recuperar tras sesión de ${mode?.label || 'entrenamiento'}. Tono militar.`;
        try {
            const plan = await callGeminiAPI(prompt);
            setNutritionPlan({ title: "Suministros (Post-Op)", content: plan });
        } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
    };

    const toggleSuperset = (index) => {
        if (index >= localExercises.length - 1) return;
        setLocalExercises(prev => {
            const newState = [...prev];
            const current = { ...newState[index] };
            const next = { ...newState[index + 1] };

            if (current.supersetId && next.supersetId === current.supersetId) {
                next.supersetId = null; 
                const prevEx = index > 0 ? newState[index - 1] : null;
                if (!prevEx || prevEx.supersetId !== current.supersetId) { current.supersetId = null; }
            } else {
                const newId = current.supersetId || `ss-${Date.now()}`;
                current.supersetId = newId;
                next.supersetId = newId;
            }
            newState[index] = current;
            newState[index + 1] = next;
            return newState;
        });
    };

    const handleSelectExercise = (exName) => {
        if (editingExIndex !== null) {
            setLocalExercises(prev => prev.map((e, i) => i === editingExIndex ? { ...e, name: exName } : e));
        } else {
            const newIndex = localExercises.length;
            setLocalExercises([...localExercises, { id: Date.now(), name: exName, equipment: 'barbell', sets: [{weight:0, reps:0, rpe:0, type: 'normal'}] }]);
            setPhaseEnabledExIndexes(prev => [...prev, newIndex]); 
        }
        setShowExSelector(false);
    };

    // --- REESCRITURA DE FUNCIONES CLAVE PARA USAR ÍNDICE ---
    const updateEquipment = (exIdx, eqId) => {
        setLocalExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, equipment: eqId } : e));
    };

    const addSet = (exIdx) => { 
        setLocalExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, sets: [...(Array.isArray(e.sets) ? e.sets : []), { weight: 0, reps: 0, rpe: 0, type: 'normal' }] } : e)); 
    };
    
    const removeSet = (exIdx, setIdx) => { 
        setLocalExercises(prev => prev.map((e, i) => { if (i === exIdx) { const newSets = [...(Array.isArray(e.sets) ? e.sets : [])]; newSets.splice(setIdx, 1); return { ...e, sets: newSets }; } return e; })); 
    };
    
    const updateSet = (exIdx, setIdx, field, val) => { 
        setLocalExercises(prev => prev.map((e, i) => { if (i === exIdx) { const newSets = [...(Array.isArray(e.sets) ? e.sets : [])]; newSets[setIdx] = { ...newSets[setIdx], [field]: val }; return { ...e, sets: newSets }; } return e; })); 
    };
    
    const cycleSetType = (exIdx, setIdx) => { 
        const types = Object.keys(SET_TYPES); 
        setLocalExercises(prev => prev.map((e, i) => { 
            if (i === exIdx) { 
                const newSets = [...(Array.isArray(e.sets) ? e.sets : [])]; 
                const currentTypeKey = Object.keys(SET_TYPES).find(key => SET_TYPES[key].id === (newSets[setIdx]?.type || 'normal')) || 'NORMAL'; 
                const currentIndex = types.indexOf(currentTypeKey); 
                const nextTypeKey = types[(currentIndex + 1) % types.length]; 
                newSets[setIdx] = { ...newSets[setIdx], type: SET_TYPES[nextTypeKey].id }; 
                return { ...e, sets: newSets }; 
            } 
            return e; 
        })); 
    };

    const togglePhaseForEx = (exIdx) => {
        setPhaseEnabledExIndexes(prev => 
            prev.includes(exIdx) ? prev.filter(i => i !== exIdx) : [...prev, exIdx]
        );
    };

    const isGlobalDeload = mode?.label?.toLowerCase().includes('descarga');

    return (
        <div className="pb-24 pt-4 relative z-10">
            
            {analysisResult && <InfoModal data={analysisResult} onClose={() => setAnalysisResult(null)} />}
            {warmupPlan && <InfoModal data={warmupPlan} onClose={() => setWarmupPlan(null)} />}
            {nutritionPlan && <InfoModal data={nutritionPlan} onClose={() => setNutritionPlan(null)} />}
            {isAnalyzing && (<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"><Loader2 size={48} className="text-amber-500 animate-spin mb-4" /><p className="text-amber-500 font-mono font-bold animate-pulse">PROCESANDO INTELIGENCIA...</p></div>)}

            {showExSelector && (
                <div className="fixed inset-0 z-[9999]">
                    <ExerciseSelectorModal 
                        onClose={() => setShowExSelector(false)} 
                        onSelect={handleSelectExercise} 
                        customExercises={customExercises}
                        setCustomExercises={setCustomExercises}
                    />
                </div>
            )}

            {selectedExHistory && (
                <div className="fixed inset-0 z-[9999]">
                    <ExerciseHistoryModal 
                        exName={selectedExHistory}
                        history={history}
                        barUnit={barUnit}
                        onClose={() => setSelectedExHistory(null)}
                    />
                </div>
            )}

            {showFinishModal && (
                <FinishMissionModal 
                    sessionName={sessionData.name}
                    onConfirm={(name, saveAsTemplate) => onFinishMission(name, localExercises, saveAsTemplate)}
                    onDiscard={onDiscardSession}
                    onCancel={() => setShowFinishModal(false)}
                />
            )}

            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <button onClick={() => showNotify("Auto-Guardado. Usa las pestañas inferiores para ir a Calculadoras sin perder tu progreso.", "info")} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors" title="Información"><Info size={20} className="text-sky-400" /></button>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-bold text-white uppercase tracking-wider leading-none truncate">{sessionData.name || 'Misión'}</h2>
                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Sesión Activa</span>
                    </div>
                </div>
                <div className="flex gap-2 border-t border-slate-800 pt-3">
                    <button onClick={generateWarmup} className="flex items-center gap-1 text-[10px] text-orange-400 bg-slate-800 px-2 py-1.5 rounded hover:bg-slate-700 transition"><Flame size={12} /> CALENTAMIENTO</button>
                    <button onClick={generateNutrition} className="flex items-center gap-1 text-[10px] text-blue-400 bg-slate-800 px-2 py-1.5 rounded hover:bg-slate-700 transition"><Utensils size={12} /> SUMINISTROS</button>
                </div>
            </div>

            <div className="space-y-1">
                {(Array.isArray(localExercises) ? localExercises : []).map((ex, index) => {
                    if(!ex) return null; 
                    
                    const isSupersetTop = ex.supersetId != null && localExercises[index + 1]?.supersetId === ex.supersetId;
                    const isSupersetBottom = ex.supersetId != null && localExercises[index - 1]?.supersetId === ex.supersetId;
                    
                    const safeSets = Array.isArray(ex.sets) ? ex.sets : [];
                    
                    const isPhaseEnabledForEx = isGlobalDeload || phaseEnabledExIndexes.includes(index);
                    const suggestion = getSuggestion(safeSets[0]?.weight || 0, isPhaseEnabledForEx);
                    
                    const details = getExerciseDetails(ex.name);
                    const prevPerformance = getPreviousPerformance(ex.name);

                    return (
                    <div key={`ex-${index}`} className="relative pl-4">
                         {(isSupersetTop || isSupersetBottom) && (<div className={`absolute left-0 w-1 bg-amber-500 rounded-l ${isSupersetTop && isSupersetBottom ? 'top-0 bottom-0' : isSupersetTop ? 'top-1/2 bottom-[-10px]' : 'top-[-10px] bottom-1/2'}`}></div>)}
                         {(isSupersetTop || isSupersetBottom) && (<div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900 border-2 border-amber-500 rounded-full flex items-center justify-center z-10"><LinkIcon size={8} className="text-amber-500"/></div>)}

                        <div className={`bg-slate-800 rounded-xl overflow-hidden border shadow-md transition-all ${isSupersetTop || isSupersetBottom ? 'border-amber-500/30' : 'border-slate-700'} mb-4`}>
                            <div className="p-3 bg-slate-900/50 flex items-start justify-between border-b border-slate-700">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center border shrink-0 mt-1 shadow-inner ${details.bg} ${details.border} ${details.color}`}>
                                        {details.icon}
                                        <span className="text-[8px] font-bold uppercase mt-1.5 leading-none tracking-wider">{details.label}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <button onClick={() => { setEditingExIndex(index); setShowExSelector(true); }} className="text-left font-bold text-white text-lg leading-tight truncate hover:text-amber-500 transition-colors" title="Cambiar Ejercicio">
                                            {ex.name || 'Ejercicio Desconocido'}
                                        </button>
                                        
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <div className="relative">
                                                <select value={ex.equipment || 'barbell'} onChange={(e) => updateEquipment(index, e.target.value)} className="appearance-none bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2 py-1 pr-6 rounded border border-slate-600 focus:outline-none focus:border-amber-500 cursor-pointer">
                                                    {EQUIPMENT_TYPES.map(eq => <option key={eq.id} value={eq.id}>{eq.label}</option>)}
                                                </select>
                                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                            
                                            {mode && mode.id !== 'standard' && !isGlobalDeload && (
                                                <button 
                                                    onClick={() => togglePhaseForEx(index)}
                                                    className={`flex items-center gap-1 text-[9px] px-1.5 py-1 rounded border transition-colors font-bold uppercase tracking-wider ${
                                                        isPhaseEnabledForEx 
                                                            ? `${mode.color} border-current bg-slate-800` 
                                                            : 'text-slate-500 border-slate-700 bg-slate-900/50 hover:text-slate-400'
                                                    }`}
                                                >
                                                    <Target size={10} /> {isPhaseEnabledForEx ? 'Fase Activa' : 'Ignorar Fase'}
                                                </button>
                                            )}

                                            {suggestion && (<span className={`text-[10px] flex items-center gap-1 ${mode?.color || 'text-slate-400'}`}><Info size={10} /> {suggestion}</span>)}
                                            
                                            {prevPerformance && (
                                                <button onClick={() => setSelectedExHistory(ex.name)} className="flex items-center gap-1 text-[10px] text-sky-400 bg-sky-900/20 px-1.5 py-0.5 rounded border border-sky-500/30 hover:bg-sky-900/40 transition mt-1">
                                                    <BarChart2 size={10} /> {prevPerformance}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1 ml-2">
                                  <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                                      <button onClick={() => standardizeName(ex.name, index)} className="p-1.5 text-slate-500 hover:text-purple-400 rounded hover:bg-slate-700" title="Corregir Nombre (IA)">{standardizingId === index ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}</button>
                                      <button onClick={() => suggestAlternative(ex.name, index)} className="p-1.5 text-slate-500 hover:text-green-400 rounded hover:bg-slate-700" title="Variante (IA)">{standardizingId === index ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}</button>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <button onClick={() => toggleSuperset(index)} className={`p-1.5 rounded transition ${isSupersetTop ? 'text-amber-500 bg-amber-900/20' : 'text-slate-600 hover:text-amber-500 hover:bg-slate-700'}`}><LinkIcon size={14} /></button>
                                    <button onClick={() => getTacticalTip(ex.name, index)} className="p-1.5 rounded text-slate-500 hover:text-purple-400 hover:bg-slate-700">{loadingTipId === index ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}</button>
                                    <button onClick={() => setLocalExercises(prev => prev.filter((_, i) => i !== index))} className="p-1.5 rounded text-slate-600 hover:text-red-500 hover:bg-slate-700"><Trash2 size={14} /></button>
                                  </div>
                                </div>
                            </div>
                            
                            <div className="p-2">
                                <div className="grid grid-cols-12 gap-1 text-[10px] text-slate-500 font-mono text-center mb-1 uppercase">
                                    <div className="col-span-1">#</div><div className="col-span-2">Tag</div><div className="col-span-3">Kg</div><div className="col-span-3">Reps</div><div className="col-span-2">RPE</div><div className="col-span-1"></div>
                                </div>
                                {safeSets.map((s, i) => {
                                    if(!s) return null;
                                    const setType = Object.values(SET_TYPES).find(t => t.id === (s.type || 'normal')) || SET_TYPES.NORMAL;
                                    return (
                                    <div key={`set-${i}`} className={`grid grid-cols-12 gap-2 mb-2 items-center rounded px-1 py-1 ${setType.bg}`}>
                                        <div className="col-span-1 text-center text-xs text-slate-500 font-bold">{i+1}</div>
                                        <div className="col-span-2 flex justify-center"><button onClick={() => cycleSetType(index, i)} className={`text-[9px] font-bold px-1 rounded border border-white/10 w-full h-full ${setType.color}`}>{setType.label || '-'}</button></div>
                                        <input type="number" value={s.weight === 0 ? '' : s.weight} onChange={(e) => updateSet(index, i, 'weight', e.target.value)} className="col-span-3 bg-slate-900 border border-slate-700 rounded p-1 text-center text-amber-500 font-bold" placeholder="0" />
                                        <input type="number" value={s.reps === 0 ? '' : s.reps} onChange={(e) => updateSet(index, i, 'reps', e.target.value)} className="col-span-3 bg-slate-900 border border-slate-700 rounded p-1 text-center text-white" placeholder="0" />
                                        <input type="number" value={s.rpe === 0 ? '' : s.rpe} onChange={(e) => updateSet(index, i, 'rpe', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-700 rounded p-1 text-center text-slate-400 text-xs" placeholder="-" />
                                        <button onClick={() => removeSet(index, i)} className="col-span-1 text-slate-700 hover:text-red-500 flex justify-center"><X size={12} /></button>
                                    </div>
                                )})}
                                <button onClick={() => addSet(index)} className="w-full py-1 mt-1 text-xs text-slate-500 border border-dashed border-slate-700 rounded hover:text-amber-500 hover:border-amber-500 transition">+ Serie</button>
                            </div>
                        </div>
                    </div>
                )})}
            </div>

            <div className="mt-6 flex flex-col gap-2">
                <div className="flex gap-2">
                    <button onClick={() => { setEditingExIndex(null); setShowExSelector(true); }} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-lg font-bold text-sm uppercase border border-slate-700 hover:bg-slate-700 transition">+ Ejercicio</button>
                    <button onClick={analyzeSession} className="px-4 py-3 bg-slate-800 text-purple-400 rounded-lg font-bold text-sm uppercase border border-slate-700 hover:bg-slate-700 hover:text-purple-300 transition flex items-center justify-center gap-2"><ClipboardList size={18} /> Analizar ✨</button>
                </div>
                <button onClick={() => setShowFinishModal(true)} className="w-full py-3 bg-amber-600 text-black rounded-lg font-bold text-sm uppercase shadow-lg shadow-amber-900/20 hover:bg-amber-500 transition">Finalizar Misión</button>
            </div>
            
            <div className="h-16"></div>
        </div>
    );
}