import { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { generateBlockReport } from '../../utils/blockReport';
import { db } from '../../db/database';

export const BlockReportModal = ({ block, onClose }) => {
  const [editedText, setEditedText] = useState('');
  const [copied,     setCopied]     = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!block) return;
    setLoading(true);
    db.history.toArray()
      .then(allHistory => {
        setEditedText(generateBlockReport(block, allHistory));
        setLoading(false);
      })
      .catch(() => {
        setEditedText('Error al cargar el historial.');
        setLoading(false);
      });
  }, [block]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (e.g. non-HTTPS dev environment)
    }
  };

  if (!block) return null;

  const content = (
    <>
      <div className="fixed inset-0 bg-black/70 z-[68]" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-[69] bg-slate-950 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Reporte de bloque</h2>
            <p className="text-xs text-slate-500">{block.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
            Reporte (editable antes de copiar)
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm bg-slate-900 rounded-lg border border-slate-700">
              Compilando...
            </div>
          ) : (
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              className="w-full h-96 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-100 resize-none focus:border-accent-500 focus:outline-none"
            />
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm"
          >
            Cerrar
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
    </>
  );

  return createPortal(content, document.body);
};
