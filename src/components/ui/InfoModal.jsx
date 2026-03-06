import React from "react";
import { X, ClipboardList } from "lucide-react";

export default function InfoModal({ data, onClose }) {
  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-amber-500 rounded-xl flex flex-col max-h-[85vh] w-full max-w-sm shadow-[0_0_50px_rgba(245,158,11,0.3)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 rounded-full p-1"
        >
          <X size={20} />
        </button>

        <div className="p-6 pb-2 flex-shrink-0">
          <div className="flex items-center gap-3 text-amber-500">
            <ClipboardList size={28} />
            <h3 className="text-lg font-bold uppercase tracking-wider">
              {data.title || "Info"}
            </h3>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto text-slate-300 text-sm leading-relaxed font-mono border-l-2 border-slate-700 ml-6 mb-2">
          <div className="prose prose-invert prose-sm">
            {String(data.content || "")
              .split("\n")
              .map((line, i) => (
                <p key={i} className="mb-1">
                  {line}
                </p>
              ))}
          </div>
        </div>

        <div className="p-6 pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase rounded shadow-lg shadow-amber-900/20"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}