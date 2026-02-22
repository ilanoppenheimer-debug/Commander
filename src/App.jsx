import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Clock
} from 'lucide-react';

// --- CONFIGURACIÓN API GLOBAL ---
const apiKey = ""; 

// ==========================================
// SECCIÓN 1: CONSTANTES Y CONFIGURACIÓN
// ==========================================

const PLATE_CONFIG = {
  kg: {
    25: { color: 'bg-red-600 border-red-800', height: 'h-32', label: '25', type: 'standard', text: 'text-white' },
    20: { color: 'bg-blue-600 border-blue-800', height: 'h-32', label: '20', type: 'standard', text: 'text-white' },
    15: { color: 'bg-yellow-400 border-yellow-600', height: 'h-28', label: '15', type: 'standard', text: 'text-black' },
    10: { color: 'bg-green-600 border-green-800', height: 'h-24', label: '10', type: 'standard', text: 'text-white' },
    5: { color: 'bg-slate-100 border-slate-300', height: 'h-20', label: '5', type: 'standard', text: 'text-black' },
    2.5: { color: 'bg-red-600 border-red-800', height: 'h-16', label: '2.5', type: 'fractional', text: 'text-white' },
    2: { color: 'bg-blue-500 border-blue-700', height: 'h-16', label: '2', type: 'fractional', text: 'text-white' },
    1.5: { color: 'bg-yellow-400 border-yellow-600', height: 'h-14', label: '1.5', type: 'fractional', text: 'text-black' },
    1.25: { color: 'bg-slate-400 border-slate-600', height: 'h-14', label: '1.25', type: 'fractional', text: 'text-white' },
    1: { color: 'bg-green-500 border-green-700', height: 'h-12', label: '1', type: 'fractional', text: 'text-white' },
    0.5: { color: 'bg-slate-100 border-slate-300', height: 'h-10', label: '0.5', type: 'fractional', text: 'text-black' },
    0.25: { color: 'bg-slate-300 border-slate-400', height: 'h-9', label: '0.25', type: 'fractional', text: 'text-black' },
  },
  lb: {
    45: { color: 'bg-blue-600 border-blue-800', height: 'h-32', label: '45', type: 'standard', text: 'text-white' },
    35: { color: 'bg-yellow-400 border-yellow-600', height: 'h-28', label: '35', type: 'standard', text: 'text-black' },
    25: { color: 'bg-green-600 border-green-800', height: 'h-24', label: '25', type: 'standard', text: 'text-white' },
    10: { color: 'bg-slate-100 border-slate-300', height: 'h-20', label: '10', type: 'standard', text: 'text-black' },
    5: { color: 'bg-black border-slate-600', height: 'h-16', label: '5', type: 'fractional', text: 'text-white' },
    2.5: { color: 'bg-slate-400 border-slate-600', height: 'h-14', label: '2.5', type: 'fractional', text: 'text-white' },
    1.25: { color: 'bg-slate-300 border-slate-500', height: 'h-10', label: '1.25', type: 'fractional', text: 'text-black' },
  }
};

const DEFAULT_INVENTORY_STATE = {
  kg: { 25: 6, 20: 8, 15: 4, 10: 4, 5: 4, 2.5: 4, 2: 2, 1.5: 2, 1.25: 4, 1: 2, 0.5: 2, 0.25: 2 },
  lb: { 45: 8, 35: 4, 25: 4, 10: 6, 5: 4, 2.5: 4, 1.25: 2 }
};

const DEFAULT_EXERCISE_DB = [
  "Press Banca", "Press Banca Inclinado", "Aperturas de Pecho", "Cruce de Poleas", "Fondos en Paralelas",
  "Sentadilla", "Prensa de Piernas", "Extensiones de Cuádriceps", "Sentadilla Búlgara", "Sentadilla Hack",
  "Peso Muerto", "Peso Muerto Rumano", "Curl Femoral", "Hip Thrust", "Elevación de Gemelos",
  "Dominadas", "Remo con Barra", "Jalón al Pecho", "Remo en Punta", "Pull-over con Polea",
  "Press Militar", "Elevaciones Laterales", "Pájaros (Elevaciones Posteriores)", "Encogimientos de Hombros",
  "Curl de Bíceps", "Curl Martillo", "Curl Predicador", "Extensión de Tríceps", "Rompecráneos", "Press Francés",
  "Plancha Abdominal", "Crunch Abdominal", "Elevación de Piernas"
].sort();

const EQUIPMENT_TYPES = [
  { id: 'barbell', label: 'Barra' },
  { id: 'dumbbell', label: 'Mancuernas' },
  { id: 'bodyweight', label: 'Peso Corporal' },
  { id: 'machine', label: 'Máquina' },
  { id: 'cable', label: 'Polea' },
  { id: 'smith', label: 'Multipower' },
  { id: 'kettlebell', label: 'Kettlebell' }
];

const DEFAULT_MODES = [
  { id: 'standard', label: 'Modo Libre', rpe: '-', repRange: '-', sets: '-', weightMod: 1.0, color: 'text-slate-400', desc: 'Registro manual sin asistencia.' },
  { id: 'm1_base', label: 'MESO 1: Base', rpe: '7-8', repRange: '5-6', sets: 3, weightMod: 1.0, color: 'text-blue-400', desc: 'Acumula fatiga controlada.' },
  { id: 'm1_deload', label: 'MESO 1: Descarga', rpe: '5', repRange: '5', sets: 2, weightMod: 0.6, color: 'text-green-400', desc: 'OBLIGATORIO. Pesos ligeros.' },
  { id: 'm2_int', label: 'MESO 2: Fuerza', rpe: '8-9', repRange: '3-4', sets: 3, weightMod: 1.1, color: 'text-amber-500', desc: 'Sube peso, baja reps.' },
  { id: 'm2_deload', label: 'MESO 2: Descarga', rpe: '5', repRange: '3', sets: 2, weightMod: 0.6, color: 'text-green-400', desc: 'Recuperación del SNC.' },
  { id: 'm3_peak', label: 'MESO 3: Peaking', rpe: '9-10', repRange: '1-3', sets: 3, weightMod: 1.25, color: 'text-red-600', desc: 'Busca PRs (Récords).' },
];

const PHASE_COLORS = ['text-blue-400', 'text-green-400', 'text-amber-500', 'text-red-600', 'text-purple-400', 'text-pink-400', 'text-sky-400'];

const SET_TYPES = {
  NORMAL: { id: 'normal', label: '', color: 'text-slate-500', bg: 'bg-transparent' },
  WARMUP: { id: 'warmup', label: 'W', color: 'text-yellow-200', bg: 'bg-yellow-900/40' },
  TOP: { id: 'top', label: 'TOP', color: 'text-amber-400', bg: 'bg-amber-900/40' },
  BACKOFF: { id: 'backoff', label: 'BACK', color: 'text-blue-300', bg: 'bg-blue-900/40' },
  DROP: { id: 'drop', label: 'DROP', color: 'text-red-400', bg: 'bg-red-900/40' },
  AMRAP: { id: 'amrap', label: 'AMRAP', color: 'text-purple-400', bg: 'bg-purple-900/40' }
};

const DEFAULT_ROUTINES = [
  {
    id: 'routine-1',
    name: 'Plantilla Push Alpha',
    lastPerformed: null,
    exercises: [
      { id: 101, name: 'Press Banca', equipment: 'barbell', sets: [{ weight: 0, reps: 10, rpe: 7, type: 'normal' }] },
      { id: 102, name: 'Press Militar', equipment: 'dumbbell', sets: [{ weight: 0, reps: 10, rpe: 8, type: 'normal' }] },
      { id: 103, name: 'Fondos en Paralelas', equipment: 'bodyweight', sets: [{ weight: 0, reps: 12, rpe: 9, type: 'normal' }] }
    ]
  }
];

// ==========================================
// SECCIÓN 2: UTILIDADES
// ==========================================

const toKg = (val, unit) => (unit === 'kg' ? val : val * 0.453592);
const toLb = (val, unit) => (unit === 'lb' ? val : val * 2.20462);
const formatNum = (num) => { const n = parseFloat(num); if (isNaN(n)) return 0; return parseFloat(n.toFixed(2)); };

const FORMULAS = {
  epley: (w, r) => w * (1 + r / 30),
  brzycki: (w, r) => w * (36 / (37 - r)),
  hybrid: (w, r) => (FORMULAS.epley(w, r) + FORMULAS.brzycki(w, r)) / 2
};

