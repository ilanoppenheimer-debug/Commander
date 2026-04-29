import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight, Star } from 'lucide-react';
import Modal from '../ui/Modal';
import { EQUIPMENT_TYPES } from '../../constants/gymConstants';
import { MUSCLE_GROUP_OPTIONS, MOVEMENT_PATTERNS, SCALE_3, saveExerciseMeta, getExerciseMeta } from '../../constants/exerciseMetadata';

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

export default function CreateExerciseModal({ existingName, allExerciseNames = [], onSave, onClose }) {
  const isEdit = !!existingName;
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

  // Duplicate detection
  useEffect(() => {
    if (isEdit) return;
    clearTimeout(debounceRef.current);
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) { setDuplicate({ exact: null, similar: [] }); return; }
    debounceRef.current = setTimeout(() => {
      const exact = allExerciseNames.find(e => e.toLowerCase() === trimmed) || null;
      const similar = exact ? [] : allExerciseNames.filter(e => {
        const el = e.toLowerCase();
        return el.startsWith(trimmed) || el.includes(trimmed) || trimmed.includes(el);
      }).slice(0, 3);
      setDuplicate({ exact, similar });
    }, DEBOUNCE_MS);
  }, [name, allExerciseNames, isEdit]);

  const canSave = (isEdit || (!duplicate.exact && name.trim())) && muscleGroup && equipment;

  const handleSave = () => {
    if (!canSave) return;
    const finalName = isEdit ? existingName : name.trim();
    const meta = { muscleGroup, equipment, bilateral, movementPattern, stability, cnsLoad, injuryRisk, enjoyment, feelConnection, notes, isCustom: !isEdit, createdAt: isEdit ? undefined : new Date().toISOString() };
    saveExerciseMeta(finalName, meta);
    onSave(finalName, meta);
  };

  return (
    <Modal isOpen onClose={onClose} size="md" align="center">
      <div className="bg-slate-900 w-full max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-white text-base">{isEdit ? `Editar: ${existingName}` : 'Nuevo Ejercicio'}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Name */}
          {!isEdit && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre *</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Remo con Cable Bajo"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-accent-500 focus:outline-none"
              />
              {duplicate.exact && (
                <div className="mt-2 flex items-center gap-2 bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2 text-amber-300 text-xs">
                  <span>Ya existe "{duplicate.exact}"</span>
                  <button onClick={() => { onSave(duplicate.exact, null); }} className="ml-auto underline text-accent-400">Usar este</button>
                </div>
              )}
              {!duplicate.exact && duplicate.similar.length > 0 && (
                <div className="mt-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400">
                  ¿Te referís a: {duplicate.similar.map(s => (
                    <button key={s} onClick={() => { onSave(s, null); }} className="text-accent-400 underline ml-1">{s}</button>
                  ))}?
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
              onClick={() => setBilateral(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative ${!bilateral ? 'bg-accent-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${!bilateral ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
            disabled={!canSave || !!duplicate.exact}
            className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-black font-bold text-sm rounded-xl transition"
          >
            {isEdit ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
