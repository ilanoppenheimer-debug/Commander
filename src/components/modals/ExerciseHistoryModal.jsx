import React, { useState, useMemo } from "react";
import { X, BarChart2 } from "lucide-react";

const ExerciseHistoryModal = ({ exName, history, onClose, barUnit }) => {
  const [limit, setLimit] = useState(5);

  const pastPerformances = useMemo(() => {
    if (!Array.isArray(history)) return [];

    const matches = [];

    history.forEach((session) => {
      if (!session) return;

      const exData = (session.exercises || []).find(
        (e) =>
          e &&
          String(e.name).toLowerCase() === String(exName).toLowerCase()
      );

      if (exData && Array.isArray(exData.sets) && exData.sets.length > 0) {
        matches.push({
          date: session.completedAt || new Date().toISOString(),
          sessionName: session.name || "Sesión",
          sets: exData.sets,
        });
      }
    });

    return matches.slice(0, limit === "all" ? undefined : limit);
  }, [history, exName, limit]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-sky-400 flex items-center gap-2">
              <BarChart2 size={20} /> Comparativa
            </h2>
            <span className="text-xs text-white uppercase">{exName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex gap-2 overflow-x-auto shrink-0">
          {[5, 10, "all"].map((num) => (
            <button
              key={num}
              onClick={() => setLimit(num)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                limit === num
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {num === "all" ? "Todas" : `Últimas ${num}`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pastPerformances.length > 0 ? (
            pastPerformances.map((perf, idx) => (
              <div
                key={idx}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
              >
                <div className="bg-slate-900/50 p-2 border-b border-slate-700 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                    {perf.sessionName}
                  </span>
                  <span className="text-[10px] text-sky-400 font-mono bg-sky-900/20 px-2 py-0.5 rounded">
                    {new Date(perf.date).toLocaleDateString()}
                  </span>
                </div>

                <div className="p-2 space-y-1">
                  {(perf.sets || []).map((s, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-xs items-center px-2 py-1 rounded bg-slate-900/30"
                    >
                      <span className="text-slate-500 font-mono w-6">
                        {i + 1}.
                      </span>
                      <span className="font-bold text-amber-500">
                        {s?.weight > 0 ? `${s.weight}${barUnit}` : "-"}
                      </span>
                      <span className="text-white w-12 text-center">
                        {s?.reps > 0 ? `${s.reps} reps` : "-"}
                      </span>
                      <span className="text-slate-400 text-[10px] w-8 text-right">
                        {s?.rpe ? `RPE ${s.rpe}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-slate-500 italic">
              No hay registros previos para este ejercicio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseHistoryModal;
