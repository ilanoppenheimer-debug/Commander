import {
  PLATE_CONFIG,
  DEFAULT_INVENTORY_STATE,
  DEFAULT_EXERCISE_DB,
  EQUIPMENT_TYPES,
  DEFAULT_MODES,
  PHASE_COLORS,
  SET_TYPES,
  DEFAULT_ROUTINES
} from "./constants/gymConstants";
import { calculatePlates } from "./utils/plateMath";
import { roundToIncrement, toKg, toLb, formatNum } from "./utils/weightUtils";
import {
  calculate1RM,
  calculateTrainingWeight
} from "./utils/strengthMath";
import { getExerciseDetails } from "./features/exerciseMeta.jsx";
import { playTacticalAlarm } from "./services/audioService";
import { callGeminiAPI } from "./services/aiService";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import InputGroup from "./components/ui/InputGroup";
import ToggleSwitch from "./components/UI/ToggleSwitch";
import InfoModal from "./components/UI/InfoModal";
import TrendModal from "./components/modals/TrendModal";
import { useTrainingState } from "./hooks/useTrainingState";
import ExerciseHistoryModal from "./components/modals/ExerciseHistoryModal";
import ExerciseSelectorModal from "./components/modals/ExerciseSelectorModal";
import AdvancedTimer from "./features/AdvancedTimer";
import TargetCalculator, { PlateVisualizer } from "./components/TargetCalculator";
import ReverseCalculator from "./components/ReverseCalculator";
import WorkCalculator from "./components/WorkCalculator";
import ActiveSession from "./components/ActiveSession";
import { 
  Dumbbell, 
  Trash2, 
  Plus, 
  Download, 
  Settings, 
  Activity, 
  TrendingUp, 
  Shield, 
  Zap, 
  FileText,
  X,
  ChevronLeft,
  Info,
  BrainCircuit,
  Play,
  Copy,
  Edit3,
  AlertTriangle,
  Loader2,
  Link as LinkIcon,
  Timer,
  Pause,
  RotateCcw,
  Wand2,
  ChevronUp,
  ChevronDown,
  Target,
  RefreshCw,
  ClipboardList,
  Flame,
  Utensils,
  Calculator,
  Minus,
  BarChart2,
  Sparkles,
  Search,
  LayoutGrid,
  Layers,
  Clock,
  Check
} from 'lucide-react';
import { buildAthleteProfile } from "./features/athleteProfile/buildAthleteProfile";

// --- CONFIGURACIÓN API GLOBAL ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

