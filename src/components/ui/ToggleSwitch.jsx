import React from "react";

export default function ToggleSwitch({ checked, onChange, label }) {
  return (
    <div
      className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-700 cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <span className="text-xs font-bold text-slate-400 ml-1">
        {label}
      </span>

      <div
        className={`w-10 h-5 rounded-full relative transition-colors ${
          checked ? "bg-blue-600" : "bg-slate-600"
        }`}
      >
        <div
          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </div>
    </div>
  );
}