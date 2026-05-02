import { MoreVertical, AlertTriangle } from 'lucide-react';
import { BlockColorDot } from './BlockColorDot';
import { TAG_LABELS } from '../../constants/blockTemplates';

export const BlockCard = ({ block, onTap, onMenu, fatigueWarning }) => {
  const progress = block.sessionsTarget
    ? (block.sessionsLogged / block.sessionsTarget) * 100
    : null;
  const targetReached = block.sessionsTarget && block.sessionsLogged >= block.sessionsTarget;
  const tagsLabel = Array.isArray(block.appliesTo)
    ? block.appliesTo.map(t => TAG_LABELS[t] || t).join(' + ')
    : '—';

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <BlockColorDot color={block.color} size={10} />
        <button onClick={() => onTap?.(block)} className="flex-1 text-left">
          <div className="text-sm font-bold text-slate-100">{block.name}</div>
        </button>
        <span className={`text-xs tabular-nums ${targetReached ? 'text-amber-400' : 'text-slate-400'}`}>
          {block.sessionsLogged}/{block.sessionsTarget ?? '∞'}
        </span>
        <button onClick={() => onMenu?.(block)} className="p-1 text-slate-500 hover:text-slate-300">
          <MoreVertical size={14} />
        </button>
      </div>
      <div className="text-[10px] text-slate-500 mb-2">{tagsLabel}</div>
      {progress !== null && (
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.min(100, progress)}%`, backgroundColor: targetReached ? '#f59e0b' : block.color }}
          />
        </div>
      )}
      {fatigueWarning && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle size={12} />
          <span>{fatigueWarning.message}</span>
        </div>
      )}
    </div>
  );
};
