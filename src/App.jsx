import {
  PLATE_CONFIG,
  DEFAULT_INVENTORY_STATE,
  DEFAULT_EXERCISE_DB,
  EQUIPMENT_TYPES,
  DEFAULT_MODES,
  PHASE_COLORS,
  SET_TYPES,
  DEFAULT_ROUTINES,
  ACCENT_PRESETS
} from "./constants/gymConstants";
import { calculatePlates } from "./utils/plateMath";
import { historyToCSV, csvToHistory, downloadCSV } from "./utils/csvExport";
import { roundToIncrement, toKg, toLb, formatNum } from "./utils/weightUtils";
import { calculate1RM, calculateTrainingWeight } from "./utils/strengthMath";
import { getExerciseDetails } from "./features/exerciseMeta.jsx";
import { buildAthleteProfile } from "./features/athleteProfile/buildAthleteProfile";
import { playTacticalAlarm } from "./services/audioService";
import { callGeminiAPI } from "./services/aiService";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import InputGroup from "./components/ui/InputGroup";
import ToggleSwitch from "./components/ui/ToggleSwitch";
import InfoModal from "./components/ui/InfoModal";
import TrendModal from "./components/modals/TrendModal";
import ExerciseHistoryModal from "./components/modals/ExerciseHistoryModal";
import ExerciseSelectorModal from "./components/modals/ExerciseSelectorModal";
import AdvancedTimer from "./features/AdvancedTimer";
import TargetCalculator, { PlateVisualizer } from "./components/TargetCalculator";
import ReverseCalculator from "./components/ReverseCalculator";
import WorkCalculator from "./components/WorkCalculator";
import ActiveSession from "./components/ActiveSession";
import ErrorFallback from "./components/ErrorFallback";
import DataBackupTab from "./components/DataBackupTab";
import { useHistory, useRoutines, useCustomExercises } from "./db/hooks";
import { migrateFromLocalStorageIfNeeded } from "./db/migrations";
import { saveSession, deleteSession, saveRoutine, deleteRoutine, addCustomExercise, removeCustomExercise, getSetting, setSetting } from "./db/repository";
import { useSessionStore } from "./stores/sessionStore";
import { createBackup, downloadBackupAsFile } from "./services/backupService";
import { isSignedIn, performDriveBackup } from "./services/googleDriveService";
import { logger } from "./services/logger";
import {
  Dumbbell, Trash2, Plus, Download, Settings, Activity, TrendingUp, Shield, Zap, FileText,
  X, ChevronLeft, Info, BrainCircuit, Play, Copy, Edit3, AlertTriangle, Loader2, Link as LinkIcon,
  Timer, Pause, RotateCcw, Wand2, ChevronUp, ChevronDown, Target, RefreshCw, ClipboardList,
  Flame, Utensils, Calculator, Minus, BarChart2, Sparkles, Search, LayoutGrid, Layers, Clock, Check
} from 'lucide-react';

