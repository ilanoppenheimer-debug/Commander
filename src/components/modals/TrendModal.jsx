import React, { useMemo, useState } from "react";
import { X, TrendingUp, Share2 } from "lucide-react";
import Modal from "../ui/Modal";
import { buildTrendPoints, hasTrendableEquipment, pickTrendLabels, trendKindFor, REFERENCE_LABEL } from "../../utils/trendData";
import { sendExerciseToCoach, SEND_TO_COACH_MESSAGES } from "../../utils/exerciseHistoryLines";

// equipment (optional): variant to chart; null/absent = by name only (all implements).
// label (optional): how the variant is printed, "Curl de Bíceps · barra"; defaults to the name.
const TrendModal = ({ exName, equipment = null, label, history, barUnit, onClose }) => {
  // Opened from several places (App, 1RM detail) with no notify prop: feedback is local.
  const [feedback, setFeedback] = useState(null);
  const handleSendToCoach = async () => {
    const result = await sendExerciseToCoach(exName, history, equipment);
    const msg = SEND_TO_COACH_MESSAGES[result];
    if (!msg) return;
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };
  // Barbell / dumbbell / smith / landmine are comparable; machine and cable are a reference for that machine only
  // (labelled); bodyweight and timed exercises are not charted here.
  const trendable = hasTrendableEquipment(equipment);
  const chartData = useMemo(
    () => (trendable ? buildTrendPoints(exName, equipment, history) : []),
    [history, exName, equipment, trendable]
  );
  const isReference = useMemo(
    () => trendable && trendKindFor(exName, equipment, history) === 'reference',
    [history, exName, equipment, trendable]
  );

  const renderChart = () => {
    if (!trendable) {
      return (
        <div className="h-48 flex items-center justify-center text-center text-slate-500 text-sm italic px-4">
          Peso corporal y ejercicios por tiempo: por ahora sin Progreso 1RM.
        </div>
      );
    }
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
    // A long history has ~30 points over ~260 units: print only the labels that fit.
    const labels = pickTrendLabels(points.map((p) => p.x), points.map((p) => parseFloat(p.est1RM)));

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
                {labels.value.has(i) && (
                  <text
                    x={p.x}
                    y={p.y - 10}
                    fill="#94a3b8"
                    fontSize="9"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {p.est1RM}
                  </text>
                )}
                {labels.date.has(i) && (
                  <text
                    x={p.x}
                    y={height}
                    fill="#64748b"
                    fontSize="8"
                    textAnchor="middle"
                  >
                    {p.shortDate}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen onClose={onClose} size="2xl">
      <div className="bg-slate-900 w-full max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2">
              <TrendingUp size={20} /> Progreso 1RM
            </h2>
            <p className="text-white text-sm font-bold mt-1">{label || exName}</p>
            {isReference && <p className="text-[11px] text-slate-400 mt-0.5">{REFERENCE_LABEL}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendToCoach}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition"
            >
              <Share2 size={14} /> Enviar al Coach
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-white bg-slate-800 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {feedback && (
          <p className={`text-xs font-bold mb-3 ${feedback[1] === "error" ? "text-red-400" : "text-emerald-400"}`}>{feedback[0]}</p>
        )}

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
    </Modal>
  );
};

export default TrendModal;
