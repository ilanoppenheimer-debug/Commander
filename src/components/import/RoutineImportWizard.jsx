import { useState, useCallback } from 'react';
import { X, AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, Play, Save, FileText, Layers } from 'lucide-react';
import Modal from '../ui/Modal';
import { parseRoutineMarkdown } from '../../utils/routineImport/parser';
import { matchRoutineExercises } from '../../utils/routineImport/exerciseMatching';
import { convertImportedToRoutine, findExistingTemplate, createExerciseFromImport } from '../../utils/routineImport/converter';
import { getAllBlocks, getSessionCountsByBlock, upsertBlockFromCoach } from '../../db/blocks';
import { db } from '../../db/database';

// ── Steps: paste → preview → success ─────────────────────────────────────────

export default function RoutineImportWizard({ onClose, onSaved, onStartSession }) {
  const [step,       setStep]       = useState('paste');
  const [text,       setText]       = useState('');
  const [parsed,     setParsed]     = useState(null);
  const [warnings,   setWarnings]   = useState([]);
  const [mappings,   setMappings]   = useState({});
  const [overrides,  setOverrides]  = useState({});   // name → resolved name
  const [existing,   setExisting]   = useState(null); // existing template if name clash
  const [saveMode,   setSaveMode]   = useState('new'); // 'new' | 'replace' | 'temporary'
  const [processing, setProcessing] = useState(false);
  const [expandedEx,       setExpandedEx]       = useState(null);
  const [saved,            setSaved]            = useState(null);
  const [existingBlock,    setExistingBlock]    = useState(null);
  const [existingBlockSessionCount, setExistingBlockSessionCount] = useState(0);
  const [blockImportResult,setBlockImportResult]= useState(null);

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;
    setProcessing(true);
    try {
      const result = parseRoutineMarkdown(text);
      if (!result.success) {
        setWarnings(result.errors);
        setParsed(null);
        return;
      }
      const parseWarnings = [...(result.warnings || [])];

      const { mappings: m } = await matchRoutineExercises(result.routine);
      setMappings(m);
      const existing = await findExistingTemplate(result.routine);
      setExisting(existing);
      setSaveMode(existing ? 'replace' : 'new');

      // Block preview lookup (read-only)
      let matchedBlock = null;
      if (result.routine.blockMeta?.coachId) {
        const allBlocks = await getAllBlocks();
        matchedBlock = allBlocks.find(b => b.coachId === result.routine.blockMeta.coachId) || null;
      }
      setExistingBlock(matchedBlock);

      if (matchedBlock) {
        const counts = await getSessionCountsByBlock();
        setExistingBlockSessionCount(counts.get(matchedBlock.id) || 0);

        // Non-blocking alert: this sesion_num was already used by a saved session
        // of this same block. Aviso, no bloqueo — the user decides.
        if (result.routine.sessionNum != null) {
          const priorHistory = await db.history.toArray();
          const dup = priorHistory.find(s =>
            Array.isArray(s.blockIds) && s.blockIds.includes(matchedBlock.id) &&
            s.sessionNum === result.routine.sessionNum
          );
          if (dup) {
            parseWarnings.push(
              `Ya existe una sesión ${result.routine.sessionNum} de este bloque (${dup.name || 'sin nombre'}, ${(dup.completedAt || '').slice(0, 10)}) — ¿el número es correcto?`
            );
          }
        }
      } else {
        setExistingBlockSessionCount(0);
      }

      setWarnings(parseWarnings);
      setParsed(result.routine);
      setStep('preview');
    } catch (e) {
      setWarnings([`Error inesperado: ${e.message}`]);
    } finally {
      setProcessing(false);
    }
  }, [text]);

  const handleImport = useCallback(async () => {
    if (!parsed) return;
    setProcessing(true);
    try {
      // Create unmatched exercises first
      const unmatched = parsed.exercises.filter(ex => {
        const m = mappings[ex.name];
        return !overrides[ex.name] && (!m || m.type === 'none');
      });
      for (const ex of unmatched) {
        await createExerciseFromImport(ex);
      }

      const routineToSave = saveMode === 'replace' && existing
        ? { ...parsed, _replaceTargetId: existing.id }
        : parsed;

      const routine = await convertImportedToRoutine(routineToSave, mappings, overrides, saveMode);

      // Block import — after routine is saved, best-effort (never reverts routine)
      let blockResult = null;
      if (parsed.blockMeta) {
        try {
          blockResult = await upsertBlockFromCoach(parsed.blockMeta);
        } catch (e) {
          setWarnings(prev => [...prev, `Bloque no procesado: ${e.message}`]);
        }
      }

      setSaved(routine);
      setBlockImportResult(blockResult);
      setStep('success');
      if (saveMode !== 'temporary') onSaved?.(routine);
    } catch (e) {
      setWarnings(prev => [...prev, `Error guardando: ${e.message}`]);
    } finally {
      setProcessing(false);
    }
  }, [parsed, mappings, overrides, saveMode, existing, onSaved]);

  const handleStartNow = useCallback(async () => {
    if (!parsed) return;
    setProcessing(true);
    try {
      const unmatched = parsed.exercises.filter(ex => {
        const m = mappings[ex.name];
        return !overrides[ex.name] && (!m || m.type === 'none');
      });
      for (const ex of unmatched) {
        await createExerciseFromImport(ex);
      }
      const routine = await convertImportedToRoutine(parsed, mappings, overrides, 'temporary');

      // Block import — non-blocking: session start takes priority if it fails
      if (parsed.blockMeta) {
        upsertBlockFromCoach(parsed.blockMeta).catch(() => {});
      }

      onStartSession?.(routine);
      onClose();
    } catch (e) {
      setWarnings(prev => [...prev, `Error: ${e.message}`]);
    } finally {
      setProcessing(false);
    }
  }, [parsed, mappings, overrides, onStartSession, onClose]);

  return (
    <Modal isOpen onClose={onClose} size="lg" align="center">
      <div className="bg-slate-900 w-full max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-white flex items-center gap-2">
            <FileText size={18} className="text-accent-400" />
            Importar Rutina v4
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {step === 'paste' && (
            <StepPaste
              text={text}
              setText={setText}
              onParse={handleParse}
              processing={processing}
              warnings={warnings}
            />
          )}
          {step === 'preview' && parsed && (
            <StepPreview
              parsed={parsed}
              warnings={warnings}
              mappings={mappings}
              overrides={overrides}
              setOverrides={setOverrides}
              existing={existing}
              saveMode={saveMode}
              setSaveMode={setSaveMode}
              existingBlock={existingBlock}
              existingBlockSessionCount={existingBlockSessionCount}
              expandedEx={expandedEx}
              setExpandedEx={setExpandedEx}
              onBack={() => setStep('paste')}
              onImport={handleImport}
              onStartNow={handleStartNow}
              processing={processing}
            />
          )}
          {step === 'success' && saved && (
            <StepSuccess
              routine={saved}
              saveMode={saveMode}
              blockImportResult={blockImportResult}
              onStartSession={() => { onStartSession?.(saved); onClose(); }}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Step: Paste ───────────────────────────────────────────────────────────────

function StepPaste({ text, setText, onParse, processing, warnings }) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-slate-400">
        Pegá aquí el output de tu Claude Project (formato Iron Commander v4 con bloque YAML inicial).
      </p>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-lg p-2 text-xs text-red-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={`---\nnombre: TORSO A\nfecha: 2026-05-10\nfoco: Single de aproximación en banca\nduracion_min: 60\n---\n\n# EJERCICIO: Banca Plana\n...`}
        className="w-full h-64 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 font-mono resize-none focus:outline-none focus:border-accent-500/60"
        autoFocus
      />

      <button
        onClick={onParse}
        disabled={!text.trim() || processing}
        className="w-full py-3 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {processing ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
        Procesar
      </button>
    </div>
  );
}

// ── Step: Preview ─────────────────────────────────────────────────────────────

function StepPreview({ parsed, warnings, mappings, overrides, setOverrides, existing, saveMode, setSaveMode, existingBlock, existingBlockSessionCount, expandedEx, setExpandedEx, onBack, onImport, onStartNow, processing }) {
  const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];

  const matchBadge = (exName) => {
    const override = overrides[exName];
    if (override) return { label: override, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-500/30' };
    const m = mappings[exName];
    if (!m || m.type === 'none') return { label: 'Nuevo', color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-500/30' };
    if (m.type === 'exact') return { label: '✓ ' + m.exerciseName, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-500/30' };
    return { label: '≈ ' + m.candidates[0], color: 'text-sky-400', bg: 'bg-sky-900/20 border-sky-500/30' };
  };

  const hasFuzzy = exercises.some(ex => {
    const m = mappings[ex.name];
    return m?.type === 'fuzzy' && !overrides[ex.name];
  });

  return (
    <div className="p-4 space-y-4">
      {/* Metadata */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-1">
        <div className="font-bold text-white text-base">{parsed.name}</div>
        {parsed.focus && <div className="text-xs text-slate-400">{parsed.focus}</div>}
        <div className="flex flex-wrap gap-2 mt-1">
          {parsed.mesociclo && <Chip label={parsed.mesociclo} />}
          {parsed.sessionNum && <Chip label={`S${parsed.sessionNum}${parsed.sessionTotal ? `/${parsed.sessionTotal}` : ''}`} />}
          {parsed.duration && <Chip label={`${parsed.duration} min`} />}
        </div>
        {parsed.contextNotes && (
          <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-3">{parsed.contextNotes}</p>
        )}
      </div>

      {/* Block import panel */}
      {parsed.blockMeta && (
        <div className="bg-sky-900/20 border border-sky-500/30 rounded-xl p-3 space-y-1.5">
          <div className="text-xs text-sky-300 font-bold flex items-center gap-1.5">
            <Layers size={12} />
            Bloque: {parsed.blockMeta.name || parsed.blockMeta.coachId}
          </div>
          <div className="text-[11px] text-sky-200">
            {existingBlock ? (
              <span>
                Se va a <span className="font-bold text-amber-300">ACTUALIZAR</span>
                {parsed.blockMeta.currentWeek != null && ` · semana ${parsed.blockMeta.currentWeek}`}
                {parsed.blockMeta.fase && ` · ${parsed.blockMeta.fase}`}
              </span>
            ) : (
              <span>Se va a <span className="font-bold text-emerald-300">CREAR</span> (nuevo)</span>
            )}
          </div>
          {parsed.blockMeta.closesCoachId && (
            <div className="text-[11px] text-slate-400">
              Cierra el bloque: <span className="text-orange-300 font-bold">{parsed.blockMeta.closesCoachId}</span>
            </div>
          )}
          {existingBlock && (
            <div className="text-[10px] text-slate-500">
              Sesiones registradas: {existingBlockSessionCount} — no se resetea
            </div>
          )}
        </div>
      )}

      {/* Existing template clash */}
      {existing && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-3 space-y-2">
          <div className="text-xs text-amber-300 font-bold flex items-center gap-1">
            <AlertTriangle size={12} /> Plantilla existente: "{existing.name}"
          </div>
          <div className="flex gap-2">
            {[
              { id: 'replace',   label: 'Reemplazar' },
              { id: 'new',       label: 'Nueva plantilla' },
              { id: 'temporary', label: 'Solo iniciar' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setSaveMode(opt.id)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition ${
                  saveMode === opt.id
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.slice(0, 5).map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] text-slate-400">
              <AlertTriangle size={10} className="mt-0.5 shrink-0 text-amber-400" /> {w}
            </div>
          ))}
          {warnings.length > 5 && <p className="text-[10px] text-slate-500 text-center">+{warnings.length - 5} más</p>}
        </div>
      )}

      {/* Exercises */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-1 mb-2">
          Ejercicios ({exercises.length})
        </div>
        {exercises.map((ex, i) => {
          const badge = matchBadge(ex.name);
          const m = mappings[ex.name];
          const isExpanded = expandedEx === ex.name;
          const hasFuzzyEx = m?.type === 'fuzzy' && !overrides[ex.name];

          return (
            <div key={ex.id || i} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedEx(isExpanded ? null : ex.name)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-white text-sm font-medium truncate">{ex.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.bg} ${badge.color}`}>
                    {badge.label.length > 28 ? badge.label.slice(0, 28) + '…' : badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-slate-500">{Array.isArray(ex.sets) ? ex.sets.length : 0} series</span>
                  {hasFuzzyEx && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Sugerencia de mapeo" />}
                  <ChevronDown size={12} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-700 p-3 space-y-2 bg-slate-900/50">
                  {/* Fuzzy match options */}
                  {m?.type === 'fuzzy' && !overrides[ex.name] && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Seleccionar ejercicio:</p>
                      <div className="space-y-1">
                        {m.candidates.slice(0, 4).map(c => (
                          <button
                            key={c}
                            onClick={() => setOverrides(prev => ({ ...prev, [ex.name]: c }))}
                            className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-accent-500/60 transition"
                          >
                            {c}
                          </button>
                        ))}
                        <button
                          onClick={() => setOverrides(prev => ({ ...prev, [ex.name]: ex.name }))}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-slate-500 bg-slate-900 border border-dashed border-slate-700 hover:text-white transition"
                        >
                          Crear como "{ex.name}"
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Override selected */}
                  {overrides[ex.name] && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400">→ {overrides[ex.name]}</span>
                      <button
                        onClick={() => setOverrides(prev => { const n = { ...prev }; delete n[ex.name]; return n; })}
                        className="text-slate-500 hover:text-white transition"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Adaptive decision */}
                  {Array.isArray(ex.decisionAdaptativa) && ex.decisionAdaptativa.length > 0 && (
                    <div className="bg-slate-800 rounded-lg p-2 space-y-1">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Decisión adaptativa</p>
                      {ex.decisionAdaptativa.map((d, di) => (
                        <p key={di} className="text-[10px] text-slate-400">· {d}</p>
                      ))}
                    </div>
                  )}

                  {/* Sets preview */}
                  {Array.isArray(ex.sets) && ex.sets.length > 0 && (
                    <div className="space-y-0.5">
                      {ex.sets.map((s, si) => (
                        <div key={si} className="flex items-center gap-2 text-[10px] text-slate-500 px-1">
                          <span className="w-4 shrink-0 font-mono">{si + 1}</span>
                          <span className={`w-12 shrink-0 font-bold ${s.type === 'warmup' ? 'text-blue-400' : s.type === 'top' ? 'text-amber-400' : 'text-slate-400'}`}>{s.type}</span>
                          <span>{s.weight || '–'}kg</span>
                          <span>×{s.reps || '–'}</span>
                          {s.rpe && <span>@{s.rpe}</span>}
                          {s.notes && <span className="text-[9px] italic truncate">{s.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="space-y-2 pb-2">
        {hasFuzzy && (
          <p className="text-[10px] text-amber-400 text-center flex items-center justify-center gap-1">
            <AlertTriangle size={10} /> Hay ejercicios sin resolver — expandilos para elegir
          </p>
        )}
        <button
          onClick={onImport}
          disabled={processing || saveMode === 'temporary'}
          className="w-full py-3 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {processing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saveMode === 'replace' ? 'Reemplazar plantilla' : 'Guardar como plantilla'}
        </button>
        <button
          onClick={onStartNow}
          disabled={processing}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Play size={14} fill="currentColor" /> Iniciar sin guardar
        </button>
        <button
          onClick={onBack}
          disabled={processing}
          className="w-full py-2 text-slate-500 text-sm hover:text-white transition"
        >
          ← Editar texto
        </button>
      </div>
    </div>
  );
}

// ── Step: Success ─────────────────────────────────────────────────────────────

function StepSuccess({ routine, saveMode, blockImportResult, onStartSession, onClose }) {
  return (
    <div className="p-6 flex flex-col items-center gap-5 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
        <Check size={28} className="text-emerald-400" />
      </div>
      <div>
        <p className="text-white font-bold text-lg">{routine.name}</p>
        <p className="text-slate-400 text-sm mt-1">
          {saveMode === 'replace' ? 'Plantilla reemplazada' : saveMode === 'new' ? 'Plantilla guardada' : 'Lista para iniciar'}
        </p>
      </div>
      {blockImportResult && (
        <div className="w-full bg-sky-900/20 border border-sky-500/30 rounded-xl p-2.5 text-xs text-left space-y-1">
          <div className="text-sky-300 font-bold flex items-center gap-1.5">
            <Layers size={11} />
            Bloque {blockImportResult.action === 'created' ? 'creado' : 'actualizado'}: {blockImportResult.block?.name}
          </div>
          {blockImportResult.closed && (
            <div className="text-slate-400">Cerrado: {blockImportResult.closed.name}</div>
          )}
          {blockImportResult.warnings?.map((w, i) => (
            <div key={i} className="text-amber-400 flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{w}</div>
          ))}
        </div>
      )}
      <div className="w-full space-y-2">
        <button
          onClick={onStartSession}
          className="w-full py-3 bg-accent-600 hover:bg-accent-500 text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition"
        >
          <Play size={16} fill="currentColor" /> Iniciar sesión ahora
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 text-slate-400 text-sm hover:text-white transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Chip({ label }) {
  return (
    <span className="text-[10px] bg-slate-700/60 border border-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full font-mono">
      {label}
    </span>
  );
}