const calculate1RM = (weight, reps, rpe, formulaType = 'epley') => {
  const w = parseFloat(weight) || 0;
  const r = parseFloat(reps) || 0;
  const rpeVal = rpe ? parseFloat(rpe) : 10;
  const effectiveReps = r + (10 - rpeVal);
  if (effectiveReps <= 1) return w;
  return FORMULAS[formulaType](w, effectiveReps);
};

const calculateTrainingWeight = (oneRM, targetReps, targetRPE) => {
  const rpeVal = targetRPE ? parseFloat(targetRPE) : 10;
  const effectiveReps = targetReps + (10 - rpeVal);
  return oneRM / (1 + effectiveReps / 30); 
};

const getExerciseDetails = (name) => {
  if (!name) return { icon: <Dumbbell size={18} />, color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', label: 'General' };
  const n = String(name).toLowerCase();
  
  if (n.includes('press banca') || n.includes('pecho') || n.includes('aperturas') || n.includes('cruce') || n.includes('fondo') || n.includes('push')) {
    return { icon: <Shield size={18} />, color: 'text-sky-400', bg: 'bg-sky-900/20', border: 'border-sky-500/30', label: 'Pecho' };
  }
  if (n.includes('remo') || n.includes('dominada') || n.includes('jalón') || n.includes('espalda') || n.includes('pull-over') || n.includes('peso muerto') || n.includes('deadlift')) {
    return { icon: <Layers size={18} />, color: 'text-red-500', bg: 'bg-red-900/20', border: 'border-red-500/30', label: 'Espalda' };
  }
  if (n.includes('sentadilla') || n.includes('squat') || n.includes('prensa') || n.includes('pierna') || n.includes('femoral') || n.includes('gemelo') || n.includes('thrust') || n.includes('hack') || n.includes('búlgara') || n.includes('cuádriceps')) {
    return { icon: <Activity size={18} />, color: 'text-amber-500', bg: 'bg-amber-900/20', border: 'border-amber-500/30', label: 'Piernas' };
  }
  if (n.includes('militar') || n.includes('lateral') || n.includes('pájaro') || n.includes('hombro') || n.includes('encogimiento')) {
    return { icon: <Target size={18} />, color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-500/30', label: 'Hombros' };
  }
  if (n.includes('curl') || n.includes('bíceps') || n.includes('tríceps') || n.includes('brazo') || n.includes('rompecráneos') || n.includes('francés')) {
    return { icon: <Zap size={18} />, color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/30', label: 'Brazos' };
  }
  if (n.includes('plancha') || n.includes('abdominal') || n.includes('crunch') || n.includes('core')) {
    return { icon: <LayoutGrid size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-500/30', label: 'Core' };
  }
  
  return { icon: <Dumbbell size={18} />, color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', label: 'General' };
};

const playTacticalAlarm = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(0, ctx.currentTime + 0.11);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(0, ctx.currentTime + 0.31);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.5);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) { console.log("Audio no permitido en este entorno", e); }
};

const callGeminiAPI = async (prompt) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (error) { console.log("AI Error:", error); throw error; }
};

// ==========================================
// SECCIÓN 3: COMPONENTES UI COMPARTIDOS
// ==========================================

const InputGroup = ({ label, value, onChange, type = "text", suffix, step = "1", placeholder = "" }) => (
  <div className="flex flex-col gap-2 relative group">
    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold ml-1">{label}</label>
    <div className="relative">
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} step={step} placeholder={placeholder} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-white font-mono text-lg focus:border-blue-500 focus:outline-none transition-colors placeholder-slate-600" />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm pointer-events-none">{suffix}</span>}
    </div>
  </div>
);