function AppMain() {
  const [activeTab, setActiveTab] = useState('routines'); 
  
  const [showSettings, setShowSettings] = useState(false);
  const [barWeight, setBarWeight] = useState(20);
  const [barUnit, setBarUnit] = useState('kg');
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY_STATE);
  
  const [routines, setRoutines] = useState(DEFAULT_ROUTINES);
  const [customExercises, setCustomExercises] = useState([]); 
  const [modes, setModes] = useState(DEFAULT_MODES); 
  const [activeModeId, setActiveModeId] = useState('standard'); 
  const [history, setHistory] = useState([]);
  const [historyMode, setHistoryMode] = useState('log'); 
  const [trendExercise, setTrendExercise] = useState(null); 
  
  const [activeSession, setActiveSession] = useState(null); 

  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");

  const [showImportModal, setShowImportModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState(null);
  const [importText, setImportText] = useState('');
  const [aiPrompt, setAiPrompt] = useState(''); 
  const [isGenerating, setIsGenerating] = useState(false); 
  const [isImporting, setIsImporting] = useState(false); 
  const [notification, setNotification] = useState(null);

  const showNotify = (msg, type = 'info') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

 const athleteProfile = useMemo(
  () => buildAthleteProfile(history),
  [history]
);

  // --- PERSISTENCE ---
  useEffect(() => {
    const savedData = localStorage.getItem('IronSuiteDataV14');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed.routines)) setRoutines(parsed.routines.filter(Boolean));
        if (parsed.barWeight) setBarWeight(parsed.barWeight);
        if (Array.isArray(parsed.modes) && parsed.modes.length > 0) setModes(parsed.modes.filter(Boolean));
        if (parsed.activeModeId) setActiveModeId(parsed.activeModeId);
        if (Array.isArray(parsed.customExercises)) setCustomExercises(parsed.customExercises.filter(Boolean));
        if (Array.isArray(parsed.history)) setHistory(parsed.history.filter(Boolean)); 
        if (parsed.activeSession) setActiveSession(parsed.activeSession); 
        if (parsed.activeTab) setActiveTab(parsed.activeTab); 
        if (parsed.historyMode) setHistoryMode(parsed.historyMode);
        
        if (parsed.inventory) {
            setInventory(prev => ({
                kg: { ...DEFAULT_INVENTORY_STATE.kg, ...(parsed.inventory.kg || {}) },
                lb: { ...DEFAULT_INVENTORY_STATE.lb, ...(parsed.inventory.lb || {}) }
            }));
        }
      } catch (e) { console.error("Error loading data", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('IronSuiteDataV14', JSON.stringify({ 
        routines, modes, activeModeId, inventory, barWeight, customExercises, history, activeSession, activeTab, historyMode, timestamp: new Date().toISOString() 
    }));
  }, [routines, modes, activeModeId, inventory, barWeight, customExercises, history, activeSession, activeTab, historyMode]);

  // --- ACTIONS IRON CMDR ---
  const createRoutine = () => {
      const newRoutine = { id: `routine-${Date.now()}`, name: 'Nueva Plantilla', lastPerformed: null, exercises: [] };
      setRoutines(prev => [newRoutine, ...(Array.isArray(prev) ? prev : [])]);
      showNotify("Plantilla Creada", "success");
  };

  const startRoutineFromTemplate = (routine) => {
      if(!routine) return;
      setActiveSession({
          id: `session-${Date.now()}`,
          name: routine.name || 'Rutina',
          exercises: JSON.parse(JSON.stringify(Array.isArray(routine.exercises) ? routine.exercises : [])),
          startTime: new Date().toISOString(),
      });
  };

  const startFreestyleSession = () => {
      setActiveSession({
          id: `session-${Date.now()}`,
          name: 'Entrenamiento Libre',
          exercises: [],
          startTime: new Date().toISOString(),
      });
  };

  const handleFinishMission = (sessionName, finalExercises, saveAsTemplate) => {
      const safeFinalExercises = Array.isArray(finalExercises) ? finalExercises : [];
      const completedSession = {
          historyId: `hist-${Date.now()}`,
          name: sessionName || 'Entrenamiento Libre',
          completedAt: new Date().toISOString(),
          exercises: safeFinalExercises
      };
      
      setHistory(prev => [completedSession, ...(Array.isArray(prev) ? prev : [])]);

      if (saveAsTemplate) {
          const newRoutine = {
              id: `routine-${Date.now()}`,
              name: sessionName || 'Nueva Plantilla',
              lastPerformed: new Date().toISOString(),
              exercises: safeFinalExercises.map(ex => ({ ...ex, sets: Array.isArray(ex?.sets) ? ex.sets.map(s => ({...s, weight: 0, reps: 0})) : []}))
          };
          setRoutines(prev => [newRoutine, ...(Array.isArray(prev) ? prev : [])]);
      }
      
      setActiveSession(null);
      showNotify("Misión Finalizada Exitosamente", "success");
  };

  const confirmDeleteRoutine = () => { if (routineToDelete) { setRoutines(prev => prev.filter(r => r.id !== routineToDelete)); setRoutineToDelete(null); showNotify("Plantilla eliminada."); } };
  const duplicateRoutine = (e, routine) => { e.stopPropagation(); const newRoutine = { ...routine, id: `routine-${Date.now()}`, name: `${routine.name || 'Rutina'} (Copia)`, lastPerformed: null }; setRoutines(prev => [...(Array.isArray(prev) ? prev : []), newRoutine]); showNotify("Plantilla Clonada", "success"); };

  const startEditingTemplateName = (e, routine) => {
      e.stopPropagation();
      setEditingTemplateId(routine.id);
      setEditingTemplateName(routine.name);
  };

  const saveTemplateName = (e, id) => {
      e.stopPropagation();
      setRoutines(prev => prev.map(r => r.id === id ? { ...r, name: editingTemplateName || 'Sin Nombre' } : r));
      setEditingTemplateId(null);
      showNotify("Nombre actualizado.");
  };

  const generateAIRoutine = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    const prompt = `Genera plantilla de gimnasio: "${aiPrompt}". Responde SOLO JSON con esta estructura exacta: { "name": "Nombre", "exercises": [{ "name": "Ej", "equipment": "barbell", "sets": [{ "weight": 0, "reps": 10, "rpe": 8, "type": "normal" }] }] }. Máximo 6 ejercicios. Opciones de equipo: barbell, dumbbell, bodyweight, machine, cable.`;
    try {
      const textResponse = await callGeminiAPI(prompt);
      const cleanJson = textResponse.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      const safeExercises = Array.isArray(parsedData.exercises) ? parsedData.exercises : [];
      const newRoutine = { id: `ai-${Date.now()}`, name: `${parsedData.name || 'Plantilla IA'} ✨`, lastPerformed: null, exercises: safeExercises.map((ex, idx) => ({ ...ex, equipment: ex.equipment || 'barbell', id: Date.now() + idx, sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({...s, type: 'normal'})) : [] })) };
      setRoutines(prev => [...(Array.isArray(prev) ? prev : []), newRoutine]);
      setShowAIModal(false);
      setAiPrompt('');
      showNotify("Protocolo Generado", "success");
    } catch (error) { console.error(error); showNotify("Error de conexión IA", "error"); } finally { setIsGenerating(false); }
  };

  const handleSmartImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    const prompt = `Parser plantilla de gym. Texto crudo: "${importText}". Responde SOLO JSON con esta estructura exacta: { "name": "Nombre", "exercises": [{ "name": "Ej", "equipment": "barbell", "sets": [{ "weight": 0, "reps": 10, "rpe": 8, "type": "normal" }] }] }. Opciones equipo: barbell, dumbbell, bodyweight, machine, cable.`;
    try {
        const textResponse = await callGeminiAPI(prompt);
        let parsedData;
        try {
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            parsedData = JSON.parse(jsonMatch[0]);
        } catch(e) {
            const lines = importText.split('\n').filter(l => l.trim().length > 3);
            parsedData = {
                name: "Plantilla Importada (Recuperada)",
                exercises: lines.map((l, i) => ({
                    name: l.split(/[,|-]/)[0].trim().substring(0, 30),
                    equipment: 'barbell',
                    sets: [{ weight: 0, reps: 10, rpe: 8, type: 'normal' }]
                }))
            };
        }

        const safeExercises = Array.isArray(parsedData.exercises) ? parsedData.exercises : [];
        const newRoutine = { id: `import-${Date.now()}`, name: parsedData.name || 'Plantilla Importada', lastPerformed: null, exercises: safeExercises.map((ex, idx) => ({ ...ex, equipment: ex.equipment || 'barbell', id: Date.now() + idx, sets: Array.isArray(ex.sets) ? ex.sets : [] })) };
        setRoutines(prev => [...(Array.isArray(prev) ? prev : []), newRoutine]);
        setShowImportModal(false);
        setImportText('');
        showNotify("Plantilla Importada", "success");
    } catch (error) { console.error("Import failed", error); showNotify("Error al procesar texto", "error"); } finally { setIsImporting(false); }
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ routines, customExercises, modes, history }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `IronCommander_Backup_${new Date().toLocaleDateString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const safeRoutines = Array.isArray(routines) ? routines : [];
  const safeModes = Array.isArray(modes) && modes.length > 0 ? modes : DEFAULT_MODES;
  const currentMode = safeModes.find(m => m.id === activeModeId) || safeModes[0] || DEFAULT_MODES[0];
  const safeHistory = Array.isArray(history) ? history.filter(Boolean) : [];
  
  const tabs = [
    { id: 'routines', label: 'Rutinas', icon: ClipboardList },
    { id: 'history', label: 'Historial', icon: Clock },
    { id: 'target', label: 'Cargar', icon: Calculator },
    { id: 'reverse', label: 'Sumar', icon: Plus },
    { id: 'work', label: 'Fuerza', icon: TrendingUp },
  ];

  const isTraining = activeSession !== null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500 selection:text-slate-900 overflow-hidden flex flex-col relative">
      
      {/* Toast Notification System */}
      {notification && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-full font-bold text-xs shadow-xl animate-fade-in-down flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-600 text-white' : notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 border border-sky-500 text-sky-400'}`}>
              <Info size={14} />
              {notification.msg}
          </div>
      )}

      {/* Temporizador Global Flotante */}
      <AdvancedTimer />

      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2" onClick={() => { if(!isTraining) setActiveTab('routines'); }}>
                <div className="p-1.5 bg-gradient-to-br from-amber-600 to-red-600 rounded shadow-lg shadow-amber-900/20 cursor-pointer">
                    <Dumbbell className="text-white w-5 h-5" />
                </div>
                <div className="cursor-pointer">
                    <h1 className="text-lg font-bold tracking-wider text-white uppercase leading-none">Iron Cmdr</h1>
                    <span className="text-[10px] text-amber-500 font-mono tracking-widest">SUITE V14.1</span>
                </div>
            </div>
            
            <div className="flex gap-2">
                {!isTraining && activeTab === 'routines' && (
                   <>
                    <button onClick={() => setShowAIModal(true)} className="p-2 text-purple-400 hover:bg-slate-800 rounded-lg border border-slate-800 hover:border-purple-500/50 transition" title="Generar con IA"><BrainCircuit size={20} /></button>
                    <button onClick={() => setShowImportModal(true)} className="p-2 text-green-400 hover:bg-slate-800 rounded-lg border border-slate-800 hover:border-green-500/50 transition" title="Importar Texto"><FileText size={20} /></button>
                   </>
                )}
                <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-white transition-colors" title="Configuración"><Settings className="w-5 h-5" /></button>
            </div>
        </div>
        
        {/* Periodization Selector (Visible in Routines Dashboard AND Active Session) */}
        {activeTab === 'routines' && (
            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 relative z-20">
                <div className="max-w-md mx-auto flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Fase Global:</span>
                    <select 
                      value={activeModeId} 
                      onChange={(e) => setActiveModeId(e.target.value)} 
                      className={`bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none ${currentMode?.color || 'text-slate-400'}`}
                    >
                        {safeModes.map(m => (<option key={m.id} value={m.id} className={m.color}>{m.label}</option>))}
                    </select>
                </div>
            </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full p-4 pb-24 relative">
        
        {/* VISTA: ENTRENAMIENTO EN VIVO */}
        {isTraining && activeTab === 'routines' && activeSession && (
            <ActiveSession 
                key={activeSession.id || 'active-session'}
                sessionData={activeSession} 
                updateSessionData={setActiveSession} 
                onFinishMission={handleFinishMission}
                onDiscardSession={() => { setActiveSession(null); showNotify("Sesión descartada.", "info"); }} 
                mode={currentMode} 
                history={safeHistory}
                customExercises={customExercises} 
                setCustomExercises={setCustomExercises} 
                barUnit={barUnit}
                showNotify={showNotify}
            />
        )}

        {/* ROUTINES VIEW (DASHBOARD) */}
        {!isTraining && activeTab === 'routines' && (
            <div className="space-y-6 animate-fade-in">
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500 transition shadow-lg" onClick={startFreestyleSession}>
                    <Activity size={32} className="text-amber-500" />
                    <span className="text-sm font-bold uppercase text-white">Entrenamiento Libre</span>
                    <span className="text-[10px] text-slate-500">Iniciar sesión vacía (sin plantilla)</span>
                </div>
                
                <div>
                    <div className="flex justify-between items-end mb-3 border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mis Plantillas</h3>
                        <button onClick={createRoutine} className="text-[10px] font-bold uppercase bg-slate-800 text-amber-500 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-amber-500 transition flex items-center gap-1 shadow-md">
                            <Plus size={12} /> Nueva
                        </button>
                    </div>
                    <div className="space-y-3">
                        {safeRoutines.map(routine => (
                            <div key={routine.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-500 transition relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 mr-4">
                                        {editingTemplateId === routine.id ? (
                                            <div className="flex items-center gap-2 mb-1">
                                                <input 
                                                    autoFocus
                                                    value={editingTemplateName} 
                                                    onChange={(e) => setEditingTemplateName(e.target.value)}
                                                    className="bg-slate-950 border border-amber-500 text-white text-sm font-bold rounded px-2 py-1 w-full"
                                                />
                                                <button onClick={(e) => saveTemplateName(e, routine.id)} className="p-1.5 bg-amber-600 text-black rounded"><Check size={14}/></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group/edit">
                                                <h4 className="font-bold text-white text-lg cursor-pointer hover:text-amber-500 transition-colors" onClick={(e) => startEditingTemplateName(e, routine)}>{routine.name || 'Plantilla Sin Nombre'}</h4>
                                                <button onClick={(e) => startEditingTemplateName(e, routine)} className="text-slate-500 opacity-0 group-hover/edit:opacity-100 hover:text-white transition-opacity"><Edit3 size={12}/></button>
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-500 font-mono">{Array.isArray(routine.exercises) ? routine.exercises.length : 0} Ejercicios</p>
                                    </div>
                                    <button onClick={() => startRoutineFromTemplate(routine)} className="w-10 h-10 shrink-0 rounded-full bg-amber-600 flex items-center justify-center text-black hover:bg-amber-500 shadow-lg shadow-amber-900/20" title="Iniciar esta rutina"><Play fill="currentColor" size={16} className="ml-0.5" /></button>
                                </div>
                                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700/50">
                                    <button onClick={(e) => duplicateRoutine(e, routine)} className="px-3 py-1.5 rounded bg-slate-900 text-xs text-slate-400 hover:text-white flex items-center gap-1"><Copy size={12} /> Clonar</button>
                                    <div className="flex-1"></div>
                                    <button onClick={(e) => { e.stopPropagation(); setRoutineToDelete(routine.id); }} className="px-3 py-1.5 rounded bg-slate-900 text-xs text-red-900 hover:text-red-500 flex items-center gap-1 hover:bg-red-900/20 transition cursor-pointer"><Trash2 size={12} /> Borrar</button>
                                </div>
                            </div>
                        ))}
                        {safeRoutines.length === 0 && <div className="text-center py-10 text-slate-600 italic">No tienes plantillas guardadas. Crea una o usa IA.</div>}
                    </div>
                </div>
                <div className="flex justify-center pt-8"><button onClick={handleDownload} className="text-xs text-slate-500 flex items-center gap-2 hover:text-white transition"><Download size={14} /> Backup Database (JSON)</button></div>
            </div>
        )}

        {/* HISTORY VIEW (DEDICATED TAB) */}
        {activeTab === 'history' && (
            <div className="animate-fade-in space-y-4">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2"><Clock className="text-sky-500"/> Historial</h2>
                    <span className="text-xs text-slate-500 font-mono">{safeHistory.length} Registros</span>
                </div>

                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 mb-4">
                    <button onClick={() => setHistoryMode('log')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${historyMode === 'log' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Sesiones</button>
                    <button onClick={() => setHistoryMode('stats')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${historyMode === 'stats' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Tendencias</button>
                </div>

                {historyMode === 'log' ? (
                    safeHistory.length === 0 ? (
                        <div className="text-center py-10 text-slate-600 italic">No hay misiones completadas aún. ¡Ve a entrenar!</div>
                    ) : (
                        <div className="space-y-4">
                            {safeHistory.map(h => (
                                <div key={h.historyId || Math.random()} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-white text-lg leading-tight">{h.name || 'Entrenamiento Libre'}</h3>
                                            <span className="text-[10px] text-amber-500 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 mt-1 inline-block">{h.completedAt ? new Date(h.completedAt).toLocaleString() : '-'}</span>
                                        </div>
                                        <button onClick={() => setHistory(prev => (Array.isArray(prev) ? prev.filter(item => item.historyId !== h.historyId) : []))} className="p-2 bg-slate-900 rounded text-slate-600 hover:text-red-500 transition"><Trash2 size={14}/></button>
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-1 mb-2 bg-slate-900/50 p-2 rounded-lg">
                                        {(Array.isArray(h.exercises) ? h.exercises : []).map((ex, i) => (
                                            <div key={i} className="flex justify-between border-b border-slate-700/50 py-1 last:border-0">
                                                <span className="truncate pr-2 text-slate-300 font-medium">{ex?.name || 'Ejercicio'}</span>
                                                <span className="shrink-0">{Array.isArray(ex?.sets) ? ex.sets.length : 0} series</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    safeHistory.length === 0 ? (
                        <div className="text-center py-10 text-slate-600 italic">Entrena para recolectar datos de inteligencia.</div>
                    ) : (
                        <div className="space-y-2">
                            {(()=>{
                                const counts = {};
                                safeHistory.forEach(session => {
                                    session.exercises?.forEach(ex => {
                                        if (ex?.name) { counts[ex.name] = (counts[ex.name] || 0) + 1; }
                                    });
                                });
                                return Object.entries(counts).sort((a,b) => b[1] - a[1]).map(([name, count]) => {
                                    const details = getExerciseDetails(name);
                                    return (
                                        <div key={name} onClick={() => setTrendExercise(name)} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:border-purple-500 hover:bg-slate-750 transition group">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg border ${details.bg} ${details.border} ${details.color}`}>{details.icon}</div>
                                                <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-purple-400 font-bold bg-purple-900/20 border border-purple-500/20 px-2 py-1 rounded-lg">{count} sesiones</span>
                                                <ChevronLeft size={16} className="text-slate-500 rotate-180 group-hover:text-purple-400" />
                                            </div>
                                        </div>
                                    )
                                });
                            })()}
                        </div>
                    )
                )}
            </div>
        )}

        {/* MODAL GLOBAL DE TENDENCIAS */}
        {trendExercise && (
            <TrendModal 
                exName={trendExercise} 
                history={safeHistory} 
                barUnit={barUnit} 
                onClose={() => setTrendExercise(null)} 
            />
        )}

        {/* CALCULATOR VIEWS */}
        {activeTab === 'target' && <TargetCalculator barWeight={barWeight} barUnit={barUnit} inventory={inventory} />}
        {activeTab === 'reverse' && <ReverseCalculator barWeight={barWeight} barUnit={barUnit} />}
        {activeTab === 'work' && <WorkCalculator />}
        
      </main>

      {/* BOTTOM NAVIGATION (SIEMPRE VISIBLE) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 pb-safe z-40">
        <div className="max-w-md mx-auto flex justify-around p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            const handleClick = () => {
                setActiveTab(tab.id);
            };

            return (
              <button key={tab.id} onClick={handleClick} className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 relative ${isActive ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
                {isActive && (<span className="absolute -top-1 w-12 h-1 bg-amber-500 rounded-b-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>)}
                <Icon className={`w-6 h-6 ${isActive ? 'scale-110 drop-shadow-lg' : 'scale-100'} transition-transform`} />
                <span className="text-[9px] font-bold uppercase tracking-wide">{tab.label}</span>
                {/* Indicador de Sesión Activa en Segundo Plano */}
                {tab.id === 'routines' && isTraining && !isActive && (
                    <span className="absolute top-[8px] right-[25%] w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_#10b981]"></span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* --- MODALS GLOBALES --- */}
      {showSettings && (
          <SettingsModal 
              inventory={inventory} setInventory={setInventory} 
              barWeight={barWeight} setBarWeight={setBarWeight} 
              barUnit={barUnit} setBarUnit={setBarUnit} 
              modes={modes} setModes={setModes}
              onClose={() => setShowSettings(false)} 
          />
      )}
      
      {routineToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 w-full max-w-xs rounded-xl border border-red-500/50 shadow-2xl p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-red-900/20 rounded-full text-red-500"><AlertTriangle size={32} /></div>
              <h3 className="text-lg font-bold text-white">¿Eliminar Plantilla?</h3>
              <div className="flex gap-2 w-full mt-2">
                <button onClick={() => setRoutineToDelete(null)} className="flex-1 py-2 rounded bg-slate-800 text-slate-300 font-bold text-sm">Cancelar</button>
                <button onClick={confirmDeleteRoutine} className="flex-1 py-2 rounded bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-900/20">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-purple-500/50 shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                  <div className="p-6">
                      <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><BrainCircuit className="text-purple-500" /> Iron AI</h3>{!isGenerating && <button onClick={() => setShowAIModal(false)}><X className="text-slate-500" /></button>}</div>
                      {isGenerating ? (<div className="flex flex-col items-center justify-center py-8 space-y-4"><Loader2 className="w-12 h-12 text-purple-500 animate-spin" /><p className="text-sm text-purple-300 font-mono animate-pulse">ESTABLECIENDO ENLACE...</p></div>) : (<><p className="text-sm text-slate-400 mb-4">Objetivo táctico para nueva plantilla:</p><textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Ej: Rutina de fuerza para hombros..." className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 focus:outline-none mb-4 resize-none" /><button onClick={generateAIRoutine} disabled={!aiPrompt.trim()} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition"><Zap size={18} fill="currentColor" /> Generar Protocolo</button></>)}
                  </div>
              </div>
          </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><FileText className="text-green-500" /> Importar</h3>{!isImporting && <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white"><X /></button>}</div>
            <div className="p-6 space-y-4">
              {isImporting ? (<div className="flex flex-col items-center justify-center py-8 space-y-4"><Loader2 className="w-12 h-12 text-green-500 animate-spin" /><p className="text-sm text-green-300 font-mono animate-pulse">ANALIZANDO DATOS TÁCTICOS...</p></div>) : (<><p className="text-xs text-slate-400">Pega aquí cualquier tabla o lista (Excel/Web). La IA creará una plantilla.</p><textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={`Ejemplo:\nPress Banca | 3 series | 10 reps | RPE 8\nSentadilla 4x8 100kg`} className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 font-mono focus:border-green-500 focus:outline-none"></textarea><button onClick={handleSmartImport} className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2"><BrainCircuit size={16} /> Procesar con IA</button></>)}
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .animate-pop-in { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-slide-in-right { animation: slideInRight 0.3s ease-out forwards; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        .overflow-x-auto::-webkit-scrollbar { display: none; }
        .overflow-x-auto { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// BOUNDARY DE SEGURIDAD ABSOLUTA
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col items-center justify-center font-sans">
          <AlertTriangle size={64} className="text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-center">Fallo Crítico Evitado</h1>
          <p className="text-slate-400 text-center mb-6 max-w-sm">Hubo un conflicto en la renderización o con los datos locales.</p>
          <div className="bg-black/50 p-4 rounded text-red-400 text-xs font-mono mb-6 w-full max-w-sm overflow-x-auto">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }} 
            className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-red-900/50 flex items-center gap-2"
          >
            <RotateCcw size={18} /> Limpiar Todo y Reiniciar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><AppMain /></ErrorBoundary>;
}