import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronDown, ChevronRight, Star, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { EQUIPMENT_TYPES } from '../../constants/gymConstants';
import { TAG_LABELS } from '../../constants/blockTemplates';
import { MUSCLE_GROUP_OPTIONS, MOVEMENT_PATTERNS, SCALE_3, saveExerciseMeta, getExerciseMeta, resolveFamily } from '../../constants/exerciseMetadata';
import { FAMILY_NAMES, familyGroup, familyVariants, getFamilyEntry } from '../../constants/exerciseFamilies';
import { scoreCandidates } from '../../utils/routineImport/exerciseMatching';
import { previewRenameExercise, renameExercise } from '../../utils/exerciseRename';
import { sameExercise, normalizeExerciseName } from '../../utils/exerciseName';

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

// Family field: the family the exercise is grouped under in the selector. Default (null) = "Nueva
// familia: <name>" (a family of one). Typing searches the existing families; a text that matches none
// can also be used as a new family. Only grouping: nothing here touches the history.
function FamilyPicker({ value, onChange, options, newLabelName, locked = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = normalizeExerciseName(query);
  const filtered = options.filter(o => !q || normalizeExerciseName(o.name).includes(q));
  const exactTyped = options.some(o => normalizeExerciseName(o.name) === q);
  const shown = value === null ? `Nueva familia: ${newLabelName || '…'}` : value;
  return (
    <div>
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Familia</label>
      <button
        type="button"
        data-testid="family-picker"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white text-left focus:border-accent-500"
      >
        <span className={value === null ? 'text-slate-400 italic' : ''}>{shown}</span>
        <ChevronDown size={14} className="text-slate-500" />
      </button>
      {open && (
        <div className="mt-1 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar familia..."
            className="w-full bg-slate-950 px-3 py-2 text-sm text-white border-b border-slate-800 focus:outline-none"
          />
          <div className="max-h-48 overflow-y-auto">
            {!locked && (
              <button type="button" onClick={() => { onChange(null); setOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
                ▸ Nueva familia: {newLabelName || '…'}
              </button>
            )}
            {filtered.map(o => (
              <button key={o.name} type="button" onClick={() => { onChange(o.name); setOpen(false); setQuery(''); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 ${value === o.name ? 'text-accent-400' : 'text-slate-200'}`}>
                ▸ {o.name} <span className="text-slate-500 text-xs">(existente · {o.count})</span>
              </button>
            ))}
            {query.trim() && !exactTyped && (
              <button type="button" onClick={() => { onChange(query.trim()); setOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 border-t border-slate-800">
                ▸ Nueva familia: {query.trim()}
              </button>
            )}
          </div>
        </div>
      )}
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
  // A variant of the families table (not an exercise of the athlete's own): long press only lets him
  // change its FAMILY — the name and everything else stay as they are.
  const tableVariantEdit = isEdit && !isCustomExercise && !!getFamilyEntry(existingName);

  const [name, setName] = useState(existingName || '');
  const [muscleGroup, setMuscleGroup] = useState('');
  // No preselected implement: creating requires choosing one. '' = sin definir.
  const [equipment, setEquipment] = useState('');
  const [bilateral, setBilateral] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [movementPattern, setMovementPattern] = useState(null);
  const [stability, setStability] = useState(null);
  const [cnsLoad, setCnsLoad] = useState(null);
  const [injuryRisk, setInjuryRisk] = useState(null);
  const [enjoyment, setEnjoyment] = useState(null);
  const [feelConnection, setFeelConnection] = useState(null);
  const [notes, setNotes] = useState('');
  const [duplicate, setDuplicate] = useState({ exact: null, suggest: null });
  // Family: null = "Nueva familia: <name>" (a family of one, nothing is written). In edit mode it starts
  // as the family the exercise resolves to today.
  const [family, setFamily] = useState(() => (existingName ? resolveFamily(existingName) : null));
  const initialFamily = useRef(existingName ? resolveFamily(existingName) : null);
  const [muscleTouched, setMuscleTouched] = useState(false);
  const [dismissedFor, setDismissedFor] = useState(''); // "No, es otro" for this exact text

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
  // este" instead). Besides that, an "¿Es X?" prompt only when the typed name is `probable` or a
  // `fuzzy` whose WHOLE name contains / is contained in an existing one (see scoreCandidates), so a
  // legitimate new variant ("Curl X") is not flooded with prompts. In rename mode an exact match is
  // expected and welcome — it's the fusion case — so it's surfaced as information on the confirm
  // screen, not here.
  useEffect(() => {
    if (isEdit && !canRename) return;
    clearTimeout(debounceRef.current);
    const trimmed = name.trim().toLowerCase();
    const isRenameAttempt = isEdit && trimmed !== existingName.toLowerCase();
    if (isEdit && !isRenameAttempt) { setDuplicate({ exact: null, suggest: null }); return; }
    if (!trimmed) { setDuplicate({ exact: null, suggest: null }); return; }
    debounceRef.current = setTimeout(() => {
      const exact = allExerciseNames.find(e => sameExercise(e, trimmed)) || null;
      let suggest = null;
      if (!exact && !isEdit) {
        const r = scoreCandidates(name.trim(), allExerciseNames);
        if (r.type === 'probable') suggest = { name: r.exerciseName, tier: 'probable' };
        else if (r.type === 'fuzzy' && r.contained.length) suggest = { name: r.contained[0], tier: 'fuzzy' };
      }
      setDuplicate({ exact, suggest });
    }, DEBOUNCE_MS);
  }, [name, allExerciseNames, isEdit, canRename, existingName]);

  // Existing families to pick from: the table's plus the ones the athlete's exercises group under.
  const familyOptions = useMemo(() => {
    const counts = new Map();
    const add = (f, n) => { const k = normalizeExerciseName(f); const c = counts.get(k) || { name: f, count: 0 }; c.count += n; counts.set(k, c); };
    FAMILY_NAMES.forEach(f => add(f, 0));
    for (const n of allExerciseNames) { const f = resolveFamily(n); if (f !== n || counts.has(normalizeExerciseName(f))) add(f, 1); }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [allExerciseNames]);

  // What choosing a family preloads: its muscle group (the table's default, or the one its members agree
  // on) and the implements its variants offer (as suggestions: the equipment stays a single choice).
  const familyMembers = useMemo(() => (family ? allExerciseNames.filter(n => normalizeExerciseName(resolveFamily(n)) === normalizeExerciseName(family)) : []), [family, allExerciseNames]);
  const groupOfFamily = useMemo(() => {
    if (!family) return null;
    const own = familyGroup(family);
    if (own) return own;
    const mates = new Set(familyMembers.map(n => getExerciseMeta(n).muscleGroup).filter(Boolean));
    return mates.size === 1 ? [...mates][0] : null;
  }, [family, familyMembers]);
  const suggestedEquipment = useMemo(() => {
    if (!family) return [];
    const freq = new Map();
    for (const r of familyVariants(family)) for (const e of r.equipment) freq.set(e, (freq.get(e) || 0) + 1);
    for (const n of familyMembers) { const e = getExerciseMeta(n).equipment; if (e) freq.set(e, (freq.get(e) || 0) + 1); }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  }, [family, familyMembers]);
  useEffect(() => {
    if (isEdit || muscleTouched || !groupOfFamily) return;
    setMuscleGroup(groupOfFamily);
  }, [groupOfFamily, isEdit, muscleTouched]);

  const isRenameAttempt = canRename && name.trim() && name.trim() !== existingName;
  // Editing an exercise that never had an implement may stay that way (equipment is then
  // simply not written); creating one must pick it.
  const canSave = tableVariantEdit
    ? true
    : isEdit
      ? (isRenameAttempt ? !!name.trim() : true) && muscleGroup
      : !duplicate.exact && name.trim() && muscleGroup && equipment;

  // The family is written ONLY when the athlete chose one different from what the exercise resolves to
  // (edit) or from its own name (create): "Nueva familia: <name>" is already the fallback.
  const familyToWrite = (() => {
    if (!family) return null;
    const base = isEdit ? initialFamily.current : name.trim();
    return normalizeExerciseName(family) !== normalizeExerciseName(base || '') ? family : null;
  })();

  // Keys with no value are left OUT, not set to undefined: saveExerciseMeta merges
  // {...stored, ...data}, so an undefined key would erase what is already stored.
  const buildMeta = () => ({
    muscleGroup,
    ...(equipment ? {
      equipment,
      equipmentOverride: true,
      equipmentAssignedAt: new Date().toISOString(),
      equipmentAssignedBy: 'user-manual',
    } : {}),
    bilateral,
    movementPattern,
    stability,
    cnsLoad,
    injuryRisk,
    enjoyment,
    feelConnection,
    notes,
    ...(isEdit ? {} : { isCustom: true, createdAt: new Date().toISOString() }),
    ...(familyToWrite ? { family: familyToWrite } : {}),
    muscleGroupOverride: true,
    muscleGroupAssignedAt: new Date().toISOString(),
    muscleGroupAssignedBy: 'user-manual',
  });

  const handleSave = async () => {
    if (!canSave) return;
    setRenameError(null);

    if (tableVariantEdit) {
      // Only the family. Nothing else of the exercise is written.
      if (familyToWrite) saveExerciseMeta(existingName, { family: familyToWrite });
      onSave(existingName, null);
      return;
    }

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
            {renamePreview.caseOnly && (
              <div className="text-xs text-sky-300 bg-sky-900/20 border border-sky-500/30 rounded-lg p-2">
                Solo cambian mayúsculas, tildes o espacios: para la app sigue siendo el mismo ejercicio. Se unifica cómo está escrito en el historial y las rutinas.
              </div>
            )}

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

          {isEdit && !isCustomExercise && !tableVariantEdit && (
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-xs">
              <AlertTriangle size={14} className="shrink-0" />
              Ejercicio de catálogo — renombrar todavía no está disponible para estos.
            </div>
          )}

          {/* Table variant: the name is locked, only the family can change */}
          {tableVariantEdit && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre</label>
              <div data-testid="locked-name" className="w-full bg-slate-800/50 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-500 text-sm">{existingName}</div>
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
              {!isEdit && !duplicate.exact && duplicate.suggest && dismissedFor !== normalizeExerciseName(name) && (
                <div data-testid="es-x" className="mt-2 bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2 text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-1.5"><AlertTriangle size={12} className="shrink-0" /> ¿Es "{duplicate.suggest.name}"?</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { onSave(duplicate.suggest.name, null); }} className="px-2.5 py-1 rounded-lg bg-accent-600 text-black font-bold">Usar existente</button>
                    <button type="button" onClick={() => setDismissedFor(normalizeExerciseName(name))} className="px-2.5 py-1 rounded-lg bg-slate-700 text-white font-bold">No, es otro</button>
                  </div>
                </div>
              )}
              {isEdit && isRenameAttempt && duplicate.exact && (
                <div className="mt-2 bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2 text-amber-300 text-xs">
                  Ya existe "{duplicate.exact}" — al guardar se van a fusionar.
                </div>
              )}
            </div>
          )}

          {/* Family: preloads the muscle group and suggests implements (create); alone in "solo familia" */}
          <FamilyPicker value={family} onChange={(v) => setFamily(v === null && isEdit ? existingName : v)} options={familyOptions} newLabelName={isEdit ? existingName : name.trim()} locked={tableVariantEdit} />
          {tableVariantEdit && (
            <div className="text-[11px] text-slate-500">Solo cambia dónde aparece en el selector.</div>
          )}

          {!tableVariantEdit && (<>
          {/* Muscle group */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Grupo muscular *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MUSCLE_GROUP_OPTIONS.map(mg => (
                <button
                  key={mg.id}
                  type="button"
                  onClick={() => { setMuscleGroup(mg.id); setMuscleTouched(true); }}
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
            {suggestedEquipment.length > 0 && (
              <div className="text-[10px] text-slate-500 mb-1.5">Sugeridos por la familia (con borde punteado)</div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {[...EQUIPMENT_TYPES].sort((a, b) => (suggestedEquipment.includes(b.id) ? 1 : 0) - (suggestedEquipment.includes(a.id) ? 1 : 0)).map(eq => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => setEquipment(eq.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${equipment === eq.id ? 'bg-accent-600 border-accent-500 text-black' : `bg-slate-800 text-slate-400 hover:text-white ${suggestedEquipment.includes(eq.id) ? 'border-dashed border-accent-500/60' : 'border-slate-700'}`}`}
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
          </>)}
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
