import { X } from 'lucide-react';
import { TAG_OPTIONS, TAG_LABELS, TAG_DESCRIPTIONS } from '../../constants/blockTemplates';

export const TagPicker = ({ value, onChange, onClose }) => (
  <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl min-w-[200px]">
    <div className="flex items-center justify-between mb-1 px-1">
      <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Tipo de ejercicio</div>
      {onClose && <button onClick={onClose} className="text-slate-500 hover:text-white p-0.5"><X size={12} /></button>}
    </div>
    <div className="space-y-0.5">
      {TAG_OPTIONS.map(tag => (
        <button
          key={tag}
          onClick={() => { onChange(tag); onClose?.(); }}
          className={`w-full px-3 py-2 text-left rounded-lg transition-colors ${
            value === tag
              ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
              : 'hover:bg-slate-800 text-slate-300 border border-transparent'
          }`}
        >
          <div className="text-sm font-medium">{TAG_LABELS[tag]}</div>
          <div className="text-[10px] text-slate-500 leading-tight">{TAG_DESCRIPTIONS[tag]}</div>
        </button>
      ))}
    </div>
  </div>
);
