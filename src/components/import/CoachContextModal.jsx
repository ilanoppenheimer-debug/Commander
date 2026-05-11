import { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import Modal from '../ui/Modal';
import { generateCoachContext } from '../../utils/routineImport/contextGenerator';

export default function CoachContextModal({ onClose }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateCoachContext();
      setText(result);
    } catch (e) {
      setError(e?.message || 'Error generando contexto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { generate(); }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="lg" align="center">
      <div className="bg-slate-900 w-full max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-white text-base flex items-center gap-2">
            <span className="text-accent-400">⌨</span> Contexto para Coach
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-white transition"
              title="Regenerar"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="text-accent-400 animate-spin" />
              <p className="text-sm text-slate-400 font-mono">Leyendo datos locales...</p>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
              {error}
            </div>
          ) : (
            <textarea
              readOnly
              value={text}
              className="w-full h-80 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 font-mono resize-none focus:outline-none focus:border-slate-600"
            />
          )}
        </div>

        <div className="p-4 border-t border-slate-800 shrink-0 space-y-2">
          <p className="text-[10px] text-slate-500 text-center">
            Copiá este texto y pegalo en tu Claude Project como contexto antes de pedir la próxima rutina.
          </p>
          <button
            onClick={handleCopy}
            disabled={loading || !!error || !text}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-accent-600 hover:bg-accent-500 text-black disabled:opacity-40'
            }`}
          >
            {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar todo</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
