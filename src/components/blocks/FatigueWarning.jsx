import { AlertTriangle, X } from 'lucide-react';

export const FatigueWarning = ({ warning, onDismiss, onAction }) => {
  if (!warning) return null;
  return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 flex items-start gap-2">
      <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm font-bold text-amber-200">{warning.message}</div>
        {Array.isArray(warning.reasons) && warning.reasons.length > 0 && (
          <ul className="mt-1 text-xs text-amber-300/80">
            {warning.reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        )}
        {onAction && (
          <button onClick={onAction} className="mt-2 text-xs text-amber-400 underline">
            Crear bloque deload
          </button>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-amber-500 hover:text-amber-300 p-0.5">
          <X size={14} />
        </button>
      )}
    </div>
  );
};