const ToggleSwitch = ({ checked, onChange, label }) => (
  <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-700 cursor-pointer" onClick={() => onChange(!checked)}>
    <span className="text-xs font-bold text-slate-400 ml-1">{label}</span>
    <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-600'}`}>
      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${checked ? 'left-6' : 'left-1'}`}></div>
    </div>
  </div>
);

const InfoModal = ({ data, onClose }) => {
    if (!data) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border-2 border-amber-500 rounded-xl flex flex-col max-h-[85vh] w-full max-w-sm shadow-[0_0_50px_rgba(245,158,11,0.3)] relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 rounded-full p-1"><X size={20} /></button>
                <div className="p-6 pb-2 flex-shrink-0"><div className="flex items-center gap-3 text-amber-500"><ClipboardList size={28} /><h3 className="text-lg font-bold uppercase tracking-wider">{data.title || 'Info'}</h3></div></div>
                <div className="px-6 py-4 overflow-y-auto text-slate-300 text-sm leading-relaxed font-mono border-l-2 border-slate-700 ml-6 mb-2">
                    <div className="prose prose-invert prose-sm">{String(data.content || '').split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}</div>
                </div>
                <div className="p-6 pt-2 flex-shrink-0"><button onClick={onClose} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase rounded shadow-lg shadow-amber-900/20">Entendido</button></div>
            </div>
        </div>
    );
};

const ExerciseHistoryModal = ({ exName, history, onClose, barUnit }) => {
    const [limit, setLimit] = useState(5);
    
    const pastPerformances = useMemo(() => {
        if (!Array.isArray(history)) return [];
        const matches = [];
        history.forEach(session => {
            if (!session) return;
            const exData = (session.exercises || []).find(e => e && String(e.name).toLowerCase() === String(exName).toLowerCase());
            if (exData && Array.isArray(exData.sets) && exData.sets.length > 0) {
                matches.push({ date: session.completedAt || new Date().toISOString(), sessionName: session.name || 'Sesión', sets: exData.sets });
            }
        });
        return matches.slice(0, limit === 'all' ? undefined : limit);
    }, [history, exName, limit]);

    return (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-md h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-sky-400 flex items-center gap-2"><BarChart2 size={20} /> Comparativa</h2>
                        <span className="text-xs text-white uppercase">{exName}</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"><X size={24}/></button>
                </div>
                
                <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex gap-2 overflow-x-auto shrink-0">
                    {[5, 10, 'all'].map(num => (
                        <button key={num} onClick={() => setLimit(num)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${limit === num ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                            {num === 'all' ? 'Todas' : `Últimas ${num}`}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {pastPerformances.length > 0 ? (
                        pastPerformances.map((perf, idx) => (
                            <div key={idx} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <div className="bg-slate-900/50 p-2 border-b border-slate-700 flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">{perf.sessionName}</span>
                                    <span className="text-[10px] text-sky-400 font-mono bg-sky-900/20 px-2 py-0.5 rounded">{new Date(perf.date).toLocaleDateString()}</span>
                                </div>
                                <div className="p-2 space-y-1">
                                    {(perf.sets || []).map((s, i) => (
                                        <div key={i} className="flex justify-between text-xs items-center px-2 py-1 rounded bg-slate-900/30">
                                            <span className="text-slate-500 font-mono w-6">{i+1}.</span>
                                            <span className="font-bold text-amber-500">{s?.weight > 0 ? `${s.weight}${barUnit}` : '-'}</span>
                                            <span className="text-white w-12 text-center">{s?.reps > 0 ? `${s.reps} reps` : '-'}</span>
                                            <span className="text-slate-400 text-[10px] w-8 text-right">{s?.rpe ? `RPE ${s.rpe}` : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-slate-500 italic">No hay registros previos para este ejercicio.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ExerciseSelectorModal = ({ onClose, onSelect, customExercises, setCustomExercises }) => {
    const [search, setSearch] = useState('');

    const allExercises = useMemo(() => {
        const safeCustom = Array.isArray(customExercises) ? customExercises.filter(Boolean) : [];
        const list = [...new Set([...DEFAULT_EXERCISE_DB, ...safeCustom])].sort();
        return list.filter(e => e && String(e).toLowerCase().includes((search || '').toLowerCase()));
    }, [search, customExercises]);

    const handleAddCustom = () => {
        const newEx = search.trim();
        if(newEx && !allExercises.includes(newEx)) {
            setCustomExercises(prev => [...(Array.isArray(prev) ? prev : []), newEx]);
            onSelect(newEx);
        }
    };

    const removeCustom = (e, exName) => {
        e.stopPropagation();
        setCustomExercises(prev => (Array.isArray(prev) ? prev.filter(ex => ex !== exName) : []));
    };

    const exactMatch = allExercises.find(e => e && String(e).toLowerCase() === search.trim().toLowerCase());

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-md h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><Dumbbell className="text-amber-500" size={20} /> Repertorio</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"><X size={24}/></button>
                </div>
                
                <div className="p-4 shrink-0 border-b border-slate-800 bg-slate-900/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input autoFocus type="text" placeholder="Buscar ejercicio..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-600" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {allExercises.length > 0 ? (
                        <div className="space-y-1">
                            {allExercises.map(ex => {
                                const isCustom = Array.isArray(customExercises) && customExercises.includes(ex);
                                const details = getExerciseDetails(ex);
                                return (
                                    <div key={ex} onClick={() => onSelect(ex)} className="flex items-center justify-between p-3 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg border ${details.bg} ${details.border} ${details.color}`}>{details.icon}</div>
                                            <div className="flex flex-col">
                                                <span className="text-slate-200 font-medium">{ex}</span>
                                                <span className={`text-[9px] uppercase font-bold tracking-widest opacity-80 ${details.color}`}>{details.label}</span>
                                            </div>
                                        </div>
                                        {isCustom && (
                                            <button onClick={(e) => removeCustom(e, ex)} className="p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar personalizado"><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10 px-4"><p className="text-slate-500 mb-4">No se encontraron resultados para "{search}"</p></div>
                    )}
                    
                    {search.trim() && !exactMatch && (
                        <button onClick={handleAddCustom} className="w-full mt-2 py-3 bg-amber-600/10 border border-dashed border-amber-500/50 text-amber-500 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-amber-600/20 transition-colors">
                            <Plus size={18} /> Añadir "{search}" a mi Repertorio
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdvancedTimer = () => {
    const [mode, setMode] = useState('stopwatch'); 
    const [seconds, setSeconds] = useState(0);
    const [initialTimerSeconds, setInitialTimerSeconds] = useState(60); 
    const [isActive, setIsActive] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const timerRef = useRef(null);
    const draggingRef = useRef(false);
    const startPosRef = useRef({ x: null, y: null });
    const posRef = useRef({ 
        x: typeof window !== 'undefined' ? window.innerWidth - 80 : 300, 
        y: typeof window !== 'undefined' ? window.innerHeight - 150 : 600 
    });

    useEffect(() => {
      let interval = null;
      if (isActive) {
        interval = setInterval(() => {
          setSeconds(s => {
            if (mode === 'timer') {
              if (s <= 1) { clearInterval(interval); setIsActive(false); playTacticalAlarm(); return 0; }
              return s - 1;
            } else { return s + 1; }
          });
        }, 1000);
      } else if (!isActive && seconds !== 0 && mode === 'stopwatch') { clearInterval(interval); }
      return () => clearInterval(interval);
    }, [isActive, mode]);

    useEffect(() => {
        if (timerRef.current) timerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }, []);

    const formatTime = (totalSeconds) => {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const setTimerPreset = (secs) => { setMode('timer'); setInitialTimerSeconds(secs); setSeconds(secs); setIsActive(true); setIsExpanded(false); };
    
    const handlePointerDown = (e) => {
        draggingRef.current = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startPosRef.current = { x: clientX - posRef.current.x, y: clientY - posRef.current.y };
    };

    const handlePointerMove = (e) => {
        if (startPosRef.current.x === null) return; 
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let newX = clientX - startPosRef.current.x;
        let newY = clientY - startPosRef.current.y;

        if (Math.abs(newX - posRef.current.x) > 5 || Math.abs(newY - posRef.current.y) > 5) {
            draggingRef.current = true;
        }

        newX = Math.max(0, Math.min(newX, window.innerWidth - 60));
        newY = Math.max(0, Math.min(newY, window.innerHeight - 60));

        posRef.current = { x: newX, y: newY };
        if (timerRef.current) timerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handlePointerUp = () => { startPosRef.current = { x: null, y: null }; };

    const toggleExpand = (e) => {
        if (!draggingRef.current) setIsExpanded(!isExpanded);
    };

    return (
      <div ref={timerRef} className="fixed top-0 left-0 z-[100] flex flex-col items-center" style={{ touchAction: 'none' }}>
        {isExpanded && (
           <div className="absolute bottom-16 -right-16 sm:right-0 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/80 mb-2 w-52 animate-fade-in-up">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                 <span className="text-xs font-bold text-slate-400 uppercase">{mode === 'stopwatch' ? 'Cronómetro' : 'Temporizador'}</span>
                 <button onClick={() => { setMode(mode === 'stopwatch' ? 'timer' : 'stopwatch'); setIsActive(false); setSeconds(mode === 'stopwatch' ? initialTimerSeconds : 0); }} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 hover:text-white border border-slate-700">Cambiar</button>
              </div>
              <div className="flex justify-center gap-4 mb-3">
                  <button onClick={() => setIsActive(!isActive)} className={`p-3 rounded-full ${isActive ? 'bg-amber-600/20 text-amber-500' : 'bg-slate-800 text-slate-300 hover:text-white'}`}>
                      {isActive ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                  </button>
                  <button onClick={() => { setIsActive(false); setSeconds(mode === 'timer' ? initialTimerSeconds : 0); }} className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white">
                      <RotateCcw size={20} />
                  </button>
              </div>
              {mode === 'timer' && (
                 <div className="grid grid-cols-3 gap-2">
                    {[30, 60, 90, 120, 180, 240].map(secs => (
                       <button key={secs} onClick={() => setTimerPreset(secs)} className="px-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 border border-slate-700 hover:border-amber-500 transition">
                          {Math.floor(secs/60) > 0 ? `${Math.floor(secs/60)}m${secs%60 > 0 ? secs%60 : ''}` : `${secs}s`}
                       </button>
                    ))}
                 </div>
              )}
           </div>
        )}
        <div 
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} onClick={toggleExpand}
            className={`w-14 h-14 rounded-full bg-slate-800 border-2 ${isActive && mode === 'timer' && seconds <= 10 ? 'border-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : isActive ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-slate-600'} flex flex-col items-center justify-center shadow-xl cursor-grab active:cursor-grabbing backdrop-blur-md select-none`}
        >
            <Timer size={18} className={isActive && mode === 'timer' && seconds <= 10 ? 'text-red-500' : isActive ? 'text-amber-500' : 'text-slate-400'} style={{ pointerEvents: 'none' }} />
            <span className={`text-[10px] font-bold font-mono leading-tight mt-0.5 ${isActive && mode === 'timer' && seconds <= 10 ? 'text-red-500' : 'text-white'}`} style={{ pointerEvents: 'none' }}>{formatTime(seconds)}</span>
        </div>
      </div>
    );
};

// ==========================================
// SECCIÓN 4: COMPONENTES GYM MASTER (CALCULADORAS)
// ==========================================

const PlateVisualizer = ({ plates }) => {
  if (!Array.isArray(plates)) return null;
  return (
    <div className="w-full h-40 bg-slate-900/50 rounded-xl flex items-center justify-start overflow-x-auto overflow-y-hidden border-b-4 border-slate-700 relative p-4 mb-4 shadow-inner">
      <div className="absolute left-0 w-full h-4 bg-slate-400 z-0 top-1/2 -translate-y-1/2 shadow-lg"></div>
      <div className="h-20 w-8 bg-slate-300 z-10 mr-1 shadow-xl border-r-2 border-slate-500 shrink-0 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
      </div>
      {plates.map((p, idx) => {
        if(!p) return null;
        const config = PLATE_CONFIG[p.unit]?.[p.weight] || { color: 'bg-slate-700', height: 'h-24', label: '?' };
        return (
          <div key={idx} className="flex flex-col items-center justify-center z-20 -ml-1 shrink-0 transition-all duration-300 animate-slide-in-right group">
            <div className={`${config?.height || 'h-24'} w-6 ${config?.color || 'bg-slate-700'} rounded-sm border-x border-y shadow-xl flex items-center justify-center relative`}>
              <span className={`text-[9px] font-bold -rotate-90 absolute whitespace-nowrap ${config?.text || 'text-white'}`}>{p.weight} <span className="text-[6px] opacity-70">{p.unit}</span></span>
              <div className="absolute inset-y-0 left-0 w-1 bg-white/10"></div>
            </div>
          </div>
        );
      })}
      {plates.length === 0 && <div className="z-10 text-slate-600 text-xs font-mono ml-4 bg-slate-900 px-2 py-1 rounded">Barra Vacía</div>}
    </div>
  );
};

const SettingsModal = ({ inventory, setInventory, barWeight, setBarWeight, barUnit, setBarUnit, modes, setModes, onClose }) => {
    const [editingModeId, setEditingModeId] = useState(null);
    const [showAIPhaseInput, setShowAIPhaseInput] = useState(false);
    const [aiPhasePrompt, setAiPhasePrompt] = useState('');
    const [isGeneratingPhase, setIsGeneratingPhase] = useState(false);
    const [aiPhaseError, setAiPhaseError] = useState(null);

    const updateCount = (unit, weight, delta) => { 
        setInventory(prev => { 
            const currentUnitInventory = prev?.[unit] || {}; 
            const currentCount = currentUnitInventory[weight] || 0; 
            return { ...prev, [unit]: { ...currentUnitInventory, [weight]: Math.max(0, currentCount + delta) } }; 
        }); 
    };
    
    const addMode = () => {
        const safeModes = Array.isArray(modes) ? modes : DEFAULT_MODES;
        const newMode = {
            id: `phase-${Date.now()}`, label: 'Nueva Fase', rpe: '8', repRange: '8-10', sets: '3', weightMod: 1.0, color: PHASE_COLORS[safeModes.length % PHASE_COLORS.length], desc: 'Fase personalizada.'
        };
        setModes([...safeModes, newMode]);
        setEditingModeId(newMode.id);
    };

    const generatePhaseWithAI = async () => {
        if (!aiPhasePrompt.trim()) return;
        setIsGeneratingPhase(true);
        setAiPhaseError(null);
        const safeModes = Array.isArray(modes) ? modes : DEFAULT_MODES;
        const promptText = `Actúa como un entrenador táctico experto. Analiza este texto y extrae/crea una fase de entrenamiento: "${aiPhasePrompt}". Responde ÚNICAMENTE con un objeto JSON válido usando esta estructura exacta: { "label": "Nombre corto de la Fase", "rpe": "ej. 8 o 7-8", "repRange": "ej. 5 o 8-10", "sets": "ej. 3", "weightMod": 1.0 (float: 1.0 para mantener carga, < 1.0 para descargas, > 1.0 para progresión/sobrecarga), "desc": "Descripción breve y motivadora" }`;

        try {
            const textResponse = await callGeminiAPI(promptText);
            const cleanJson = textResponse.replace(/```json|```/g, '').trim();
            const parsedData = JSON.parse(cleanJson);

            const newMode = {
                id: `phase-${Date.now()}`,
                label: parsedData.label || 'Fase IA Táctica',
                rpe: String(parsedData.rpe || '8'),
                repRange: String(parsedData.repRange || '8-10'),
                sets: String(parsedData.sets || '3'),
                weightMod: parseFloat(parsedData.weightMod) || 1.0,
                color: PHASE_COLORS[safeModes.length % PHASE_COLORS.length],
                desc: parsedData.desc || 'Protocolo calculado por IA.'
            };

            setModes([...safeModes, newMode]);
            setAiPhasePrompt('');
            setShowAIPhaseInput(false);
        } catch (error) {
            console.error("AI Phase Generation Failed:", error);
            setAiPhaseError("No se pudo descifrar la fase. Intenta ser más descriptivo.");
        } finally {
            setIsGeneratingPhase(false);
        }
    };

    const updateMode = (id, field, val) => {
        setModes(prev => (Array.isArray(prev) ? prev.map(m => m.id === id ? { ...m, [field]: val } : m) : DEFAULT_MODES));
    };

    const removeMode = (id) => {
        setModes(prev => (Array.isArray(prev) ? prev.filter(m => m.id !== id) : DEFAULT_MODES));
        if (editingModeId === id) setEditingModeId(null);
    };

    const sortedKg = Object.keys(PLATE_CONFIG.kg).map(Number).sort((a,b) => b-a);
    const sortedLb = Object.keys(PLATE_CONFIG.lb).map(Number).sort((a,b) => b-a);
    const safeModesToRender = Array.isArray(modes) ? modes : DEFAULT_MODES;

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="bg-slate-900 w-full max-w-md h-[90vh] sm:h-[80vh] rounded-t-2xl sm:rounded-2xl border border-slate-800 shadow-2xl flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl z-20">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5" /> Configuración</h2>
            <button onClick={onClose} className="text-white font-bold px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500">Guardar</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Target size={14} /> Fases / Mesociclos</h3>
              <div className="space-y-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
                  {safeModesToRender.map(m => (
                      <div key={m.id}>
                          {editingModeId === m.id ? (
                              <div className="bg-slate-950 p-3 rounded-lg border border-amber-500/50 space-y-3 animate-fade-in-down">
                                  <InputGroup label="Nombre de la Fase" value={m.label} onChange={v => updateMode(m.id, 'label', v)} />
                                  <div className="grid grid-cols-2 gap-2">
                                      <InputGroup label="Series" value={m.sets} onChange={v => updateMode(m.id, 'sets', v)} />
                                      <InputGroup label="Reps" value={m.repRange} onChange={v => updateMode(m.id, 'repRange', v)} />
                                      <InputGroup label="RPE" value={m.rpe} onChange={v => updateMode(m.id, 'rpe', v)} />
                                      <InputGroup label="Multiplicador (Carga)" value={m.weightMod} type="number" step="0.05" onChange={v => updateMode(m.id, 'weightMod', parseFloat(v)||1)} />
                                  </div>
                                  <InputGroup label="Descripción" value={m.desc} onChange={v => updateMode(m.id, 'desc', v)} />
                                  <div className="flex justify-end pt-2">
                                      <button onClick={() => setEditingModeId(null)} className="px-4 py-2 bg-amber-600 text-black font-bold text-xs rounded hover:bg-amber-500">Listo</button>
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
                                      {m.id !== 'standard' && <button onClick={() => removeMode(m.id)} className="p-2 rounded text-slate-400 hover:text-red-500 hover:bg-slate-700 transition"><Trash2 size={14} /></button>}
                                  </div>
                              </div>
                          )}
                      </div>
                  ))}
                  
                  {!showAIPhaseInput ? (
                      <div className="flex gap-2 mt-2">
                          <button onClick={addMode} className="flex-1 py-2 border border-dashed border-slate-600 text-slate-400 hover:text-amber-500 hover:border-amber-500 rounded-lg text-xs font-bold uppercase transition flex items-center justify-center gap-1">
                              <Plus size={14} /> Manual
                          </button>
                          <button onClick={() => setShowAIPhaseInput(true)} className="flex-1 py-2 border border-dashed border-purple-500/50 text-purple-400 hover:text-purple-300 hover:border-purple-400 rounded-lg text-xs font-bold uppercase transition flex items-center justify-center gap-1 bg-purple-900/10">
                              <Zap size={14} /> Importar/IA
                          </button>
                      </div>
                  ) : (
                      <div className="bg-slate-950 p-3 rounded-lg border border-purple-500/50 space-y-3 mt-2 animate-fade-in-down">
                          <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1"><Zap size={12}/> Constructor Táctico IA</span>
                              <button onClick={() => setShowAIPhaseInput(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                          </div>
                          <textarea 
                              value={aiPhasePrompt} 
                              onChange={e => setAiPhasePrompt(e.target.value)} 
                              placeholder="Ej: Copia tu bloque de Excel, o escribe: 'Fase de hipertrofia, 4 series de 12 reps, RPE 8'" 
                              className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-purple-500 focus:outline-none resize-none"
                          />
                          {aiPhaseError && <div className="text-[10px] text-red-500">{aiPhaseError}</div>}
                          <button 
                              onClick={generatePhaseWithAI} 
                              disabled={isGeneratingPhase || !aiPhasePrompt.trim()} 
                              className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded transition flex items-center justify-center gap-2"
                          >
                              {isGeneratingPhase ? <><Loader2 size={14} className="animate-spin"/> Procesando...</> : <><Sparkles size={14}/> Generar Fase</>}
                          </button>
                      </div>
                  )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Info size={14} /> La Barra</h3>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-4">
                 <div className="flex-1"><label className="text-[10px] uppercase text-slate-400 font-bold">Peso</label><input type="number" value={barWeight} onChange={e => setBarWeight(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-bold mt-1"/></div>
                 <div className="flex flex-col"><label className="text-[10px] uppercase text-slate-400 font-bold mb-1">Unidad</label><div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">{['kg', 'lb'].map(u => (<button key={u} onClick={() => setBarUnit(u)} className={`px-3 py-2 rounded text-xs font-bold ${barUnit===u ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{u.toUpperCase()}</button>))}</div></div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Inventario de Discos</h3>
              <div className="space-y-6">
                {[{ u: 'kg', weights: sortedKg, label: 'Kilos' }, { u: 'lb', weights: sortedLb, label: 'Libras' }].map(({u, weights, label}) => (
                  <div key={u} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-sm font-bold text-white mb-3 uppercase flex justify-between">{label}</h4>
                    <div className="space-y-2">{weights.map(w => {
                        const count = inventory?.[u] ? (inventory[u][w] || 0) : 0;
                        return (
                          <div key={w} className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shadow-sm ${PLATE_CONFIG[u]?.[w]?.color?.replace('h-', '')?.replace('w-', '') || 'bg-slate-700'} ${PLATE_CONFIG[u]?.[w]?.text || 'text-white'}`}>{w}</div><span className="text-slate-400 text-sm font-medium">{w} {u}</span></div>
                            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700"><button onClick={() => updateCount(u, w, -2)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-l-lg">-2</button><div className="w-8 text-center font-bold text-white text-sm">{count}</div><button onClick={() => updateCount(u, w, 2)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-r-lg">+2</button></div>
                          </div>
                        );})}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
};

const TargetCalculator = ({ barWeight, barUnit, inventory }) => {
    const [targetWeight, setTargetWeight] = useState(100);
    const [unit, setUnit] = useState('kg');
    const [allowMixing, setAllowMixing] = useState(false); 
  
    const calculatePlates = () => {
      let t = parseFloat(targetWeight);
      if (isNaN(t) || t <= 0) return [];
      const barW = parseFloat(barWeight) || 0;
      let currentBar = barUnit === unit ? barW : (unit === 'kg' ? toKg(barW, 'lb') : toLb(barW, 'kg'));
      let weightNeeded = t - currentBar;
      let perSide = weightNeeded / 2;
      if (perSide <= 0) return [];
      let available = [];
      const safeInvKg = inventory?.kg || {};
      const safeInvLb = inventory?.lb || {};

      if (allowMixing) {
        const kgOpts = Object.entries(safeInvKg).filter(([_, count]) => count > 0).map(([w, count]) => ({ weight: parseFloat(w), unit: 'kg', count, compareWeight: unit === 'kg' ? parseFloat(w) : toLb(parseFloat(w), 'kg') }));
        const lbOpts = Object.entries(safeInvLb).filter(([_, count]) => count > 0).map(([w, count]) => ({ weight: parseFloat(w), unit: 'lb', count, compareWeight: unit === 'lb' ? parseFloat(w) : toKg(parseFloat(w), 'lb') }));
        available = [...kgOpts, ...lbOpts].sort((a, b) => b.compareWeight - a.compareWeight);
      } else {
        const currentInv = inventory?.[unit] || {};
        available = Object.entries(currentInv).filter(([_, count]) => count > 0).map(([w, count]) => ({ weight: parseFloat(w), unit: unit, count, compareWeight: parseFloat(w) })).sort((a, b) => b.compareWeight - a.compareWeight);
      }
      let remaining = perSide;
      const result = [];
      available.forEach(plate => {
        if (remaining <= 0) return;
        const weightVal = plate.compareWeight;
        const possibleCount = Math.floor((remaining + 0.01) / weightVal); 
        if (possibleCount > 0) {
          const maxPairs = Math.floor(plate.count / 2);
          const take = Math.min(possibleCount, maxPairs);
          if (take > 0) {
            for(let i=0; i<take; i++) { result.push({ weight: plate.weight, unit: plate.unit }); }
            remaining -= take * weightVal;
            remaining = Math.max(0, remaining);
          }
        }
      });
      return result; 
    };
  
    const plates = calculatePlates();
    const groupedPlates = useMemo(() => {
      const map = new Map();
      (plates || []).forEach(p => {
        if(!p) return;
        const key = `${p.weight}-${p.unit}`;
        if (!map.has(key)) map.set(key, { ...p, count: 0 });
        map.get(key).count++;
      });
      return Array.from(map.values()).sort((a, b) => b.weight - a.weight);
    }, [plates, unit]);
  
    const barW = parseFloat(barWeight) || 0;
    const totalExact = (plates || []).reduce((sum, p) => sum + (p?.unit === unit ? p.weight : (unit === 'kg' ? toKg(p?.weight, 'lb') : toLb(p?.weight, 'kg'))), 0) * 2 + (barUnit === unit ? barW : (unit === 'kg' ? toKg(barW, 'lb') : toLb(barW, 'kg')));
  
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex gap-4 items-end mb-4">
            <div className="flex-1"><InputGroup label={`Peso Objetivo (${unit})`} type="number" value={targetWeight} onChange={setTargetWeight} /></div>
            <div className="flex bg-slate-900 rounded-lg p-1 h-[54px] items-center">
              {['kg', 'lb'].map((u) => (
                <button key={u} onClick={() => setUnit(u)} className={`px-3 py-2 h-full rounded-md text-sm font-bold transition-all ${unit === u ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{u.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="mb-4"><ToggleSwitch checked={allowMixing} onChange={setAllowMixing} label={allowMixing ? "Combinando (Kg + Lb)" : "Solo un tipo"} /></div>
          <PlateVisualizer plates={plates} unit={unit} />
          <div className="space-y-2">
             <div className="text-xs uppercase text-slate-500 font-bold mb-2">Cargar por lado:</div>
             {groupedPlates.length > 0 ? (
               <div className="grid grid-cols-2 gap-2">
                 {groupedPlates.map((item, idx) => (
                   <div key={idx} className="bg-slate-700/50 p-2 rounded-lg border border-slate-600 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <span className={`w-3 h-3 rounded-full ${PLATE_CONFIG[item.unit]?.[item.weight]?.color?.split(' ')[0] || 'bg-white'}`}></span>
                         <span className="font-bold text-white text-lg">{item.weight} <span className="text-xs text-slate-400">{item.unit}</span></span>
                      </div>
                      <span className="font-mono text-blue-400 font-bold">x{item.count}</span>
                   </div>
                 ))}
               </div>
             ) : (<p className="text-slate-500 text-sm text-center py-2">Ingresa un peso válido.</p>)}
          </div>
        </div>
         <div className="text-center text-xs text-slate-500">Peso Real Calculado: {formatNum(totalExact)} {unit}</div>
      </div>
    );
};
  
const ReverseCalculator = ({ barWeight, barUnit }) => {
    const [platesOnSide, setPlatesOnSide] = useState([]);
    const addPlate = (weight, unit) => { setPlatesOnSide([...platesOnSide, { weight, unit, id: Date.now() + Math.random() }]); };
    const removeLast = () => setPlatesOnSide(prev => prev.slice(0, -1));
    const reset = () => setPlatesOnSide([]);
    const sideKg = platesOnSide.reduce((acc, p) => acc + toKg(p.weight, p.unit), 0);
    const sideLb = platesOnSide.reduce((acc, p) => acc + toLb(p.weight, p.unit), 0);
    const barW = parseFloat(barWeight) || 0;
    const totalKg = (sideKg * 2) + toKg(barW, barUnit);
    const totalLb = (sideLb * 2) + toLb(barW, barUnit);
    const standardKg = Object.keys(PLATE_CONFIG.kg).map(Number).filter(w => PLATE_CONFIG.kg[w].type === 'standard').sort((a,b) => b-a);
    const standardLb = Object.keys(PLATE_CONFIG.lb).map(Number).filter(w => PLATE_CONFIG.lb[w].type === 'standard').sort((a,b) => b-a);
    const fractionalKg = Object.keys(PLATE_CONFIG.kg).map(Number).filter(w => PLATE_CONFIG.kg[w].type === 'fractional').sort((a,b) => b-a);
    const fractionalLb = Object.keys(PLATE_CONFIG.lb).map(Number).filter(w => PLATE_CONFIG.lb[w].type === 'fractional').sort((a,b) => b-a);
  
    return (
      <div className="space-y-4 animate-fade-in flex flex-col h-full pb-20">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl sticky top-0 z-10">
          <div className="flex justify-between items-end">
             <div>
               <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Peso Total</div>
               <div className="text-4xl font-black text-white leading-none">{formatNum(totalLb)} <span className="text-xl text-blue-500">lb</span></div>
               <div className="text-sm font-bold text-emerald-400 mt-1">{formatNum(totalKg)} kg</div>
             </div>
             <button onClick={reset} className="text-red-400 p-2 hover:bg-red-500/10 rounded-lg"><RotateCcw size={20} /></button>
          </div>
        </div>
        <div className="relative">
           <PlateVisualizer plates={platesOnSide} />
           {platesOnSide.length > 0 && (<button onClick={removeLast} className="absolute right-2 bottom-6 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/30">Quitar último</button>)}
        </div>
        <div className="space-y-6">
           <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-emerald-500 uppercase mb-2 flex items-center gap-2">Kilos</h4>
              <div className="grid grid-cols-4 gap-2 mb-2">{standardKg.map(w => (<button key={`kg-${w}`} onClick={() => addPlate(w, 'kg')} className={`h-12 rounded-lg font-bold shadow-sm active:scale-95 border-b-4 flex items-center justify-center ${PLATE_CONFIG.kg[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.kg[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
              <h5 className="text-[10px] text-slate-500 font-bold uppercase mb-2 mt-3">Micro</h5>
              <div className="grid grid-cols-6 gap-2">{fractionalKg.map(w => (<button key={`kg-${w}`} onClick={() => addPlate(w, 'kg')} className={`h-10 text-xs rounded-lg font-bold shadow-sm active:scale-95 border-b-2 flex items-center justify-center ${PLATE_CONFIG.kg[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.kg[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
           </div>
           <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-blue-500 uppercase mb-2 flex items-center gap-2">Libras</h4>
              <div className="grid grid-cols-4 gap-2 mb-2">{standardLb.map(w => (<button key={`lb-${w}`} onClick={() => addPlate(w, 'lb')} className={`h-12 rounded-lg font-bold shadow-sm active:scale-95 border-b-4 flex items-center justify-center ${PLATE_CONFIG.lb[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.lb[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
              <h5 className="text-[10px] text-slate-500 font-bold uppercase mb-2 mt-3">Micro</h5>
              <div className="grid grid-cols-6 gap-2">{fractionalLb.map(w => (<button key={`lb-${w}`} onClick={() => addPlate(w, 'lb')} className={`h-10 text-xs rounded-lg font-bold shadow-sm active:scale-95 border-b-2 flex items-center justify-center ${PLATE_CONFIG.lb[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.lb[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
           </div>
        </div>
      </div>
    );
};
  
const WorkCalculator = () => {
    const [liftWeight, setLiftWeight] = useState('');
    const [liftReps, setLiftReps] = useState('');
    const [liftRPE, setLiftRPE] = useState('');
    const [formula, setFormula] = useState('hybrid');
    const [unit, setUnit] = useState('kg');
    const [targetReps, setTargetReps] = useState(8);
    const [targetRPE, setTargetRPE] = useState(8);
    const [exercise, setExercise] = useState(DEFAULT_EXERCISE_DB[0]);
    const [aiAdvice, setAiAdvice] = useState('');
    const [loadingAI, setLoadingAI] = useState(false);
    const [showAI, setShowAI] = useState(false);
  
    const oneRM = calculate1RM(liftWeight, liftReps, liftRPE, formula);
    const workWeight = oneRM ? calculateTrainingWeight(oneRM, targetReps, targetRPE) : 0;
  
    const handleAIConsult = async () => {
      setShowAI(true);
      setLoadingAI(true);
      const prompt = `Actúa como coach. Ejercicio: ${exercise}. 1RM Est: ${formatNum(oneRM)} ${unit}. Objetivo: ${formatNum(workWeight)} ${unit} x ${targetReps} reps @ RPE ${targetRPE}. Dame 1 consejo técnico, sensación RPE y calentamiento breve.`;
      try {
          const advice = await callGeminiAPI(prompt);
          setAiAdvice(advice);
      } catch(e) { setAiAdvice("Error conexión."); }
      setLoadingAI(false);
    };
  
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="bg-slate-800 p-2 rounded-xl border border-slate-700 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 pl-2"><Dumbbell className="text-blue-500" size={18} /><span className="text-xs font-bold text-slate-400 uppercase">Ejercicio:</span></div>
          <div className="relative w-1/2">
            <select value={exercise} onChange={(e) => setExercise(e.target.value)} className="w-full bg-transparent text-white font-bold text-sm appearance-none pr-8 py-2 pl-2 outline-none cursor-pointer truncate">
              {DEFAULT_EXERCISE_DB.map(ex => <option key={ex} value={ex} className="bg-slate-900">{ex}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex justify-between mb-4"><h2 className="font-bold flex items-center gap-2 text-purple-400"><TrendingUp size={20} /> Calc 1RM</h2><select value={formula} onChange={(e) => setFormula(e.target.value)} className="bg-slate-900 text-xs font-bold text-slate-400 border border-slate-700 rounded px-2 outline-none"><option value="epley">Epley</option><option value="brzycki">Brzycki</option><option value="hybrid">Híbrida</option></select></div>
          <div className="grid grid-cols-2 gap-3 mb-3">
             <div className="col-span-2 flex gap-2"><div className="flex-1"><InputGroup label="Peso" type="number" value={liftWeight} onChange={setLiftWeight} placeholder="100" /></div><div className="w-20 pt-6"><button onClick={() => setUnit(unit === 'kg' ? 'lb' : 'kg')} className="w-full h-[52px] bg-slate-700 rounded-xl font-bold border border-slate-600 hover:bg-slate-600 transition-colors">{unit.toUpperCase()}</button></div></div>
             <InputGroup label="Reps" type="number" value={liftReps} onChange={setLiftReps} placeholder="5" />
             <InputGroup label="RPE" type="number" value={liftRPE} onChange={setLiftRPE} placeholder="10" step="0.5" />
          </div>
          {oneRM > 0 && (<div className="mt-4 bg-purple-900/20 p-4 rounded-xl border border-purple-500/30 text-center animate-pop-in"><div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Tu 1RM Teórico</div><div className="text-4xl font-black text-white">{formatNum(oneRM)} {unit}</div></div>)}
        </div>
        {oneRM > 0 && (
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex gap-2 items-center"><BarChart2 size={16} /> Planificar Serie</h3>
            <div className="flex gap-4 mb-6">
              <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Reps</label><div className="bg-slate-900 rounded-lg flex items-center p-1 border border-slate-700"><button onClick={() => setTargetReps(Math.max(1, targetReps-1))} className="p-2 text-slate-400 hover:text-white"><Minus size={14}/></button><div className="flex-1 text-center font-bold">{targetReps}</div><button onClick={() => setTargetReps(targetReps+1)} className="p-2 text-slate-400 hover:text-white"><Plus size={14}/></button></div></div>
              <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">RPE</label><div className="bg-slate-900 rounded-lg flex items-center p-1 border border-slate-700"><button onClick={() => setTargetRPE(Math.max(1, targetRPE-0.5))} className="p-2 text-slate-400 hover:text-white"><Minus size={14}/></button><div className="flex-1 text-center font-bold text-blue-400">{targetRPE}</div><button onClick={() => setTargetRPE(Math.min(10, targetRPE+0.5))} className="p-2 text-slate-400 hover:text-white"><Plus size={14}/></button></div></div>
            </div>
            <div className="text-center mb-6"><div className="text-slate-400 text-xs mb-1">Cargar en la barra:</div><div className="text-5xl font-black text-white tracking-tighter">{formatNum(workWeight)} <span className="text-2xl text-emerald-500">{unit}</span></div></div>
            <button onClick={handleAIConsult} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 group"><Sparkles className="text-yellow-300 group-hover:animate-pulse" size={18} /> Consultar Coach AI</button>
          </div>
        )}
        {showAI && <InfoModal data={{title: "Coach AI", content: loadingAI ? "Analizando..." : aiAdvice}} onClose={() => setShowAI(false)} />}
      </div>
    );
};

// --- MODAL: FINALIZAR MISIÓN ---
const FinishMissionModal = ({ sessionName, onConfirm, onDiscard, onCancel }) => {
    const [name, setName] = useState(sessionName || 'Entrenamiento Libre');
    const [saveTemplate, setSaveTemplate] = useState(false);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 w-full max-w-sm rounded-xl border border-amber-500/50 p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Target className="text-amber-500"/> Misión Completada</h2>
                <p className="text-xs text-slate-400 mb-6">Elige cómo quieres archivar este registro de combate.</p>
                
                <div className="space-y-4">
                    <InputGroup label="Nombre del Registro" value={name} onChange={setName} placeholder="Ej: Empuje Pesado" />
                    
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <ToggleSwitch checked={saveTemplate} onChange={setSaveTemplate} label="Guardar también como Plantilla" />
                        <p className="text-[9px] text-slate-500 mt-2 ml-1">Aparecerá en "Mis Plantillas" para repetirla otro día.</p>
                    </div>

                    <div className="pt-4 flex flex-col gap-2">
                        <button onClick={() => onConfirm(name, saveTemplate)} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase rounded shadow-lg shadow-amber-900/20 transition">Guardar en Historial</button>
                        <button onClick={onDiscard} className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold uppercase rounded border border-red-900/50 transition">Descartar (Borrar todo)</button>
                        <button onClick={onCancel} className="w-full py-3 text-slate-400 font-bold hover:text-white transition">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// SECCIÓN 5: COMPONENTES IRON CMDR (CORE)
// ==========================================

const ActiveSession = ({ sessionData, updateSessionData, onFinishMission, onDiscardSession, mode, history, customExercises, setCustomExercises, barUnit, showNotify }) => {
    
    // Si la sesión data por algún motivo viene vacía, no crasheamos.
    if (!sessionData) return null;

    const safeInitialExercises = Array.isArray(sessionData.exercises) ? sessionData.exercises : [];
    const [localExercises, setLocalExercises] = useState(safeInitialExercises);
    const [loadingTipId, setLoadingTipId] = useState(null); 
    const [standardizingId, setStandardizingId] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [warmupPlan, setWarmupPlan] = useState(null);
    const [nutritionPlan, setNutritionPlan] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [showExSelector, setShowExSelector] = useState(false);
    const [editingExId, setEditingExId] = useState(null);
    const [selectedExHistory, setSelectedExHistory] = useState(null);
    const [showFinishModal, setShowFinishModal] = useState(false);

    const isFirstRender = useRef(true);

    // Auto-Guardado continuo
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        updateSessionData({ ...sessionData, exercises: localExercises });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const getSuggestion = (baseWeight) => {
        if (!mode || mode.id === 'standard') return null;
        if (!baseWeight || baseWeight <= 0) return `Fase: ${mode.sets}x${mode.repRange} @ RPE ${mode.rpe}`;
        const wMod = parseFloat(mode.weightMod) || 1.0;
        const targetWeight = (parseFloat(baseWeight) * wMod).toFixed(1);
        return `Sug: ${targetWeight}${barUnit} | ${mode.sets}x${mode.repRange} @ RPE ${mode.rpe}`;
    };

    const getTacticalTip = async (exerciseName, exId) => {
      setLoadingTipId(exId);
      const prompt = `Consejo táctico de 1 frase para "${exerciseName}". Tono militar.`;
      try {
        const tip = await callGeminiAPI(prompt);
        if (tip) setAnalysisResult({ title: "Tip Táctico", content: tip });
      } catch (e) { console.error(e); } finally { setLoadingTipId(null); }
    };

    const standardizeName = async (currentName, exId) => {
        setStandardizingId(exId);
        const prompt = `Standardize this gym exercise name to Spanish (common universal term). Example: "brench pres" -> "Press Banca con Barra". Input: "${currentName}". Output ONLY the name.`;
        try {
            const standardized = await callGeminiAPI(prompt);
            if (standardized) setLocalExercises(prev => prev.map(e => e.id === exId ? { ...e, name: standardized.trim() } : e));
        } catch (e) { console.error(e); } finally { setStandardizingId(null); }
    };

    const suggestAlternative = async (currentName, exId) => {
        setStandardizingId(exId); 
        const prompt = `Sugiere UN ejercicio alternativo de gimnasio para "${currentName}" que trabaje el mismo grupo muscular principal. Devuelve SOLO el nombre del ejercicio en Español.`;
        try {
            const alternative = await callGeminiAPI(prompt);
            if (alternative) setLocalExercises(prev => prev.map(e => e.id === exId ? { ...e, name: alternative.trim() } : e));
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
        if (editingExId !== null) {
            setLocalExercises(prev => prev.map(e => e.id === editingExId ? { ...e, name: exName } : e));
        } else {
            setLocalExercises([...localExercises, { id: Date.now(), name: exName, equipment: 'barbell', sets: [{weight:0, reps:0, rpe:0, type: 'normal'}] }]);
        }
        setShowExSelector(false);
    };

    const updateEquipment = (exId, eqId) => {
        setLocalExercises(prev => prev.map(e => e.id === exId ? { ...e, equipment: eqId } : e));
    };

    const addSet = (exId) => { setLocalExercises(prev => prev.map(e => e.id === exId ? { ...e, sets: [...(Array.isArray(e.sets) ? e.sets : []), { weight: 0, reps: 0, rpe: 0, type: 'normal' }] } : e)); };
    const removeSet = (exId, idx) => { setLocalExercises(prev => prev.map(e => { if (e.id === exId) { const newSets = [...(Array.isArray(e.sets) ? e.sets : [])]; newSets.splice(idx, 1); return { ...e, sets: newSets }; } return e; })); };
    const updateSet = (exId, idx, field, val) => { setLocalExercises(prev => prev.map(e => { if (e.id === exId) { const newSets = [...(Array.isArray(e.sets) ? e.sets : [])]; newSets[idx] = { ...newSets[idx], [field]: val }; return { ...e, sets: newSets }; } return e; })); };
    
    const cycleSetType = (exId, idx) => { 
        const types = Object.keys(SET_TYPES); 
        setLocalExercises(prev => prev.map(e => { 
            if (e.id === exId) { 
                const newSets = [...(Array.isArray(e.sets) ? e.sets : [])]; 
                const currentTypeKey = Object.keys(SET_TYPES).find(key => SET_TYPES[key].id === (newSets[idx]?.type || 'normal')) || 'NORMAL'; 
                const currentIndex = types.indexOf(currentTypeKey); 
                const nextTypeKey = types[(currentIndex + 1) % types.length]; 
                newSets[idx] = { ...newSets[idx], type: SET_TYPES[nextTypeKey].id }; 
                return { ...e, sets: newSets }; 
            } 
            return e; 
        })); 
    };

    return (
        <div className="animate-fade-in pb-24 pt-4">
            
            {analysisResult && <InfoModal data={analysisResult} onClose={() => setAnalysisResult(null)} />}
            {warmupPlan && <InfoModal data={warmupPlan} onClose={() => setWarmupPlan(null)} />}
            {nutritionPlan && <InfoModal data={nutritionPlan} onClose={() => setNutritionPlan(null)} />}
            {isAnalyzing && (<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"><Loader2 size={48} className="text-amber-500 animate-spin mb-4" /><p className="text-amber-500 font-mono font-bold animate-pulse">PROCESANDO INTELIGENCIA...</p></div>)}

            {showExSelector && (
                <ExerciseSelectorModal 
                    onClose={() => setShowExSelector(false)} 
                    onSelect={handleSelectExercise} 
                    customExercises={customExercises}
                    setCustomExercises={setCustomExercises}
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
                    sessionName={sessionData.name}
                    onConfirm={(name, saveAsTemplate) => onFinishMission(name, localExercises, saveAsTemplate)}
                    onDiscard={onDiscardSession}
                    onCancel={() => setShowFinishModal(false)}
                />
            )}

            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <button onClick={() => showNotify("Autoguardado. Usa la barra inferior para moverte sin perder datos.", "info")} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors" title="Información"><Info size={20} className="text-sky-400" /></button>
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
                    const suggestion = getSuggestion(safeSets[0]?.weight || 0);
                    const details = getExerciseDetails(ex.name);
                    const prevPerformance = getPreviousPerformance(ex.name);

                    return (
                    <div key={ex.id || index} className="relative pl-4">
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
                                        <button onClick={() => { setEditingExId(ex.id); setShowExSelector(true); }} className="text-left font-bold text-white text-lg leading-tight truncate hover:text-amber-500 transition-colors" title="Cambiar Ejercicio">
                                            {ex.name || 'Ejercicio Desconocido'}
                                        </button>
                                        
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <div className="relative">
                                                <select value={ex.equipment || 'barbell'} onChange={(e) => updateEquipment(ex.id, e.target.value)} className="appearance-none bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2 py-1 pr-6 rounded border border-slate-600 focus:outline-none focus:border-amber-500 cursor-pointer">
                                                    {EQUIPMENT_TYPES.map(eq => <option key={eq.id} value={eq.id}>{eq.label}</option>)}
                                                </select>
                                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                            {suggestion && (<span className={`text-[10px] flex items-center gap-1 ${mode?.color || 'text-slate-400'}`}><Info size={10} /> {suggestion}</span>)}
                                            
                                            {/* Etiqueta de Rendimiento Previo */}
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
                                      <button onClick={() => standardizeName(ex.name, ex.id)} className="p-1.5 text-slate-500 hover:text-purple-400 rounded hover:bg-slate-700" title="Corregir Nombre (IA)">{standardizingId === ex.id ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}</button>
                                      <button onClick={() => suggestAlternative(ex.name, ex.id)} className="p-1.5 text-slate-500 hover:text-green-400 rounded hover:bg-slate-700" title="Variante (IA)">{standardizingId === ex.id ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}</button>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <button onClick={() => toggleSuperset(index)} className={`p-1.5 rounded transition ${isSupersetTop ? 'text-amber-500 bg-amber-900/20' : 'text-slate-600 hover:text-amber-500 hover:bg-slate-700'}`}><LinkIcon size={14} /></button>
                                    <button onClick={() => getTacticalTip(ex.name, ex.id)} className="p-1.5 rounded text-slate-500 hover:text-purple-400 hover:bg-slate-700">{loadingTipId === ex.id ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}</button>
                                    <button onClick={() => setLocalExercises(prev => prev.filter(e => e.id !== ex.id))} className="p-1.5 rounded text-slate-600 hover:text-red-500 hover:bg-slate-700"><Trash2 size={14} /></button>
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
                                    <div key={i} className={`grid grid-cols-12 gap-2 mb-2 items-center rounded px-1 py-1 ${setType.bg}`}>
                                        <div className="col-span-1 text-center text-xs text-slate-500 font-bold">{i+1}</div>
                                        <div className="col-span-2 flex justify-center"><button onClick={() => cycleSetType(ex.id, i)} className={`text-[9px] font-bold px-1 rounded border border-white/10 w-full h-full ${setType.color}`}>{setType.label || '-'}</button></div>
                                        <input type="number" value={s.weight === 0 ? '' : s.weight} onChange={(e) => updateSet(ex.id, i, 'weight', e.target.value)} className="col-span-3 bg-slate-900 border border-slate-700 rounded p-1 text-center text-amber-500 font-bold" placeholder="0" />
                                        <input type="number" value={s.reps === 0 ? '' : s.reps} onChange={(e) => updateSet(ex.id, i, 'reps', e.target.value)} className="col-span-3 bg-slate-900 border border-slate-700 rounded p-1 text-center text-white" placeholder="0" />
                                        <input type="number" value={s.rpe === 0 ? '' : s.rpe} onChange={(e) => updateSet(ex.id, i, 'rpe', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-700 rounded p-1 text-center text-slate-400 text-xs" placeholder="-" />
                                        <button onClick={() => removeSet(ex.id, i)} className="col-span-1 text-slate-700 hover:text-red-500 flex justify-center"><X size={12} /></button>
                                    </div>
                                )})}
                                <button onClick={() => addSet(ex.id)} className="w-full py-1 mt-1 text-xs text-slate-500 border border-dashed border-slate-700 rounded hover:text-amber-500 hover:border-amber-500 transition">+ Serie</button>
                            </div>
                        </div>
                    </div>
                )})}
            </div>

            <div className="mt-6 flex flex-col gap-2">
                <div className="flex gap-2">
                    <button onClick={() => { setEditingExId(null); setShowExSelector(true); }} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-lg font-bold text-sm uppercase border border-slate-700 hover:bg-slate-700 transition">+ Ejercicio</button>
                    <button onClick={analyzeSession} className="px-4 py-3 bg-slate-800 text-purple-400 rounded-lg font-bold text-sm uppercase border border-slate-700 hover:bg-slate-700 hover:text-purple-300 transition flex items-center justify-center gap-2"><ClipboardList size={18} /> Analizar ✨</button>
                </div>
                <button onClick={() => setShowFinishModal(true)} className="w-full py-3 bg-amber-600 text-black rounded-lg font-bold text-sm uppercase shadow-lg shadow-amber-900/20 hover:bg-amber-500 transition">Finalizar Misión</button>
            </div>
            
            <div className="h-16"></div>
        </div>
    );
};

// ==========================================
// SECCIÓN 6: APP PRINCIPAL (CONTENEDOR)
// ==========================================

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
  
  const [activeSession, setActiveSession] = useState(null); 

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

  // --- PERSISTENCE ---
  useEffect(() => {
    const savedData = localStorage.getItem('IronSuiteDataV11');
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
    localStorage.setItem('IronSuiteDataV11', JSON.stringify({ 
        routines, modes, activeModeId, inventory, barWeight, customExercises, history, activeSession, activeTab, timestamp: new Date().toISOString() 
    }));
  }, [routines, modes, activeModeId, inventory, barWeight, customExercises, history, activeSession, activeTab]);

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

  const confirmDeleteRoutine = () => { if (routineToDelete) { setRoutines(prev => prev.filter(r => r.id !== routineToDelete)); setRoutineToDelete(null); } };
  const duplicateRoutine = (e, routine) => { e.stopPropagation(); const newRoutine = { ...routine, id: `routine-${Date.now()}`, name: `${routine.name || 'Rutina'} (Copia)`, lastPerformed: null }; setRoutines(prev => [...(Array.isArray(prev) ? prev : []), newRoutine]); showNotify("Plantilla Clonada", "success"); };

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
        const cleanJson = textResponse.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(cleanJson);
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
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-full font-bold text-xs shadow-xl animate-fade-in-down flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 border border-sky-500 text-sky-400'}`}>
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
                    <span className="text-[10px] text-amber-500 font-mono tracking-widest">SUITE V10.0</span>
                </div>
            </div>
            
            <div className="flex gap-2">
                {!isTraining && activeTab === 'routines' && (
                   <>
                    <button onClick={() => setShowAIModal(true)} className="p-2 text-purple-400 hover:bg-slate-800 rounded-lg border border-slate-800 hover:border-purple-500/50 transition"><BrainCircuit size={20} /></button>
                    <button onClick={() => setShowImportModal(true)} className="p-2 text-green-400 hover:bg-slate-800 rounded-lg border border-slate-800 hover:border-green-500/50 transition"><FileText size={20} /></button>
                   </>
                )}
                <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-white transition-colors"><Settings className="w-5 h-5" /></button>
            </div>
        </div>
        
        {/* Periodization Selector (Only in Routines Dashboard) */}
        {!isTraining && activeTab === 'routines' && (
            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800">
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
                            <Plus size={12} /> Nueva Plantilla
                        </button>
                    </div>
                    <div className="space-y-3">
                        {safeRoutines.map(routine => (
                            <div key={routine.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-500 transition relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-white text-lg">{routine.name || 'Plantilla Sin Nombre'}</h4>
                                        <p className="text-xs text-slate-500 font-mono">{Array.isArray(routine.exercises) ? routine.exercises.length : 0} Ejercicios</p>
                                    </div>
                                    <button onClick={() => startRoutineFromTemplate(routine)} className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-black hover:bg-amber-500 shadow-lg shadow-amber-900/20" title="Iniciar esta rutina"><Play fill="currentColor" size={16} className="ml-0.5" /></button>
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
                {safeHistory.length === 0 ? (
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
                )}
            </div>
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
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 relative ${isActive ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
                {isActive && (<span className="absolute -top-1 w-12 h-1 bg-amber-500 rounded-b-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>)}
                <Icon className={`w-6 h-6 ${isActive ? 'scale-110 drop-shadow-lg' : 'scale-100'} transition-transform`} />
                <span className="text-[9px] font-bold uppercase tracking-wide">{tab.label}</span>
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
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><FileText className="text-green-500" /> Importar (IA)</h3>{!isImporting && <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white"><X /></button>}</div>
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