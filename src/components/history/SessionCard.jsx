import React, { useRef, useState } from 'react';
import { MoreHorizontal, Trash2, Edit3, Eye, Share2, Copy, Download, X } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatSessionAsText, downloadSessionAsJSON, shareSessionNative } from '../../utils/sessionShare';

function relativeDate(isoString) {
  if (!isoString) return '—';
  const now = new Date();
  const d = new Date(isoString);
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
  return `Hace ${Math.floor(diffDays / 365)} año${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
}

function topSet(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const score = (s.weight || 0) * (s.reps || 0);
    const bestScore = (best.weight || 0) * (best.reps || 0);
    if (score > bestScore) return s;
    if (score === bestScore && (s.weight || 0) > (best.weight || 0)) return s;
    return best;
  });
}

function formatSet(set, barUnit = 'kg') {
  if (!set) return '—';
  const w = set.weight > 0 ? `${set.weight}${barUnit}` : 'PC';
  const r = `${set.reps} rep${set.reps !== 1 ? 's' : ''}`;
  const rpe = set.rpe > 0 ? ` @RPE${set.rpe}` : '';
  return `${w} × ${r}${rpe}`;
}

export default function SessionCard({ session, barUnit = 'kg', onClick, onEdit, onDelete }) {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  const visible = exercises.slice(0, 4);
  const extra = exercises.length - 4;
  const totalSets = exercises.reduce((sum, ex) => sum + (Array.isArray(ex?.sets) ? ex.sets.length : 0), 0);

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false));

  const handleCopy = async () => {
    const text = formatSessionAsText(session, barUnit);
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    await shareSessionNative(session, barUnit);
    setShareOpen(false);
  };

  return (
    <div
      className="bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-600 transition cursor-pointer group relative"
      onClick={() => onClick?.(session)}
    >
      {/* Header */}
      <div className="p-4 pb-2 flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-bold text-white text-base leading-tight truncate">
            {session.name || 'Entrenamiento Libre'}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-accent-500 font-mono">
              {relativeDate(session.completedAt)}
            </span>
            <span className="text-[10px] text-slate-600">
              {session.completedAt ? new Date(session.completedAt).toLocaleDateString('es-AR') : ''}
            </span>
          </div>
        </div>
        <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 text-slate-600 hover:text-white rounded-lg hover:bg-slate-700 transition opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-10 w-40 py-1 animate-fade-in">
              <button
                onClick={() => { setMenuOpen(false); onClick?.(session); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Eye size={14} /> Ver detalle
              </button>
              <button
                onClick={() => { setMenuOpen(false); onEdit?.(session); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Edit3 size={14} /> Editar
              </button>
              <button
                onClick={() => { setMenuOpen(false); setShareOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Share2 size={14} /> Compartir
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete?.(session); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition"
              >
                <Trash2 size={14} /> Borrar
              </button>
            </div>
          )}
        </div>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-end justify-center p-4 animate-fade-in" onClick={() => setShareOpen(false)}>
          <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-4 space-y-2 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-white text-sm">Compartir sesión</span>
              <button onClick={() => setShareOpen(false)} className="p-1 text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <button onClick={handleCopy} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white font-medium transition">
              <Copy size={16} className="text-slate-400" /> {copied ? '✓ Copiado!' : 'Copiar como texto'}
            </button>
            {navigator.share && (
              <button onClick={handleNativeShare} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white font-medium transition">
                <Share2 size={16} className="text-slate-400" /> Compartir…
              </button>
            )}
            <button onClick={() => { downloadSessionAsJSON(session); setShareOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white font-medium transition">
              <Download size={16} className="text-slate-400" /> Descargar JSON
            </button>
          </div>
        </div>
      )}

      {/* Exercise list */}
      {visible.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {visible.map((ex, i) => {
            const ts = topSet(ex?.sets);
            return (
              <div key={ex?.id || i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate pr-2 font-medium">{ex?.name || 'Ejercicio'}</span>
                <span className="text-accent-400 font-mono shrink-0 text-[11px]">{formatSet(ts, barUnit)}</span>
              </div>
            );
          })}
          {extra > 0 && (
            <p className="text-[10px] text-slate-600 pt-0.5">+{extra} ejercicio{extra > 1 ? 's' : ''} más</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-700/60 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
          {totalSets} series · {exercises.length} ejercicios
        </span>
        {session.durationSec > 0 && (
          <span className="text-[10px] text-slate-600">
            {Math.round(session.durationSec / 60)} min
          </span>
        )}
      </div>
    </div>
  );
}
