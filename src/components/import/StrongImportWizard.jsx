import React, { useState, useRef, useCallback } from 'react';
import {
  X, Upload, ChevronRight, ChevronLeft, Check, AlertTriangle,
  Loader2, FileText, Dumbbell, LayoutGrid, Zap, CheckSquare, Square,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { parseStrongCSV } from '../../services/strongImporter/csvParser';
import { getUnknownExercises } from '../../services/strongImporter/exerciseDictionary';
import { normalizeStrongData } from '../../services/strongImporter/normalizer';
import { detectRoutines } from '../../services/strongImporter/routineDetector';
import { importToDexie, checkExistingStrongSessions } from '../../services/strongImporter/importer';
import { DEFAULT_EXERCISE_DB } from '../../constants/gymConstants';
import { isSignedIn } from '../../services/googleDriveService';

const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Barra' },
  { id: 'dumbbell', label: 'Mancuernas' },
  { id: 'cable', label: 'Polea' },
  { id: 'machine', label: 'Máquina' },
  { id: 'bodyweight', label: 'Peso Corporal' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'other', label: 'Otro' },
];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i < current ? 'w-2 h-2 bg-accent-500' :
            i === current ? 'w-3 h-3 bg-accent-400 ring-2 ring-accent-500/40' :
            'w-2 h-2 bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

