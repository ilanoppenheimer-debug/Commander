import React from "react";
import { Trophy, TrendingUp, TrendingDown, Minus, BarChart2 } from "lucide-react";

const formatNum = (n) => {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n * 10) / 10);
};

const formatDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "-";
  }
};

export default function PostSessionReport({ analysis, barUnit = "kg" }) {
  if (!analysis) return null;

  const { volume, sets, rollingAverage4w, volumeDeltaPct, prs, comparison } =
    analysis;

  const deltaDisplay =
    Number.isFinite(volumeDeltaPct) && rollingAverage4w > 0
      ? volumeDeltaPct
      : null;

  const deltaIcon =
    deltaDisplay === null ? (
      <Minus size={12} />
    ) : deltaDisplay >= 5 ? (
      <TrendingUp size={12} />
    ) : deltaDisplay <= -5 ? (
      <TrendingDown size={12} />
    ) : (
      <Minus size={12} />
    );

  const deltaColor =
    deltaDisplay === null
      ? "text-slate-500"
      : deltaDisplay >= 5
        ? "text-emerald-400"
        : deltaDisplay <= -5
          ? "text-orange-400"
          : "text-slate-400";

  return (
    <div className="space-y-3">
      {prs.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={16} className="text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              {prs.length === 1
                ? "Nuevo PR"
                : `${prs.length} Nuevos PR`}
            </span>
          </div>
          <div className="space-y-1.5">
            {prs.map((pr, i) => (
              <div key={i} className="text-xs text-amber-100/90">
                <span className="font-bold">{pr.exercise}:</span>{" "}
                {pr.records
                  .map((r) =>
                    r.kind === "weight"
                      ? `${r.value}${barUnit} (antes ${r.prev}${barUnit})`
                      : `1RM ${r.value}${barUnit} (antes ${r.prev}${barUnit})`
                  )
                  .join(" · ")}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 size={14} className="text-sky-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Volumen Total
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <div className="text-xl font-bold text-white">
            {formatNum(volume)}
            <span className="text-xs text-slate-500 ml-1">
              {barUnit}·rep
            </span>
          </div>
          <div className="text-[10px] text-slate-500">{sets} series</div>
        </div>
        {rollingAverage4w > 0 && (
          <div
            className={`flex items-center gap-1 text-[10px] mt-1 ${deltaColor}`}
          >
            {deltaIcon}
            <span>
              {deltaDisplay !== null && deltaDisplay >= 0 ? "+" : ""}
              {deltaDisplay === null ? "-" : deltaDisplay.toFixed(0)}% vs promedio 4 sem. ({formatNum(rollingAverage4w)})
            </span>
          </div>
        )}
      </div>

      {comparison && comparison.exerciseComparisons.length > 0 && (
        <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              vs Última ({formatDate(comparison.lastDate)})
            </span>
          </div>
          <div className="space-y-1.5">
            {comparison.exerciseComparisons.map((c, i) => {
              const delta = c.pastTop > 0 ? c.currentTop - c.pastTop : 0;
              const color =
                delta > 0
                  ? "text-emerald-400"
                  : delta < 0
                    ? "text-orange-400"
                    : "text-slate-400";
              const sign = delta > 0 ? "+" : "";
              return (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs border-b border-slate-800 pb-1 last:border-0 last:pb-0"
                >
                  <span className="text-slate-300 truncate pr-2">{c.name}</span>
                  <span className={`${color} font-mono text-[10px] shrink-0`}>
                    {c.currentTop}×{c.currentReps} vs {c.pastTop}×{c.pastReps}
                    {c.pastTop > 0 && (
                      <span className="ml-1 font-bold">
                        ({sign}
                        {delta.toFixed(1)})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
