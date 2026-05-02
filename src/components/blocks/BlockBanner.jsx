import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { BlockColorDot } from './BlockColorDot';
import { TAG_LABELS } from '../../constants/blockTemplates';

export const BlockBanner = ({ activeBlocks, fatigueWarnings = {}, onTapBlock }) => {
  const [expanded, setExpanded] = useState(false);

  if (!activeBlocks || activeBlocks.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">Modo libre · sin bloques activos</span>
        <button onClick={() => onTapBlock?.(null)} className="text-[10px] text-accent-400 uppercase tracking-wider font-bold">
          Crear bloque
        </button>
      </div>
    );
  }

  const primary = activeBlocks[0];
  const hasMore = activeBlocks.length > 1;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg mb-3 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2">
        <BlockColorDot color={primary.color} size={10} />
        <span className="text-sm font-medium text-slate-200 flex-1 text-left truncate">
          {primary.name}
          {hasMore && <span className="text-slate-500 ml-1">+{activeBlocks.length - 1}</span>}
        </span>
        <span className="text-xs text-slate-500 tabular-nums">
          {primary.sessionsLogged}/{primary.sessionsTarget ?? '∞'}
        </span>
        {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 divide-y divide-slate-800">
          {activeBlocks.map(block => {
            const fatigue = fatigueWarnings[block.id];
            const tagsLabel = Array.isArray(block.appliesTo)
              ? block.appliesTo.map(t => TAG_LABELS[t] || t).join(' + ')
              : '—';
            return (
              <button
                key={block.id}
                onClick={() => onTapBlock?.(block)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/50 text-left"
              >
                <BlockColorDot color={block.color} size={10} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">{block.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{tagsLabel}</div>
                  {fatigue && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                      <AlertTriangle size={10} />
                      <span>{fatigue.message}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {block.sessionsLogged}/{block.sessionsTarget ?? '∞'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
