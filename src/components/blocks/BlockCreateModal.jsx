import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { createPortal } from 'react-dom';
import { BLOCK_TEMPLATES, TAG_OPTIONS, TAG_LABELS, BLOCK_COLOR_PALETTE, createBlockFromTemplate } from '../../constants/blockTemplates';
import { upsertBlock } from '../../db/blocks';
import { BlockColorDot } from './BlockColorDot';

const PROGRESSION_OPTIONS = [
  { id: 'rpe_based', label: 'Basado en RPE' },
  { id: 'linear',    label: 'Lineal' },
  { id: 'dup',       label: 'DUP' },
  { id: 'none',      label: 'Sin progresión' },
];

const CNS_OPTIONS = ['high', 'medium', 'low'];

export const BlockCreateModal = ({ open, onClose, onCreated }) => {
  const [type,           setType]           = useState('peaking');
  const [name,           setName]           = useState('');
  const [appliesTo,      setAppliesTo]      = useState([]);
  const [color,          setColor]          = useState('#f59e0b');
  const [sessionsTarget, setSessionsTarget] = useState(10);
  const [unlimited,      setUnlimited]      = useState(false);
  const [params,         setParams]         = useState({ ...BLOCK_TEMPLATES.peaking.params });
  const [advancedOpen,   setAdvancedOpen]   = useState(false);
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (open) applyTemplate('peaking');
  }, [open]);

  const applyTemplate = (t) => {
    const tmpl = BLOCK_TEMPLATES[t];
    if (!tmpl) return;
    setType(t);
    setName(tmpl.defaultName);
    setAppliesTo([...tmpl.suggestedTags]);
    setColor(tmpl.defaultColor);
    setUnlimited(tmpl.sessionsTarget === null);
    setSessionsTarget(tmpl.sessionsTarget || 10);
    setParams({ ...tmpl.params });
  };

  const toggleTag = (tag) =>
    setAppliesTo(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const setParam = (key, val) => setParams(prev => ({ ...prev, [key]: val }));
  const setRange = (key, idx, val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setParams(prev => {
      const r = [...(prev[key] || [0, 0])];
      r[idx] = num;
      return { ...prev, [key]: r };
    });
  };

  const canCreate = name.trim() && appliesTo.length > 0;

  const handleCreate = async () => {
    if (!canCreate || saving) return;
    setSaving(true);
    try {
      const block = createBlockFromTemplate(type, {
        name: name.trim(), appliesTo, color,
        sessionsTarget: unlimited ? null : (parseInt(sessionsTarget, 10) || null),
        params,
      });
      block.status = 'active';
      block.startedAt = new Date().toISOString();
      await upsertBlock(block);
      onCreated?.(block);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const content = (
    <>
      <div className="fixed inset-0 bg-black/60 z-[58]" onClick={onClose} />
      <div className="fixed inset-x-4 top-[5vh] bottom-[5vh] z-[59] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-white text-base">Nuevo Bloque</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Type selector */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 block">Tipo</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(BLOCK_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key)}
                  className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                    type === key
                      ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">{t.label}</div>
                  <div className="text-[9px] text-slate-500 leading-tight mt-0.5 truncate">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 block">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-accent-500 focus:outline-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 block">Aplica a *</label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_OPTIONS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                    appliesTo.includes(tag)
                      ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {BLOCK_COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Sessions target */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 block">Sesiones objetivo</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={unlimited ? '' : sessionsTarget}
                onChange={e => setSessionsTarget(e.target.value)}
                disabled={unlimited}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:border-accent-500 focus:outline-none disabled:opacity-40"
              />
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setUnlimited(v => !v)}
                  className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${unlimited ? 'bg-accent-600' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${unlimited ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                Sin límite
              </label>
            </div>
          </div>

          {/* Advanced accordion */}
          <div className="border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-white transition"
            >
              Parámetros avanzados
              {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {advancedOpen && (
              <div className="p-4 space-y-4 bg-slate-900">
                {/* Ranges */}
                {[
                  { key: 'setsRange',      label: 'Series (min/max)' },
                  { key: 'repsRange',      label: 'Reps (min/max)' },
                  { key: 'rpeRange',       label: 'RPE (min/max)' },
                  { key: 'intensityRange', label: '% 1RM (min/max)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">{label}</label>
                    <div className="flex gap-2">
                      {[0, 1].map(idx => (
                        <input
                          key={idx}
                          type="number"
                          value={params[key]?.[idx] ?? ''}
                          onChange={e => setRange(key, idx, e.target.value)}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:border-accent-500 focus:outline-none"
                          placeholder={idx === 0 ? 'Mín' : 'Máx'}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Progression */}
                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Progresión</label>
                  <select
                    value={params.weightProgression || 'none'}
                    onChange={e => setParam('weightProgression', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-500 focus:outline-none"
                  >
                    {PROGRESSION_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>

                {/* Weekly mod */}
                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">
                    Mod. semanal: {((params.weeklyMod || 1) * 100 - 100).toFixed(1)}%
                  </label>
                  <input
                    type="range"
                    min="0.95" max="1.05" step="0.005"
                    value={params.weeklyMod || 1.0}
                    onChange={e => setParam('weeklyMod', parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* CNS Load */}
                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Carga SNC</label>
                  <div className="flex gap-2">
                    {CNS_OPTIONS.map(o => (
                      <button
                        key={o}
                        onClick={() => setParam('cnsLoad', o)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize border transition-colors ${
                          params.cnsLoad === o
                            ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Frecuencia (días/semana)</label>
                  <input
                    type="number" min="1" max="7"
                    value={params.suggestedFrequency || 2}
                    onChange={e => setParam('suggestedFrequency', parseInt(e.target.value, 10) || 2)}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:border-accent-500 focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Notas</label>
                  <textarea
                    rows={2}
                    value={params.notes || ''}
                    onChange={e => setParam('notes', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-accent-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || saving}
            className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-black font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
          >
            {saving ? 'Creando...' : 'Crear y activar'}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};
