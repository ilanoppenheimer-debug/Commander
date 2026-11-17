import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronDown, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { EQUIPMENT_TYPES } from '../../constants/gymConstants';
import { TAG_LABELS } from '../../constants/blockTemplates';
import { MUSCLE_GROUP_OPTIONS, saveExerciseMeta, getExerciseMeta, resolveFamily, resolveMuscleGroup, isUnilateral, tableIsUnilateral, clearMetaFields } from '../../constants/exerciseMetadata';
import { FAMILY_NAMES, familyGroup, familyVariants, getFamilyEntry, offeredEquipment } from '../../constants/exerciseFamilies';
import { scoreCandidates } from '../../utils/routineImport/exerciseMatching';
import { previewRenameExercise, renameExercise } from '../../utils/exerciseRename';
import { sameExercise, normalizeExerciseName } from '../../utils/exerciseName';

const DEBOUNCE_MS = 300;

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
  // A variant of the families table — even if the athlete also has it among his own exercises (created
  // before the table existed): long press only lets him change its FAMILY and its muscle group. The name
  // is the table's identity and stays locked.
  const tableVariantEdit = isEdit && !!getFamilyEntry(existingName);
  const canRename = isEdit && isCustomExercise && !tableVariantEdit;

  const [name, setName] = useState(existingName || '');
  const [muscleGroup, setMuscleGroup] = useState('');
  // No preselected implement: creating requires choosing one. '' = sin definir.
  const [equipment, setEquipment] = useState('');
  // "Unilateral con:" — implements marked as one side at a time (ids). Starts as what the exercise resolves to
  // today (the table, or the athlete's override).
  const [uniMarked, setUniMarked] = useState([]);
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
      const g = resolveMuscleGroup(existingName).group || meta.muscleGroup;
      if (g) setMuscleGroup(g);
      if (meta.equipment) setEquipment(meta.equipment);
      setUniMarked(EQUIPMENT_TYPES.map(e => e.id).filter(e => isUnilateral(existingName, e)));
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

  // The muscle group belongs to the FAMILY. A family of the families table has its group fixed there
  // (read-only here). A family of the athlete's own has the group of its variants: joining it takes that
  // group; editing one of its variants changes the group of ALL of them. Only "Nueva familia" (a family of
  // one) picks a group with chips.
  const selfKey = normalizeExerciseName(isEdit ? existingName : name.trim());
  const familyMembers = useMemo(() => (family ? allExerciseNames.filter(n => normalizeExerciseName(resolveFamily(n)) === normalizeExerciseName(family)) : []), [family, allExerciseNames]);
  const otherMembers = useMemo(() => familyMembers.filter(n => normalizeExerciseName(n) !== selfKey), [familyMembers, selfKey]);
  const tableGroup = family ? familyGroup(family) : undefined;
  const athleteGroup = useMemo(() => {
    if (tableGroup || otherMembers.length === 0) return null;
    const groups = new Set(otherMembers.map(n => resolveMuscleGroup(n).group).filter(Boolean));
    return groups.size === 1 ? [...groups][0] : null;
  }, [tableGroup, otherMembers]);
  const familyGroupValue = tableGroup || athleteGroup || null;
  const groupLocked = !!tableGroup || (!isEdit && !!athleteGroup);
  const wholeFamilyEdit = !tableGroup && otherMembers.length > 0;
  const suggestedEquipment = useMemo(() => {
    if (!family) return [];
    const freq = new Map();
    for (const r of familyVariants(family)) for (const e of r.equipment) freq.set(e, (freq.get(e) || 0) + 1);
    for (const n of familyMembers) { const e = getExerciseMeta(n).equipment; if (e) freq.set(e, (freq.get(e) || 0) + 1); }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  }, [family, familyMembers]);
  // Choosing a family preloads its group (until the athlete picks one himself).
  useEffect(() => {
    if (muscleTouched || !familyGroupValue) return;
    setMuscleGroup(familyGroupValue);
  }, [familyGroupValue, muscleTouched]);

  const shownGroup = groupLocked ? (familyGroupValue || '') : muscleGroup;
  const groupLabel = MUSCLE_GROUP_OPTIONS.find(m => m.id === shownGroup)?.label || shownGroup;

  const isRenameAttempt = canRename && name.trim() && name.trim() !== existingName;
  // Editing an exercise that never had an implement may stay that way (equipment is then
  // simply not written); creating one must pick it.
  const canSave = tableVariantEdit
    ? !!shownGroup
    : isEdit
      ? (isRenameAttempt ? !!name.trim() : true) && !!shownGroup
      : !duplicate.exact && name.trim() && shownGroup && equipment;

  // The family is written ONLY when the athlete chose one different from what the exercise resolves to
  // (edit) or from its own name (create): "Nueva familia: <name>" is already the fallback.
  const familyToWrite = (() => {
    if (!family) return null;
    const base = isEdit ? initialFamily.current : name.trim();
    return normalizeExerciseName(family) !== normalizeExerciseName(base || '') ? family : null;
  })();

  // The advanced fields (patrón, estabilidad, SNC, lesión, gusto, conexión, notas) have no form any more:
  // whatever is stored is carried over as it is, never modified.
  const ADVANCED_FIELDS = ['movementPattern', 'stability', 'cnsLoad', 'injuryRisk', 'enjoyment', 'feelConnection', 'notes'];
  const ownGroupStamp = () => ({ muscleGroup: shownGroup, muscleGroupOverride: true, muscleGroupAssignedAt: new Date().toISOString(), muscleGroupAssignedBy: 'user-manual' });
  // Table family: its group rules, nothing is written. Any other family: the exercise carries the group of
  // the family, and so do all the other variants when it changed.
  const writeFamilyGroup = (selfName) => {
    if (tableGroup || !shownGroup) return;
    for (const n of otherMembers) {
      if (resolveMuscleGroup(n).group !== shownGroup) saveExerciseMeta(n, ownGroupStamp());
    }
    if (getExerciseMeta(selfName).muscleGroup !== shownGroup) saveExerciseMeta(selfName, ownGroupStamp());
  };

  // "Unilateral con:" — the implements the row offers. A variant of the table: the ones it offers. An own
  // exercise: the ones its family suggests plus its own (all of them while there is nothing to go on).
  const uniOptions = (() => {
    if (tableVariantEdit) return offeredEquipment(existingName);
    const ids = new Set([...suggestedEquipment, ...(equipment ? [equipment] : [])]);
    const list = EQUIPMENT_TYPES.map(e => e.id).filter(e => ids.size === 0 || ids.has(e));
    return list;
  })();
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  // The table is the default: what is marked is saved as the athlete's override ONLY when it differs from
  // what the exercise resolves to today; going back to the default drops the override (nothing stays saved).
  const writeUnilateral = (name) => {
    const desired = uniOptions.filter(e => uniMarked.includes(e));
    const current = uniOptions.filter(e => isUnilateral(name, e));
    if (sameSet(desired, current)) return;
    const base = tableVariantEdit ? uniOptions.filter(e => tableIsUnilateral(name, e)) : [];
    const legacyUni = !getFamilyEntry(name) && getExerciseMeta(name).bilateral === false;
    if (sameSet(desired, base) && !legacyUni) clearMetaFields(name, ['unilateral']);
    else saveExerciseMeta(name, { unilateral: desired.length ? desired : false });
  };

  // Keys with no value are left OUT, not set to undefined: saveExerciseMeta merges
  // {...stored, ...data}, so an undefined key would erase what is already stored.
  const buildMeta = () => {
    const stored = isEdit ? getExerciseMeta(existingName) : {};
    const kept = {};
    for (const f of ADVANCED_FIELDS) if (stored[f] !== undefined) kept[f] = stored[f];
    return {
      ...kept,
      ...(equipment ? {
        equipment,
        equipmentOverride: true,
        equipmentAssignedAt: new Date().toISOString(),
        equipmentAssignedBy: 'user-manual',
      } : {}),
      ...(isEdit ? {} : { isCustom: true, createdAt: new Date().toISOString() }),
      ...(familyToWrite ? { family: familyToWrite } : {}),
      ...(!tableGroup && shownGroup ? ownGroupStamp() : {}),
    };
  };

  const handleSave = async () => {
    if (!canSave) return;
    setRenameError(null);

    if (tableVariantEdit) {
      // Only the family (and, when it moves to a family of the athlete's, that family's group).
      if (familyToWrite) saveExerciseMeta(existingName, { family: familyToWrite });
      writeFamilyGroup(existingName);
      writeUnilateral(existingName);
      onSave(existingName, null);
      return;
    }

    if (isRenameAttempt) {
      // Persist metadata edits under the OLD name first, so the rename's merge picks
      // up the freshest values as the "source" side, not whatever was there on open.
      saveExerciseMeta(existingName, buildMeta());
      writeFamilyGroup(existingName);
      writeUnilateral(existingName);
      const preview = await previewRenameExercise(existingName, name.trim());
      if (!preview.ok) { setRenameError(preview.reason); return; }
      setRenamePreview(preview);
      return;
    }

    const finalName = isEdit ? existingName : name.trim();
    const meta = buildMeta();
    saveExerciseMeta(finalName, meta);
    writeFamilyGroup(finalName);
    writeUnilateral(finalName);
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
                    <button type="button" onClick={() => { setDismissedFor(normalizeExerciseName(name)); setFamily(resolveFamily(duplicate.suggest.name)); setMuscleTouched(false); }} className="px-2.5 py-1 rounded-lg bg-slate-700 text-white font-bold">No, es otro</button>
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
            <div className="text-[11px] text-slate-500">Cambia dónde aparece en el selector y de qué grupo es.</div>
          )}

          {/* Muscle group: the family's. Read-only when the family already has one; chips for a new family
              (or to change the group of a family of the athlete's own, which applies to all its variants). */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Grupo muscular{groupLocked ? '' : ' *'}</label>
            {groupLocked ? (
              <div data-testid="group-readonly" className="bg-slate-800/50 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300">
                Grupo: <span className="text-white font-bold">{groupLabel}</span> <span className="text-slate-500">· de la familia</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-1.5">
                  {MUSCLE_GROUP_OPTIONS.map(mg => (
                    <button
                      key={mg.id}
                      type="button"
                      onClick={() => { setMuscleGroup(mg.id); setMuscleTouched(true); }}
                      className={`py-2 rounded-lg text-xs font-bold transition border ${shownGroup === mg.id ? 'bg-accent-600 border-accent-500 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                      {mg.label}
                    </button>
                  ))}
                </div>
                {wholeFamilyEdit && (
                  <div data-testid="group-note" className="mt-2 text-[11px] text-slate-500">Es el grupo de la familia: cambiarlo lo cambia en las {otherMembers.length + 1} variantes.</div>
                )}
              </>
            )}
          </div>

          {!tableVariantEdit && (<>
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

          </>)}

          {/* Unilateral con: implements done one side at a time. Preloaded with what the exercise resolves to. */}
          {uniOptions.length > 0 && (
            <div data-testid="unilateral-row">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Unilateral con:</label>
              <div className="flex flex-wrap gap-1.5">
                {uniOptions.map(id => {
                  const on = uniMarked.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setUniMarked(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${on ? 'bg-accent-600 border-accent-500 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                      {EQUIPMENT_TYPES.find(e => e.id === id)?.label || id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
