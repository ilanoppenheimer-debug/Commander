import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const QUICK_TEMPLATES = [
  { label: 'Molestia',        text: 'Molestia leve, monitorear' },
  { label: 'Cambio variante', text: 'Cambié variante por equipo no disponible' },
  { label: 'Máquina ocupada', text: 'Máquina ocupada, usé alternativa' },
  { label: 'PR personal',     text: 'PR personal en este set' },
  { label: 'Set fácil',       text: 'Se sintió muy fácil, RPE menor al anotado' },
  { label: 'Casi falla',      text: 'Casi falla en la última rep' },
];

export const NoteModal = ({ open, onClose, initialText, onSave, title = 'Nota' }) => {
  const [text, setText] = useState(initialText || '');

  useEffect(() => {
    if (open) setText(initialText || '');
  }, [open, initialText]);

  if (!open) return null;

  const handleSave = () => {
    onSave(text.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative w-full max-w-md max-h-[80vh] bg-slate-950 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              Rápido
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  onClick={() => setText(prev => prev ? `${prev}\n${tpl.text}` : tpl.text)}
                  className="px-2 py-1 text-[11px] bg-slate-800 text-slate-300 rounded-md hover:bg-slate-700"
                >
                  + {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              Texto libre
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              placeholder="Notas, observaciones, sensaciones..."
              className="w-full h-32 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 resize-none"
              autoFocus
            />
            <div className="text-[10px] text-slate-600 mt-1">{text.length}/500</div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
          >
            <Save size={16} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
