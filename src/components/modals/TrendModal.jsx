import React, { useMemo } from "react";
import { X, TrendingUp } from "lucide-react";
import { calculate1RM } from "../../utils/strengthMath";
import { formatNum } from "../../utils/weightUtils";

const TrendModal = ({ exName, history, barUnit, onClose }) => {
  const chartData = useMemo(() => {
    if (!exName || !Array.isArray(history)) return [];

    const dataPoints = [];
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
    );

    sortedHistory.forEach((session) => {
      if (!session || !Array.isArray(session.exercises)) return;

      const exData = session.exercises.find(
        (e) =>
          e &&
          String(e.name).toLowerCase() === String(exName).toLowerCase()
      );

      if (exData && Array.isArray(exData.sets) && exData.sets.length > 0) {
        let max1RM = 0;
        let topWeight = 0;

        exData.sets.forEach((s) => {
          const weight = parseFloat(s.weight) || 0;
          const reps = parseFloat(s.reps) || 0;
          const rpe = parseFloat(s.rpe) || 10;

          if (weight > 0 && reps > 0) {
            const est1RM = calculate1RM(weight, reps, rpe, "epley");
            if (est1RM > max1RM) max1RM = est1RM;
            if (weight > topWeight) topWeight = weight;
          }
        });

        if (max1RM > 0) {
          dataPoints.push({
            date: new Date(session.completedAt),
            shortDate: new Date(session.completedAt).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" }
            ),
            est1RM: formatNum(max1RM),
            topWeight: formatNum(topWeight),
          });
        }
      }
    });

    return dataPoints;
  }, [history, exName]);

  const renderChart = () => {
    if (chartData.length < 2) {
      return (
        <div className="h-48 flex items-center justify-center text-slate-500 text-sm italic">
          Insuficientes datos para gráfica (Mínimo 2 sesiones).
        </div>
      );
    }

    const padding = 20;
    const width = 300;
    const height = 150;

    const minRM = Math.min(...chartData.map((d) => parseFloat(d.est1RM)));
    const maxRM = Math.max(...chartData.map((d) => parseFloat(d.est1RM)));
    const range = maxRM - minRM === 0 ? 1 : maxRM - minRM;

    const points = chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((parseFloat(d.est1RM) - minRM) / range) * (height - padding * 2);
      return { x, y, ...d };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

    return (
      <div className="w-full mt-4 overflow-x-auto pb-4">
        <div className="min-w-[300px] h-48 bg-slate-900 rounded-xl border border-slate-700 p-2 relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <line
              x1={padding}
              y1={padding}
              x2={width - padding}
              y2={padding}
              stroke="#334155"
              strokeDasharray="4"
            />
            <line
              x1={padding}
              y1={height / 2}
              x2={width - padding}
              y2={height / 2}
              stroke="#334155"
              strokeDasharray="4"
            />
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="#334155"
              strokeDasharray="4"
            />

            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#a855f7"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#0f172a"
                  stroke="#a855f7"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={p.y - 10}
                  fill="#94a3b8"
                  fontSize="8"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {p.est1RM}
                </text>
                <text
                  x={p.x}
                  y={height}
                  fill="#64748b"
                  fontSize="7"
                  textAnchor="middle"
                >
                  {p.shortDate}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2">
              <TrendingUp size={20} /> Progreso 1RM
            </h2>
            <p className="text-white text-sm font-bold mt-1">{exName}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {renderChart()}

        {chartData.length > 0 && (
          <div className="mt-4 bg-purple-900/20 p-4 rounded-xl border border-purple-500/30 text-center">
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest block mb-1">
              Mejor 1RM Proyectado
            </span>
            <span className="text-3xl font-black text-white">
              {Math.max(...chartData.map((d) => parseFloat(d.est1RM)))}{" "}
              <span className="text-sm text-purple-500">{barUnit}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendModal;