// ── Step 1: File upload ───────────────────────────────────────────────────────
function StepUpload({ onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError('Solo se aceptan archivos .csv');
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const text = await file.text();
      const result = parseStrongCSV(text);
      onParsed(result, text);
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }, [onParsed]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Importar Historial de Strong</h2>
        <p className="text-sm text-slate-400">
          Subí el CSV exportado desde Strong app. Vamos a importar todas tus sesiones,
          detectar tus rutinas habituales, y mapear ejercicios al catálogo en español.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition cursor-pointer ${
          dragging ? 'border-accent-500 bg-accent-500/10' : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
      >
        {parsing ? (
          <>
            <Loader2 size={40} className="text-accent-400 animate-spin" />
            <p className="text-accent-400 font-bold animate-pulse">Analizando filas...</p>
          </>
        ) : (
          <>
            <Upload size={40} className="text-slate-500" />
            <div className="text-center">
              <p className="text-slate-300 font-bold">Arrastrá tu CSV aquí</p>
              <p className="text-slate-500 text-sm mt-1">o hacé click para seleccionar</p>
            </div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest">Solo archivos .csv de Strong</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-950/40 border border-red-700/50 rounded-xl p-4 text-red-300 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-1">Error al leer el CSV</div>
            <div className="text-red-400/80">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Unknown exercise mapping ─────────────────────────────────────────
function StepMapping({ unknowns, customMappings, setCustomMappings }) {
  if (unknowns.length === 0) return null;

  const allNames = [...DEFAULT_EXERCISE_DB].sort();

  const setDecision = (exerciseRaw, decision) => {
    setCustomMappings(prev => ({ ...prev, [exerciseRaw]: decision }));
  };

  const allDecided = unknowns.every(u => customMappings[u.exerciseRaw]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Ejercicios no reconocidos</h2>
        <p className="text-sm text-slate-400">
          Estos ejercicios de Strong no están en el diccionario. Indicá qué hacer con cada uno.
        </p>
      </div>

      {!allDecided && (
        <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2">
          <AlertTriangle size={14} />
          Hay {unknowns.filter(u => !customMappings[u.exerciseRaw]).length} ejercicio(s) sin decisión
        </div>
      )}

      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {unknowns.map(({ exerciseRaw, count }) => {
          const decision = customMappings[exerciseRaw];
          return (
            <div key={exerciseRaw} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-bold text-white">{exerciseRaw}</span>
                  <span className="ml-2 text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{count}× en el CSV</span>
                </div>
                {decision && <Check size={16} className="text-emerald-500 shrink-0" />}
              </div>

              <div className="flex flex-wrap gap-2">
                {['map', 'custom', 'ignore'].map(type => (
                  <button
                    key={type}
                    onClick={() => setDecision(exerciseRaw, { type, name: '', equipment: 'other' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      decision?.type === type
                        ? 'bg-accent-600 border-accent-500 text-black'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                    }`}
                  >
                    {type === 'map' && 'Mapear a existente'}
                    {type === 'custom' && 'Agregar como custom'}
                    {type === 'ignore' && 'Ignorar'}
                  </button>
                ))}
              </div>

              {decision?.type === 'map' && (
                <select
                  value={decision.name}
                  onChange={(e) => setDecision(exerciseRaw, { ...decision, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                >
                  <option value="">— Elegir ejercicio —</option>
                  {allNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}

              {decision?.type === 'custom' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={decision.name}
                    onChange={(e) => setDecision(exerciseRaw, { ...decision, name: e.target.value })}
                    placeholder="Nombre en español"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                  />
                  <select
                    value={decision.equipment}
                    onChange={(e) => setDecision(exerciseRaw, { ...decision, equipment: e.target.value })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                  >
                    {EQUIPMENT_OPTIONS.map(eq => <option key={eq.id} value={eq.id}>{eq.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Routine selection ─────────────────────────────────────────────────
function StepRoutines({ routineCandidates, selectedRoutines, setSelectedRoutines }) {
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (idx) => {
    setSelectedRoutines(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const updateName = (idx, name) => {
    setSelectedRoutines(prev => {
      // We store overridden names in a separate field via a trick:
      // use a Map where values can be { checked: bool, name: string }
      // But since selectedRoutines is a Set of indices, we'll handle naming separately.
      // Names are managed by parent via routineCandidates array mutation.
      return prev;
    });
  };

  if (routineCandidates.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white mb-1">Rutinas detectadas</h2>
        <div className="text-center py-12 text-slate-500">
          <LayoutGrid size={48} className="mx-auto mb-3 opacity-30" />
          <p>No se encontraron rutinas con suficientes repeticiones (mínimo 5 sesiones).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Rutinas detectadas</h2>
        <p className="text-sm text-slate-400">
          Detectamos tus rutinas más repetidas. Marcá cuáles querés convertir en plantillas.
        </p>
      </div>

      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {routineCandidates.map((r, idx) => {
          const isSelected = selectedRoutines.has(idx);
          const isExpanded = expanded.has(idx);
          return (
            <div
              key={idx}
              className={`border rounded-xl transition ${
                isSelected ? 'border-accent-500/60 bg-accent-500/5' : 'border-slate-700 bg-slate-800'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <button onClick={() => toggle(idx)} className="mt-1 shrink-0">
                    {isSelected
                      ? <CheckSquare size={20} className="text-accent-400" />
                      : <Square size={20} className="text-slate-600" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <input
                      value={r.suggestedName}
                      onChange={(e) => {
                        r.suggestedName = e.target.value; // mutate for simplicity
                        setSelectedRoutines(prev => new Set(prev)); // force re-render
                      }}
                      className="w-full bg-transparent font-bold text-white text-sm border-b border-transparent focus:border-accent-500 focus:outline-none pb-0.5 transition"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Repetida <span className="text-slate-300 font-bold">{r.sessionCount}</span> veces
                      &nbsp;·&nbsp;
                      {new Date(r.firstDate).toLocaleDateString()} — {new Date(r.lastDate).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.topExercises.map(ex => (
                        <span key={ex} className="text-[9px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{ex}</span>
                      ))}
                      {r.allExercises.length > 3 && (
                        <span className="text-[9px] text-slate-500 px-1">+{r.allExercises.length - 3} más</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; })}
                    className="text-slate-500 hover:text-white transition shrink-0"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Ejercicios de la plantilla</div>
                  <div className="space-y-1">
                    {r.templateExercises.map(ex => (
                      <div key={ex.name} className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/60 rounded px-3 py-1.5">
                        <span>{ex.name}</span>
                        <span className="text-slate-500">{ex.sets?.length || 0} × {ex.sets?.[0]?.reps || 0} reps</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4: Confirmation ──────────────────────────────────────────────────────
function StepConfirm({ sessionCount, selectedRoutines, routineCandidates, customExCount, driveConnected, existingCount, skipDuplicates, setSkipDuplicates }) {
  const selectedNames = [...selectedRoutines].map(i => routineCandidates[i]?.suggestedName).filter(Boolean);
  const willImport = skipDuplicates ? Math.max(0, sessionCount - existingCount) : sessionCount;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Confirmar importación</h2>
        <p className="text-sm text-slate-400">Revisá el resumen antes de proceder.</p>
      </div>

      <div className="space-y-3">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Sesiones a importar</span>
            <span className="font-bold text-white">{willImport}</span>
          </div>
          {existingCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Ya importadas (duplicados)</span>
              <span className="font-bold text-amber-400">{existingCount}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Plantillas a crear</span>
            <span className="font-bold text-white">{selectedNames.length}</span>
          </div>
          {customExCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Ejercicios custom nuevos</span>
              <span className="font-bold text-white">{customExCount}</span>
            </div>
          )}
        </div>

        {selectedNames.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Plantillas</div>
            <div className="space-y-1">
              {selectedNames.map((name, i) => (
                <div key={i} className="text-sm text-slate-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {existingCount > 0 && (
          <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2 text-amber-300 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Detecté {existingCount} sesiones ya importadas de Strong.</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSkipDuplicates(true)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${skipDuplicates ? 'bg-accent-600 border-accent-500 text-black' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
              >
                Saltar duplicados
              </button>
              <button
                onClick={() => setSkipDuplicates(false)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${!skipDuplicates ? 'bg-amber-600 border-amber-500 text-black' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
              >
                Importar todas de nuevo
              </button>
            </div>
          </div>
        )}

        {driveConnected ? (
          <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-3 text-emerald-400 text-xs">
            <Check size={16} />
            Se creará un backup automático en Google Drive antes de importar.
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/40 rounded-xl p-3 text-amber-400 text-xs">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            Google Drive no está conectado. Se hará backup local solamente.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 5: Progress & result ────────────────────────────────────────────────
function StepResult({ result, error, progress, total, onGoToHistory, onClose }) {
  const isRunning = !result && !error;
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">
          {isRunning ? 'Importando...' : result ? 'Import completado' : 'Algo falló'}
        </h2>
      </div>

      {isRunning && (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 size={48} className="text-accent-400 animate-spin" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Importando sesión {progress} de {total}...</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-900/40 border-2 border-emerald-500 flex items-center justify-center">
              <Check size={32} className="text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
            {[
              { label: 'Sesiones importadas', value: result.sessionsImported },
              { label: 'Sesiones saltadas (duplicados)', value: result.sessionsSkipped },
              { label: 'Plantillas creadas', value: result.routinesCreated },
              { label: 'Ejercicios custom agregados', value: result.customExercisesAdded },
              { label: 'Tiempo total', value: `${(result.durationMs / 1000).toFixed(1)}s` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="font-bold text-white">{value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onGoToHistory}
            className="w-full py-3 bg-accent-600 hover:bg-accent-500 text-black font-bold rounded-xl transition"
          >
            Ver mi historial
          </button>
        </div>
      )}

      {error && (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-4">
            <div className="w-16 h-16 rounded-full bg-red-900/40 border-2 border-red-500 flex items-center justify-center">
              <X size={32} className="text-red-400" />
            </div>
          </div>

          <div className="bg-red-950/30 border border-red-700/40 rounded-xl p-4 space-y-2 text-sm">
            <div className="text-red-300 font-bold">{error}</div>
            <div className="text-red-400/70 text-xs">
              Tus datos previos están intactos. El backup pre-import sigue disponible.
            </div>
          </div>

          <button onClick={onClose} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function StrongImportWizard({ onClose, onGoToHistory }) {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [parseResult, setParseResult] = useState(null);

  // Step 2 state
  const [unknowns, setUnknowns] = useState([]);
  const [customMappings, setCustomMappings] = useState({});

  // Step 3 state
  const [routineCandidates, setRoutineCandidates] = useState([]);
  const [selectedRoutines, setSelectedRoutines] = useState(new Set());

  // Step 4 state
  const [normalizedSessions, setNormalizedSessions] = useState([]);
  const [existingCount, setExistingCount] = useState(0);
  const [driveConnected, setDriveConnected] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Step 5 state
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const totalSteps = 5;

  // Compute custom exercises count for confirmation
  const customExCount = Object.values(customMappings).filter(
    d => d?.type === 'custom' && d.name
  ).length;

  const onParsed = useCallback(async (result) => {
    setParseResult(result);

    // Detect unknowns
    const unk = getUnknownExercises(result.rows);
    setUnknowns(unk);

    if (unk.length > 0) {
      setStep(1);
    } else {
      await advanceToNormalize({}, result);
    }
  }, []);

  const buildCustomMappingsForNormalizer = (mappings) => {
    const out = {};
    for (const [exerciseRaw, decision] of Object.entries(mappings)) {
      if (!decision) continue;
      if (decision.type === 'ignore') {
        out[exerciseRaw] = { ignore: true };
      } else if (decision.type === 'map' && decision.name) {
        out[exerciseRaw] = { name: decision.name, equipment: 'other' };
      } else if (decision.type === 'custom' && decision.name) {
        out[exerciseRaw] = { name: decision.name, equipment: decision.equipment || 'other' };
      }
    }
    return out;
  };

  const advanceToNormalize = useCallback(async (mappings, parsedOverride) => {
    const rows = (parsedOverride || parseResult).rows;
    const normMappings = buildCustomMappingsForNormalizer(mappings || customMappings);
    const sessions = normalizeStrongData(rows, normMappings);
    setNormalizedSessions(sessions);

    const candidates = detectRoutines(sessions);
    setRoutineCandidates(candidates);

    // Pre-select all candidates
    setSelectedRoutines(new Set(candidates.map((_, i) => i)));

    setStep(2);
  }, [parseResult, customMappings]);

  const advanceToConfirm = useCallback(async () => {
    const [existing, drive] = await Promise.all([
      checkExistingStrongSessions(),
      isSignedIn().catch(() => false),
    ]);
    setExistingCount(existing);
    setDriveConnected(drive);
    setStep(3);
  }, []);

  const startImport = useCallback(async () => {
    setStep(4);
    setImportResult(null);
    setImportError(null);
    setProgress(0);
    setProgressTotal(normalizedSessions.length);

    const chosenRoutines = [...selectedRoutines].map(i => routineCandidates[i]).filter(Boolean);

    try {
      const result = await importToDexie(
        normalizedSessions,
        chosenRoutines,
        { skipDuplicates },
        (done, total) => { setProgress(done); setProgressTotal(total); }
      );
      setImportResult(result);
    } catch (e) {
      setImportError(e.message);
    }
  }, [normalizedSessions, selectedRoutines, routineCandidates, skipDuplicates]);

  const canAdvanceStep2 = unknowns.every(u => {
    const d = customMappings[u.exerciseRaw];
    if (!d) return false;
    if (d.type === 'map' && !d.name) return false;
    if (d.type === 'custom' && !d.name) return false;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={step < 4 ? onClose : undefined}
    >
      <div
        className="bg-slate-900 w-full max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl border border-slate-700 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-accent-400" />
            <span className="font-bold text-white text-sm uppercase tracking-wider">Strong Import</span>
          </div>
          <div className="flex items-center gap-4">
            <StepDots current={step} total={totalSteps} />
            {step < 4 && (
              <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 0 && <StepUpload onParsed={onParsed} />}

          {step === 0 && parseResult && (
            <div className="mt-4 bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-4 text-sm text-emerald-300">
              <Check size={16} className="inline mr-2" />
              <strong>{parseResult.workoutCount}</strong> sesiones encontradas,
              &nbsp;<strong>{parseResult.setCount}</strong> sets en total.
            </div>
          )}

          {step === 1 && (
            <StepMapping
              unknowns={unknowns}
              customMappings={customMappings}
              setCustomMappings={setCustomMappings}
            />
          )}

          {step === 2 && (
            <StepRoutines
              routineCandidates={routineCandidates}
              selectedRoutines={selectedRoutines}
              setSelectedRoutines={setSelectedRoutines}
            />
          )}

          {step === 3 && (
            <StepConfirm
              sessionCount={normalizedSessions.length}
              selectedRoutines={selectedRoutines}
              routineCandidates={routineCandidates}
              customExCount={customExCount}
              driveConnected={driveConnected}
              existingCount={existingCount}
              skipDuplicates={skipDuplicates}
              setSkipDuplicates={setSkipDuplicates}
            />
          )}

          {step === 4 && (
            <StepResult
              result={importResult}
              error={importError}
              progress={progress}
              total={progressTotal}
              onGoToHistory={() => { onGoToHistory?.(); onClose(); }}
              onClose={onClose}
            />
          )}
        </div>

        {/* Footer nav */}
        {step < 4 && (
          <div className="p-4 border-t border-slate-800 flex gap-2 shrink-0">
            {step > 0 && step < 4 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 transition"
              >
                <ChevronLeft size={16} /> Atrás
              </button>
            )}

            <div className="flex-1" />

            {/* Step 0: show Continue only after parse */}
            {step === 0 && parseResult && (
              <button
                onClick={() => onParsed(parseResult)}
                className="flex items-center gap-2 px-5 py-2 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl transition"
              >
                Continuar <ChevronRight size={16} />
              </button>
            )}

            {/* Step 1: mapping */}
            {step === 1 && (
              <button
                disabled={!canAdvanceStep2}
                onClick={() => advanceToNormalize(customMappings)}
                className="flex items-center gap-2 px-5 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-black font-bold text-sm rounded-xl transition"
              >
                Continuar <ChevronRight size={16} />
              </button>
            )}

            {/* Step 2: routines */}
            {step === 2 && (
              <>
                <button
                  onClick={() => { setSelectedRoutines(new Set()); advanceToConfirm(); }}
                  className="px-3 py-2 text-slate-400 hover:text-white text-sm font-bold transition"
                >
                  Saltar
                </button>
                <button
                  onClick={advanceToConfirm}
                  className="flex items-center gap-2 px-5 py-2 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl transition"
                >
                  Continuar <ChevronRight size={16} />
                </button>
              </>
            )}

            {/* Step 3: confirm → import */}
            {step === 3 && (
              <button
                onClick={startImport}
                className="flex items-center gap-2 px-6 py-2 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl transition shadow-lg"
              >
                <Zap size={16} /> Importar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
