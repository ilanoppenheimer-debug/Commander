import { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import { TAG_OPTIONS, TAG_LABELS, BLOCK_COLOR_PALETTE } from '../../constants/blockTemplates';
import { upsertBlock, activateBlock, pauseBlock, resumeBlock, completeBlock, smartDeleteBlock } from '../../db/blocks';
import { BlockColorDot } from './BlockColorDot';
import { BlockReportModal } from './BlockReportModal';

export const BlockEditModal = ({ block, onClose, onUpdated }) => {
  const [name,        setName]        = useState(block?.name || '');
  const [appliesTo,   setAppliesTo]   = useState(block?.appliesTo || []);
  const [color,       setColor]       = useState(block?.color || '#f59e0b');
  const [sessionsTarget, setSessionsTarget] = useState(block?.sessionsTarget || '');
  const [unlimited,   setUnlimited]   = useState(block?.sessionsTarget === null);
  const [saving,      setSaving]      = useState(false);
  const [showReport,  setShowReport]  = useState(false);

  useEffect(() => {
    if (block) {
      setName(block.name || '');
      setAppliesTo(block.appliesTo || []);
      setColor(block.color || '#f59e0b');
      setUnlimited(block.sessionsTarget === null);
      setSessionsTarget(block.sessionsTarget ?? '');
    }
  }, [block]);

  if (!block) return null;

  const canEditTags = (block.sessionsLogged || 0) === 0;
  const toggleTag = (tag) => {
    if (!canEditTags) return;
    setAppliesTo(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await upsertBlock({
        ...block,
        name: name.trim() || block.name,
        appliesTo: canEditTags ? appliesTo : block.appliesTo,
        color,
        sessionsTarget: unlimited ? null : (parseInt(sessionsTarget, 10) || null),
      });
      onUpdated?.();
    } finally { setSaving(false); }
  };

  const handleStatusAction = async (action) => {
    if (saving) return;
    setSaving(true);
    try {
      if (action === 'activate')  await activateBlock(block.id);
      if (action === 'pause')     await pauseBlock(block.id);
      if (action === 'resume')    await resumeBlock(block.id);
      if (action === 'complete')  await completeBlock(block.id);
      if (action === 'delete') {
        await smartDeleteBlock(block.id);
      }
      onUpdated?.();
    } finally { setSaving(false); }
  };

  const content = (
    <>
      <div className="fixed inset-0 bg-black/60 z-[58]" onClick={onClose} />
      <div className="fixed inset-x-4 top-[10vh] bottom-[10vh] z-[59] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-w-lg mx-auto">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BlockColorDot color={block.color} size={12} />
            <h2 className="font-bold text-white text-base truncate">{block.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
              block.status === 'active'    ? 'bg-emerald-500/20 text-emerald-300' :
              block.status === 'paused'    ? 'bg-amber-500/20 text-amber-300' :
              block.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
              'bg-slate-700 text-slate-400'
            }`}>{block.status}</span>
            <span className="text-[10px] text-slate-500">
              {block.sessionsLogged}/{block.sessionsTarget ?? '∞'} sesiones
            </span>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 block">Nombre</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-accent-500 focus:outline-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 block">
              Aplica a {!canEditTags && <span className="text-slate-600">(bloqueado con sesiones)</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_OPTIONS.map(tag => (
                <button
                  key={tag} onClick={() => toggleTag(tag)}
                  disabled={!canEditTags}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    appliesTo.includes(tag)
                      ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  } ${!canEditTags ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                <button key={c} onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Sessions target */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 block">Sesiones objetivo</label>
            <div className="flex items-center gap-3">
              <input
                type="number" value={unlimited ? '' : sessionsTarget}
                onChange={e => setSessionsTarget(e.target.value)}
                disabled={unlimited}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:border-accent-500 focus:outline-none disabled:opacity-40"
              />
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <button type="button" onClick={() => setUnlimited(v => !v)}
                  className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${unlimited ? 'bg-accent-600' : 'bg-slate-700'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${unlimited ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                Sin límite
              </label>
            </div>
          </div>

          {/* Block report */}
          {(block.sessionsLogged || 0) > 0 && (
            <div className="border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowReport(true)}
                className="w-full py-2 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl border border-slate-700 transition"
              >
                <FileText size={15} />
                Generar reporte de bloque
              </button>
            </div>
          )}

          {/* Status actions */}
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Acciones</div>
            {block.status === 'draft'    && <button onClick={() => handleStatusAction('activate')} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition">Activar</button>}
            {block.status === 'active'   && <button onClick={() => handleStatusAction('pause')}    className="w-full py-2 bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition">Pausar</button>}
            {block.status === 'paused'   && <button onClick={() => handleStatusAction('resume')}   className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition">Reanudar</button>}
            {['active','paused'].includes(block.status) && (
              <button onClick={() => handleStatusAction('complete')} className="w-full py-2 bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition">Completar bloque</button>
            )}
            <button
              onClick={() => { if (window.confirm('¿Eliminar bloque?')) handleStatusAction('delete'); }}
              className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 font-bold text-sm rounded-xl border border-red-700/40 transition"
            >
              {(block.sessionsLogged || 0) > 0 ? 'Archivar' : 'Eliminar'}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-black font-bold text-sm rounded-xl transition">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {createPortal(content, document.body)}
      {showReport && <BlockReportModal block={block} onClose={() => setShowReport(false)} />}
    </>
  );
};