const FullSettingsModal = ({
  inventory,
  setInventory,
  barWeight,
  setBarWeight,
  barUnit,
  setBarUnit,
  modes,
  setModes,
  accent,
  setAccent,
  showNotify,
  onClose,
}) => {
  const [editingModeId, setEditingModeId] = useState(null);
  const [showAIPhaseInput, setShowAIPhaseInput] = useState(false);
  const [aiPhasePrompt, setAiPhasePrompt] = useState("");
  const [isGeneratingPhase, setIsGeneratingPhase] = useState(false);
  const [aiPhaseError, setAiPhaseError] = useState(null);
  const [settingsTab, setSettingsTab] = useState('fases');

  const updateCount = (unit, weight, delta) => {
    setInventory((prev) => {
      const currentUnitInventory = prev?.[unit] || {};
      const currentCount = currentUnitInventory[weight] || 0;
      return {
        ...prev,
        [unit]: { ...currentUnitInventory, [weight]: Math.max(0, currentCount + delta) },
      };
    });
  };

  const addMode = () => {
    const safeModes = Array.isArray(modes) ? modes : DEFAULT_MODES;
    const newMode = {
      id: `phase-${Date.now()}`,
      label: "Nueva Fase",
      rpe: "8",
      repRange: "8-10",
      sets: "3",
      weightMod: 1.0,
      color: PHASE_COLORS[safeModes.length % PHASE_COLORS.length],
      desc: "Fase personalizada.",
    };
    setModes([...safeModes, newMode]);
    setEditingModeId(newMode.id);
  };

  const generatePhaseWithAI = async () => {
    if (!aiPhasePrompt.trim()) return;
    setIsGeneratingPhase(true);
    setAiPhaseError(null);
    const safeModes = Array.isArray(modes) ? modes : DEFAULT_MODES;
    const promptText = `Actúa como un entrenador táctico experto. Analiza este texto y extrae/crea una fase de entrenamiento: "${aiPhasePrompt}". Responde ÚNICAMENTE con un objeto JSON válido usando esta estructura exacta: { "label": "Nombre corto de la Fase", "rpe": "ej. 8 o 7-8", "repRange": "ej. 5 o 8-10", "sets": "ej. 3", "weightMod": 1.0, "desc": "Descripción breve y motivadora" }`;
    try {
      const textResponse = await callGeminiAPI(promptText);
      const cleanJson = textResponse.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      const newMode = {
        id: `phase-${Date.now()}`,
        label: parsedData.label || "Fase IA Táctica",
        rpe: String(parsedData.rpe || "8"),
        repRange: String(parsedData.repRange || "8-10"),
        sets: String(parsedData.sets || "3"),
        weightMod: parseFloat(parsedData.weightMod) || 1.0,
        color: PHASE_COLORS[safeModes.length % PHASE_COLORS.length],
        desc: parsedData.desc || "Protocolo calculado por IA.",
      };
      setModes([...safeModes, newMode]);
      setAiPhasePrompt("");
      setShowAIPhaseInput(false);
    } catch (error) {
      console.error("AI Phase Generation Failed:", error);
      setAiPhaseError("No se pudo descifrar la fase. Intenta ser más descriptivo.");
    } finally {
      setIsGeneratingPhase(false);
    }
  };

  const updateMode = (id, field, val) => {
    setModes((prev) => Array.isArray(prev) ? prev.map((m) => (m.id === id ? { ...m, [field]: val } : m)) : DEFAULT_MODES);
  };

  const removeMode = (id) => {
    setModes((prev) => Array.isArray(prev) ? prev.filter((m) => m.id !== id) : DEFAULT_MODES);
    if (editingModeId === id) setEditingModeId(null);
  };

  const sortedKg = Object.keys(PLATE_CONFIG.kg).map(Number).sort((a, b) => b - a);
  const sortedLb = Object.keys(PLATE_CONFIG.lb).map(Number).sort((a, b) => b - a);
  const safeModesToRender = Array.isArray(modes) ? modes : DEFAULT_MODES;

  const SETTINGS_TABS = [
    { id: 'apariencia', label: 'Apariencia' },
    { id: 'fases',     label: 'Fases'      },
    { id: 'equipo',    label: 'Equipo'     },
    { id: 'datos',     label: 'Datos'      },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md md:max-w-4xl lg:max-w-5xl h-[90vh] md:h-[85vh] rounded-t-2xl sm:rounded-2xl border border-slate-800 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl z-20 shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" /> Configuración
          </h2>
          <button onClick={onClose} className="text-white font-bold px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500">
            Guardar
          </button>
        </div>

        <div className="flex border-b border-slate-800 px-4 shrink-0 overflow-x-auto">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                settingsTab === tab.id
                  ? 'border-accent-500 text-accent-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {settingsTab === 'apariencia' && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles size={14} /> Apariencia
              </h3>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Color de acento</div>
                <div className="flex flex-wrap gap-3">
                  {ACCENT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setAccent(p.id)}
                      title={p.label}
                      className={`w-10 h-10 rounded-full border-2 transition-all active:scale-95 ${accent === p.id ? "border-white ring-2 ring-white/40 scale-110" : "border-slate-700 hover:border-slate-500"}`}
                      style={{ backgroundColor: p.swatch }}
                    >
                      <span className="sr-only">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {settingsTab === 'fases' && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target size={14} /> Fases / Mesociclos
              </h3>
              <div className="space-y-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
                {safeModesToRender.map((m) => (
                  <div key={m.id}>
                    {editingModeId === m.id ? (
                      <div className="bg-slate-950 p-3 rounded-lg border border-accent-500/50 space-y-3 animate-fade-in-down">
                        <InputGroup label="Nombre de la Fase" value={m.label} onChange={(v) => updateMode(m.id, "label", v)} />
                        <div className="grid grid-cols-2 gap-2">
                          <InputGroup label="Series" value={m.sets} onChange={(v) => updateMode(m.id, "sets", v)} />
                          <InputGroup label="Reps" value={m.repRange} onChange={(v) => updateMode(m.id, "repRange", v)} />
                          <InputGroup label="RPE" value={m.rpe} onChange={(v) => updateMode(m.id, "rpe", v)} />
                          <InputGroup label="Multiplicador (Carga)" value={m.weightMod} type="number" step="0.05" onChange={(v) => updateMode(m.id, "weightMod", parseFloat(v) || 1)} />
                        </div>
                        <InputGroup label="Descripción" value={m.desc} onChange={(v) => updateMode(m.id, "desc", v)} />
                        <div className="flex justify-end pt-2">
                          <button onClick={() => setEditingModeId(null)} className="px-4 py-2 bg-accent-600 text-black font-bold text-xs rounded hover:bg-accent-500">Listo</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800 group">
                        <div>
                          <div className={`text-sm font-bold ${m.color}`}>{m.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.sets}x{m.repRange} @ RPE {m.rpe} | {m.weightMod}x Carga</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingModeId(m.id)} className="p-2 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"><Edit3 size={14} /></button>
                          {m.id !== "standard" && <button onClick={() => removeMode(m.id)} className="p-2 rounded text-slate-400 hover:text-red-500 hover:bg-slate-700 transition"><Trash2 size={14} /></button>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {!showAIPhaseInput ? (
                  <div className="flex gap-2 mt-2">
                    <button onClick={addMode} className="flex-1 py-2 border border-dashed border-slate-600 text-slate-400 hover:text-accent-500 hover:border-accent-500 rounded-lg text-xs font-bold uppercase transition flex items-center justify-center gap-1"><Plus size={14} /> Manual</button>
                    <button onClick={() => setShowAIPhaseInput(true)} className="flex-1 py-2 border border-dashed border-purple-500/50 text-purple-400 hover:text-purple-300 hover:border-purple-400 rounded-lg text-xs font-bold uppercase transition flex items-center justify-center gap-1 bg-purple-900/10"><Zap size={14} /> Importar/IA</button>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-3 rounded-lg border border-purple-500/50 space-y-3 mt-2 animate-fade-in-down">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1"><Zap size={12} /> Constructor Táctico IA</span>
                      <button onClick={() => setShowAIPhaseInput(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                    </div>
                    <textarea value={aiPhasePrompt} onChange={(e) => setAiPhasePrompt(e.target.value)} placeholder="Ej: Copia tu bloque de Excel, o escribe: 'Fase de hipertrofia, 4 series de 12 reps, RPE 8'" className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-purple-500 focus:outline-none resize-none" />
                    {aiPhaseError && <div className="text-[10px] text-red-500">{aiPhaseError}</div>}
                    <button onClick={generatePhaseWithAI} disabled={isGeneratingPhase || !aiPhasePrompt.trim()} className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded transition flex items-center justify-center gap-2">
                      {isGeneratingPhase ? <><Loader2 size={14} className="animate-spin" /> Procesando...</> : <><Sparkles size={14} /> Generar Fase</>}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {settingsTab === 'equipo' && (
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Info size={14} /> La Barra</h3>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-slate-400 font-bold">Peso</label>
                    <input type="number" value={barWeight} onChange={(e) => setBarWeight(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-bold mt-1" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase text-slate-400 font-bold mb-1">Unidad</label>
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">
                      {["kg", "lb"].map((u) => (
                        <button key={u} onClick={() => setBarUnit(u)} className={`px-3 py-2 rounded text-xs font-bold ${barUnit === u ? "bg-slate-700 text-white" : "text-slate-500"}`}>{u.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Inventario de Discos</h3>
                <div className="space-y-6">
                  {[{ u: "kg", weights: sortedKg, label: "Kilos" }, { u: "lb", weights: sortedLb, label: "Libras" }].map(({ u, weights, label }) => (
                    <div key={u} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                      <h4 className="text-sm font-bold text-white mb-3 uppercase flex justify-between">{label}</h4>
                      <div className="space-y-2">
                        {weights.map((w) => {
                          const count = inventory?.[u] ? inventory[u][w] || 0 : 0;
                          const cfg = PLATE_CONFIG[u]?.[w];
                          return (
                            <div key={w} className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                              <div className="flex items-center gap-3">
                                <div style={{ backgroundColor: cfg?.fill || "#334155", borderColor: cfg?.stroke || "#475569", color: cfg?.text || "#ffffff" }} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shadow-sm">{w}</div>
                                <span className="text-slate-400 text-sm font-medium">{w} {u}</span>
                              </div>
                              <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700">
                                <button onClick={() => updateCount(u, w, -2)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-l-lg">-2</button>
                                <div className="w-8 text-center font-bold text-white text-sm">{count}</div>
                                <button onClick={() => updateCount(u, w, 2)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-r-lg">+2</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {settingsTab === 'datos' && (
            <DataBackupTab showNotify={showNotify} onGoToHistory={() => { setActiveTab('history'); setShowSettings(false); }} />
          )}
        </div>
      </div>
    </div>
  );
};

function AppMain() {
  // ── Dexie live-query data ──────────────────────────────────────────────────
  const dbHistory         = useHistory();
  const dbRoutines        = useRoutines();
  const dbCustomExercises = useCustomExercises();

  // ── Zustand session store ──────────────────────────────────────────────────
  const session    = useSessionStore(s => s.session);
  const storeStart = useSessionStore(s => s.startSession);
  const storeFinish= useSessionStore(s => s.finishSession);
  const storeDiscard= useSessionStore(s => s.discardSession);

  // ── Settings (React state, loaded from Dexie on mount) ────────────────────
  const [activeTab,    setActiveTab]    = useState('routines');
  const [barWeight,    setBarWeight]    = useState(20);
  const [barUnit,      setBarUnit]      = useState('kg');
  const [inventory,    setInventory]    = useState(DEFAULT_INVENTORY_STATE);
  const [modes,        setModes]        = useState(DEFAULT_MODES);
  const [activeModeId, setActiveModeId] = useState('standard');
  const [historyMode,  setHistoryMode]  = useState('log');
  const [accent,       setAccent]       = useState('amber');

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showSettings,       setShowSettings]       = useState(false);
  const [editingTemplateId,  setEditingTemplateId]  = useState(null);
  const [editingTemplateName,setEditingTemplateName]= useState("");
  const [showImportModal,    setShowImportModal]    = useState(false);
  const [showAIModal,        setShowAIModal]        = useState(false);
  const [routineToDelete,    setRoutineToDelete]    = useState(null);
  const [importText,         setImportText]         = useState('');
  const [aiPrompt,           setAiPrompt]           = useState('');
  const [isGenerating,       setIsGenerating]       = useState(false);
  const [isImporting,        setIsImporting]        = useState(false);
  const [notification,       setNotification]       = useState(null);
  const [trendExercise,      setTrendExercise]      = useState(null);
  const [isMigrating,        setIsMigrating]        = useState(true);

  // Guard: only persist settings to Dexie after initial load is complete
  const isSettingsLoaded = useRef(false);

  // ── Accent CSS var ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.accent = accent;
    }
  }, [accent]);

  // ── Migration + initial Dexie load ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setIsMigrating(true);
      await migrateFromLocalStorageIfNeeded();

      // Load settings from Dexie
      const keys = ['barWeight','barUnit','accent','activeModeId','activeTab','historyMode','modes','inventory'];
      const values = await Promise.all(keys.map(k => getSetting(k)));
      const s = Object.fromEntries(keys.map((k, i) => [k, values[i]]));

      if (s.barWeight !== undefined) setBarWeight(s.barWeight);
      if (s.barUnit   !== undefined) setBarUnit(s.barUnit);
      if (s.accent    !== undefined) setAccent(s.accent);
      if (s.activeModeId !== undefined) setActiveModeId(s.activeModeId);
      if (s.activeTab !== undefined) setActiveTab(s.activeTab);
      if (s.historyMode !== undefined) setHistoryMode(s.historyMode);
      if (s.modes !== undefined && Array.isArray(s.modes) && s.modes.length > 0) setModes(s.modes);
      if (s.inventory !== undefined) {
        // Bug 1 fix: spread defaults first, then user data (user data wins)
        setInventory({
          kg: { ...DEFAULT_INVENTORY_STATE.kg, ...(s.inventory?.kg || {}) },
          lb: { ...DEFAULT_INVENTORY_STATE.lb, ...(s.inventory?.lb || {}) },
        });
      }

      // Hydrate active session from Dexie
      await useSessionStore.getState().hydrateFromDb();

      isSettingsLoaded.current = true;
      setIsMigrating(false);
    })();
  }, []);

  // ── Persist settings to Dexie on change (after initial load) ─────────────
  useEffect(() => { if (isSettingsLoaded.current) setSetting('barWeight', barWeight); }, [barWeight]);
  useEffect(() => { if (isSettingsLoaded.current) setSetting('barUnit', barUnit); }, [barUnit]);
  useEffect(() => { if (isSettingsLoaded.current) setSetting('accent', accent); }, [accent]);
  useEffect(() => { if (isSettingsLoaded.current) setSetting('activeModeId', activeModeId); }, [activeModeId]);
  useEffect(() => { if (isSettingsLoaded.current) setSetting('activeTab', activeTab); }, [activeTab]);
  useEffect(() => { if (isSettingsLoaded.current) setSetting('historyMode', historyMode); }, [historyMode]);
  useEffect(() => { if (isSettingsLoaded.current) setSetting('modes', modes); }, [modes]);
  useEffect(() => { if (isSettingsLoaded.current) setSetting('inventory', inventory); }, [inventory]);

  // ── Auto backup check on load ─────────────────────────────────────────────
  useEffect(() => {
    if (isMigrating) return;
    (async () => {
      try {
        const lastBackup = await getSetting('lastBackupDate');
        const oneDayMs = 24 * 60 * 60 * 1000;
        const needsBackup = !lastBackup || (Date.now() - new Date(lastBackup).getTime() > oneDayMs);
        if (needsBackup && await isSignedIn()) {
          const backup = await createBackup();
          await performDriveBackup(backup);
          logger.info('Auto-backup completed on app open');
        }
      } catch { /* non-blocking */ }
    })();
  }, [isMigrating]);

  const showNotify = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Derived safe refs ──────────────────────────────────────────────────────
  const safeRoutines    = Array.isArray(dbRoutines)        ? dbRoutines.filter(Boolean)         : [];
  const safeHistory     = Array.isArray(dbHistory)         ? dbHistory.filter(Boolean)          : [];
  const safeCustomExs   = Array.isArray(dbCustomExercises) ? dbCustomExercises.filter(Boolean)  : [];
  const safeModes       = Array.isArray(modes) && modes.length > 0 ? modes : DEFAULT_MODES;
  const currentMode     = safeModes.find(m => m.id === activeModeId) || safeModes[0] || DEFAULT_MODES[0];
  const athleteProfile  = useMemo(() => buildAthleteProfile(safeHistory), [safeHistory]);
  const isTraining      = session !== null;

  const tabs = [
    { id: 'routines', label: 'Rutinas',   icon: ClipboardList },
    { id: 'history',  label: 'Historial', icon: Clock },
    { id: 'target',   label: 'Cargar',    icon: Calculator },
    { id: 'reverse',  label: 'Sumar',     icon: Plus },
    { id: 'work',     label: 'Fuerza',    icon: TrendingUp },
  ];

  // ── Actions ────────────────────────────────────────────────────────────────
  const createRoutine = async () => {
    const newRoutine = { id: `routine-${Date.now()}`, name: 'Nueva Plantilla', lastPerformed: null, exercises: [] };
    await saveRoutine(newRoutine);
    showNotify("Plantilla Creada", "success");
  };

  const startRoutineFromTemplate = (routine) => {
    if (!routine) return;
    storeStart(routine);
  };

  const startFreestyleSession = () => {
    storeStart(null);
  };

  const handleFinishMission = async (sessionName, finalExercises, saveAsTemplate) => {
    const safeFinalExercises = Array.isArray(finalExercises) ? finalExercises : [];
    const completedSession = {
      historyId: `hist-${Date.now()}`,
      name: sessionName || 'Entrenamiento Libre',
      completedAt: new Date().toISOString(),
      exercises: safeFinalExercises,
    };

    await saveSession(completedSession);

    if (saveAsTemplate) {
      const newRoutine = {
        id: `routine-${Date.now()}`,
        name: sessionName || 'Nueva Plantilla',
        lastPerformed: new Date().toISOString(),
        exercises: safeFinalExercises.map(ex => ({
          ...ex,
          sets: Array.isArray(ex?.sets) ? ex.sets.map(s => ({ ...s, weight: 0, reps: 0 })) : [],
        })),
      };
      await saveRoutine(newRoutine);
    }

    storeFinish();
    showNotify("Misión Finalizada Exitosamente", "success");
    logger.info('Session finished', { name: sessionName, exercises: safeFinalExercises.length });

    // Non-blocking Drive backup after session
    (async () => {
      try {
        if (await isSignedIn()) {
          const backup = await createBackup();
          await performDriveBackup(backup);
        }
      } catch { /* non-blocking */ }
    })();
  };

  const confirmDeleteRoutine = async () => {
    if (routineToDelete) {
      await deleteRoutine(routineToDelete);
      setRoutineToDelete(null);
      showNotify("Plantilla eliminada.");
    }
  };

  const duplicateRoutine = async (e, routine) => {
    e.stopPropagation();
    const newRoutine = { ...routine, id: `routine-${Date.now()}`, name: `${routine.name || 'Rutina'} (Copia)`, lastPerformed: null };
    await saveRoutine(newRoutine);
    showNotify("Plantilla Clonada", "success");
  };

  const startEditingTemplateName = (e, routine) => {
    e.stopPropagation();
    setEditingTemplateId(routine.id);
    setEditingTemplateName(routine.name);
  };

  const saveTemplateName = async (e, routine) => {
    e.stopPropagation();
    await saveRoutine({ ...routine, name: editingTemplateName || 'Sin Nombre' });
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
      const newRoutine = {
        id: `ai-${Date.now()}`,
        name: `${parsedData.name || 'Plantilla IA'} ✨`,
        lastPerformed: null,
        exercises: safeExercises.map((ex, idx) => ({ ...ex, equipment: ex.equipment || 'barbell', id: Date.now() + idx, sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({ ...s, type: 'normal' })) : [] }))
      };
      await saveRoutine(newRoutine);
      setShowAIModal(false);
      setAiPrompt('');
      showNotify("Protocolo Generado", "success");
    } catch (error) { console.error(error); showNotify("Error de conexión IA", "error"); }
    finally { setIsGenerating(false); }
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
          exercises: lines.map(l => ({ name: l.split(/[,|-]/)[0].trim().substring(0, 30), equipment: 'barbell', sets: [{ weight: 0, reps: 10, rpe: 8, type: 'normal' }] }))
        };
      }
      const safeExercises = Array.isArray(parsedData.exercises) ? parsedData.exercises : [];
      const newRoutine = {
        id: `import-${Date.now()}`,
        name: parsedData.name || 'Plantilla Importada',
        lastPerformed: null,
        exercises: safeExercises.map((ex, idx) => ({ ...ex, equipment: ex.equipment || 'barbell', id: Date.now() + idx, sets: Array.isArray(ex.sets) ? ex.sets : [] }))
      };
      await saveRoutine(newRoutine);
      setShowImportModal(false);
      setImportText('');
      showNotify("Plantilla Importada", "success");
    } catch (error) { console.error("Import failed", error); showNotify("Error al procesar texto", "error"); }
    finally { setIsImporting(false); }
  };

  const handleDownload = async () => {
    try {
      await downloadBackupAsFile();
      showNotify("Backup descargado", "success");
    } catch (e) {
      showNotify("Error al exportar", "error");
    }
  };

  const handleExportHistoryCSV = () => {
    if (!Array.isArray(safeHistory) || safeHistory.length === 0) {
      showNotify("Historial vacío, nada para exportar", "info");
      return;
    }
    const csv = historyToCSV(safeHistory);
    const today = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `IronCommander_Historial_${today}.csv`);
    showNotify(`Exportadas ${safeHistory.length} sesiones`, "success");
  };

  const handleImportHistoryCSV = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = csvToHistory(String(e.target?.result || ""));
        if (imported.length === 0) { showNotify("CSV vacío o inválido", "error"); return; }
        const existingIds = new Set(safeHistory.map(h => h?.historyId).filter(Boolean));
        const deduped = imported.filter(h => !existingIds.has(h.historyId));
        for (const s of deduped) await saveSession(s);
        showNotify(`Importadas ${deduped.length} sesiones nuevas`, "success");
      } catch (err) {
        console.error("Import CSV failed", err);
        showNotify("Error al leer el CSV", "error");
      }
    };
    reader.readAsText(file);
  };

  if (isMigrating) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="text-accent-500 animate-spin" />
        <p className="text-slate-400 font-mono text-sm animate-pulse">Iniciando base de datos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-accent-500 selection:text-slate-900 overflow-hidden flex flex-col relative">

      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-full font-bold text-xs shadow-xl animate-fade-in-down flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-600 text-white' : notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 border border-sky-500 text-sky-400'}`}>
          <Info size={14} />
          {notification.msg}
        </div>
      )}

      <AdvancedTimer />

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-md md:max-w-5xl lg:max-w-6xl xl:max-w-[88rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => { if (!isTraining) setActiveTab('routines'); }}>
            <div className="p-1.5 bg-gradient-to-br from-accent-600 to-red-600 rounded shadow-lg shadow-accent-900/20 cursor-pointer">
              <Dumbbell className="text-white w-5 h-5" />
            </div>
            <div className="cursor-pointer">
              <h1 className="text-lg font-bold tracking-wider text-white uppercase leading-none">Iron Cmdr</h1>
              <span className="text-[10px] text-accent-500 font-mono tracking-widest">SUITE V14.1</span>
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

        {activeTab === 'routines' && (
          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 relative z-20">
            <div className="max-w-md md:max-w-5xl lg:max-w-6xl xl:max-w-[88rem] mx-auto flex items-center justify-between gap-2">
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

      <main className="flex-1 overflow-y-auto max-w-md md:max-w-5xl lg:max-w-6xl xl:max-w-[88rem] mx-auto w-full p-4 md:px-6 lg:px-8 pb-24 relative">

        {isTraining && activeTab === 'routines' && session && (
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <ActiveSession
              key={session.id || 'active-session'}
              onFinishMission={handleFinishMission}
              onDiscardSession={() => { storeDiscard(); showNotify("Sesión descartada.", "info"); }}
              mode={currentMode}
              history={safeHistory}
              athleteProfile={athleteProfile}
              customExercises={safeCustomExs}
              addCustomExercise={addCustomExercise}
              removeCustomExercise={removeCustomExercise}
              barUnit={barUnit}
              showNotify={showNotify}
            />
          </ErrorBoundary>
        )}

        {!isTraining && activeTab === 'routines' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent-500 transition shadow-lg" onClick={startFreestyleSession}>
              <Activity size={32} className="text-accent-500" />
              <span className="text-sm font-bold uppercase text-white">Entrenamiento Libre</span>
              <span className="text-[10px] text-slate-500">Iniciar sesión vacía (sin plantilla)</span>
            </div>

            <div>
              <div className="flex justify-between items-end mb-3 border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mis Plantillas</h3>
                <button onClick={createRoutine} className="text-[10px] font-bold uppercase bg-slate-800 text-accent-500 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-accent-500 transition flex items-center gap-1 shadow-md">
                  <Plus size={12} /> Nueva
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {safeRoutines.map(routine => (
                  <div key={routine.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-500 transition relative group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 mr-4">
                        {editingTemplateId === routine.id ? (
                          <div className="flex items-center gap-2 mb-1">
                            <input autoFocus value={editingTemplateName} onChange={(e) => setEditingTemplateName(e.target.value)} className="bg-slate-950 border border-accent-500 text-white text-sm font-bold rounded px-2 py-1 w-full" />
                            <button onClick={(e) => saveTemplateName(e, routine)} className="p-1.5 bg-accent-600 text-black rounded"><Check size={14}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/edit">
                            <h4 className="font-bold text-white text-lg cursor-pointer hover:text-accent-500 transition-colors" onClick={(e) => startEditingTemplateName(e, routine)}>{routine.name || 'Plantilla Sin Nombre'}</h4>
                            <button onClick={(e) => startEditingTemplateName(e, routine)} className="text-slate-500 opacity-0 group-hover/edit:opacity-100 hover:text-white transition-opacity"><Edit3 size={12}/></button>
                          </div>
                        )}
                        <p className="text-xs text-slate-500 font-mono">{Array.isArray(routine.exercises) ? routine.exercises.length : 0} Ejercicios</p>
                      </div>
                      <button onClick={() => startRoutineFromTemplate(routine)} className="w-10 h-10 shrink-0 rounded-full bg-accent-600 flex items-center justify-center text-black hover:bg-accent-500 shadow-lg shadow-accent-900/20" title="Iniciar esta rutina"><Play fill="currentColor" size={16} className="ml-0.5" /></button>
                    </div>
                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700/50">
                      <button onClick={(e) => duplicateRoutine(e, routine)} className="px-3 py-1.5 rounded bg-slate-900 text-xs text-slate-400 hover:text-white flex items-center gap-1"><Copy size={12} /> Clonar</button>
                      <div className="flex-1"></div>
                      <button onClick={(e) => { e.stopPropagation(); setRoutineToDelete(routine.id); }} className="px-3 py-1.5 rounded bg-slate-900 text-xs text-red-900 hover:text-red-500 flex items-center gap-1 hover:bg-red-900/20 transition cursor-pointer"><Trash2 size={12} /> Borrar</button>
                    </div>
                  </div>
                ))}
                {safeRoutines.length === 0 && <div className="text-center py-10 text-slate-600 italic col-span-3">No tienes plantillas guardadas. Crea una o usa IA.</div>}
              </div>
            </div>
            <div className="flex justify-center pt-8">
              <button onClick={handleDownload} className="text-xs text-slate-500 flex items-center gap-2 hover:text-white transition"><Download size={14} /> Backup Database (JSON)</button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2"><Clock className="text-sky-500"/> Historial</h2>
              <span className="text-xs text-slate-500 font-mono">{safeHistory.length} Registros</span>
            </div>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 mb-2">
              <button onClick={() => setHistoryMode('log')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${historyMode === 'log' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Sesiones</button>
              <button onClick={() => setHistoryMode('stats')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${historyMode === 'stats' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Tendencias</button>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={handleExportHistoryCSV} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-slate-900 border border-slate-700 rounded-md hover:border-sky-500/60 hover:text-sky-300 transition"><Download size={12}/> Exportar CSV</button>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-slate-900 border border-slate-700 rounded-md hover:border-emerald-500/60 hover:text-emerald-300 transition cursor-pointer">
                <FileText size={12}/> Importar CSV
                <input type="file" accept=".csv,text/csv" onChange={handleImportHistoryCSV} className="hidden" />
              </label>
            </div>

            {historyMode === 'log' ? (
              safeHistory.length === 0 ? (
                <div className="md:max-w-md md:mx-auto text-center py-16 text-slate-600 italic">No hay misiones completadas aún. ¡Ve a entrenar!</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {safeHistory.map(h => (
                    <div key={h.historyId || Math.random()} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-white text-lg leading-tight">{h.name || 'Entrenamiento Libre'}</h3>
                          <span className="text-[10px] text-accent-500 font-mono bg-accent-500/10 px-2 py-0.5 rounded border border-accent-500/20 mt-1 inline-block">{h.completedAt ? new Date(h.completedAt).toLocaleString() : '-'}</span>
                        </div>
                        <button onClick={() => deleteSession(h.historyId)} className="p-2 bg-slate-900 rounded text-slate-600 hover:text-red-500 transition"><Trash2 size={14}/></button>
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
                <div className="md:max-w-md md:mx-auto text-center py-16 text-slate-600 italic">Entrena para recolectar datos de inteligencia.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(() => {
                    const counts = {};
                    safeHistory.forEach(s => { s.exercises?.forEach(ex => { if (ex?.name) counts[ex.name] = (counts[ex.name] || 0) + 1; }); });
                    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
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
                      );
                    });
                  })()}
                </div>
              )
            )}
          </div>
        )}

        {trendExercise && (
          <TrendModal exName={trendExercise} history={safeHistory} barUnit={barUnit} onClose={() => setTrendExercise(null)} />
        )}

        {activeTab === 'target'  && <ErrorBoundary FallbackComponent={ErrorFallback}><TargetCalculator barWeight={barWeight} barUnit={barUnit} inventory={inventory} /></ErrorBoundary>}
        {activeTab === 'reverse' && <ErrorBoundary FallbackComponent={ErrorFallback}><ReverseCalculator barWeight={barWeight} barUnit={barUnit} /></ErrorBoundary>}
        {activeTab === 'work'    && <ErrorBoundary FallbackComponent={ErrorFallback}><WorkCalculator /></ErrorBoundary>}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 pb-safe z-40">
        <div className="max-w-md md:max-w-xl mx-auto flex justify-around p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 relative ${isActive ? 'text-accent-500' : 'text-slate-500 hover:text-slate-300'}`}>
                {isActive && <span className="absolute -top-1 w-12 h-1 bg-accent-500 rounded-b-full shadow-[0_0_10px_rgb(var(--accent-500)/0.5)]"></span>}
                <Icon className={`w-6 h-6 ${isActive ? 'scale-110 drop-shadow-lg' : 'scale-100'} transition-transform`} />
                <span className="text-[9px] font-bold uppercase tracking-wide">{tab.label}</span>
                {tab.id === 'routines' && isTraining && !isActive && (
                  <span className="absolute top-[8px] right-[25%] w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_#10b981]"></span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {showSettings && (
        <FullSettingsModal
          inventory={inventory} setInventory={setInventory}
          barWeight={barWeight} setBarWeight={setBarWeight}
          barUnit={barUnit} setBarUnit={setBarUnit}
          modes={modes} setModes={setModes}
          accent={accent} setAccent={setAccent}
          showNotify={showNotify}
          onClose={() => setShowSettings(false)}
        />
      )}

      {routineToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setRoutineToDelete(null)}>
          <div className="bg-slate-900 w-full max-w-xs rounded-xl border border-red-500/50 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => !isGenerating && setShowAIModal(false)}>
          <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-purple-500/50 shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><BrainCircuit className="text-purple-500" /> Iron AI</h3><button onClick={() => setShowAIModal(false)} className="p-1 text-slate-500 hover:text-white transition"><X size={20} /></button></div>
              {isGenerating ? (<div className="flex flex-col items-center justify-center py-8 space-y-4"><Loader2 className="w-12 h-12 text-purple-500 animate-spin" /><p className="text-sm text-purple-300 font-mono animate-pulse">ESTABLECIENDO ENLACE...</p></div>) : (<><p className="text-sm text-slate-400 mb-4">Objetivo táctico para nueva plantilla:</p><textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Ej: Rutina de fuerza para hombros..." className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 focus:outline-none mb-4 resize-none" /><button onClick={generateAIRoutine} disabled={!aiPrompt.trim()} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition"><Zap size={18} fill="currentColor" /> Generar Protocolo</button></>)}
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => !isImporting && setShowImportModal(false)}>
          <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><FileText className="text-green-500" /> Importar</h3><button onClick={() => setShowImportModal(false)} className="p-1 text-slate-400 hover:text-white transition"><X size={20} /></button></div>
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

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AppMain />
    </ErrorBoundary>
  );
}
