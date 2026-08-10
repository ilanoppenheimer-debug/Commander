import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight, Star, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { EQUIPMENT_TYPES } from '../../constants/gymConstants';
import { TAG_LABELS } from '../../constants/blockTemplates';
import { MUSCLE_GROUP_OPTIONS, MOVEMENT_PATTERNS, SCALE_3, saveExerciseMeta, getExerciseMeta } from '../../constants/exerciseMetadata';
import { previewRenameExercise, renameExercise } from '../../utils/exerciseRename';

const DEBOUNCE_MS = 300;

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          className={`text-lg transition ${n <= (value || 0) ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'}`}
        >★</button>
      ))}
    </div>
  );
}

export default function CreateExerciseModal({ existingName, allExerciseNames = [], customExerciseNames = [], onSave, onClose }) {
  const isEdit = !!existingName;
  const isCustomExercise = isEdit && customExerciseNames.includes(existingName);
  // Catalogue exercises (DEFAULT_EXERCISE_DB) are hardcoded arrays, not data — renaming
  // one would drop it out of muscle-group/tab classification with no way to fix that at
  // runtime. Renaming is scoped to custom exercises until that's addressed separately.
  const canRename = isEdit && isCustomExercise;

  const [name, setName] = useState(existingName || '');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('barbell');
  const [bilateral, setBilateral] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [movementPattern, setMovementPattern] = useState(null);
  const [stability, setStability] = useState(null);
  const [cnsLoad, setCnsLoad] = useState(null);
  const [injuryRisk, setInjuryRisk] = useState(null);
  const [enjoyment, setEnjoyment] = useState(null);
  const [feelConnection, setFeelConnection] = useState(null);
  const [notes, setNotes] = useState('');
  const [duplicate, setDuplicate] = useState({ exact: null, similar: [] });

  // Rename confirmation sub-flow: null = normal form; an object = showing the preview
  // screen (sessions/plantillas affected, merge details) awaiting explicit confirm.
  const [renamePreview, setRenamePreview] = useState(null);
  const [renameError, setRenameError] = useState(null);
  const [renameBusy, setRenameBusy] = useState(false);

  const debounceRef = useRef(null);

  // Pre-fill on edit
  useEffect(() => {
    if (isEdit && existingName) {
      const meta = getExerciseMeta(existingName);
      if (meta.muscleGroup) setMuscleGroup(meta.muscleGroup);
      if (meta.equipment) setEquipment(meta.equipment);
      if (meta.bilateral !== undefined) setBilateral(meta.bilateral);
      if (meta.movementPattern) setMovementPattern(meta.movementPattern);
      if (meta.stability) setStability(meta.stability);
      if (meta.cnsLoad) setCnsLoad(meta.cnsLoad);
      if (meta.injuryRisk) setInjuryRisk(meta.injuryRisk);
      if (meta.enjoyment) setEnjoyment(meta.enjoyment);
      if (meta.feelConnection) setFeelConnection(meta.feelConnection);
      if (meta.notes) setNotes(meta.notes);
    }
  }, [isEdit, existingName]);

  // Duplicate detection. In create mode an exact match blocks saving (offers "usar
  // este" instead). In rename mode an exact match is expected and welcome — it's the
  // fusion case — so it's surfaced as information on the confirm screen, not here.
  useEffect(() => {
    if (isEdit && !canRename) return;
    clearTimeout(debounceRef.current);
    const trimmed = name.trim().toLowerCase();
    const isRenameAttempt = isEdit && trimmed !== existingName.toLowerCase();
    if (isEdit && !isRenameAttempt) { setDuplicate({ exact: null, similar: [] }); return; }
    if (!trimmed) { setDuplicate({ exact: null, similar: [] }); return; }
    debounceRef.current = setTimeout(() => {
      const exact = allExerciseNames.find(e => e.toLowerCase() === trimmed) || null;
      const similar = exact ? [] : allExerciseNames.filter(e => {
        const el = e.toLowerCase();
        return el.startsWith(trimmed) || el.includes(trimmed) || trimmed.includes(el);
      }).slice(0, 3);
      setDuplicate({ exact, similar });
    }, DEBOUNCE_MS);
  }, [name, allExerciseNames, isEdit, canRename, existingName]);

  const isRenameAttempt = canRename && name.trim() && name.trim() !== existingName;
  const canSave = isEdit
    ? (isRenameAttempt ? !!name.trim() : true) && muscleGroup && equipment
    : !duplicate.exact && name.trim() && muscleGroup && equipment;

  const buildMeta = () => ({
    muscleGroup,
    equipment,
    bilateral,
    movementPattern,
    stability,
    cnsLoad,
    injuryRisk,
    enjoyment,
    feelConnection,
    notes,
    isCustom: !isEdit,
    createdAt: isEdit ? undefined : new Date().toISOString(),
    muscleGroupOverride: true,
    muscleGroupAssignedAt: new Date().toISOString(),
    muscleGroupAssignedBy: 'user-manual',
    equipmentOverride: true,
    equipmentAssignedAt: new Date().toISOString(),
    equipmentAssignedBy: 'user-manual',
  });

  const handleSave = async () => {
    if (!canSave) return;
    setRenameError(null);

    if (isRenameAttempt) {
      // Persist metadata edits under the OLD name first, so the rename's merge picks
      // up the freshest values as the "source" side, not whatever was there on open.
      saveExerciseMeta(existingName, buildMeta());
      const preview = await previewRenameExercise(existingName, name.trim());
      if (!preview.ok) { setRenameError(preview.reason); return; }
      setRenamePreview(preview);
      return;
    }

    const finalName = isEdit ? existingName : name.trim();
    const meta = buildMeta();
    saveExerciseMeta(finalName, meta);
    onSave(finalName, meta);
  };

  const handleConfirmRename = async () => {
    if (!renamePreview) return;
    setRenameBusy(true);
    setRenameError(null);
    const result = await renameExercise(renamePreview.oldName, renamePreview.newName);
    setRenameBusy(false);
    if (!result.ok) {
      setRenamePreview(null);
      setRenameError(result.reason);
      return;
    }
    onSave(result.to, null);
  };

  const RENAME_ERROR_MESSAGES = {
    'not-custom': 'Este ejercicio es del catálogo — todavía no se puede renombrar.',
    'active-session-conflict': 'Hay una sesión activa que usa este ejercicio. Terminala o descartala antes de renombrar.',
    'backup-failed': 'El backup previo falló, así que no se tocó nada. Probá de nuevo.',
    'empty-name': 'El nombre no puede quedar vacío.',
    'same-name': null,
  };

  if (renamePreview) {
    return (
      <Modal isOpen onClose={onClose} size="md" align="center">
        <div className="bg-slate-900 w-full max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <h2 className="font-bold text-white text-base">Confirmar renombrado</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 text-sm">
            <div className="text-slate-300">
              <span className="text-white font-bold">"{renamePreview.oldName}"</span> pasa a llamarse{' '}
              <span className="text-white font-bold">"{renamePreview.newName}"</span>.
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 space-y-1 text-slate-300 text-xs">
              <div>Sesiones del historial a actualizar: <span className="text-white font-bold">{renamePreview.sessionsAffected}</span></div>
              <div>Plantillas a actualizar: <span className="text-white font-bold">{renamePreview.routinesAffected}</span></div>
            </div>

            {renamePreview.willMerge ? (
              <div className="bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2 text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold"><AlertTriangle size={12} /> Se fusiona con un ejercicio existente</div>
                <div>"{renamePreview.newName}" ya existe — su historial se une al de "{renamePreview.oldName}" bajo un solo nombre.</div>
                {renamePreview.mergedMetaPreview && (
                  <div className="pt-1 text-amber-300/90">
                    Tag: {renamePreview.mergedMetaPreview.defaultTag ? TAG_LABELS[renamePreview.mergedMetaPreview.defaultTag] : '—'}
                    {' · '}Equipo: {renamePreview.mergedMetaPreview.equipment || '—'}
                    {' · '}Favorito: {renamePreview.mergedMetaPreview.favorite ? 'sí' : 'no'}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-xs">
                "{renamePreview.newName}" es un nombre nuevo — no hay fusión, solo se actualiza la etiqueta.
              </div>
            )}

            {renameError && (
              <div className="bg-red-950/30 border border-red-600/40 rounded-lg px-3 py-2 text-red-300 text-xs">
                {RENAME_ERROR_MESSAGES[renameError] || 'No se pudo renombrar.'}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 flex gap-2 shrink-0">
            <button onClick={() => setRenamePreview(null)} disabled={renameBusy} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition">Cancelar</button>
            <button
              onClick={handleConfirmRename}
              disabled={renameBusy}
              className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-black font-bold text-sm rounded-xl transition"
            >
              {renameBusy ? 'Renombrando...' : 'Confirmar renombrado'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} size="md" align="center">
      <div className="bg-slate-900 w-full max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-white text-base">{isEdit ? `Editar: ${existingName}` : 'Nuevo Ejercicio'}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {renameError && (
            <div className="bg-red-950/30 border border-red-600/40 rounded-lg px-3 py-2 text-red-300 text-xs">
              {RENAME_ERROR_MESSAGES[renameError] || 'No se pudo renombrar.'}
            </div>
          )}

          {isEdit && !isCustomExercise && (
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-xs">
              <AlertTriangle size={14} className="shrink-0" />
              Ejercicio de catálogo — renombrar todavía no está disponible para estos.
            </div>
          )}

          {/* Name */}
          {(!isEdit || canRename) && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre *</label>
              <input
                autoFocus={!isEdit}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Remo con Cable Bajo"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-accent-500 focus:outline-none"
              />
              {!isEdit && duplicate.exact && (
                <div className="mt-2 flex items-center gap-2 bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2 text-amber-300 text-xs">
                  <span>Ya existe "{duplicate.exact}"</span>
                  <button onClick={() => { onSave(duplicate.exact, null); }} className="ml-auto underline text-accent-400">Usar este</button>
                </div>
              )}
              {!isEdit && !duplicate.exact && duplicate.similar.length > 0 && (
                <div className="mt-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400">
                  ¿Te referís a: {duplicate.similar.map(s => (
                    <button key={s} onClick={() => { onSave(s, null); }} className="text-accent-400 underline ml-1">{s}</button>
                  ))}?
                </div>
              )}
              {isEdit && isRenameAttempt && duplicate.exact && (
                <div className="mt-2 bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2 text-amber-300 text-xs">
                  Ya existe "{duplicate.exact}" — al guardar se van a fusionar.
                </div>
              )}
            </div>
          )}

          {/* Muscle group */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Grupo muscular *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MUSCLE_GROUP_OPTIONS.map(mg => (
                <button
                  key={mg.id}
                  type="button"
                  onClick={() => setMuscleGroup(mg.id)}
                  className={`py-2 rounded-lg text-xs font-bold transition border ${muscleGroup === mg.id ? 'bg-accent-600 border-accent-500 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                  {mg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Equipamiento *</label>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_TYPES.map(eq => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => setEquipment(eq.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${equipment === eq.id ? 'bg-accent-600 border-accent-500 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bilateral toggle */}
          <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
            <span className="text-sm text-white font-medium">Unilateral</span>
            <button
              type="button"
              role="switch"
              aria-checked={!bilateral}
              onClick={() => setBilateral(v => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${!bilateral ? 'bg-accent-600' : 'bg-slate-700'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${!bilateral ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Advanced accordion */}
          <div className="border border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-white transition"
            >
              Configuración avanzada (opcional)
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {showAdvanced && (
              <div className="p-4 space-y-4 bg-slate-900">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Patrón de movimiento</label>
                  <div className="flex flex-wrap gap-1">
                    {MOVEMENT_PATTERNS.map(mp => (
                      <button key={mp.id} type="button" onClick={() => setMovementPattern(p => p === mp.id ? null : mp.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition border ${movementPattern === mp.id ? 'bg-accent-600 border-accent-500 text-black' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                      >{mp.label}</button>
                    ))}
                  </div>
                </div>
                {[{ label: 'Estabilidad requerida', val: stability, set: setStability }, { label: 'Demanda SNC', val: cnsLoad, set: setCnsLoad }, { label: 'Riesgo de lesión', val: injuryRisk, set: setInjuryRisk }].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">{label}</label>
                    <div className="flex gap-2">
                      {SCALE_3.map(s => (
                        <button key={s.id} type="button" onClick={() => set(v => v === s.id ? null : s.id)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${val === s.id ? `${s.color} bg-slate-700 border-current` : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                        >{s.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cuánto te gusta</label>
                  <StarRating value={enjoyment} onChange={setEnjoyment} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Conexión mente-músculo</label>
                  <StarRating value={feelConnection} onChange={setFeelConnection} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Notas</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Técnica, cuidados, notas..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-accent-500 focus:outline-none resize-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!canSave || (!isEdit && !!duplicate.exact)}
            className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-black font-bold text-sm rounded-xl transition"
          >
            {isRenameAttempt ? 'Continuar' : isEdit ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
