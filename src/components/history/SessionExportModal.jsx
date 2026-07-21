import { useState, useEffect } from 'react';
import { X, Copy, Check, Brain, Clock, ThumbsUp } from 'lucide-react';
import { generateSessionReport } from '../../utils/sessionExport';
import { getActiveBlocks, getSessionCountsByBlock } from '../../db/blocks';
import { db } from '../../db/database';

const SUB_MODES = [
  {
    id: 'C1',
    icon: Brain,
    label: 'Análisis profundo',
    description: 'Qué subió, qué bajó, qué duele, qué ajustar',
    pedidoText: 'Análisis profundo de esta sesión: progresión por ejercicio, flags de RPE, y recomendaciones para la próxima sesión.',
  },
  {
    id: 'C2',
    icon: Clock,
    label: 'Check-in corto',
    description: 'Esto pasó, qué toca después',
    pedidoText: 'Check-in corto: confirma si la sesión estuvo acorde al plan y qué toca en la próxima.',
  },
  {
    id: 'C3',
    icon: ThumbsUp,
    label: 'Validación rápida',
    description: '¿Estuvo bien o flojo?',
    pedidoText: 'Validación rápida: ¿la sesión estuvo bien ejecutada o fue floja? Una línea.',
  },
];

export const SessionExportModal = ({ open, onClose, session }) => {
  const [selectedMode, setSelectedMode] = useState('C2');
  const [editedText, setEditedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !session) return;
    setLoading(true);

    Promise.all([
      getActiveBlocks().catch(() => []),
      db.history.toArray().catch(() => []),
      getSessionCountsByBlock().catch(() => new Map()),
    ]).then(([blocks, allSessions, blockSessionCounts]) => {
      const mode = SUB_MODES.find(m => m.id === selectedMode) || SUB_MODES[1];
      const report = generateSessionReport(session, {
        blocks,
        allSessions,
        pedidoText: mode.pedidoText,
        blockSessionCounts,
      });
      setEditedText(report);
      setLoading(false);
    });
  }, [open, session, selectedMode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Clipboard error', e);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />

      <div
        className="relative w-full max-w-lg max-h-[92vh] bg-slate-950 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Compartir con coach</h2>
            <p className="text-xs text-slate-500">
              {session.name || 'Sesión'} · {(session.completedAt || '').slice(0, 10) || '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sub-mode selector */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              ¿Qué querés del coach?
            </div>
            <div className="space-y-2">
              {SUB_MODES.map(mode => {
                const Icon = mode.icon;
                const isSelected = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-blue-400 shrink-0 mt-0.5' : 'text-slate-500 shrink-0 mt-0.5'} />
                    <div className="flex-1 text-left">
                      <div className={`text-sm font-bold ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                        {mode.label}
                      </div>
                      <div className="text-[11px] text-slate-500">{mode.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editable report */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              Reporte (editable)
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-500 text-sm bg-slate-900 rounded-lg border border-slate-700">
                Generando...
              </div>
            ) : (
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                className="w-full h-64 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-100 resize-none"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm">
            Cancelar
          </button>
          <button
            onClick={handleCopy}
            disabled={loading}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar reporte'}
          </button>
        </div>
      </div>
    </div>
  );
};
